import type { MilkyClient, milky } from '@fraqjs/fraq';

import type { BottleStore } from '../persistence/bottle-store.js';

export interface ResolvedBottleSignature {
  displayName?: string;
  needsModeration: boolean;
}

export async function resolveBottleSignature(
  client: MilkyClient,
  store: BottleStore,
  message: milky.IncomingMessage,
): Promise<ResolvedBottleSignature> {
  const signature = await store.signatureFor(message.sender_id);
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
