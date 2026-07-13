import { type Context, param, type Session } from '@fraqjs/fraq';

import type { BottleStore } from './storage.js';

export function registerAdministrationCommands(ctx: Context, store: BottleStore, ownerIds: number[]): void {
  function isOwner(session: Session): boolean {
    return ownerIds.includes(session.raw.sender_id);
  }

  function canDelete(session: Session): boolean {
    return (
      isOwner(session) ||
      store.isModerator(session.raw.sender_id) ||
      (session.raw.message_scene === 'group' && session.raw.group_member.role !== 'member')
    );
  }

  function validUserId(userId: number): boolean {
    return Number.isSafeInteger(userId) && userId > 0;
  }

  ctx.router
    .command('删除漂流瓶')
    .describe('按 ID 删除漂流瓶')
    .execute(async (session) => {
      await session.reply('请使用“删除漂流瓶 <ID>”。');
    });

  ctx.router
    .command('删除漂流瓶')
    .describe('按 ID 删除漂流瓶')
    .arg('id', param.greedy())
    .execute(async (session, { id }) => {
      if (!canDelete(session)) {
        await session.reply('你没有删除漂流瓶的权限。');
        return;
      }

      const bottleId = id.trim();
      if (!bottleId || !store.deleteBottle(bottleId)) {
        await session.reply('没有找到这个漂流瓶。');
        return;
      }
      await session.reply('漂流瓶已删除。');
    });

  ctx.router
    .command('漂流瓶权限')
    .describe('管理漂流瓶删除权限')
    .execute(async (session) => {
      await session.reply('请使用“漂流瓶权限 添加 <QQ号>”、“漂流瓶权限 删除 <QQ号>”或“漂流瓶权限 列表”。');
    });

  const permissions = ctx.router.group('漂流瓶权限');
  permissions
    .command('添加')
    .arg('userId', param.num())
    .execute(async (session, { userId }) => {
      if (!isOwner(session)) {
        await session.reply('只有插件主人可以管理漂流瓶权限。');
        return;
      }
      if (!validUserId(userId)) {
        await session.reply('请输入有效的 QQ 号。');
        return;
      }
      store.addModerator(userId);
      await session.reply(`已允许 ${userId} 删除漂流瓶。`);
    });

  permissions
    .command('删除')
    .arg('userId', param.num())
    .execute(async (session, { userId }) => {
      if (!isOwner(session)) {
        await session.reply('只有插件主人可以管理漂流瓶权限。');
        return;
      }
      if (!validUserId(userId)) {
        await session.reply('请输入有效的 QQ 号。');
        return;
      }
      await session.reply(store.removeModerator(userId) ? `已移除 ${userId} 的删除权限。` : '该用户不在权限列表中。');
    });

  permissions.command('列表').execute(async (session) => {
    if (!isOwner(session)) {
      await session.reply('只有插件主人可以管理漂流瓶权限。');
      return;
    }
    const users = store.moderators();
    await session.reply(users.length > 0 ? `漂流瓶删除权限列表：\n${users.join('\n')}` : '漂流瓶删除权限列表为空。');
  });
}
