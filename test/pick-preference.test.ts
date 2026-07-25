import { Context, type milky } from '@fraqjs/fraq';
import { createMockMilkyClient, inmsg } from '@fraqjs/mock';

import { DriftBottleApi } from '../src/api/drift-bottle-api.js';
import { registerPickPreferenceCommand } from '../src/commands/pick-preference.js';
import { BottleStore } from '../src/persistence/bottle-store.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('用户可以单独配置是否重复捡瓶子', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-'));
  const client = createMockMilkyClient();
  const ctx = Context.fromClient(client);
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  t.after(async () => {
    await ctx.stop();
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  let messageSeq = 1;
  client.stubApi('send_group_message', () => ({ message_seq: messageSeq++, time: 1_700_000_000 }));
  const api = new DriftBottleApi(client, store, async () => ({ approved: true, categories: [], reason: '' }));
  registerPickPreferenceCommand(ctx, api);
  await ctx.start();

  await dispatch(ctx, client, 10001, inmsg`漂流瓶重复捡 开启`);
  assert.equal(store.repeatPickFor(10001), true);

  await dispatch(ctx, client, 10001, inmsg`漂流瓶重复捡 关闭`);
  assert.equal(store.repeatPickFor(10001), false);

  await dispatch(ctx, client, 10001, inmsg`漂流瓶重复捡 默认`);
  assert.equal(store.repeatPickFor(10001), undefined);
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
