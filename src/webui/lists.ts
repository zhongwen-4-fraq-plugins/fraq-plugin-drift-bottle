import type { DriftBottleApi } from '../api/drift-bottle-api.js';
import type { BottleSegment, DriftBottle } from '../models/index.js';
import type { BottleStore } from '../persistence/bottle-store.js';
import type { ModerationRecord } from '../processing/moderation-records.js';

export interface WebuiContentSummary {
  preview: string;
  kinds: string[];
  parts: WebuiContentPart[];
}

export interface WebuiContentPart {
  segmentIndex: number;
  text: string;
  faceId?: string;
  imageSegmentIndex?: number;
}

export interface WebuiPendingReviewItem {
  id: string;
  createdAt: number;
  content: WebuiContentSummary;
  status: 'pending' | 'rejected' | 'error';
  reason: string;
  categories: string[];
  totalTokens?: number;
  target: string;
  canApprove: boolean;
  bottleDraft?: {
    senderId: number;
    displayName?: string;
    source: { scene: string; peerId: number };
  };
}

export interface WebuiBottleListItem {
  id: string;
  createdAt: number;
  commentCount: number;
  senderId: number;
  displayName?: string;
  content: WebuiContentSummary;
  source: {
    scene: string;
    peerId: number;
  };
}

export interface WebuiRegistrationRequestItem {
  userId: number;
  createdAt: number;
}

export interface WebuiListPage<T> {
  generatedAt: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
}

const PAGE_SIZE = 20;

export async function createPendingReviewListPage(
  api: DriftBottleApi,
  requestedPage: number,
): Promise<WebuiListPage<WebuiPendingReviewItem>> {
  const total = await api.pendingModerationCount();
  const page = boundedPage(requestedPage, total);
  return createPage(
    page,
    total,
    (await api.pendingModerationRecords(PAGE_SIZE, (page - 1) * PAGE_SIZE)).map(formatPendingReview),
  );
}

export async function createBottleListPage(
  api: DriftBottleApi,
  requestedPage: number,
): Promise<WebuiListPage<WebuiBottleListItem>> {
  const total = await api.count();
  const page = boundedPage(requestedPage, total);
  const bottles = await api.bottles(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  return createPage(
    page,
    total,
    await Promise.all(bottles.map(async (bottle) => formatBottle(bottle, await api.commentCountFor(bottle.id)))),
  );
}

export async function createRegistrationRequestListPage(
  store: Pick<BottleStore, 'webuiRegistrationRequestCount' | 'webuiRegistrationRequests'>,
  requestedPage: number,
): Promise<WebuiListPage<WebuiRegistrationRequestItem>> {
  const total = await store.webuiRegistrationRequestCount();
  const page = boundedPage(requestedPage, total);
  return createPage(page, total, await store.webuiRegistrationRequests(PAGE_SIZE, (page - 1) * PAGE_SIZE));
}

function createPage<T>(page: number, total: number, items: T[]): WebuiListPage<T> {
  return {
    generatedAt: Date.now(),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
    items,
  };
}

function boundedPage(requestedPage: number, total: number): number {
  return Math.min(requestedPage, Math.max(1, Math.ceil(total / PAGE_SIZE)));
}

function formatPendingReview(record: ModerationRecord): WebuiPendingReviewItem {
  const context = {
    target: moderationTargetLabel(record.target),
    canApprove: Boolean(record.bottleDraft),
    bottleDraft: record.bottleDraft
      ? {
          senderId: record.bottleDraft.senderId,
          displayName: record.bottleDraft.displayName,
          source: record.bottleDraft.source,
        }
      : undefined,
  };
  if ('manual' in record.process) {
    return {
      id: record.id,
      createdAt: record.createdAt,
      content: summarizeSegments(record.content),
      status: 'pending',
      reason: record.process.manual.reason,
      categories: [],
      ...context,
    };
  }
  if ('error' in record.process) {
    return {
      id: record.id,
      createdAt: record.createdAt,
      content: summarizeSegments(record.content),
      status: 'error',
      reason: record.process.error.message,
      categories: [],
      totalTokens: record.totalTokens,
      ...context,
    };
  }

  return {
    id: record.id,
    createdAt: record.createdAt,
    content: summarizeSegments(record.content),
    status: 'rejected',
    reason: record.process.result.reason || 'AI 未提供具体原因',
    categories: record.process.result.categories,
    totalTokens: record.totalTokens,
    ...context,
  };
}

function moderationTargetLabel(target: ModerationRecord['target']): string {
  switch (target) {
    case 'bottle-content':
      return '瓶子内容';
    case 'bottle-signature':
      return '瓶子署名';
    case 'comment-content':
      return '评论内容';
    case 'comment-signature':
      return '评论署名';
    case 'profile-signature':
      return '署名设置';
    default:
      return '历史记录';
  }
}

function formatBottle(bottle: DriftBottle, commentCount: number): WebuiBottleListItem {
  return {
    id: bottle.id,
    createdAt: bottle.createdAt,
    commentCount,
    senderId: bottle.senderId,
    displayName: bottle.displayName,
    content: summarizeSegments(bottle.segments as BottleSegment[]),
    source: {
      scene: bottle.source.scene,
      peerId: bottle.source.peerId,
    },
  };
}

export function summarizeSegments(segments: BottleSegment[]): WebuiContentSummary {
  const kinds = [...new Set(segments.map((segment) => segmentKind(segment.type)))];
  const parts = segments.flatMap((segment, segmentIndex) => {
    const text = summarizeSegment(segment).replace(/\s+/g, ' ').trim();
    return text
      ? [
          {
            segmentIndex,
            text,
            faceId: segment.type === 'face' ? segment.data.face_id : undefined,
            imageSegmentIndex: segment.type === 'image' ? segmentIndex : undefined,
          },
        ]
      : [];
  });
  const preview = parts.map((part) => part.text).join(' ') || '无法预览的内容';
  return {
    preview,
    kinds,
    parts,
  };
}

function summarizeSegment(segment: BottleSegment): string {
  switch (segment.type) {
    case 'text':
      return segment.data.text;
    case 'image':
      return segment.data.summary && segment.data.summary !== '[image]' ? `[图片：${segment.data.summary}]` : '[图片]';
    case 'video':
      return '[视频]';
    case 'face':
      return `[表情：${segment.data.face_id}]`;
    case 'market_face':
      return segment.data.summary ? `[动态表情：${segment.data.summary}]` : '[动态表情]';
    case 'forward':
      return segment.data.title ? `[合并转发：${segment.data.title}]` : '[合并转发]';
  }
}

function segmentKind(type: BottleSegment['type']): string {
  switch (type) {
    case 'text':
      return '文字';
    case 'image':
      return '图片';
    case 'video':
      return '视频';
    case 'face':
      return '表情';
    case 'market_face':
      return '动态表情';
    case 'forward':
      return '合并转发';
  }
}
