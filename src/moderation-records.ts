import type { Logger } from '@fraqjs/fraq';

import { type BottleModerator, formatModerationUsage, type ModerationResult } from './moderation.js';
import type { BottleStore } from './storage.js';
import type { BottleSegment } from './types.js';

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
}

export type NewModerationRecord = Omit<ModerationRecord, 'id' | 'createdAt'>;

export function withModerationRecords(
  store: BottleStore,
  logger: Pick<Logger, 'info'>,
  moderator: BottleModerator,
): BottleModerator {
  return async (segments) => {
    let result: ModerationResult;
    try {
      result = await moderator(segments);
    } catch (error) {
      store.addModerationRecord({
        content: segments,
        process: { error: describeError(error) },
        success: false,
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
