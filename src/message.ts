import type { MilkyClient, milky } from '@fraqjs/fraq';

import type { BottleSegment } from './types.js';

export function hasBottleContent(segments: milky.IncomingSegment[]): boolean {
  return segments.some((segment) => segment.type !== 'text' || segment.data.text.trim().length > 0);
}

export function hasOnlySupportedBottleSegments(segments: milky.IncomingSegment[]): segments is BottleSegment[] {
  return segments.every(
    (segment) =>
      segment.type === 'text' ||
      segment.type === 'image' ||
      segment.type === 'video' ||
      segment.type === 'face' ||
      segment.type === 'market_face' ||
      segment.type === 'forward',
  );
}

export function resolveBottleContent(
  segments: milky.IncomingSegment[],
  sourceSegments: milky.IncomingSegment[] = segments,
): milky.IncomingSegment[] {
  return [
    ...segments.filter((segment) => segment.type !== 'reply' && (segment.type !== 'text' || segment.data.text.trim())),
    ...sourceSegments.flatMap((segment) =>
      segment.type === 'reply'
        ? segment.data.segments.filter(
            (quoted) =>
              quoted.type === 'image' ||
              quoted.type === 'video' ||
              quoted.type === 'face' ||
              quoted.type === 'market_face' ||
              quoted.type === 'forward',
          )
        : [],
    ),
  ];
}

export async function loadForwardMessages(client: MilkyClient, segments: BottleSegment[]): Promise<BottleSegment[]> {
  return Promise.all(
    segments.map(async (segment) => {
      if (segment.type !== 'forward' || segment.data.messages) {
        return segment;
      }

      const result = await client.get_forwarded_messages({ forward_id: segment.data.forward_id });
      return { ...segment, data: { ...segment.data, messages: result.messages } };
    }),
  );
}

export async function toOutgoingSegments(
  client: MilkyClient,
  segments: milky.IncomingSegment[],
  userId = 0,
): Promise<milky.OutgoingSegment_ZodInput[]> {
  return Promise.all(segments.map((segment) => toOutgoingSegment(client, segment, userId)));
}

async function toOutgoingSegment(
  client: MilkyClient,
  segment: milky.IncomingSegment,
  userId: number,
): Promise<milky.OutgoingSegment_ZodInput> {
  switch (segment.type) {
    case 'text':
      return segment;
    case 'mention':
      return textSegment(`[提及：${segment.data.name || segment.data.user_id}]`);
    case 'mention_all':
      return textSegment('[提及全体成员]');
    case 'face':
      return segment;
    case 'reply':
      return textSegment('[回复消息]');
    case 'image':
      return {
        type: 'image',
        data: {
          uri: await getResourceUrl(client, segment.data.resource_id, segment.data.temp_url),
          sub_type: segment.data.sub_type,
          summary: segment.data.summary,
        },
      };
    case 'record':
      return {
        type: 'record',
        data: { uri: await getResourceUrl(client, segment.data.resource_id, segment.data.temp_url) },
      };
    case 'video':
      return {
        type: 'video',
        data: { uri: await getResourceUrl(client, segment.data.resource_id, segment.data.temp_url) },
      };
    case 'file':
      return textSegment(`[文件：${segment.data.file_name}]`);
    case 'forward':
      return forwardSegment(client, segment, userId);
    case 'market_face':
      return {
        type: 'image',
        data: { uri: segment.data.url, summary: segment.data.summary },
      };
    case 'light_app':
      return { type: 'light_app', data: { json_payload: segment.data.json_payload } };
    case 'xml':
      return textSegment('[XML 消息]');
    case 'markdown':
      return textSegment(segment.data.content);
    default:
      return textSegment('[暂不支持的消息]');
  }
}

async function forwardSegment(
  client: MilkyClient,
  segment: Extract<BottleSegment, { type: 'forward' }>,
  userId: number,
): Promise<milky.OutgoingForwardSegment_ZodInput> {
  const messages =
    segment.data.messages ?? (await client.get_forwarded_messages({ forward_id: segment.data.forward_id })).messages;

  return {
    type: 'forward',
    data: {
      messages: await Promise.all(
        messages.map(async (message) => ({
          user_id: userId,
          sender_name: message.sender_name,
          time: message.time,
          segments: await toOutgoingSegments(client, message.segments, userId),
        })),
      ),
      title: segment.data.title,
      preview: segment.data.preview,
      summary: segment.data.summary,
    },
  };
}

async function getResourceUrl(client: MilkyClient, resourceId: string, fallbackUrl: string): Promise<string> {
  try {
    const result = await client.get_resource_temp_url({ resource_id: resourceId });
    return result.url;
  } catch {
    return fallbackUrl;
  }
}

function textSegment(text: string): milky.OutgoingTextSegment_ZodInput {
  return { type: 'text', data: { text } };
}
