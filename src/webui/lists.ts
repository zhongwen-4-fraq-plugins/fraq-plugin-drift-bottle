import type { DriftBottleApi } from '../api/drift-bottle-api.js';
import type { BottleSegment, DriftBottle } from '../models/index.js';
import type { ModerationRecord } from '../processing/moderation-records.js';

export interface WebuiContentSummary {
  preview: string;
  kinds: string[];
}

export interface WebuiPendingReviewItem {
  id: string;
  createdAt: number;
  content: WebuiContentSummary;
  status: 'rejected' | 'error';
  reason: string;
  categories: string[];
  totalTokens?: number;
}

export interface WebuiBottleListItem {
  id: string;
  createdAt: number;
  senderId: number;
  displayName?: string;
  content: WebuiContentSummary;
  source: {
    scene: string;
    peerId: number;
  };
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

export function createPendingReviewListPage(
  api: DriftBottleApi,
  requestedPage: number,
): WebuiListPage<WebuiPendingReviewItem> {
  const total = api.pendingModerationCount();
  const page = boundedPage(requestedPage, total);
  return createPage(
    page,
    total,
    api.pendingModerationRecords(PAGE_SIZE, (page - 1) * PAGE_SIZE).map(formatPendingReview),
  );
}

export function createBottleListPage(api: DriftBottleApi, requestedPage: number): WebuiListPage<WebuiBottleListItem> {
  const total = api.count();
  const page = boundedPage(requestedPage, total);
  return createPage(page, total, api.bottles(PAGE_SIZE, (page - 1) * PAGE_SIZE).map(formatBottle));
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
  if ('error' in record.process) {
    return {
      id: record.id,
      createdAt: record.createdAt,
      content: summarizeSegments(record.content),
      status: 'error',
      reason: record.process.error.message,
      categories: [],
      totalTokens: record.totalTokens,
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
  };
}

function formatBottle(bottle: DriftBottle): WebuiBottleListItem {
  return {
    id: bottle.id,
    createdAt: bottle.createdAt,
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
  const summary = segments.map(summarizeSegment).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const preview = summary || '无法预览的内容';
  return {
    preview,
    kinds,
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
      return '[表情]';
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
