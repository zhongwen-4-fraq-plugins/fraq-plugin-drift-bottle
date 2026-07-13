import { type Context, param, type Session } from '@fraqjs/fraq';

import type { BottleModerator, ModerationResult } from './moderation.js';
import { resolveBottleSignature } from './signature.js';
import type { BottleStore } from './storage.js';

export function registerCommentCommands(ctx: Context, store: BottleStore, moderator: BottleModerator): void {
  async function showComments(session: Session, bottleId: string): Promise<void> {
    if (!store.hasBottle(bottleId)) {
      await session.reply('没有找到这个漂流瓶。');
      return;
    }

    const comments = store.commentsFor(bottleId);
    if (comments.length === 0) {
      await session.reply('这个漂流瓶还没有评论。');
      return;
    }

    const total = store.commentCount(bottleId);
    const lines = comments.map(
      (comment, index) =>
        `${total - comments.length + index + 1}. ${comment.displayName ?? '匿名'}：${comment.content}`,
    );
    await session.reply(
      [`漂流瓶 ${bottleId} 的评论（共 ${total} 条）：`, ...lines, total > comments.length ? '仅显示最新 20 条。' : '']
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
    if (!store.hasBottle(bottleId)) {
      await session.reply('没有找到这个漂流瓶。');
      return;
    }
    if ([...content].length > 500) {
      await session.reply('漂流瓶评论不能超过 500 个字符。');
      return;
    }

    let moderation: ModerationResult;
    try {
      moderation = await moderator([{ type: 'text', data: { text: content } }]);
    } catch (error) {
      ctx.logger.error('漂流瓶评论 AI 审核失败', error);
      await session.reply('AI 审核暂时不可用，请稍后再试。');
      return;
    }
    if (!moderation.approved) {
      await session.reply(`漂流瓶评论未通过 AI 审核：${moderation.reason}`);
      return;
    }

    try {
      const signature = await resolveBottleSignature(ctx.client, store, session.raw);
      if (signature.displayName && signature.needsModeration) {
        const result = await moderator([{ type: 'text', data: { text: signature.displayName } }]);
        if (!result.approved) {
          await session.reply(`评论署名未通过 AI 审核：${result.reason}`);
          return;
        }
      }

      const comment = store.addComment({
        bottleId,
        senderId: session.raw.sender_id,
        displayName: signature.displayName,
        content,
      });
      await session.reply(comment ? '评论已发布。' : '没有找到这个漂流瓶。');
    } catch (error) {
      ctx.logger.error('发布漂流瓶评论失败', error);
      await session.reply('发布评论失败，请稍后再试。');
    }
  }

  function register(commandName: string): void {
    ctx.router
      .command(commandName)
      .describe('评论或查看漂流瓶评论')
      .execute(async (session) => {
        await session.reply('请使用“评论漂流瓶 <ID> <内容>”；省略内容可查看评论。');
      });
    ctx.router
      .command(commandName)
      .describe('评论或查看漂流瓶评论')
      .arg('input', param.greedy())
      .execute(async (session, { input }) => {
        await handleComment(session, input);
      });
  }

  register('评论漂流瓶');
  register('漂流瓶评论');
}
