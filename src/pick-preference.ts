import { type Context, param } from '@fraqjs/fraq';

import type { BottleStore } from './storage.js';

export function deleteAfterPickFor(store: BottleStore, userId: number, defaultValue: boolean): boolean {
  const repeatPick = store.repeatPickFor(userId);
  return repeatPick === undefined ? defaultValue : !repeatPick;
}

export function registerPickPreferenceCommand(ctx: Context, store: BottleStore, defaultDeleteAfterPick: boolean): void {
  ctx.router
    .command('漂流瓶重复捡')
    .describe('设置个人捡取后是否保留漂流瓶')
    .execute(async (session) => {
      const repeatPick = store.repeatPickFor(session.raw.sender_id);
      const enabled = repeatPick ?? !defaultDeleteAfterPick;
      await session.reply(
        `当前设置：${enabled ? '开启' : '关闭'}${repeatPick === undefined ? '（使用全局默认）' : ''}。\n` +
          '请使用“漂流瓶重复捡 开启”、“漂流瓶重复捡 关闭”或“漂流瓶重复捡 默认”。',
      );
    });

  ctx.router
    .command('漂流瓶重复捡')
    .describe('设置个人捡取后是否保留漂流瓶')
    .arg('mode', param.union('开启', '关闭', '默认', '是', '否'))
    .execute(async (session, { mode }) => {
      if (mode === '默认') {
        store.setRepeatPick(session.raw.sender_id);
        await session.reply('已恢复使用全局捡取设置。');
        return;
      }

      const enabled = mode === '开启' || mode === '是';
      store.setRepeatPick(session.raw.sender_id, enabled);
      await session.reply(
        enabled ? '已开启重复捡瓶子，之后捡到的瓶子会保留。' : '已关闭重复捡瓶子，之后捡到的瓶子会删除。',
      );
    });
}
