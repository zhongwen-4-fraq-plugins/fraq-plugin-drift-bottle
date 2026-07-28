import { type Context, param, type Session } from '@fraqjs/fraq';

import type { WebuiRegistration } from '../webui/registration.js';

export function registerWebuiAccountCommands(ctx: Context, registration: WebuiRegistration, ownerIds: number[]): void {
  function isOwner(session: Session): boolean {
    return ownerIds.includes(session.raw.sender_id);
  }

  ctx.router
    .rawPattern()
    .arg('reply', param.segment('reply'))
    .arg('approval', param.literal('同意'))
    .execute(async (session, { reply }) => {
      if (!isOwner(session)) {
        await session.reply('只有插件主人可以审批 WebUI 账号。');
        return;
      }

      let userId: number | undefined;
      try {
        userId = await registration.userIdFromReply(reply, session.raw, session.selfId);
      } catch (error) {
        ctx.logger.error('读取 WebUI 账号注册请求失败', error);
        await session.reply('无法读取被回复的账号请求，请稍后再试。');
        return;
      }
      if (!userId) {
        await session.reply('被回复的消息不是 WebUI 账号注册请求。');
        return;
      }
      if (!(await registration.approve(userId, session.raw.sender_id))) {
        await session.reply('没有找到这个 QQ 号的待审批申请。');
        return;
      }
      await session.reply(`已同意 QQ ${userId} 的 WebUI 账号申请。`);
    });
}
