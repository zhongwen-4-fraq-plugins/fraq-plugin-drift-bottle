import type { MilkyClient, milky } from '@fraqjs/fraq';

import type {
  BottleComment,
  BottleModerationMode,
  BottleOperationRecord,
  BottleSegment,
  BottleSignature,
  DriftBottle,
  NewDriftBottle,
} from '../models/index.js';
import type {
  ApproveModerationRecordResult,
  BottleStore,
  RejectModerationRecordResult,
} from '../persistence/bottle-store.js';
import {
  hasBottleContent,
  hasOnlySupportedBottleSegments,
  loadForwardMessages,
  resolveBottleContent,
  toOutgoingSegments,
} from '../processing/message.js';
import type { BottleModerator, ModerationContext, ModerationTarget } from '../processing/moderation.js';
import { type ModerationRecord, queueBottleForManualReview } from '../processing/moderation-records.js';
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
  | { status: 'pending'; reviewId: string }
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

export type BottleImageResult =
  | { status: 'found'; url: string }
  | { status: 'not-found' | 'not-image' | 'unavailable' };

export class DriftBottleApi {
  constructor(
    private readonly client: MilkyClient,
    private readonly store: BottleStore,
    private readonly moderator: BottleModerator,
    private readonly moderationMode: () => BottleModerationMode = () => 'ai',
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

    const signature = await this.resolveSignature(message);
    const bottleDraft: NewDriftBottle = {
      senderId: message.sender_id,
      displayName: signature.displayName,
      source: {
        scene: message.message_scene,
        peerId: message.peer_id,
      },
      segments,
    };

    if (this.moderationMode() === 'manual') {
      const review = await queueBottleForManualReview(this.store, bottleDraft);
      return { status: 'pending', reviewId: review.id };
    }

    const moderation = await this.moderate(segments, { target: 'bottle-content', bottleDraft });
    if (!moderation.approved) {
      return { status: 'rejected', target: 'content', reason: moderation.reason };
    }

    if (signature.displayName && signature.needsModeration) {
      const signatureModeration = await this.moderate([{ type: 'text', data: { text: signature.displayName } }], {
        target: 'bottle-signature',
        bottleDraft,
      });
      if (!signatureModeration.approved) {
        return { status: 'rejected', target: 'signature', reason: signatureModeration.reason };
      }
    }

    const bottle = await this.store.add(bottleDraft);
    await this.store.addOperationRecord({
      action: 'bottle-created',
      actorId: message.sender_id,
      bottleId: bottle.id,
    });
    return { status: 'created', bottle };
  }

  async pickBottle(userId: number, randomValue?: number): Promise<DriftBottle | undefined> {
    const removeAfterPick = !((await this.store.repeatPickFor(userId)) ?? false);
    const bottle = await this.store.pick(removeAfterPick, randomValue);
    if (bottle) {
      await this.store.addOperationRecord({
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
    if (!(await this.store.hasBottle(bottleId))) {
      return { status: 'not-found' };
    }
    if ([...content].length > 500) {
      return { status: 'too-long' };
    }

    const moderation = await this.moderate([{ type: 'text', data: { text: content } }], {
      target: 'comment-content',
    });
    if (!moderation.approved) {
      return { status: 'rejected', target: 'content', reason: moderation.reason };
    }

    const signature = await this.resolveApprovedSignature(message, 'comment-signature');
    if ('rejected' in signature) {
      return { status: 'rejected', target: 'signature', reason: signature.rejected };
    }

    try {
      const comment = await this.store.addComment({
        bottleId,
        senderId: message.sender_id,
        displayName: signature.displayName,
        content,
      });
      if (comment) {
        await this.store.addOperationRecord({
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

  async commentsFor(bottleId: string, limit = 20): Promise<BottleComments | undefined> {
    if (!(await this.store.hasBottle(bottleId))) {
      return undefined;
    }
    return {
      comments: await this.store.commentsFor(bottleId, limit),
      total: await this.store.commentCount(bottleId),
    };
  }

  commentCountFor(bottleId: string): Promise<number> {
    return this.store.commentCount(bottleId);
  }

  async bottleImage(bottleId: string, segmentIndex: number): Promise<BottleImageResult> {
    const bottle = await this.store.bottle(bottleId);
    if (!bottle) {
      return { status: 'not-found' };
    }
    const segment = bottle.segments[segmentIndex];
    if (segment?.type !== 'image') {
      return { status: 'not-image' };
    }

    let url = segment.data.temp_url;
    if (segment.data.resource_id) {
      try {
        url = (await this.client.get_resource_temp_url({ resource_id: segment.data.resource_id })).url;
      } catch {
        // The stored temporary URL remains a useful fallback when Milky cannot refresh the resource.
      }
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? { status: 'found', url: parsed.toString() }
        : { status: 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    }
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
      await this.store.setSignature(message.sender_id, signature);
      await this.store.addOperationRecord({
        action: 'signature-updated',
        actorId: message.sender_id,
        detail: signature.type,
      });
      return { status: 'updated' };
    }
    if ([...signature.name].length > 20) {
      return { status: 'too-long' };
    }

    const moderation = await this.moderate([{ type: 'text', data: { text: signature.name } }], {
      target: 'profile-signature',
    });
    if (!moderation.approved) {
      return { status: 'rejected', reason: moderation.reason };
    }
    await this.store.setSignature(message.sender_id, signature);
    await this.store.addOperationRecord({
      action: 'signature-updated',
      actorId: message.sender_id,
      detail: signature.type,
    });
    return { status: 'updated' };
  }

  signatureFor(userId: number): Promise<BottleSignature> {
    return this.store.signatureFor(userId);
  }

  hasBottle(id: string): Promise<boolean> {
    return this.store.hasBottle(id);
  }

  isBottleOwner(id: string, userId: number): Promise<boolean> {
    return this.store.isBottleOwner(id, userId);
  }

  async deleteBottle(id: string, actorId?: number): Promise<boolean> {
    const deleted = await this.store.deleteBottle(id);
    if (deleted) {
      await this.store.addOperationRecord({ action: 'bottle-deleted', actorId, bottleId: id });
    }
    return deleted;
  }

  async addModerator(userId: number, actorId?: number): Promise<void> {
    if (await this.store.addModerator(userId)) {
      await this.store.addOperationRecord({ action: 'moderator-added', actorId, targetUserId: userId });
    }
  }

  async removeModerator(userId: number, actorId?: number): Promise<boolean> {
    const removed = await this.store.removeModerator(userId);
    if (removed) {
      await this.store.addOperationRecord({ action: 'moderator-removed', actorId, targetUserId: userId });
    }
    return removed;
  }

  isModerator(userId: number): Promise<boolean> {
    return this.store.isModerator(userId);
  }

  moderators(): Promise<number[]> {
    return this.store.moderators();
  }

  async setRepeatPick(userId: number, enabled?: boolean): Promise<void> {
    await this.store.setRepeatPick(userId, enabled);
    await this.store.addOperationRecord({
      action: 'repeat-pick-updated',
      actorId: userId,
      detail: enabled === undefined ? 'default' : enabled ? 'enabled' : 'disabled',
    });
  }

  repeatPickFor(userId: number): Promise<boolean | undefined> {
    return this.store.repeatPickFor(userId);
  }

  moderationRecords(limit = 100): Promise<ModerationRecord[]> {
    return this.store.moderationRecords(limit);
  }

  pendingModerationRecords(limit = 20, offset = 0): Promise<ModerationRecord[]> {
    return this.store.pendingModerationRecords(limit, offset);
  }

  pendingModerationCount(): Promise<number> {
    return this.store.pendingModerationCount();
  }

  approveModerationRecord(id: string, actorId: number): Promise<ApproveModerationRecordResult> {
    return this.store.approveModerationRecord(id, actorId);
  }

  rejectModerationRecord(id: string, actorId: number, reason: string): Promise<RejectModerationRecordResult> {
    return this.store.rejectModerationRecord(id, actorId, reason);
  }

  operationRecords(limit = 100): Promise<BottleOperationRecord[]> {
    return this.store.operationRecords(limit);
  }

  async add(input: NewDriftBottle): Promise<DriftBottle> {
    const bottle = await this.store.add(input);
    await this.store.addOperationRecord({ action: 'bottle-created', actorId: input.senderId, bottleId: bottle.id });
    return bottle;
  }

  count(): Promise<number> {
    return this.store.count();
  }

  bottles(limit = 20, offset = 0): Promise<DriftBottle[]> {
    return this.store.bottles(limit, offset);
  }

  private async moderate(segments: BottleSegment[], context?: ModerationContext) {
    try {
      return await this.moderator(segments, context);
    } catch (cause) {
      throw new DriftBottleApiError('moderation', { cause });
    }
  }

  private async resolveSignature(message: milky.IncomingMessage): Promise<ResolvedBottleSignature> {
    try {
      return await resolveBottleSignature(this.client, this.store, message);
    } catch (cause) {
      throw new DriftBottleApiError('resolve-signature', { cause });
    }
  }

  private async resolveApprovedSignature(
    message: milky.IncomingMessage,
    target: Extract<ModerationTarget, 'comment-signature'>,
  ): Promise<{ displayName?: string } | { rejected: string }> {
    const signature = await this.resolveSignature(message);
    if (!signature.displayName || !signature.needsModeration) {
      return { displayName: signature.displayName };
    }

    const moderation = await this.moderate([{ type: 'text', data: { text: signature.displayName } }], { target });
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
