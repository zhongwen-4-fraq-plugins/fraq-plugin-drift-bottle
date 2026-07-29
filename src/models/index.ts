import type { milky } from '@fraqjs/fraq';

export type BottleSegment =
  | Extract<milky.IncomingSegment, { type: 'text' | 'image' | 'video' | 'face' | 'market_face' }>
  | (Extract<milky.IncomingSegment, { type: 'forward' }> & {
      data: { messages?: milky.IncomingForwardedMessage[] };
    });

export type BottleSignature = { type: 'anonymous' } | { type: 'original' } | { type: 'alias'; name: string };

export interface DriftBottleOptions {
  storagePath?: string;
  moderationModel?: string;
  ownerIds?: number[];
  webuiPath?: string;
}

export interface DriftBottle {
  id: string;
  senderId: number;
  createdAt: number;
  displayName?: string;
  source: {
    scene: milky.IncomingMessage['message_scene'];
    peerId: number;
  };
  segments: milky.IncomingSegment[];
}

export interface NewDriftBottle {
  senderId: number;
  displayName?: string;
  source: DriftBottle['source'];
  segments: BottleSegment[];
}

export interface BottleComment {
  id: string;
  bottleId: string;
  senderId: number;
  createdAt: number;
  displayName?: string;
  content: string;
}

export type NewBottleComment = Pick<BottleComment, 'bottleId' | 'senderId' | 'displayName' | 'content'>;

export type BottleOperationAction =
  | 'bottle-created'
  | 'bottle-picked'
  | 'comment-created'
  | 'bottle-deleted'
  | 'signature-updated'
  | 'moderator-added'
  | 'moderator-removed'
  | 'repeat-pick-updated'
  | 'moderation-approved'
  | 'moderation-rejected';

export interface BottleOperationRecord {
  id: string;
  createdAt: number;
  action: BottleOperationAction;
  actorId?: number;
  bottleId?: string;
  targetUserId?: number;
  detail?: string;
}

export type NewBottleOperationRecord = Omit<BottleOperationRecord, 'id' | 'createdAt'>;
