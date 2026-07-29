import type { Logger } from '@fraqjs/fraq';

import type { BottleSegment } from '../models/index.js';
import type { BottleStore } from '../persistence/bottle-store.js';
import {
  type BottleModerator,
  formatModerationUsage,
  type ModerationContext,
  type ModerationResult,
} from './moderation.js';

export type ModerationProcess =
  | {
      result: Pick<ModerationResult, 'approved' | 'categories' | 'reason'>;
    }
  | {
      error: {
        name: string;
        message: string;
      };
    };

export interface ModerationRecord {
  id: string;
  createdAt: number;
  content: BottleSegment[];
  process: ModerationProcess;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  success: boolean;
  approved?: boolean;
  target?: ModerationContext['target'];
  bottleDraft?: ModerationContext['bottleDraft'];
  resolution?: 'approved' | 'rejected';
  resolvedBy?: number;
  resolvedAt?: number;
  rejectionReason?: string;
  publishedBottleId?: string;
}

export type NewModerationRecord = Omit<ModerationRecord, 'id' | 'createdAt'>;

export function withModerationRecords(
  store: BottleStore,
  logger: Pick<Logger, 'info'>,
  moderator: BottleModerator,
): BottleModerator {
  return async (segments, context) => {
    let result: ModerationResult;
    try {
      result = await moderator(segments, context);
    } catch (error) {
      store.addModerationRecord({
        content: segments,
        process: { error: describeError(error) },
        success: false,
        ...context,
      });
      throw error;
    }

    store.addModerationRecord({
      content: segments,
      process: {
        result: {
          approved: result.approved,
          categories: result.categories,
          reason: result.reason,
        },
      },
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: result.usage?.totalTokens,
      success: true,
      approved: result.approved,
      ...context,
    });
    if (result.usage) {
      logger.info(formatModerationUsage(result.usage));
    }
    return result;
  };
}

function describeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'Error', message: String(error) };
}
