import { type Context, param } from '@fraqjs/fraq';

import { hasBottleContent, hasOnlySupportedBottleSegments, toOutgoingSegments } from './message.js';
import type { BottleModerator, ModerationResult } from './moderation.js';
import type { BottleStore } from './storage.js';

export function registerDriftBottleCommands(
  ctx: Context,
  store: BottleStore,
  deleteAfterPick: boolean,
  moderator: BottleModerator,
): void {
  ctx.router
    .command('扔漂流瓶')
    .describe('将一条消息放入漂流瓶')
    .execute(async (session) => {
      await session.reply('请在“扔漂流瓶”后面写下内容。');
    });

  ctx.router
    .command('扔漂流瓶')
    .describe('将一条消息放入漂流瓶')
    .arg('content', param.catchAll())
    .execute(async (session, { content }) => {
      if (!hasBottleContent(content)) {
        await session.reply('漂流瓶里不能只有空白内容。');
        return;
      }

      if (!hasOnlySupportedBottleSegments(content)) {
        await session.reply('漂流瓶只支持文字、图片和视频。');
        return;
      }

      let moderation: ModerationResult;
      try {
        moderation = await moderator(content);
      } catch (error) {
        ctx.logger.error('漂流瓶 AI 审核失败', error);
        await session.reply('AI 审核暂时不可用，请稍后再试。');
        return;
      }

      if (!moderation.approved) {
        await session.reply(`漂流瓶未通过 AI 审核：${moderation.reason}`);
        return;
      }

      await store.add({
        senderId: session.raw.sender_id,
        displayName: store.aliasFor(session.raw.sender_id),
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
        {
          type: 'text',
          data: {
            text: bottle.displayName ? `捡到一个来自“${bottle.displayName}”的漂流瓶：\n` : '捡到一个匿名漂流瓶：\n',
          },
        },
        ...(await toOutgoingSegments(ctx.client, bottle.segments)),
      ]);
    });
}
