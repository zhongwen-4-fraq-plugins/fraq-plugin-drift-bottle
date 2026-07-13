import { type Context, param } from '@fraqjs/fraq';

import type { BottleModerator, ModerationResult } from './moderation.js';
import type { BottleStore } from './storage.js';

export function registerSignatureCommands(ctx: Context, store: BottleStore, moderator: BottleModerator): void {
  ctx.router
    .command('漂流瓶署名')
    .describe('设置漂流瓶匿名投递或使用别名')
    .execute(async (session) => {
      await session.reply('请使用“漂流瓶署名 匿名”或“漂流瓶署名 <别名>”。');
    });

  ctx.router
    .command('漂流瓶署名')
    .describe('设置漂流瓶匿名投递或使用别名')
    .arg('name', param.greedy())
    .execute(async (session, { name }) => {
      const alias = name.trim();

      if (alias === '匿名') {
        store.setAlias(session.raw.sender_id);
        await session.reply('之后扔出的漂流瓶将保持匿名。');
        return;
      }

      if ([...alias].length > 20) {
        await session.reply('漂流瓶别名不能超过 20 个字符。');
        return;
      }

      let moderation: ModerationResult;
      try {
        moderation = await moderator([{ type: 'text', data: { text: alias } }]);
      } catch (error) {
        ctx.logger.error('漂流瓶别名 AI 审核失败', error);
        await session.reply('AI 审核暂时不可用，请稍后再试。');
        return;
      }

      if (!moderation.approved) {
        await session.reply(`漂流瓶别名未通过 AI 审核：${moderation.reason}`);
        return;
      }

      store.setAlias(session.raw.sender_id, alias);
      await session.reply(`之后扔出的漂流瓶将使用别名“${alias}”。`);
    });
}
