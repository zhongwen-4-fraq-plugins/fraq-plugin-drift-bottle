import type { milky } from '@fraqjs/fraq';

export type BottleSegment = Extract<milky.IncomingSegment, { type: 'text' | 'image' | 'video' }>;

export interface DriftBottleOptions {
  storagePath?: string;
  deleteAfterPick?: boolean;
  moderationModel?: string;
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
