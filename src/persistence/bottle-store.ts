import type { FraqDatabase } from '@fraqjs/plugin-kysely';
import { type Kysely, type Selectable, sql, type Transaction } from 'kysely';

import type {
  BottleComment,
  BottleModerationMode,
  BottleOperationRecord,
  BottleSignature,
  DriftBottle,
  NewBottleComment,
  NewBottleOperationRecord,
  NewDriftBottle,
} from '../models/index.js';
import type { ModerationProcess, ModerationRecord, NewModerationRecord } from '../processing/moderation-records.js';
import type {
  BottleCommentTable,
  BottleModerationRecordTable,
  BottleOperationRecordTable,
  BottleTable,
} from './schema.js';

import { randomUUID } from 'node:crypto';

type BottleRow = Selectable<BottleTable>;
type BottleCommentRow = Selectable<BottleCommentTable>;
type ModerationRecordRow = Selectable<BottleModerationRecordTable>;
type OperationRecordRow = Selectable<BottleOperationRecordTable>;
type BottleDatabase = Kysely<FraqDatabase> | Transaction<FraqDatabase>;

export interface WebuiRegistrationRequestRecord {
  userId: number;
  createdAt: number;
}

export interface PersistedWebuiSettings {
  moderationMode?: BottleModerationMode;
  moderationModel?: string;
  ownerIds: unknown;
  webuiPath: string;
}

export type ApproveModerationRecordResult =
  | { status: 'approved'; bottle: DriftBottle }
  | { status: 'not-found' | 'already-resolved' | 'not-pending' | 'publish-unavailable' };

export type RejectModerationRecordResult =
  | { status: 'rejected' }
  | { status: 'not-found' | 'already-resolved' | 'not-pending' | 'invalid-reason' };

export class BottleStore {
  constructor(
    private readonly database: Kysely<FraqDatabase>,
    private disposeTestDatabase?: () => Promise<void>,
  ) {}

  async dispose(): Promise<void> {
    await this.disposeTestDatabase?.();
    this.disposeTestDatabase = undefined;
  }

  async add(input: NewDriftBottle): Promise<DriftBottle> {
    const bottle: DriftBottle = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    await this.database.transaction().execute(async (transaction) => {
      await insertBottle(transaction, bottle);
    });
    return bottle;
  }

  async pick(removeAfterPick: boolean, randomValue = Math.random()): Promise<DriftBottle | undefined> {
    return this.database.transaction().execute(async (transaction) => {
      const count = await countBottles(transaction);
      if (count === 0) {
        return undefined;
      }

      const row = await transaction
        .selectFrom('bottles')
        .selectAll()
        .orderBy('created_at')
        .orderBy('id')
        .limit(1)
        .offset(Math.floor(randomValue * count))
        .executeTakeFirst();
      if (!row) {
        return undefined;
      }

      if (removeAfterPick) {
        await transaction.deleteFrom('bottles').where('id', '=', row.id).execute();
      }
      return toBottle(row);
    });
  }

  async count(): Promise<number> {
    return countBottles(this.database);
  }

  async bottles(limit = 20, offset = 0): Promise<DriftBottle[]> {
    const rows = await this.database
      .selectFrom('bottles')
      .selectAll()
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();
    return rows.map(toBottle);
  }

  async bottle(id: string): Promise<DriftBottle | undefined> {
    const row = await this.database.selectFrom('bottles').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toBottle(row) : undefined;
  }

  async updateBottle(id: string, input: NewDriftBottle): Promise<DriftBottle | undefined> {
    return this.database.transaction().execute(async (transaction) => {
      const exists = await transaction.selectFrom('bottles').select('id').where('id', '=', id).executeTakeFirst();
      if (!exists) return undefined;

      await transaction
        .updateTable('bottles')
        .set({
          sender_id: input.senderId,
          display_name: input.displayName ?? null,
          source_scene: input.source.scene,
          source_peer_id: input.source.peerId,
          segments: JSON.stringify(input.segments),
        })
        .where('id', '=', id)
        .execute();

      await transaction
        .updateTable('bottle_threads')
        .set({ sender_id: input.senderId, display_name: input.displayName ?? null })
        .where('id', '=', id)
        .execute();
      const row = await transaction.selectFrom('bottles').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
      return toBottle(row);
    });
  }

  async deleteBottle(id: string): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('bottle_comments').where('bottle_id', '=', id).execute();
      await transaction.deleteFrom('bottles').where('id', '=', id).execute();
      const result = await transaction.deleteFrom('bottle_threads').where('id', '=', id).executeTakeFirst();
      return (result.numDeletedRows ?? 0n) > 0n;
    });
  }

  async hasBottle(id: string): Promise<boolean> {
    const row = await this.database.selectFrom('bottle_threads').select('id').where('id', '=', id).executeTakeFirst();
    return row !== undefined;
  }

  async isBottleOwner(id: string, userId: number): Promise<boolean> {
    const row = await this.database
      .selectFrom('bottle_threads')
      .select('id')
      .where('id', '=', id)
      .where('sender_id', '=', userId)
      .executeTakeFirst();
    return row !== undefined;
  }

  async addComment(input: NewBottleComment): Promise<BottleComment | undefined> {
    return this.database.transaction().execute(async (transaction) => {
      const bottle = await transaction
        .selectFrom('bottle_threads')
        .select('id')
        .where('id', '=', input.bottleId)
        .executeTakeFirst();
      if (!bottle) {
        return undefined;
      }

      const comment: BottleComment = {
        id: randomUUID(),
        createdAt: Date.now(),
        ...input,
      };
      await transaction
        .insertInto('bottle_comments')
        .values({
          id: comment.id,
          bottle_id: comment.bottleId,
          sender_id: comment.senderId,
          created_at: comment.createdAt,
          display_name: comment.displayName ?? null,
          content: comment.content,
        })
        .execute();
      return comment;
    });
  }

  async commentsFor(bottleId: string, limit = 20): Promise<BottleComment[]> {
    const rows = await this.database
      .selectFrom('bottle_comments')
      .selectAll()
      .where('bottle_id', '=', bottleId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .execute();
    return rows.reverse().map(toComment);
  }

  async commentCount(bottleId: string): Promise<number> {
    const row = await this.database
      .selectFrom('bottle_comments')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .where('bottle_id', '=', bottleId)
      .executeTakeFirstOrThrow();
    return row.count;
  }

  async addModerator(userId: number): Promise<boolean> {
    const result = await this.database
      .insertInto('bottle_moderators')
      .values({ user_id: userId, created_at: Date.now() })
      .onConflict((conflict) => conflict.column('user_id').doNothing())
      .executeTakeFirst();
    return (result.numInsertedOrUpdatedRows ?? 0n) > 0n;
  }

  async removeModerator(userId: number): Promise<boolean> {
    const result = await this.database.deleteFrom('bottle_moderators').where('user_id', '=', userId).executeTakeFirst();
    return (result.numDeletedRows ?? 0n) > 0n;
  }

  async isModerator(userId: number): Promise<boolean> {
    const row = await this.database
      .selectFrom('bottle_moderators')
      .select('user_id')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row !== undefined;
  }

  async moderators(): Promise<number[]> {
    const rows = await this.database
      .selectFrom('bottle_moderators')
      .select('user_id')
      .orderBy('created_at')
      .orderBy('user_id')
      .execute();
    return rows.map((row) => row.user_id);
  }

  async setRepeatPick(userId: number, enabled?: boolean): Promise<void> {
    if (enabled === undefined) {
      await this.database.deleteFrom('bottle_pick_preferences').where('user_id', '=', userId).execute();
      return;
    }
    await this.database
      .insertInto('bottle_pick_preferences')
      .values({ user_id: userId, repeat_pick: enabled ? 1 : 0 })
      .onConflict((conflict) => conflict.column('user_id').doUpdateSet({ repeat_pick: enabled ? 1 : 0 }))
      .execute();
  }

  async repeatPickFor(userId: number): Promise<boolean | undefined> {
    const row = await this.database
      .selectFrom('bottle_pick_preferences')
      .select('repeat_pick')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row ? Boolean(row.repeat_pick) : undefined;
  }

  async addModerationRecord(input: NewModerationRecord): Promise<ModerationRecord> {
    const record: ModerationRecord = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...input,
    };
    await insertModerationRecord(this.database, record);
    return record;
  }

  async moderationRecords(limit = 100): Promise<ModerationRecord[]> {
    const rows = await this.database
      .selectFrom('bottle_moderation_records')
      .selectAll()
      .orderBy('created_at', 'desc')
      .orderBy(sql`rowid`, 'desc')
      .limit(limit)
      .execute();
    return rows.map(toModerationRecord);
  }

  async pendingModerationRecords(limit = 20, offset = 0): Promise<ModerationRecord[]> {
    const rows = await pendingModerationQuery(this.database)
      .selectAll()
      .orderBy('created_at', 'desc')
      .orderBy(sql`rowid`, 'desc')
      .limit(limit)
      .offset(offset)
      .execute();
    return rows.map(toModerationRecord);
  }

  async pendingModerationCount(): Promise<number> {
    const row = await pendingModerationQuery(this.database)
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    return row.count;
  }

  async approveModerationRecord(id: string, actorId: number): Promise<ApproveModerationRecordResult> {
    return this.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom('bottle_moderation_records')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      if (!row) {
        return { status: 'not-found' };
      }
      const unavailable = moderationActionUnavailable(row);
      if (unavailable) {
        return { status: unavailable };
      }
      if (!row.bottle_draft) {
        return { status: 'publish-unavailable' };
      }

      const draft = JSON.parse(row.bottle_draft) as NewDriftBottle;
      const bottle: DriftBottle = { id: randomUUID(), createdAt: Date.now(), ...draft };
      await insertBottle(transaction, bottle);
      await transaction
        .updateTable('bottle_moderation_records')
        .set({
          resolution: 'approved',
          resolved_by: actorId,
          resolved_at: Date.now(),
          published_bottle_id: bottle.id,
        })
        .where('id', '=', id)
        .execute();
      await insertOperationRecord(transaction, {
        id: randomUUID(),
        createdAt: Date.now(),
        action: 'moderation-approved',
        actorId,
        bottleId: bottle.id,
        detail: id,
      });
      return { status: 'approved', bottle };
    });
  }

  async rejectModerationRecord(id: string, actorId: number, reason: string): Promise<RejectModerationRecordResult> {
    const normalizedReason = reason.trim();
    if (!normalizedReason || [...normalizedReason].length > 500) {
      return { status: 'invalid-reason' };
    }
    return this.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom('bottle_moderation_records')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      if (!row) {
        return { status: 'not-found' };
      }
      const unavailable = moderationActionUnavailable(row);
      if (unavailable) {
        return { status: unavailable };
      }
      await transaction
        .updateTable('bottle_moderation_records')
        .set({
          resolution: 'rejected',
          resolved_by: actorId,
          resolved_at: Date.now(),
          rejection_reason: normalizedReason,
        })
        .where('id', '=', id)
        .execute();
      await insertOperationRecord(transaction, {
        id: randomUUID(),
        createdAt: Date.now(),
        action: 'moderation-rejected',
        actorId,
        detail: normalizedReason,
      });
      return { status: 'rejected' };
    });
  }

  async addOperationRecord(input: NewBottleOperationRecord): Promise<BottleOperationRecord> {
    const record: BottleOperationRecord = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...input,
    };
    await insertOperationRecord(this.database, record);
    return record;
  }

  async operationRecords(limit = 100): Promise<BottleOperationRecord[]> {
    const rows = await this.database
      .selectFrom('bottle_operation_records')
      .selectAll()
      .orderBy('created_at', 'desc')
      .orderBy(sql`rowid`, 'desc')
      .limit(limit)
      .execute();
    return rows.map(toOperationRecord);
  }

  async webuiPasswordHash(): Promise<string | undefined> {
    const row = await this.database
      .selectFrom('bottle_webui_credentials')
      .select('password_hash')
      .where('id', '=', 1)
      .executeTakeFirst();
    return row?.password_hash;
  }

  async setWebuiPasswordHash(hash: string): Promise<void> {
    await this.database
      .insertInto('bottle_webui_credentials')
      .values({ id: 1, password_hash: hash, created_at: Date.now() })
      .onConflict((conflict) => conflict.column('id').doUpdateSet({ password_hash: hash }))
      .execute();
  }

  async clearWebuiPasswordHash(): Promise<void> {
    await this.database.deleteFrom('bottle_webui_credentials').where('id', '=', 1).execute();
  }

  async webuiAccountCount(): Promise<number> {
    const row = await this.database
      .selectFrom('bottle_webui_accounts')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    return row.count;
  }

  async webuiAccountPasswordHash(userId: number): Promise<string | undefined> {
    const row = await this.database
      .selectFrom('bottle_webui_accounts')
      .select('password_hash')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row?.password_hash;
  }

  async setWebuiAccount(userId: number, passwordHash: string, approvedBy?: number): Promise<void> {
    await this.database
      .insertInto('bottle_webui_accounts')
      .values({
        user_id: userId,
        password_hash: passwordHash,
        created_at: Date.now(),
        approved_by: approvedBy ?? null,
      })
      .onConflict((conflict) => conflict.column('user_id').doUpdateSet({ password_hash: passwordHash }))
      .execute();
  }

  async removeWebuiAccount(userId: number): Promise<void> {
    await this.database.deleteFrom('bottle_webui_accounts').where('user_id', '=', userId).execute();
  }

  async hasWebuiRegistrationRequest(userId: number): Promise<boolean> {
    const row = await this.database
      .selectFrom('bottle_webui_registration_requests')
      .select('user_id')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row !== undefined;
  }

  async createWebuiRegistrationRequest(userId: number, passwordHash: string): Promise<void> {
    await this.database
      .insertInto('bottle_webui_registration_requests')
      .values({ user_id: userId, password_hash: passwordHash, created_at: Date.now() })
      .execute();
  }

  async removeWebuiRegistrationRequest(userId: number): Promise<void> {
    await this.database.deleteFrom('bottle_webui_registration_requests').where('user_id', '=', userId).execute();
  }

  async approveWebuiRegistrationRequest(userId: number, approvedBy: number): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      const request = await transaction
        .selectFrom('bottle_webui_registration_requests')
        .select('password_hash')
        .where('user_id', '=', userId)
        .executeTakeFirst();
      if (!request) {
        return false;
      }
      await transaction
        .insertInto('bottle_webui_accounts')
        .values({
          user_id: userId,
          password_hash: request.password_hash,
          created_at: Date.now(),
          approved_by: approvedBy,
        })
        .onConflict((conflict) => conflict.column('user_id').doNothing())
        .execute();
      await transaction.deleteFrom('bottle_webui_registration_requests').where('user_id', '=', userId).execute();
      return true;
    });
  }

  async webuiRegistrationRequestCount(): Promise<number> {
    const row = await this.database
      .selectFrom('bottle_webui_registration_requests')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    return row.count;
  }

  async webuiRegistrationRequests(limit: number, offset: number): Promise<WebuiRegistrationRequestRecord[]> {
    const rows = await this.database
      .selectFrom('bottle_webui_registration_requests')
      .select(['user_id', 'created_at'])
      .orderBy('created_at', 'desc')
      .orderBy('user_id', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();
    return rows.map((row) => ({ userId: row.user_id, createdAt: row.created_at }));
  }

  async webuiSettings(): Promise<PersistedWebuiSettings | undefined> {
    const row = await this.database
      .selectFrom('bottle_webui_settings')
      .select(['moderation_mode', 'moderation_model', 'owner_ids', 'webui_path'])
      .where('id', '=', 1)
      .executeTakeFirst();
    if (!row) return undefined;

    let ownerIds: unknown;
    try {
      ownerIds = JSON.parse(row.owner_ids);
    } catch {
      ownerIds = undefined;
    }
    return {
      ...(row.moderation_mode === null ? {} : { moderationMode: row.moderation_mode }),
      ...(row.moderation_model === null ? {} : { moderationModel: row.moderation_model }),
      ownerIds,
      webuiPath: row.webui_path,
    };
  }

  async setWebuiSettings(settings: Omit<PersistedWebuiSettings, 'ownerIds'> & { ownerIds: number[] }): Promise<void> {
    const values = {
      moderation_mode: settings.moderationMode ?? null,
      moderation_model: settings.moderationModel ?? null,
      owner_ids: JSON.stringify(settings.ownerIds),
      webui_path: settings.webuiPath,
      updated_at: Date.now(),
    };
    await this.database
      .insertInto('bottle_webui_settings')
      .values({ id: 1, ...values })
      .onConflict((conflict) => conflict.column('id').doUpdateSet(values))
      .execute();
  }

  async setSignature(senderId: number, signature: BottleSignature): Promise<void> {
    if (signature.type === 'anonymous') {
      await this.database.deleteFrom('bottle_profiles').where('sender_id', '=', senderId).execute();
      return;
    }

    const values = {
      alias: signature.type === 'alias' ? signature.name : '',
      mode: signature.type,
    };
    await this.database
      .insertInto('bottle_profiles')
      .values({ sender_id: senderId, ...values })
      .onConflict((conflict) => conflict.column('sender_id').doUpdateSet(values))
      .execute();
  }

  async signatureFor(senderId: number): Promise<BottleSignature> {
    const row = await this.database
      .selectFrom('bottle_profiles')
      .select(['alias', 'mode'])
      .where('sender_id', '=', senderId)
      .executeTakeFirst();
    if (!row) {
      return { type: 'anonymous' };
    }
    return row.mode === 'original' ? { type: 'original' } : { type: 'alias', name: row.alias };
  }
}

async function countBottles(database: BottleDatabase): Promise<number> {
  const row = await database
    .selectFrom('bottles')
    .select((expression) => expression.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return row.count;
}

async function insertBottle(database: BottleDatabase, bottle: DriftBottle): Promise<void> {
  await database
    .insertInto('bottle_threads')
    .values({
      id: bottle.id,
      sender_id: bottle.senderId,
      created_at: bottle.createdAt,
      display_name: bottle.displayName ?? null,
    })
    .execute();
  await database
    .insertInto('bottles')
    .values({
      id: bottle.id,
      sender_id: bottle.senderId,
      created_at: bottle.createdAt,
      display_name: bottle.displayName ?? null,
      source_scene: bottle.source.scene,
      source_peer_id: bottle.source.peerId,
      segments: JSON.stringify(bottle.segments),
    })
    .execute();
}

async function insertModerationRecord(database: BottleDatabase, record: ModerationRecord): Promise<void> {
  await database
    .insertInto('bottle_moderation_records')
    .values({
      id: record.id,
      created_at: record.createdAt,
      content: JSON.stringify(record.content),
      process: JSON.stringify(record.process),
      input_tokens: record.inputTokens ?? null,
      output_tokens: record.outputTokens ?? null,
      total_tokens: record.totalTokens ?? null,
      success: record.success ? 1 : 0,
      approved: record.approved === undefined ? null : record.approved ? 1 : 0,
      target_type: record.target ?? null,
      bottle_draft: record.bottleDraft ? JSON.stringify(record.bottleDraft) : null,
      resolution: record.resolution ?? null,
      resolved_by: record.resolvedBy ?? null,
      resolved_at: record.resolvedAt ?? null,
      rejection_reason: record.rejectionReason ?? null,
      published_bottle_id: record.publishedBottleId ?? null,
    })
    .execute();
}

async function insertOperationRecord(database: BottleDatabase, record: BottleOperationRecord): Promise<void> {
  await database
    .insertInto('bottle_operation_records')
    .values({
      id: record.id,
      created_at: record.createdAt,
      action: record.action,
      actor_id: record.actorId ?? null,
      bottle_id: record.bottleId ?? null,
      target_user_id: record.targetUserId ?? null,
      detail: record.detail ?? null,
    })
    .execute();
}

function pendingModerationQuery(database: BottleDatabase) {
  return database
    .selectFrom('bottle_moderation_records')
    .where('resolution', 'is', null)
    .where((expression) =>
      expression.or([
        expression('success', '=', 0),
        sql<boolean>`json_type(${sql.ref('process')}, '$.manual') = 'object'`,
      ]),
    );
}

function toBottle(row: BottleRow): DriftBottle {
  return {
    id: row.id,
    senderId: row.sender_id,
    createdAt: row.created_at,
    displayName: row.display_name ?? undefined,
    source: {
      scene: row.source_scene,
      peerId: row.source_peer_id,
    },
    segments: JSON.parse(row.segments) as DriftBottle['segments'],
  };
}

function toComment(row: BottleCommentRow): BottleComment {
  return {
    id: row.id,
    bottleId: row.bottle_id,
    senderId: row.sender_id,
    createdAt: row.created_at,
    displayName: row.display_name ?? undefined,
    content: row.content,
  };
}

function toModerationRecord(row: ModerationRecordRow): ModerationRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    content: JSON.parse(row.content) as ModerationRecord['content'],
    process: JSON.parse(row.process) as ModerationProcess,
    inputTokens: row.input_tokens ?? undefined,
    outputTokens: row.output_tokens ?? undefined,
    totalTokens: row.total_tokens ?? undefined,
    success: Boolean(row.success),
    approved: row.approved === null ? undefined : Boolean(row.approved),
    target: row.target_type ?? undefined,
    bottleDraft: row.bottle_draft ? (JSON.parse(row.bottle_draft) as NewDriftBottle) : undefined,
    resolution: row.resolution ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    publishedBottleId: row.published_bottle_id ?? undefined,
  };
}

function toOperationRecord(row: OperationRecordRow): BottleOperationRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    ...(row.actor_id === null ? {} : { actorId: row.actor_id }),
    ...(row.bottle_id === null ? {} : { bottleId: row.bottle_id }),
    ...(row.target_user_id === null ? {} : { targetUserId: row.target_user_id }),
    ...(row.detail === null ? {} : { detail: row.detail }),
  };
}

function moderationActionUnavailable(row: ModerationRecordRow): 'already-resolved' | 'not-pending' | undefined {
  if (row.resolution) return 'already-resolved';
  const process = JSON.parse(row.process) as ModerationProcess;
  if (row.success !== 0 && !('manual' in process)) return 'not-pending';
  return undefined;
}
