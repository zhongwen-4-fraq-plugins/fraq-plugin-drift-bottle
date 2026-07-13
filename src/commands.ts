import { type Context, param } from '@fraqjs/fraq';

import { hasBottleContent, toOutgoingSegments } from './message.js';
import type { BottleStore } from './storage.js';

export function registerDriftBottleCommands(ctx: Context, store: BottleStore, deleteAfterPick: boolean): void {
  ctx.router
    .command('扔漂流瓶')
    .describe('将一条匿名消息放入漂流瓶')
    .execute(async (session) => {
      await session.reply('请在“扔漂流瓶”后面写下内容。');
    });

  ctx.router
    .command('扔漂流瓶')
    .describe('将一条匿名消息放入漂流瓶')
    .arg('content', param.catchAll())
    .execute(async (session, { content }) => {
      if (!hasBottleContent(content)) {
        await session.reply('漂流瓶里不能只有空白内容。');
        return;
      }

      await store.add({
        senderId: session.raw.sender_id,
        source: {
          scene: session.raw.message_scene,
          peerId: session.raw.peer_id,
        },
        segments: content,
      });
      await session.reply('漂流瓶已经扔进海里了。');
    });

  ctx.router
    .command('捡漂流瓶')
    .describe('随机捡取一个漂流瓶')
    .execute(async (session) => {
      const bottle = await store.pick(deleteAfterPick);

      if (!bottle) {
        await session.reply('海里暂时没有漂流瓶。');
        return;
      }

      await session.reply([
        { type: 'text', data: { text: '捡到一个漂流瓶：\n' } },
        ...(await toOutgoingSegments(ctx.client, bottle.segments)),
      ]);
    });
}
