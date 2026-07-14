import { type Context, type milky, param, type Session } from '@fraqjs/fraq';

import {
  hasBottleContent,
  hasOnlySupportedBottleSegments,
  loadForwardMessages,
  resolveBottleContent,
  toOutgoingSegments,
} from './message.js';
import type { BottleModerator, ModerationResult } from './moderation.js';
import { shouldRemovePickedBottle } from './pick-preference.js';
import { type ResolvedBottleSignature, resolveBottleSignature } from './signature.js';
import type { BottleStore } from './storage.js';
import type { BottleSegment } from './types.js';

export function registerDriftBottleCommands(ctx: Context, store: BottleStore, moderator: BottleModerator): void {
  async function replyForwardBottle(session: Session, segments: milky.OutgoingSegment_ZodInput[]): Promise<void> {
    let regularSegments: milky.OutgoingSegment_ZodInput[] = [];
    for (const segment of segments) {
      if (segment.type !== 'forward') {
        regularSegments.push(segment);
        continue;
      }

      if (regularSegments.length > 0) {
        await session.reply(regularSegments);
        regularSegments = [];
      }
      await session.reply([segment]);
    }
    if (regularSegments.length > 0) {
      await session.reply(regularSegments);
    }
  }

  async function throwBottle(session: Session, content: milky.IncomingSegment[]): Promise<void> {
    let bottleContent: milky.IncomingSegment[];
    try {
      bottleContent = await resolveBottleContent(ctx.client, content, session.raw);
    } catch (error) {
      ctx.logger.error('读取被回复的消息失败', error);
      await session.reply('无法读取被回复的消息，请稍后再试。');
      return;
    }

    if (!hasBottleContent(bottleContent)) {
      await session.reply('漂流瓶里不能只有空白内容。');
      return;
    }

    if (!hasOnlySupportedBottleSegments(bottleContent)) {
      await session.reply('漂流瓶只支持文字、图片、视频、表情、动态表情和合并转发消息。');
      return;
    }

    let storedContent: BottleSegment[];
    try {
      storedContent = await loadForwardMessages(ctx.client, bottleContent);
    } catch (error) {
      ctx.logger.error('读取合并转发消息失败', error);
      await session.reply('无法读取合并转发消息，请稍后再试。');
      return;
    }

    let moderation: ModerationResult;
    try {
      moderation = await moderator(storedContent);
    } catch (error) {
      ctx.logger.error('漂流瓶 AI 审核失败', error);
      await session.reply('AI 审核暂时不可用，请稍后再试。');
      return;
    }

    if (!moderation.approved) {
      await session.reply(`漂流瓶未通过 AI 审核：${moderation.reason}`);
      return;
    }

    let signature: ResolvedBottleSignature;
    try {
      signature = await resolveBottleSignature(ctx.client, store, session.raw);
      if (signature.displayName && signature.needsModeration) {
        const result = await moderator([{ type: 'text', data: { text: signature.displayName } }]);
        if (!result.approved) {
          await session.reply(`漂流瓶原名未通过 AI 审核：${result.reason}`);
          return;
        }
      }
    } catch (error) {
      ctx.logger.error('读取漂流瓶原名失败', error);
      await session.reply('无法读取当前昵称，请稍后再试。');
      return;
    }

    const bottle = await store.add({
      senderId: session.raw.sender_id,
      displayName: signature.displayName,
      source: {
        scene: session.raw.message_scene,
        peerId: session.raw.peer_id,
      },
      segments: storedContent,
    });
    await session.reply(`漂流瓶已经扔进海里了（ID：${bottle.id}）。`);
  }

  ctx.router
    .command('扔瓶子')
    .describe('将一条消息放入漂流瓶')
    .execute(async (session) => {
      await session.reply('请在“扔瓶子”后面写下内容。');
    });

  ctx.router
    .command('扔瓶子')
    .describe('将一条消息放入漂流瓶')
    .arg('content', param.catchAll())
    .execute(async (session, { content }) => {
      await throwBottle(session, content);
    });

  ctx.router
    .rawPattern()
    .arg('reply', param.segment('reply'))
    .arg('command', param.literal('扔瓶子'))
    .arg('content', param.catchAll())
    .execute(async (session, { content }) => {
      await throwBottle(session, content);
    });

  ctx.router
    .rawPattern()
    .arg('reply', param.segment('reply'))
    .arg('command', param.literal('扔瓶子'))
    .execute(async (session) => {
      await throwBottle(session, []);
    });

  ctx.router
    .command('捡瓶子')
    .describe('随机捡取一个漂流瓶')
    .execute(async (session) => {
      const bottle = await store.pick(shouldRemovePickedBottle(store, session.raw.sender_id));

      if (!bottle) {
        await session.reply('海里暂时没有漂流瓶。');
        return;
      }

      const bottleDescription = bottle.displayName ? `来自“${bottle.displayName}”的` : '匿名';
      const outgoingSegments = await toOutgoingSegments(ctx.client, bottle.segments, session.selfId);
      if (outgoingSegments.some((segment) => segment.type === 'forward')) {
        await session.reply(
          `捡到一个${bottleDescription}漂流瓶（ID：${bottle.id}）。\n` +
            '回复本消息并发送“评论漂流瓶 <内容>”可以评论这个瓶子。',
        );
        await replyForwardBottle(session, outgoingSegments);
        return;
      }

      await session.reply([
        {
          type: 'text',
          data: {
            text: `捡到一个${bottleDescription}漂流瓶（ID：${bottle.id}）：\n`,
          },
        },
        ...outgoingSegments,
        {
          type: 'text',
          data: { text: `\n\n发送“评论漂流瓶 ${bottle.id} <内容>”可以评论这个瓶子。` },
        },
      ]);
    });
}
