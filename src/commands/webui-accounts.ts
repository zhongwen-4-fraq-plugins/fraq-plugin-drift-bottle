import { type Context, param, type Session } from '@fraqjs/fraq';

import { parseQqAccount } from '../webui/auth.js';
import type { WebuiRegistration } from '../webui/registration.js';

export function registerWebuiAccountCommands(ctx: Context, registration: WebuiRegistration, ownerIds: number[]): void {
  function isOwner(session: Session): boolean {
    return ownerIds.includes(session.raw.sender_id);
  }

  const accounts = ctx.router.group('漂流瓶账号');
  accounts.command('同意').execute(async (session) => {
    await session.reply('请使用“漂流瓶账号 同意 <QQ号>”。');
  });
  accounts
    .command('同意')
    .arg('account', param.greedy())
    .execute(async (session, { account }) => {
      if (!isOwner(session)) {
        await session.reply('只有插件主人可以审批 WebUI 账号。');
        return;
      }
      const userId = parseQqAccount(account.trim());
      if (!userId) {
        await session.reply('请输入有效的 QQ 号。');
        return;
      }
      if (!(await registration.approve(userId, session.raw.sender_id))) {
        await session.reply('没有找到这个 QQ 号的待审批申请。');
        return;
      }
      await session.reply(`已同意 QQ ${userId} 的 WebUI 账号申请。`);
    });
}
