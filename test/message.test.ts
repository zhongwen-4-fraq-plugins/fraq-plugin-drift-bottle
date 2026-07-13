import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { resolveBottleContent, toOutgoingSegments } from '../src/message.js';

import assert from 'node:assert/strict';
import test from 'node:test';

test('接收消息段会转换成可安全发送的消息段', async () => {
  const client = createMockMilkyClient();
  client.stubApi('get_resource_temp_url', ({ resource_id }) => ({ url: `https://example.com/${resource_id}` }));

  const segments = await toOutgoingSegments(client, [
    inseg.text('你好'),
    inseg.mention(10001, '测试用户'),
    inseg.image({ resourceId: 'image-id', tempUrl: 'https://old.example.com/image' }),
    inseg.file({ fileName: 'document.txt' }),
  ]);

  assert.deepEqual(segments, [
    { type: 'text', data: { text: '你好' } },
    { type: 'text', data: { text: '[提及：测试用户]' } },
    {
      type: 'image',
      data: {
        uri: 'https://example.com/image-id',
        sub_type: 'normal',
        summary: '[image]',
      },
    },
    { type: 'text', data: { text: '[文件：document.txt]' } },
  ]);
});

test('回复消息中的非文字字段可以作为漂流瓶内容', async () => {
  const client = createMockMilkyClient();
  const quoted = client.inbox.group({ groupId: 20001, userId: 10001 }, [
    inseg.text('不会被带入的文字'),
    inseg.image({ resourceId: 'image-id', tempUrl: 'https://example.com/image' }),
    inseg.video({ resourceId: 'video-id', tempUrl: 'https://example.com/video' }),
    inseg.face(14),
    inseg.marketFace({ summary: '动态表情', url: 'https://example.com/face.gif' }),
    inseg.forward({ title: '聊天记录' }),
  ]);
  const message = client.inbox.group({ groupId: 20001, userId: 10002 }, [inseg.text('当前文字'), inseg.reply(quoted)]);

  const content = await resolveBottleContent(client, message.segments, message);

  assert.deepEqual(
    content.map((segment) => segment.type),
    ['text', 'image', 'video', 'face', 'market_face', 'forward'],
  );
  assert.equal(content[0]?.type === 'text' && content[0].data.text, '当前文字');
});

test('回复段内容为空时会获取原消息', async () => {
  const client = createMockMilkyClient();
  const quoted = client.inbox.group({ groupId: 20001, userId: 10001 }, [
    inseg.marketFace({ summary: '动态表情', url: 'https://example.com/face.gif' }),
  ]);
  const reply = inseg.reply(quoted);
  reply.data.segments = [];
  const message = client.inbox.group({ groupId: 20001, userId: 10002 }, [reply, inseg.text('扔漂流瓶')]);

  const content = await resolveBottleContent(client, [], message);

  assert.deepEqual(
    content.map((segment) => segment.type),
    ['market_face'],
  );
});

test('合并转发消息会转换成可发送的完整消息', async () => {
  const client = createMockMilkyClient();
  client.stubApi('get_forwarded_messages', () => ({
    messages: [
      {
        message_seq: 1,
        sender_name: '测试用户',
        avatar_url: 'https://example.com/avatar',
        time: 1_700_000_000,
        segments: [inseg.text('转发正文')],
      },
    ],
  }));
  const message = client.inbox.group({ groupId: 20001, userId: 10001 }, [inseg.forward({ title: '聊天记录' })]);

  const segments = await toOutgoingSegments(client, message.segments, 10000);

  assert.equal(segments[0]?.type, 'forward');
  assert.deepEqual(segments[0]?.type === 'forward' && segments[0].data.messages, [
    {
      user_id: 10000,
      sender_name: '测试用户',
      time: 1_700_000_000,
      segments: [{ type: 'text', data: { text: '转发正文' } }],
    },
  ]);
});
