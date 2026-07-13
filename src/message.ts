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

export async function resolveBottleContent(
  client: MilkyClient,
  segments: milky.IncomingSegment[],
  message: milky.IncomingMessage,
): Promise<milky.IncomingSegment[]> {
  const direct = segments.filter(
    (segment) => segment.type !== 'reply' && (segment.type !== 'text' || segment.data.text.trim()),
  );
  const replies = message.segments.filter((segment) => segment.type === 'reply');
  const quoted = replies.flatMap((reply) => supportedReplySegments(reply.data.segments));

  if (quoted.length > 0 || replies.length === 0) {
    return [...direct, ...quoted];
  }

  const fetched = await Promise.all(
    replies.map((reply) =>
      client.get_message({
        message_scene: message.message_scene,
        peer_id: message.peer_id,
        message_seq: reply.data.message_seq,
      }),
    ),
  );
  return [...direct, ...fetched.flatMap((result) => supportedReplySegments(result.message.segments))];
}

function supportedReplySegments(segments: milky.IncomingSegment[]): BottleSegment[] {
  return segments.filter(
    (segment): segment is BottleSegment =>
      segment.type === 'image' ||
      segment.type === 'video' ||
      segment.type === 'face' ||
      segment.type === 'market_face' ||
      segment.type === 'forward',
  );
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
