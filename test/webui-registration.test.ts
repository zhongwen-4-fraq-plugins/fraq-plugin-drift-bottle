import { Context, type milky } from '@fraqjs/fraq';
import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { registerWebuiAccountCommands } from '../src/commands/webui-accounts.js';
import { BottleStore } from '../src/persistence/bottle-store.js';
import { WebuiAuth } from '../src/webui/auth.js';
import { WebuiRegistration } from '../src/webui/registration.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('WebUI 注册申请通知所有主人，任一主人同意后广播审批者昵称', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-registration-'));
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  const client = createMockMilkyClient();
  const ctx = Context.fromClient(client);
  t.after(async () => {
    await ctx.stop();
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  let messageSeq = 1;
  client.stubApi('send_private_message', () => ({ message_seq: messageSeq++, time: 1_700_000_000 }));
  client.stubApi('get_user_profile', () => ({
    nickname: '审批主人',
    qid: '',
    age: 0,
    sex: 'unknown',
    remark: '',
    bio: '',
    level: 0,
    country: '',
    city: '',
    school: '',
  }));

  const auth = new WebuiAuth(store);
  await auth.initialize(10001);
  const registration = new WebuiRegistration(auth, client, [10001, 10002], ctx.logger);
  registerWebuiAccountCommands(ctx, registration, [10001, 10002]);
  await ctx.start();

  assert.equal(await registration.submit(987654321, 'ValidA123'), 'created');
  const requestNotices = privateMessages(client.apiCalls);
  assert.deepEqual(
    requestNotices.map((notice) => notice.userId),
    [10001, 10002],
  );
  assert.ok(requestNotices.every((notice) => notice.text.includes('回复本消息并发送“同意”即可审批')));

  client.apiCalls.splice(0);
  const requestNotice = client.inbox.friend({ peerId: 10002, senderId: client.inbox.selfId, userId: 10002 }, [
    inseg.text('收到 WebUI 账号注册请求：987654321\n回复本消息并发送“同意”即可审批。'),
  ]);
  const rejectedApproval = client.inbox.friend({ userId: 10003 }, [inseg.reply(requestNotice), inseg.text('同意')]);
  await ctx.router.dispatch(ctx.createSession(client.inbox.selfId, rejectedApproval), rejectedApproval);
  assert.equal(await auth.createSession(987654321, 'ValidA123'), undefined);

  const forgedNotice = client.inbox.friend({ userId: 10002 }, requestNotice.segments);
  const forgedApproval = client.inbox.friend({ userId: 10002 }, [inseg.reply(forgedNotice), inseg.text('同意')]);
  await ctx.router.dispatch(ctx.createSession(client.inbox.selfId, forgedApproval), forgedApproval);
  assert.equal(await auth.createSession(987654321, 'ValidA123'), undefined);

  const approvalReply = inseg.reply(requestNotice);
  approvalReply.data.segments = [];
  const approval = client.inbox.friend({ userId: 10002 }, [approvalReply, inseg.text('同意')]);
  await ctx.router.dispatch(ctx.createSession(client.inbox.selfId, approval), approval);

  const approvalNotices = privateMessages(client.apiCalls).filter((notice) => notice.text.includes('该请求已由'));
  assert.deepEqual(
    approvalNotices.map((notice) => notice.userId),
    [10001, 10002],
  );
  assert.ok(approvalNotices.every((notice) => notice.text.includes('该请求已由"审批主人 [10002]"同意。')));
  assert.ok(await auth.createSession(987654321, 'ValidA123'));
});

function privateMessages(calls: { endpoint: string; params?: unknown }[]): { text: string; userId: number }[] {
  return calls
    .filter((call) => call.endpoint === 'send_private_message')
    .map((call) => call.params as milky.SendPrivateMessageInput_ZodInput)
    .map((message) => ({
      userId: message.user_id,
      text: message.message.map((segment) => (segment.type === 'text' ? segment.data.text : '')).join(''),
    }));
}
