import { Context, type milky } from '@fraqjs/fraq';
import { createMockMilkyClient, inmsg, inseg } from '@fraqjs/mock';

import { registerAdministrationCommands } from '../src/administration.js';
import { BottleStore } from '../src/storage.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('普通用户只能删除自己的漂流瓶，管理人员可以删除任意瓶子', async (t) => {
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
  registerAdministrationCommands(ctx, store, [10001]);
  await ctx.start();

  const adminBottle = await addBottle(store);
  await dispatch(ctx, client, 10002, 'member', inmsg`删除漂流瓶 ${adminBottle.id}`);
  assert.equal(store.count(), 1);
  await dispatch(ctx, client, 10003, 'admin', inmsg`删除漂流瓶 ${adminBottle.id}`);
  assert.equal(store.count(), 0);

  const personalBottle = await addBottle(store, 10002);
  await dispatch(ctx, client, 10002, 'member', inmsg`删除漂流瓶 ${personalBottle.id}`);
  assert.equal(store.count(), 0);

  const archivedBottle = await addBottle(store, 10002);
  await store.pick(true, 0);
  assert.equal(store.hasBottle(archivedBottle.id), true);
  await dispatch(ctx, client, 10002, 'member', inmsg`删除漂流瓶 ${archivedBottle.id}`);
  assert.equal(store.hasBottle(archivedBottle.id), false);

  const ownerBottle = await addBottle(store);
  await dispatch(ctx, client, 10001, 'member', inmsg`删除漂流瓶 ${ownerBottle.id}`);
  assert.equal(store.count(), 0);

  await dispatch(ctx, client, 10001, 'member', inmsg`漂流瓶权限 添加 10004 ${inseg.mention(10006)}`);
  assert.deepEqual(store.moderators(), [10004, 10006]);
  const moderatorBottle = await addBottle(store);
  await dispatch(ctx, client, 10004, 'member', inmsg`删除漂流瓶 ${moderatorBottle.id}`);
  assert.equal(store.count(), 0);

  const replies = client.apiCalls
    .filter((call) => call.endpoint === 'send_group_message')
    .map((call) => call.params as milky.SendGroupMessageInput_ZodInput);
  assert.equal(
    replies[0]?.message[0]?.type === 'text' && replies[0].message[0].data.text,
    '普通用户只能删除自己投递的漂流瓶。',
  );
});

test('只有插件主人可以管理数据库权限列表', async (t) => {
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
  registerAdministrationCommands(ctx, store, [10001]);
  await ctx.start();

  await dispatch(ctx, client, 10002, 'admin', inmsg`漂流瓶权限 添加 10005`);
  assert.deepEqual(store.moderators(), []);
  await dispatch(
    ctx,
    client,
    10001,
    'member',
    inmsg`漂流瓶权限 添加 10005,10006 ${inseg.mention(10007)} ${inseg.mention(10005)}`,
  );
  await dispatch(ctx, client, 10001, 'member', inmsg`漂流瓶权限 列表`);
  assert.deepEqual(store.moderators(), [10005, 10006, 10007]);
  await dispatch(
    ctx,
    client,
    10001,
    'member',
    inmsg`漂流瓶权限 删除 10005 ${inseg.mention(10006)} ${inseg.mention(10007)}`,
  );
  assert.deepEqual(store.moderators(), []);
});

async function addBottle(store: BottleStore, senderId = 20001) {
  return store.add({
    senderId,
    source: { scene: 'group', peerId: 30001 },
    segments: [inseg.text('测试漂流瓶')],
  });
}

async function dispatch(
  ctx: Context,
  client: ReturnType<typeof createMockMilkyClient>,
  userId: number,
  role: 'owner' | 'admin' | 'member',
  segments: milky.IncomingSegment_ZodInput[],
): Promise<void> {
  const message = client.inbox.group({ groupId: 30001, userId, groupMember: { role } }, segments);
  await ctx.router.dispatch(ctx.createSession(client.inbox.selfId, message), message);
}
