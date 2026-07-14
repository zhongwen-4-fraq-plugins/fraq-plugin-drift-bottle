import { Context, type milky } from '@fraqjs/fraq';
import { createMockMilkyClient, inmsg, inseg } from '@fraqjs/mock';

import { registerDriftBottleCommands } from '../src/commands.js';
import type { BottleModerator } from '../src/moderation.js';
import { BottleStore } from '../src/storage.js';
import type { BottleSegment } from '../src/types.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('所有非文字瓶子的 ID 和内容会分别发送', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-'));
  const client = createMockMilkyClient();
  const ctx = Context.fromClient(client, {
    routing: { activation: { default: { type: 'direct' } } },
  });
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  t.after(async () => {
    await ctx.stop();
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  let messageSeq = 1;
  client.stubApi('send_group_message', () => ({ message_seq: messageSeq++, time: 1_700_000_000 }));
  const moderator: BottleModerator = async () => ({ approved: true, categories: [], reason: '' });
  registerDriftBottleCommands(ctx, store, moderator);
  await ctx.start();

  const forward: Extract<BottleSegment, { type: 'forward' }> = {
    type: 'forward',
    data: {
      forward_id: 'forward-id',
      title: '聊天记录',
      preview: ['转发预览'],
      summary: '共 1 条消息',
      messages: [
        {
          message_seq: 1,
          sender_name: '测试用户',
          avatar_url: 'https://example.com/avatar',
          time: 1_700_000_000,
          segments: [inseg.text('转发正文')],
        },
      ],
    },
  };
  const bottle = await store.add({
    senderId: 10001,
    source: { scene: 'group', peerId: 20001 },
    segments: [
      inseg.image({ tempUrl: 'https://example.com/image' }),
      inseg.video({ tempUrl: 'https://example.com/video' }),
      inseg.face(14),
      inseg.marketFace({ summary: '动态表情', url: 'https://example.com/face.gif' }),
      forward,
    ],
  });

  const message = client.inbox.group({ groupId: 20001, userId: 10002 }, inmsg`捡瓶子`);
  await ctx.router.dispatch(ctx.createSession(client.inbox.selfId, message), message);

  const replies = client.apiCalls
    .filter((call) => call.endpoint === 'send_group_message')
    .map((call) => call.params as milky.SendGroupMessageInput_ZodInput);
  assert.equal(replies.length, 3);
  assert.deepEqual(replies[0]?.message, [
    {
      type: 'text',
      data: {
        text: `捡到一个匿名漂流瓶（ID：${bottle.id}）。\n回复本消息并发送“评论漂流瓶 <内容>”可以评论这个瓶子。`,
      },
    },
  ]);
  assert.deepEqual(
    replies[1]?.message.map((segment) => segment.type),
    ['image', 'video', 'face', 'image'],
  );
  assert.equal(replies[2]?.message.length, 1);
  assert.equal(replies[2]?.message[0]?.type, 'forward');
});
