import { Context, type milky } from '@fraqjs/fraq';
import { createMockMilkyClient, inmsg, inseg } from '@fraqjs/mock';

import { DriftBottleApi } from '../src/api/drift-bottle-api.js';
import { registerModerationCommands } from '../src/commands/moderation.js';
import { BottleStore } from '../src/persistence/bottle-store.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('主人和漂流瓶管理员可以通过或拒绝待审核投瓶', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-moderation-command-'));
  const client = createMockMilkyClient();
  const ctx = Context.fromClient(client);
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  let messageSeq = 1;
  client.stubApi('send_group_message', () => ({ message_seq: messageSeq++, time: 1_700_000_000 }));
  const api = new DriftBottleApi(client, store, async () => ({ approved: true, categories: [], reason: '' }));
  api.addModerator(10002, 10001);
  registerModerationCommands(ctx, api, [10001]);
  await ctx.start();
  t.after(async () => {
    await ctx.stop();
    api.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const ownerReview = addPendingBottle(store, 20001, '主人审核');
  const moderatorReview = addPendingBottle(store, 20002, '管理员审核');
  const legacyReview = store.addModerationRecord({
    content: [inseg.text('缺少草稿的旧记录')],
    process: { error: { name: 'Error', message: '旧审核失败' } },
    success: false,
  });

  await dispatch(ctx, client, 10003, inmsg`漂流瓶审核 通过 ${ownerReview.id}`);
  await dispatch(ctx, client, 10001, inmsg`漂流瓶审核 通过 ${ownerReview.id}`);
  await dispatch(ctx, client, 10001, inmsg`漂流瓶审核 通过 ${ownerReview.id}`);
  await dispatch(ctx, client, 10002, inmsg`漂流瓶审核 拒绝 ${moderatorReview.id} 内容不适合公开`);
  await dispatch(ctx, client, 10001, inmsg`漂流瓶审核 通过 ${legacyReview.id}`);
  await dispatch(ctx, client, 10001, inmsg`漂流瓶审核 拒绝 ${legacyReview.id} 缺少完整投瓶信息`);
  await dispatch(ctx, client, 10001, inmsg`漂流瓶审核 通过 missing-review`);
  await dispatch(ctx, client, 10001, inmsg`漂流瓶审核 拒绝 ${ownerReview.id}`);

  const replies = client.apiCalls
    .filter((call) => call.endpoint === 'send_group_message')
    .map((call) => call.params as milky.SendGroupMessageInput_ZodInput)
    .map((reply) => (reply.message[0]?.type === 'text' ? reply.message[0].data.text : ''));
  assert.equal(replies[0], '只有插件主人和漂流瓶管理员可以人工审核。');
  assert.match(replies[1] ?? '', /^审核已通过，漂流瓶已经扔进海里了（ID：.+）。$/);
  assert.equal(replies[2], '这个审核记录已经处理过了。');
  assert.equal(replies[3], '审核已拒绝并归档。');
  assert.equal(replies[4], '这个审核记录缺少完整投瓶信息，无法通过；可以使用拒绝命令归档。');
  assert.equal(replies[5], '审核已拒绝并归档。');
  assert.equal(replies[6], '没有找到这个审核记录。');
  assert.equal(replies[7], '请使用“漂流瓶审核 拒绝 <审核记录ID> <拒绝理由>”。');

  assert.equal(store.count(), 1);
  assert.equal(store.pendingModerationCount(), 0);
  const records = store.moderationRecords();
  assert.equal(records.find((record) => record.id === ownerReview.id)?.resolvedBy, 10001);
  assert.equal(records.find((record) => record.id === moderatorReview.id)?.rejectionReason, '内容不适合公开');
  assert.equal(records.find((record) => record.id === moderatorReview.id)?.resolvedBy, 10002);
});

function addPendingBottle(store: BottleStore, senderId: number, content: string) {
  return store.addModerationRecord({
    content: [inseg.text(content)],
    process: { manual: { reason: '等待人工审核' } },
    success: true,
    approved: false,
    target: 'bottle-content',
    bottleDraft: {
      senderId,
      source: { scene: 'friend', peerId: senderId },
      segments: [inseg.text(content)],
    },
  });
}

async function dispatch(
  ctx: Context,
  client: ReturnType<typeof createMockMilkyClient>,
  userId: number,
  segments: milky.IncomingSegment_ZodInput[],
): Promise<void> {
  const message = client.inbox.group({ groupId: 30001, userId }, segments);
  await ctx.router.dispatch(ctx.createSession(client.inbox.selfId, message), message);
}
