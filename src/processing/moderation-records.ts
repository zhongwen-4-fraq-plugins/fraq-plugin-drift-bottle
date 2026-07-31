import type { Logger } from '@fraqjs/fraq';

import type { BottleSegment, NewDriftBottle } from '../models/index.js';
import type { BottleStore } from '../persistence/bottle-store.js';
import {
  type BottleModerator,
  formatModerationUsage,
  type ModerationContext,
  ModerationFailureError,
  type ModerationResult,
  type ModerationUsage,
} from './moderation.js';

export type ModerationProcess =
  | {
      manual: {
        reason: string;
      };
    }
  | {
      result: Pick<ModerationResult, 'approved' | 'categories' | 'reason'>;
    }
  | {
      error: {
        name: string;
        message: string;
        cause?: { name: string; message: string };
        responseTextSummary?: string;
        finishReason?: string;
        providerWarnings?: string[];
        attempts?: number;
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

export function queueBottleForManualReview(store: BottleStore, bottleDraft: NewDriftBottle): Promise<ModerationRecord> {
  return store.addModerationRecord({
    content: bottleDraft.segments,
    process: { manual: { reason: '等待人工审核' } },
    success: true,
    approved: false,
    target: 'bottle-content',
    bottleDraft,
  });
}

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
      const failure = describeError(error);
      await store.addModerationRecord({
        content: segments,
        process: { error: failure.error },
        inputTokens: failure.usage?.inputTokens,
        outputTokens: failure.usage?.outputTokens,
        totalTokens: failure.usage?.totalTokens,
        success: false,
        ...context,
      });
      throw error;
    }

    await store.addModerationRecord({
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

function describeError(error: unknown): {
  error: Extract<ModerationProcess, { error: unknown }>['error'];
  usage?: ModerationUsage;
} {
  if (error instanceof ModerationFailureError) {
    const original = basicError(error.cause);
    const cause = error.cause instanceof Error && error.cause.cause ? basicError(error.cause.cause) : undefined;
    const latestAttempt = error.attempts.at(-1);
    const providerWarnings = [...new Set(error.attempts.flatMap((attempt) => attempt.warnings))];
    return {
      error: {
        ...original,
        cause,
        responseTextSummary: latestAttempt?.responseTextSummary,
        finishReason: latestAttempt?.finishReason,
        providerWarnings: providerWarnings.length ? providerWarnings : undefined,
        attempts: error.attempts.length,
      },
      usage: error.usage,
    };
  }
  return { error: basicError(error) };
}

function basicError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'Error', message: String(error) };
}
