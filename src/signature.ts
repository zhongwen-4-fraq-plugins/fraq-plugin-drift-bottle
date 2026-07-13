import { type Context, type MilkyClient, type milky, param } from '@fraqjs/fraq';

import type { BottleModerator, ModerationResult } from './moderation.js';
import type { BottleStore } from './storage.js';

export interface ResolvedBottleSignature {
  displayName?: string;
  needsModeration: boolean;
}

export async function resolveBottleSignature(
  client: MilkyClient,
  store: BottleStore,
  message: milky.IncomingMessage,
): Promise<ResolvedBottleSignature> {
  const signature = store.signatureFor(message.sender_id);
  if (signature.type === 'anonymous') {
    return { needsModeration: false };
  }
  if (signature.type === 'alias') {
    return { displayName: signature.name, needsModeration: false };
  }

  if (message.message_scene === 'group') {
    return { displayName: message.group_member.card.trim() || message.group_member.nickname, needsModeration: true };
  }
  if (message.message_scene === 'friend') {
    return { displayName: message.friend.nickname, needsModeration: true };
  }

  const profile = await client.get_user_profile({ user_id: message.sender_id });
  return { displayName: profile.nickname, needsModeration: true };
}

export function registerSignatureCommands(ctx: Context, store: BottleStore, moderator: BottleModerator): void {
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
        store.setSignature(session.raw.sender_id, { type: 'anonymous' });
        await session.reply('之后扔出的漂流瓶将保持匿名。');
        return;
      }

      if (alias === '原名') {
        store.setSignature(session.raw.sender_id, { type: 'original' });
        await session.reply('之后扔出的漂流瓶将使用当前群昵称或 QQ 昵称。');
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

      store.setSignature(session.raw.sender_id, { type: 'alias', name: alias });
      await session.reply(`之后扔出的漂流瓶将使用别名“${alias}”。`);
    });
}
