import { type Context, type milky, param, type Session } from '@fraqjs/fraq';

import { type DriftBottleApi, DriftBottleApiError, type PublishCommentResult } from '../api/drift-bottle-api.js';

export function registerCommentCommands(ctx: Context, api: DriftBottleApi): void {
  async function showComments(session: Session, bottleId: string): Promise<void> {
    const result = await api.commentsFor(bottleId);
    if (!result) {
      await session.reply('没有找到这个漂流瓶。');
      return;
    }

    if (result.comments.length === 0) {
      await session.reply('这个漂流瓶还没有评论。');
      return;
    }

    const lines = result.comments.map(
      (comment, index) =>
        `${result.total - result.comments.length + index + 1}. ${comment.displayName ?? '匿名'}：${comment.content}`,
    );
    await session.reply(
      [
        `漂流瓶 ${bottleId} 的评论（共 ${result.total} 条）：`,
        ...lines,
        result.total > result.comments.length ? '仅显示最新 20 条。' : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  async function handleComment(session: Session, input: string): Promise<void> {
    const match = input.trim().match(/^(\S+)(?:\s+([\s\S]+))?$/);
    if (!match) {
      await session.reply('请使用“评论漂流瓶 <ID> <内容>”；省略内容可查看评论。');
      return;
    }

    const bottleId = match[1];
    const content = match[2]?.trim();
    if (!content) {
      await showComments(session, bottleId);
      return;
    }

    let result: PublishCommentResult;
    try {
      result = await api.publishComment(session.raw, bottleId, content);
    } catch (error) {
      if (error instanceof DriftBottleApiError && error.code === 'moderation') {
        ctx.logger.error('漂流瓶评论 AI 审核失败', error);
        await session.reply('AI 审核暂时不可用，请稍后再试。');
        return;
      }
      ctx.logger.error('发布漂流瓶评论失败', error);
      await session.reply('发布评论失败，请稍后再试。');
      return;
    }

    if (result.status === 'not-found') {
      await session.reply('没有找到这个漂流瓶。');
      return;
    }
    if (result.status === 'too-long') {
      await session.reply('漂流瓶评论不能超过 500 个字符。');
      return;
    }
    if (result.status === 'rejected') {
      await session.reply(
        result.target === 'content'
          ? `漂流瓶评论未通过 AI 审核：${result.reason}`
          : `评论署名未通过 AI 审核：${result.reason}`,
      );
      return;
    }
    await session.reply('评论已发布。');
  }

  async function handleReplyComment(
    session: Session,
    reply: Extract<milky.IncomingSegment, { type: 'reply' }>,
    content?: string,
  ): Promise<void> {
    let bottleId: string | undefined;
    try {
      bottleId = await api.bottleIdFromReply(reply, session.raw);
    } catch (error) {
      ctx.logger.error('读取被回复的漂流瓶消息失败', error);
      await session.reply('无法读取被回复的漂流瓶消息，请稍后再试。');
      return;
    }
    if (!bottleId) {
      await session.reply('被回复的消息中没有找到漂流瓶 ID。');
      return;
    }

    await handleComment(session, content?.trim() ? `${bottleId} ${content}` : bottleId);
  }

  function register(commandName: string): void {
    ctx.router
      .command(commandName)
      .describe('评论或查看漂流瓶评论')
      .execute(async (session) => {
        await session.reply('请使用“评论漂流瓶 <ID> <内容>”，或回复漂流瓶消息后发送“评论漂流瓶 <内容>”。');
      });
    ctx.router
      .command(commandName)
      .describe('评论或查看漂流瓶评论')
      .arg('input', param.greedy())
      .execute(async (session, { input }) => {
        await handleComment(session, input);
      });
    ctx.router
      .rawPattern()
      .arg('reply', param.segment('reply'))
      .arg('command', param.literal(commandName))
      .arg('content', param.greedy())
      .execute(async (session, { reply, content }) => {
        await handleReplyComment(session, reply, content);
      });
    ctx.router
      .rawPattern()
      .arg('reply', param.segment('reply'))
      .arg('command', param.literal(commandName))
      .execute(async (session, { reply }) => {
        await handleReplyComment(session, reply);
      });
  }

  register('评论漂流瓶');
  register('漂流瓶评论');
}
