import { Context, type milky } from '@fraqjs/fraq';
import { createMockMilkyClient, inmsg, inseg } from '@fraqjs/mock';

import { registerDriftBottleCommands } from '../src/commands.js';
import type { BottleModerator } from '../src/moderation.js';
import { registerSignatureCommands } from '../src/signature.js';
import { BottleStore } from '../src/storage.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('通过 AI 审核的内容可以投递，违规内容会被拒绝', async (t) => {
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
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  ctx.provide(BottleStore, store);
  let moderatedSegmentTypes: string[] = [];
  const moderator: BottleModerator = async (segments) => {
    moderatedSegmentTypes = segments.map((segment) => segment.type);
    if (segments.some((segment) => segment.type === 'text' && segment.data.text.includes('审核故障'))) {
      throw new Error('AI unavailable');
    }

    const rejected = segments.some((segment) => segment.type === 'text' && segment.data.text.includes('违规'));
    return {
      approved: !rejected,
      categories: rejected ? ['profanity'] : [],
      reason: rejected ? '包含不适宜公开的语言' : '',
    };
  };
  registerDriftBottleCommands(ctx, store, moderator);
  registerSignatureCommands(ctx, store, moderator);
  await ctx.start();

  await dispatchGroupMessage(ctx, client, 10001, inmsg`漂流瓶署名 海风`);
  await dispatchGroupMessage(ctx, client, 10001, inmsg`漂流瓶署名 违规别名`);
  await dispatchGroupMessage(ctx, client, 10001, inmsg`扔瓶子 来自海上的问候`);
  await dispatchGroupMessage(ctx, client, 10001, inmsg`扔瓶子 ${inseg.record()}`);
  await dispatchGroupMessage(ctx, client, 10001, inmsg`扔瓶子 违规内容`);
  await dispatchGroupMessage(ctx, client, 10001, inmsg`扔瓶子 审核故障`);
  await dispatchGroupMessage(ctx, client, 10002, inmsg`捡瓶子`);
  await dispatchGroupMessage(ctx, client, 10001, inmsg`漂流瓶署名 匿名`);
  await dispatchGroupMessage(ctx, client, 10001, inmsg`扔瓶子 匿名问候`);
  await dispatchGroupMessage(ctx, client, 10002, inmsg`捡瓶子`);
  await dispatchGroupMessage(ctx, client, 10003, inmsg`捡瓶子`);
  const quoted = client.inbox.group({ groupId: 20001, userId: 10002 }, [
    inseg.text('不会被带入的文字'),
    inseg.image({ tempUrl: 'https://example.com/image' }),
    inseg.video({ tempUrl: 'https://example.com/video' }),
    inseg.face(14),
    inseg.marketFace({ summary: '动态表情', url: 'https://example.com/face.gif' }),
    inseg.forward({ title: '聊天记录' }),
  ]);
  await dispatchGroupMessage(ctx, client, 10001, inmsg`${inseg.reply(quoted)}扔瓶子`);
  await dispatchGroupMessage(ctx, client, 10001, inmsg`漂流瓶署名 原名`);

  assert.deepEqual(moderatedSegmentTypes, ['image', 'video', 'face', 'market_face', 'forward']);
  assert.deepEqual(store.signatureFor(10001), { type: 'original' });

  const replies = client.apiCalls
    .filter((call) => call.endpoint === 'send_group_message')
    .map((call) => call.params as milky.SendGroupMessageInput_ZodInput)
    .map((reply) => ({
      ...reply,
      message: reply.message.map((segment) =>
        segment.type === 'text'
          ? {
              ...segment,
              data: {
                text: segment.data.text.replace(
                  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
                  '<id>',
                ),
              },
            }
          : segment,
      ),
    }));

  assert.deepEqual(replies, [
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '之后扔出的漂流瓶将使用别名“海风”。' } }],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '漂流瓶别名未通过 AI 审核：包含不适宜公开的语言' } }],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '漂流瓶已经扔进海里了（ID：<id>）。' } }],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '漂流瓶只支持文字、图片、视频、表情、动态表情和合并转发消息。' } }],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '漂流瓶未通过 AI 审核：包含不适宜公开的语言' } }],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: 'AI 审核暂时不可用，请稍后再试。' } }],
    },
    {
      group_id: 20001,
      message: [
        { type: 'text', data: { text: '捡到一个来自“海风”的漂流瓶（ID：<id>）：\n' } },
        { type: 'text', data: { text: '来自海上的问候' } },
        { type: 'text', data: { text: '\n\n发送“评论漂流瓶 <id> <内容>”可以评论这个瓶子。' } },
      ],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '之后扔出的漂流瓶将保持匿名。' } }],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '漂流瓶已经扔进海里了（ID：<id>）。' } }],
    },
    {
      group_id: 20001,
      message: [
        { type: 'text', data: { text: '捡到一个匿名漂流瓶（ID：<id>）：\n' } },
        { type: 'text', data: { text: '匿名问候' } },
        { type: 'text', data: { text: '\n\n发送“评论漂流瓶 <id> <内容>”可以评论这个瓶子。' } },
      ],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '海里暂时没有漂流瓶。' } }],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '漂流瓶已经扔进海里了（ID：<id>）。' } }],
    },
    {
      group_id: 20001,
      message: [{ type: 'text', data: { text: '之后扔出的漂流瓶将使用当前群昵称或 QQ 昵称。' } }],
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
