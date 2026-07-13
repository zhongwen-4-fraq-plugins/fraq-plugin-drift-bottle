import { type Context, type milky, param, type Session } from '@fraqjs/fraq';

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

  function parseUserIds(segments: milky.IncomingSegment[]): number[] | undefined {
    const userIds: number[] = [];
    for (const segment of segments) {
      if (segment.type === 'mention') {
        userIds.push(segment.data.user_id);
        continue;
      }
      if (segment.type !== 'text') {
        return undefined;
      }

      const text = segment.data.text.trim();
      if (!text) {
        continue;
      }
      for (const value of text.split(/[\s,，]+/)) {
        if (!/^\d+$/.test(value)) {
          return undefined;
        }
        userIds.push(Number(value));
      }
    }

    const uniqueUserIds = [...new Set(userIds)];
    return uniqueUserIds.length > 0 && uniqueUserIds.every(validUserId) ? uniqueUserIds : undefined;
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
  permissions.command('添加').execute(async (session) => {
    await session.reply('请使用“漂流瓶权限 添加 <QQ号或@用户...>”。');
  });
  permissions
    .command('添加')
    .arg('users', param.catchAll())
    .execute(async (session, { users }) => {
      if (!isOwner(session)) {
        await session.reply('只有插件主人可以管理漂流瓶权限。');
        return;
      }
      const userIds = parseUserIds(users);
      if (!userIds) {
        await session.reply('请输入有效的 QQ 号或提及用户。');
        return;
      }
      for (const userId of userIds) {
        store.addModerator(userId);
      }
      await session.reply(`已允许 ${userIds.join('、')} 删除漂流瓶。`);
    });

  permissions.command('删除').execute(async (session) => {
    await session.reply('请使用“漂流瓶权限 删除 <QQ号或@用户...>”。');
  });
  permissions
    .command('删除')
    .arg('users', param.catchAll())
    .execute(async (session, { users }) => {
      if (!isOwner(session)) {
        await session.reply('只有插件主人可以管理漂流瓶权限。');
        return;
      }
      const userIds = parseUserIds(users);
      if (!userIds) {
        await session.reply('请输入有效的 QQ 号或提及用户。');
        return;
      }
      const removed = userIds.filter((userId) => store.removeModerator(userId));
      await session.reply(
        removed.length > 0 ? `已移除 ${removed.join('、')} 的删除权限。` : '这些用户都不在权限列表中。',
      );
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
