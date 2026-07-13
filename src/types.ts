import type { milky } from '@fraqjs/fraq';

export interface DriftBottleOptions {
  storagePath?: string;
  deleteAfterPick?: boolean;
  moderationModel?: string;
}

export interface DriftBottle {
  id: string;
  senderId: number;
  createdAt: number;
  source: {
    scene: milky.IncomingMessage['message_scene'];
    peerId: number;
  };
  segments: milky.IncomingSegment[];
}

export interface NewDriftBottle {
  senderId: number;
  source: DriftBottle['source'];
  segments: milky.IncomingSegment[];
}
