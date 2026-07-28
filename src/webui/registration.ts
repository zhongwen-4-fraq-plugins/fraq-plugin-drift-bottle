import { type Logger, type MilkyClient, type milky, msg } from '@fraqjs/fraq';

import { parseQqAccount, type WebuiAuth, type WebuiRegistrationRequestResult } from './auth.js';

export type RegistrationSubmissionResult = WebuiRegistrationRequestResult | 'notification-unavailable';

export class WebuiRegistration {
  private readonly ownerIds: number[];

  constructor(
    private readonly auth: WebuiAuth,
    private readonly client: MilkyClient,
    ownerIds: number[],
    private readonly logger: Logger,
  ) {
    this.ownerIds = [...new Set(ownerIds.filter((ownerId) => Number.isSafeInteger(ownerId) && ownerId > 0))];
  }

  async submit(userId: number, password: string): Promise<RegistrationSubmissionResult> {
    if (this.ownerIds.length === 0) {
      return 'notification-unavailable';
    }
    const result = await this.auth.requestRegistration(userId, password);
    if (result !== 'created') {
      return result;
    }

    const message = `收到 WebUI 账号注册请求：${userId}\n回复本消息并发送“同意”即可审批。`;
    if ((await this.notifyOwners(message)) === 0) {
      this.auth.cancelRegistration(userId);
      return 'notification-unavailable';
    }
    return 'created';
  }

  async approve(userId: number, approvedBy: number): Promise<boolean> {
    if (!this.auth.approveRegistration(userId, approvedBy)) {
      return false;
    }

    const nickname = await this.resolveNickname(approvedBy);
    await this.notifyOwners(`WebUI 账号 ${userId} 注册成功。\n该请求已由"${nickname} [${approvedBy}]"同意。`);
    return true;
  }

  async userIdFromReply(
    reply: Extract<milky.IncomingSegment, { type: 'reply' }>,
    message: milky.IncomingMessage,
    selfId: number,
  ): Promise<number | undefined> {
    if (reply.data.sender_id !== selfId) {
      return undefined;
    }

    const embeddedUserId = registrationUserId(reply.data.segments);
    if (embeddedUserId) {
      return embeddedUserId;
    }

    const result = await this.client.get_message({
      message_scene: message.message_scene,
      peer_id: message.peer_id,
      message_seq: reply.data.message_seq,
    });
    if (result.message.sender_id !== selfId) {
      return undefined;
    }
    return registrationUserId(result.message.segments);
  }

  private async notifyOwners(text: string): Promise<number> {
    const deliveries = await Promise.allSettled(
      this.ownerIds.map((ownerId) => this.client.send_private_message({ user_id: ownerId, message: msg`${text}` })),
    );
    let delivered = 0;
    deliveries.forEach((delivery, index) => {
      if (delivery.status === 'fulfilled') {
        delivered += 1;
        return;
      }
      this.logger.error(`向插件主人 ${this.ownerIds[index]} 发送 WebUI 账号通知失败`, delivery.reason);
    });
    return delivered;
  }

  private async resolveNickname(userId: number): Promise<string> {
    try {
      const profile = await this.client.get_user_profile({ user_id: userId });
      return profile.nickname.replace(/\s+/g, ' ').trim().slice(0, 32) || '未知昵称';
    } catch (error) {
      this.logger.error(`获取审批者 ${userId} 的 QQ 昵称失败`, error);
      return '未知昵称';
    }
  }
}

function registrationUserId(segments: milky.IncomingSegment[]): number | undefined {
  const text = segments
    .filter((segment) => segment.type === 'text')
    .map((segment) => segment.data.text)
    .join('');
  const match = text.match(/^收到 WebUI 账号注册请求：([1-9]\d{4,11})(?:\n|$)/);
  return parseQqAccount(match?.[1]);
}
