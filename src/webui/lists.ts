import type { milky } from '@fraqjs/fraq';

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
  forwardMessages?: WebuiForwardMessage[];
  forwardMessageCount?: number;
}

export interface WebuiForwardMessage {
  sequence: number;
  sender: string;
  markdown: string;
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
    const forward = segment.type === 'forward' ? createForwardMessages(segment) : undefined;
    return text
      ? [
          {
            segmentIndex,
            text,
            faceId: segment.type === 'face' ? segment.data.face_id : undefined,
            imageSegmentIndex: segment.type === 'image' ? segmentIndex : undefined,
            ...forward,
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

const MAX_FORWARD_DEPTH = 2;

function createForwardMessages(
  segment: Extract<BottleSegment, { type: 'forward' }>,
): Pick<WebuiContentPart, 'forwardMessages' | 'forwardMessageCount'> | undefined {
  const messages = forwardedMessages(segment);
  if (!messages?.length) return undefined;
  return {
    forwardMessages: messages.map((message) => ({
      sequence: message.message_seq,
      sender: message.sender_name || '未知发送者',
      markdown: formatForwardMessageBody(message, 0),
    })),
    forwardMessageCount: messages.length,
  };
}

function formatNestedForwardMarkdown(
  segment: Extract<milky.IncomingSegment, { type: 'forward' }>,
  messages: milky.IncomingForwardedMessage[],
  depth: number,
): string {
  const title = escapeMarkdown(segment.data.title || '合并转发');
  const messageMarkdown = messages.map((message) => {
    const sender = escapeMarkdown(message.sender_name || '未知发送者');
    const body = formatForwardMessageBody(message, depth);
    const separator = /^(?: {0,3}(?:#{1,6}\s|>|[-+*]\s|\d+[.)]\s|```|~~~|\|))/.test(body) ? '\n\n' : '';
    return `**${sender}**：${separator}${body}`;
  });
  return `**${title}**\n\n${messageMarkdown.join('\n\n')}`;
}

function formatForwardMessageBody(message: milky.IncomingForwardedMessage, depth: number): string {
  return (
    message.segments
      .map((nested) => formatForwardSegment(nested, depth))
      .filter(Boolean)
      .join('\n\n')
      .trim() || '*无法预览的消息*'
  );
}

function formatForwardSegment(segment: milky.IncomingSegment, depth: number): string {
  switch (segment.type) {
    case 'text':
    case 'markdown':
      return segment.type === 'text' ? segment.data.text : segment.data.content;
    case 'mention':
      return `@${escapeMarkdown(segment.data.name || String(segment.data.user_id))}`;
    case 'mention_all':
      return '@全体成员';
    case 'reply':
      return segment.data.sender_name
        ? `[回复：${escapeMarkdown(segment.data.sender_name)}]`
        : `[回复消息 ${segment.data.message_seq}]`;
    case 'image':
      return segment.data.summary && segment.data.summary !== '[image]'
        ? `[图片：${escapeMarkdown(segment.data.summary)}]`
        : '[图片]';
    case 'record':
      return `[语音：${segment.data.duration} 秒]`;
    case 'video':
      return `[视频：${segment.data.duration} 秒]`;
    case 'file':
      return `[文件：${escapeMarkdown(segment.data.file_name)}]`;
    case 'face':
      return `[表情：${segment.data.face_id}]`;
    case 'market_face':
      return segment.data.summary ? `[动态表情：${escapeMarkdown(segment.data.summary)}]` : '[动态表情]';
    case 'light_app':
      return `[小程序：${escapeMarkdown(segment.data.app_name)}]`;
    case 'xml':
      return '[XML 消息]';
    case 'forward': {
      const messages = forwardedMessages(segment);
      if (messages?.length && depth < MAX_FORWARD_DEPTH) {
        return formatNestedForwardMarkdown(segment, messages, depth + 1);
      }
      return segment.data.title ? `[合并转发：${escapeMarkdown(segment.data.title)}]` : '[合并转发]';
    }
  }
}

function forwardedMessages(
  segment: Extract<milky.IncomingSegment, { type: 'forward' }>,
): milky.IncomingForwardedMessage[] | undefined {
  const data = segment.data as typeof segment.data & { messages?: milky.IncomingForwardedMessage[] };
  return Array.isArray(data.messages) ? data.messages : undefined;
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_[\]{}()#+\-.!|])/g, '\\$1');
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
