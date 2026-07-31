import { type Context, param, type Session } from '@fraqjs/fraq';

import type { DriftBottleApi } from '../api/drift-bottle-api.js';
import type { ApproveModerationRecordResult, RejectModerationRecordResult } from '../persistence/bottle-store.js';

export function registerModerationCommands(ctx: Context, api: DriftBottleApi, ownerIds: number[]): void {
  async function canModerate(session: Session): Promise<boolean> {
    return ownerIds.includes(session.raw.sender_id) || api.isModerator(session.raw.sender_id);
  }

  async function ensurePermission(session: Session): Promise<boolean> {
    if (await canModerate(session)) return true;
    await session.reply('只有插件主人和漂流瓶管理员可以人工审核。');
    return false;
  }

  async function approve(session: Session, rawId: string): Promise<void> {
    if (!(await ensurePermission(session))) return;
    const id = rawId.trim();
    if (!id) {
      await session.reply('请使用“漂流瓶审核 通过 <审核记录ID>”。');
      return;
    }

    const result = await api.approveModerationRecord(id, session.raw.sender_id);
    await session.reply(approvalMessage(result));
  }

  async function reject(session: Session, input: string): Promise<void> {
    if (!(await ensurePermission(session))) return;
    const match = input.trim().match(/^(\S+)(?:\s+([\s\S]+))?$/);
    const id = match?.[1];
    const reason = match?.[2]?.trim();
    if (!id || !reason) {
      await session.reply('请使用“漂流瓶审核 拒绝 <审核记录ID> <拒绝理由>”。');
      return;
    }

    const result = await api.rejectModerationRecord(id, session.raw.sender_id, reason);
    await session.reply(rejectionMessage(result));
  }

  ctx.router
    .command('漂流瓶审核')
    .describe('人工处理待审核漂流瓶')
    .execute(async (session) => {
      await session.reply('请使用“漂流瓶审核 通过 <审核记录ID>”或“漂流瓶审核 拒绝 <审核记录ID> <拒绝理由>”。');
    });

  const moderation = ctx.router.group('漂流瓶审核');
  moderation.command('通过').execute(async (session) => {
    await approve(session, '');
  });
  moderation
    .command('通过')
    .arg('id', param.greedy())
    .execute(async (session, { id }) => {
      await approve(session, id);
    });

  moderation.command('拒绝').execute(async (session) => {
    await reject(session, '');
  });
  moderation
    .command('拒绝')
    .arg('input', param.greedy())
    .execute(async (session, { input }) => {
      await reject(session, input);
    });
}

function approvalMessage(result: ApproveModerationRecordResult): string {
  switch (result.status) {
    case 'approved':
      return `审核已通过，漂流瓶已经扔进海里了（ID：${result.bottle.id}）。`;
    case 'not-found':
      return '没有找到这个审核记录。';
    case 'already-resolved':
      return '这个审核记录已经处理过了。';
    case 'not-pending':
      return '这个审核记录不需要人工处理。';
    case 'publish-unavailable':
      return '这个审核记录缺少完整投瓶信息，无法通过；可以使用拒绝命令归档。';
  }
}

function rejectionMessage(result: RejectModerationRecordResult): string {
  switch (result.status) {
    case 'rejected':
      return '审核已拒绝并归档。';
    case 'not-found':
      return '没有找到这个审核记录。';
    case 'already-resolved':
      return '这个审核记录已经处理过了。';
    case 'not-pending':
      return '这个审核记录不需要人工处理。';
    case 'invalid-reason':
      return '拒绝理由不能为空且不能超过 500 个字符。';
  }
}
