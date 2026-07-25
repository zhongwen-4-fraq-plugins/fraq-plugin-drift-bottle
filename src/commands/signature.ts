import { type Context, param } from '@fraqjs/fraq';

import { type DriftBottleApi, DriftBottleApiError, type UpdateSignatureResult } from '../api/drift-bottle-api.js';

export function registerSignatureCommands(ctx: Context, api: DriftBottleApi): void {
  ctx.router
    .command('漂流瓶署名')
    .describe('设置漂流瓶匿名、原名或别名署名')
    .execute(async (session) => {
      await session.reply('请使用“漂流瓶署名 匿名”、“漂流瓶署名 原名”或“漂流瓶署名 <别名>”。');
    });

  ctx.router
    .command('漂流瓶署名')
    .describe('设置漂流瓶匿名、原名或别名署名')
    .arg('name', param.greedy())
    .execute(async (session, { name }) => {
      const alias = name.trim();

      if (alias === '匿名') {
        await api.updateSignature(session.raw, { type: 'anonymous' });
        await session.reply('之后扔出的漂流瓶将保持匿名。');
        return;
      }

      if (alias === '原名') {
        await api.updateSignature(session.raw, { type: 'original' });
        await session.reply('之后扔出的漂流瓶将使用当前群昵称或 QQ 昵称。');
        return;
      }

      let result: UpdateSignatureResult;
      try {
        result = await api.updateSignature(session.raw, { type: 'alias', name: alias });
      } catch (error) {
        if (error instanceof DriftBottleApiError && error.code === 'moderation') {
          ctx.logger.error('漂流瓶别名 AI 审核失败', error);
          await session.reply('AI 审核暂时不可用，请稍后再试。');
          return;
        }
        throw error;
      }

      if (result.status === 'too-long') {
        await session.reply('漂流瓶别名不能超过 20 个字符。');
        return;
      }
      if (result.status === 'rejected') {
        await session.reply(`漂流瓶别名未通过 AI 审核：${result.reason}`);
        return;
      }

      await session.reply(`之后扔出的漂流瓶将使用别名“${alias}”。`);
    });
}
