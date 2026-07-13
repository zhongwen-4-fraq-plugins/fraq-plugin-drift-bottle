import { Context, type milky } from '@fraqjs/fraq';
import { createMockMilkyClient, inmsg } from '@fraqjs/mock';

import { registerCommentCommands } from '../src/comments.js';
import type { BottleModerator } from '../src/moderation.js';
import { BottleStore } from '../src/storage.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('归档后的漂流瓶仍可评论和查看评论', async (t) => {
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
  const moderator: BottleModerator = async (segments) => {
    const rejected = segments.some((segment) => segment.type === 'text' && segment.data.text.includes('违规'));
    return {
      approved: !rejected,
      categories: rejected ? ['profanity'] : [],
      reason: rejected ? '包含不适宜公开的语言' : '',
    };
  };
  registerCommentCommands(ctx, store, moderator);
  await ctx.start();

  store.setSignature(10001, { type: 'alias', name: '海风' });
  const bottle = await store.add({
    senderId: 10002,
    source: { scene: 'group', peerId: 20001 },
    segments: [{ type: 'text', data: { text: '瓶子正文' } }],
  });
  await store.pick(true, 0);

  await dispatch(ctx, client, 10001, inmsg`评论漂流瓶 ${bottle.id} 写得真好`);
  await dispatch(ctx, client, 10003, inmsg`评论漂流瓶 ${bottle.id} 违规评论`);
  await dispatch(ctx, client, 10003, inmsg`漂流瓶评论 ${bottle.id}`);

  assert.equal(store.commentCount(bottle.id), 1);
  assert.deepEqual(
    store.commentsFor(bottle.id).map(({ displayName, content }) => ({ displayName, content })),
    [{ displayName: '海风', content: '写得真好' }],
  );

  const replies = client.apiCalls
    .filter((call) => call.endpoint === 'send_group_message')
    .map((call) => call.params as milky.SendGroupMessageInput_ZodInput)
    .map((reply) => (reply.message[0]?.type === 'text' ? reply.message[0].data.text : ''));
  assert.deepEqual(replies, [
    '评论已发布。',
    '漂流瓶评论未通过 AI 审核：包含不适宜公开的语言',
    `漂流瓶 ${bottle.id} 的评论（共 1 条）：\n1. 海风：写得真好`,
  ]);
});

async function dispatch(
  ctx: Context,
  client: ReturnType<typeof createMockMilkyClient>,
  userId: number,
  segments: milky.IncomingSegment_ZodInput[],
): Promise<void> {
  const message = client.inbox.group({ groupId: 20001, userId }, segments);
  await ctx.router.dispatch(ctx.createSession(client.inbox.selfId, message), message);
}
