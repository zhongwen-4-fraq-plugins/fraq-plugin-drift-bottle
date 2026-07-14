import { Context, type milky } from '@fraqjs/fraq';
import { createMockMilkyClient, inmsg } from '@fraqjs/mock';

import { registerHelpCommand } from '../src/help.js';

import assert from 'node:assert/strict';
import test from 'node:test';

test('漂流瓶帮助命令会列出可用命令和支持字段', async (t) => {
  const client = createMockMilkyClient();
  const ctx = Context.fromClient(client, {
    routing: { activation: { default: { type: 'direct' } } },
  });
  t.after(() => ctx.stop());

  client.stubApi('send_group_message', () => ({ message_seq: 1, time: 1_700_000_000 }));
  registerHelpCommand(ctx);
  await ctx.start();

  for (const command of ['漂流瓶帮助', '漂流瓶help', '漂流瓶 help']) {
    const message = client.inbox.group({ groupId: 20001, userId: 10001 }, inmsg`${command}`);
    await ctx.router.dispatch(ctx.createSession(client.inbox.selfId, message), message);
  }

  const replies = client.apiCalls.filter((call) => call.endpoint === 'send_group_message');
  assert.equal(replies.length, 3);
  const reply = replies[0];
  const output = reply?.params as milky.SendGroupMessageInput_ZodInput;
  assert.match(output.message[0]?.type === 'text' ? output.message[0].data.text : '', /扔瓶子 <内容>/);
  assert.match(output.message[0]?.type === 'text' ? output.message[0].data.text : '', /漂流瓶署名 原名/);
  assert.match(output.message[0]?.type === 'text' ? output.message[0].data.text : '', /删除漂流瓶 <ID>/);
  assert.match(output.message[0]?.type === 'text' ? output.message[0].data.text : '', /漂流瓶重复捡 开启\/关闭\/默认/);
  assert.match(output.message[0]?.type === 'text' ? output.message[0].data.text : '', /评论漂流瓶 <ID> <内容>/);
  assert.match(output.message[0]?.type === 'text' ? output.message[0].data.text : '', /回复漂流瓶消息/);
  assert.match(output.message[0]?.type === 'text' ? output.message[0].data.text : '', /动态表情/);
  assert.match(output.message[0]?.type === 'text' ? output.message[0].data.text : '', /回复包含非文字内容/);
});
