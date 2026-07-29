import { type Context, type milky, param, type Session } from '@fraqjs/fraq';

import { type CreateBottleResult, type DriftBottleApi, DriftBottleApiError } from '../api/drift-bottle-api.js';

export function registerDriftBottleCommands(ctx: Context, api: DriftBottleApi): void {
  async function replyBottleSegments(session: Session, segments: milky.OutgoingSegment_ZodInput[]): Promise<void> {
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
    let result: CreateBottleResult;
    try {
      result = await api.createBottle(session.raw, content);
    } catch (error) {
      const code = error instanceof DriftBottleApiError ? error.code : undefined;
      if (code === 'read-reply') {
        ctx.logger.error('读取被回复的消息失败', error);
        await session.reply('无法读取被回复的消息，请稍后再试。');
        return;
      }
      if (code === 'read-forward') {
        ctx.logger.error('读取合并转发消息失败', error);
        await session.reply('无法读取合并转发消息，请稍后再试。');
        return;
      }
      if (code === 'moderation') {
        ctx.logger.error('漂流瓶 AI 审核失败', error);
        await session.reply('AI 审核暂时不可用，请稍后再试。');
        return;
      }
      if (code === 'resolve-signature') {
        ctx.logger.error('读取漂流瓶署名失败', error);
        await session.reply('无法读取当前昵称，请稍后再试。');
        return;
      }
      throw error;
    }

    if (result.status === 'empty') {
      await session.reply('漂流瓶里不能只有空白内容。');
      return;
    }
    if (result.status === 'unsupported') {
      await session.reply('漂流瓶只支持文字、图片、视频、表情、动态表情和合并转发消息。');
      return;
    }
    if (result.status === 'rejected') {
      await session.reply(
        result.target === 'content'
          ? `漂流瓶未通过 AI 审核：${result.reason}`
          : `漂流瓶署名未通过 AI 审核：${result.reason}`,
      );
      return;
    }
    if (result.status === 'pending') {
      await session.reply('漂流瓶已提交人工审核，通过后会进入海里。');
      return;
    }
    await session.reply(`漂流瓶已经扔进海里了（ID：${result.bottle.id}）。`);
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
      const bottle = await api.pickBottle(session.raw.sender_id);

      if (!bottle) {
        await session.reply('海里暂时没有漂流瓶。');
        return;
      }

      const bottleDescription = bottle.displayName ? `来自“${bottle.displayName}”的` : '匿名';
      const outgoingSegments = await api.outgoingSegments(bottle, session.selfId);
      if (outgoingSegments.some((segment) => segment.type !== 'text')) {
        await session.reply(
          `捡到一个${bottleDescription}漂流瓶（ID：${bottle.id}）。\n` +
            '回复本消息并发送“评论漂流瓶 <内容>”可以评论这个瓶子。',
        );
        await replyBottleSegments(session, outgoingSegments);
        return;
      }

      await session.reply([
        {
          type: 'text',
          data: { text: `捡到一个${bottleDescription}漂流瓶（ID：${bottle.id}）：\n` },
        },
        ...outgoingSegments,
        {
          type: 'text',
          data: { text: `\n\n发送“评论漂流瓶 ${bottle.id} <内容>”可以评论这个瓶子。` },
        },
      ]);
    });
}
