import type { Disposable, MilkyClient, milky } from '@fraqjs/fraq';

import type {
  BottleComment,
  BottleOperationRecord,
  BottleSegment,
  BottleSignature,
  DriftBottle,
  NewDriftBottle,
} from '../models/index.js';
import type { BottleStore } from '../persistence/bottle-store.js';
import {
  hasBottleContent,
  hasOnlySupportedBottleSegments,
  loadForwardMessages,
  resolveBottleContent,
  toOutgoingSegments,
} from '../processing/message.js';
import type { BottleModerator } from '../processing/moderation.js';
import type { ModerationRecord } from '../processing/moderation-records.js';
import { type ResolvedBottleSignature, resolveBottleSignature } from '../processing/signature.js';

export type DriftBottleApiErrorCode =
  | 'read-reply'
  | 'read-forward'
  | 'moderation'
  | 'resolve-signature'
  | 'publish-comment';

export class DriftBottleApiError extends Error {
  constructor(
    readonly code: DriftBottleApiErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'DriftBottleApiError';
  }
}

export type CreateBottleResult =
  | { status: 'created'; bottle: DriftBottle }
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'rejected'; target: 'content' | 'signature'; reason: string };

export type PublishCommentResult =
  | { status: 'created'; comment: BottleComment }
  | { status: 'not-found' }
  | { status: 'too-long' }
  | { status: 'rejected'; target: 'content' | 'signature'; reason: string };

export type UpdateSignatureResult =
  | { status: 'updated' }
  | { status: 'too-long' }
  | { status: 'rejected'; reason: string };

export interface BottleComments {
  comments: BottleComment[];
  total: number;
}

export class DriftBottleApi implements Disposable {
  constructor(
    private readonly client: MilkyClient,
    private readonly store: BottleStore,
    private readonly moderator: BottleModerator,
  ) {}

  async createBottle(message: milky.IncomingMessage, content: milky.IncomingSegment[]): Promise<CreateBottleResult> {
    let resolvedContent: milky.IncomingSegment[];
    try {
      resolvedContent = await resolveBottleContent(this.client, content, message);
    } catch (cause) {
      throw new DriftBottleApiError('read-reply', { cause });
    }

    if (!hasBottleContent(resolvedContent)) {
      return { status: 'empty' };
    }
    if (!hasOnlySupportedBottleSegments(resolvedContent)) {
      return { status: 'unsupported' };
    }

    let segments: BottleSegment[];
    try {
      segments = await loadForwardMessages(this.client, resolvedContent);
    } catch (cause) {
      throw new DriftBottleApiError('read-forward', { cause });
    }

    const moderation = await this.moderate(segments);
    if (!moderation.approved) {
      return { status: 'rejected', target: 'content', reason: moderation.reason };
    }

    const signature = await this.resolveApprovedSignature(message);
    if ('rejected' in signature) {
      return { status: 'rejected', target: 'signature', reason: signature.rejected };
    }

    const bottle = await this.store.add({
      senderId: message.sender_id,
      displayName: signature.displayName,
      source: {
        scene: message.message_scene,
        peerId: message.peer_id,
      },
      segments,
    });
    this.store.addOperationRecord({
      action: 'bottle-created',
      actorId: message.sender_id,
      bottleId: bottle.id,
    });
    return { status: 'created', bottle };
  }

  async pickBottle(userId: number, randomValue?: number): Promise<DriftBottle | undefined> {
    const removeAfterPick = !(this.store.repeatPickFor(userId) ?? false);
    const bottle = await this.store.pick(removeAfterPick, randomValue);
    if (bottle) {
      this.store.addOperationRecord({
        action: 'bottle-picked',
        actorId: userId,
        bottleId: bottle.id,
        detail: removeAfterPick ? 'removed' : 'retained',
      });
    }
    return bottle;
  }

  async outgoingSegments(bottle: DriftBottle, userId = 0): Promise<milky.OutgoingSegment_ZodInput[]> {
    return toOutgoingSegments(this.client, bottle.segments, userId);
  }

  async publishComment(
    message: milky.IncomingMessage,
    bottleId: string,
    content: string,
  ): Promise<PublishCommentResult> {
    if (!this.store.hasBottle(bottleId)) {
      return { status: 'not-found' };
    }
    if ([...content].length > 500) {
      return { status: 'too-long' };
    }

    const moderation = await this.moderate([{ type: 'text', data: { text: content } }]);
    if (!moderation.approved) {
      return { status: 'rejected', target: 'content', reason: moderation.reason };
    }

    const signature = await this.resolveApprovedSignature(message);
    if ('rejected' in signature) {
      return { status: 'rejected', target: 'signature', reason: signature.rejected };
    }

    try {
      const comment = this.store.addComment({
        bottleId,
        senderId: message.sender_id,
        displayName: signature.displayName,
        content,
      });
      if (comment) {
        this.store.addOperationRecord({
          action: 'comment-created',
          actorId: message.sender_id,
          bottleId,
        });
      }
      return comment ? { status: 'created', comment } : { status: 'not-found' };
    } catch (cause) {
      throw new DriftBottleApiError('publish-comment', { cause });
    }
  }

  commentsFor(bottleId: string, limit = 20): BottleComments | undefined {
    if (!this.store.hasBottle(bottleId)) {
      return undefined;
    }
    return {
      comments: this.store.commentsFor(bottleId, limit),
      total: this.store.commentCount(bottleId),
    };
  }

  async bottleIdFromReply(
    reply: Extract<milky.IncomingSegment, { type: 'reply' }>,
    message: milky.IncomingMessage,
  ): Promise<string | undefined> {
    const embeddedId = findBottleId(reply.data.segments);
    if (embeddedId) {
      return embeddedId;
    }

    const result = await this.client.get_message({
      message_scene: message.message_scene,
      peer_id: message.peer_id,
      message_seq: reply.data.message_seq,
    });
    return findBottleId(result.message.segments);
  }

  async updateSignature(message: milky.IncomingMessage, signature: BottleSignature): Promise<UpdateSignatureResult> {
    if (signature.type !== 'alias') {
      this.store.setSignature(message.sender_id, signature);
      this.store.addOperationRecord({
        action: 'signature-updated',
        actorId: message.sender_id,
        detail: signature.type,
      });
      return { status: 'updated' };
    }
    if ([...signature.name].length > 20) {
      return { status: 'too-long' };
    }

    const moderation = await this.moderate([{ type: 'text', data: { text: signature.name } }]);
    if (!moderation.approved) {
      return { status: 'rejected', reason: moderation.reason };
    }
    this.store.setSignature(message.sender_id, signature);
    this.store.addOperationRecord({
      action: 'signature-updated',
      actorId: message.sender_id,
      detail: signature.type,
    });
    return { status: 'updated' };
  }

  signatureFor(userId: number): BottleSignature {
    return this.store.signatureFor(userId);
  }

  hasBottle(id: string): boolean {
    return this.store.hasBottle(id);
  }

  isBottleOwner(id: string, userId: number): boolean {
    return this.store.isBottleOwner(id, userId);
  }

  deleteBottle(id: string, actorId?: number): boolean {
    const deleted = this.store.deleteBottle(id);
    if (deleted) {
      this.store.addOperationRecord({ action: 'bottle-deleted', actorId, bottleId: id });
    }
    return deleted;
  }

  addModerator(userId: number, actorId?: number): void {
    if (this.store.addModerator(userId)) {
      this.store.addOperationRecord({ action: 'moderator-added', actorId, targetUserId: userId });
    }
  }

  removeModerator(userId: number, actorId?: number): boolean {
    const removed = this.store.removeModerator(userId);
    if (removed) {
      this.store.addOperationRecord({ action: 'moderator-removed', actorId, targetUserId: userId });
    }
    return removed;
  }

  isModerator(userId: number): boolean {
    return this.store.isModerator(userId);
  }

  moderators(): number[] {
    return this.store.moderators();
  }

  setRepeatPick(userId: number, enabled?: boolean): void {
    this.store.setRepeatPick(userId, enabled);
    this.store.addOperationRecord({
      action: 'repeat-pick-updated',
      actorId: userId,
      detail: enabled === undefined ? 'default' : enabled ? 'enabled' : 'disabled',
    });
  }

  repeatPickFor(userId: number): boolean | undefined {
    return this.store.repeatPickFor(userId);
  }

  moderationRecords(limit = 100): ModerationRecord[] {
    return this.store.moderationRecords(limit);
  }

  pendingModerationRecords(limit = 20, offset = 0): ModerationRecord[] {
    return this.store.pendingModerationRecords(limit, offset);
  }

  pendingModerationCount(): number {
    return this.store.pendingModerationCount();
  }

  operationRecords(limit = 100): BottleOperationRecord[] {
    return this.store.operationRecords(limit);
  }

  async add(input: NewDriftBottle): Promise<DriftBottle> {
    const bottle = await this.store.add(input);
    this.store.addOperationRecord({ action: 'bottle-created', actorId: input.senderId, bottleId: bottle.id });
    return bottle;
  }

  count(): number {
    return this.store.count();
  }

  bottles(limit = 20, offset = 0): DriftBottle[] {
    return this.store.bottles(limit, offset);
  }

  dispose(): void {
    this.store.dispose();
  }

  private async moderate(segments: BottleSegment[]) {
    try {
      return await this.moderator(segments);
    } catch (cause) {
      throw new DriftBottleApiError('moderation', { cause });
    }
  }

  private async resolveApprovedSignature(
    message: milky.IncomingMessage,
  ): Promise<{ displayName?: string } | { rejected: string }> {
    let signature: ResolvedBottleSignature;
    try {
      signature = await resolveBottleSignature(this.client, this.store, message);
    } catch (cause) {
      throw new DriftBottleApiError('resolve-signature', { cause });
    }
    if (!signature.displayName || !signature.needsModeration) {
      return { displayName: signature.displayName };
    }

    const moderation = await this.moderate([{ type: 'text', data: { text: signature.displayName } }]);
    return moderation.approved ? { displayName: signature.displayName } : { rejected: moderation.reason };
  }
}

function findBottleId(segments: milky.IncomingSegment[]): string | undefined {
  for (const segment of segments) {
    if (segment.type !== 'text') {
      continue;
    }
    const match = segment.data.text.match(/ID[：: ]\s*([^\s）)]+)/);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}
