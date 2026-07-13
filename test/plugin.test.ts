import { Context, type milky } from '@fraqjs/fraq';
import { createMockMilkyClient, inmsg } from '@fraqjs/mock';

import DriftBottlePlugin from '../src/index.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('可以扔出、捡取漂流瓶，并在瓶池为空时提示', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-'));
  const client = createMockMilkyClient();
  const ctx = Context.fromClient(client, {
    routing: { activation: { default: { type: 'direct' } } },
  });
  t.after(async () => {
    await ctx.stop();
    await rm(directory, { recursive: true, force: true });
  });

  let messageSeq = 1;
  client.stubApi('send_group_message', () => ({ message_seq: messageSeq++, time: 1_700_000_000 }));
  ctx.install(DriftBottlePlugin, {
    storagePath: join(directory, 'bottles.db'),
    deleteAfterPick: true,
  });
  await ctx.start();

  await dispatchGroupMessage(ctx, client, 10001, inmsg`扔漂流瓶 来自海上的问候`);
  await dispatchGroupMessage(ctx, client, 10002, inmsg`捡漂流瓶`);
  await dispatchGroupMessage(ctx, client, 10003, inmsg`捡漂流瓶`);

  const replies = client.apiCalls
    .filter((call) => call.endpoint === 'send_group_message')
    .map((call) => call.params as milky.SendGroupMessageInput_ZodInput);

  assert.deepEqual(replies, [
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '漂流瓶已经扔进海里了。' } }],
    },
    {
      group_id: 20001,
      message: [
        { type: 'text', data: { text: '捡到一个漂流瓶：\n' } },
        { type: 'text', data: { text: '来自海上的问候' } },
      ],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '海里暂时没有漂流瓶。' } }],
    },
  ]);
});

async function dispatchGroupMessage(
  ctx: Context,
  client: ReturnType<typeof createMockMilkyClient>,
  userId: number,
  segments: milky.IncomingSegment_ZodInput[],
): Promise<void> {
  const message = client.inbox.group({ groupId: 20001, userId }, segments);
  await ctx.router.dispatch(ctx.createSession(client.inbox.selfId, message), message);
}
