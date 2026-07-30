import type { Disposable } from '@fraqjs/fraq';

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

import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

interface BottleRow {
  id: string;
  sender_id: number;
  created_at: number;
  display_name: string | null;
  source_scene: DriftBottle['source']['scene'];
  source_peer_id: number;
  segments: string;
}

interface BottleCommentRow {
  id: string;
  bottle_id: string;
  sender_id: number;
  created_at: number;
  display_name: string | null;
  content: string;
}

interface ModerationRecordRow {
  id: string;
  created_at: number;
  content: string;
  process: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  success: number;
  approved: number | null;
  target_type: ModerationRecord['target'] | null;
  bottle_draft: string | null;
  resolution: ModerationRecord['resolution'] | null;
  resolved_by: number | null;
  resolved_at: number | null;
  rejection_reason: string | null;
  published_bottle_id: string | null;
}

interface OperationRecordRow {
  id: string;
  created_at: number;
  action: BottleOperationRecord['action'];
  actor_id: number | null;
  bottle_id: string | null;
  target_user_id: number | null;
  detail: string | null;
}

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

export class BottleStore implements Disposable {
  private database?: DatabaseSync;

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    this.database = new DatabaseSync(this.filePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottles (
        id TEXT PRIMARY KEY,
        sender_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        display_name TEXT,
        source_scene TEXT NOT NULL,
        source_peer_id INTEGER NOT NULL,
        segments TEXT NOT NULL
      )
    `);
    const columns = this.database.prepare('PRAGMA table_info(bottles)').all() as { name: string }[];
    if (!columns.some((column) => column.name === 'display_name')) {
      this.database.exec('ALTER TABLE bottles ADD COLUMN display_name TEXT');
    }
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottle_threads (
        id TEXT PRIMARY KEY,
        sender_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        display_name TEXT
      );
      INSERT OR IGNORE INTO bottle_threads (id, sender_id, created_at, display_name)
      SELECT id, sender_id, created_at, display_name FROM bottles;
      CREATE TABLE IF NOT EXISTS bottle_comments (
        id TEXT PRIMARY KEY,
        bottle_id TEXT NOT NULL,
        sender_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        display_name TEXT,
        content TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS bottle_comments_bottle_id_created_at
      ON bottle_comments (bottle_id, created_at, id);
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottle_profiles (
        sender_id INTEGER PRIMARY KEY,
        alias TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'alias'
      )
    `);
    const profileColumns = this.database.prepare('PRAGMA table_info(bottle_profiles)').all() as { name: string }[];
    if (!profileColumns.some((column) => column.name === 'mode')) {
      this.database.exec("ALTER TABLE bottle_profiles ADD COLUMN mode TEXT NOT NULL DEFAULT 'alias'");
    }
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottle_moderators (
        user_id INTEGER PRIMARY KEY,
        created_at INTEGER NOT NULL
      )
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottle_pick_preferences (
        user_id INTEGER PRIMARY KEY,
        repeat_pick INTEGER NOT NULL
      )
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottle_moderation_records (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        content TEXT NOT NULL,
        process TEXT NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        total_tokens INTEGER,
        success INTEGER NOT NULL,
        approved INTEGER,
        target_type TEXT,
        bottle_draft TEXT,
        resolution TEXT,
        resolved_by INTEGER,
        resolved_at INTEGER,
        rejection_reason TEXT,
        published_bottle_id TEXT
      );
      CREATE INDEX IF NOT EXISTS bottle_moderation_records_created_at
      ON bottle_moderation_records (created_at, id);
    `);
    const moderationColumns = this.database.prepare('PRAGMA table_info(bottle_moderation_records)').all() as {
      name: string;
    }[];
    const moderationMigrations: [string, string][] = [
      ['target_type', 'TEXT'],
      ['bottle_draft', 'TEXT'],
      ['resolution', 'TEXT'],
      ['resolved_by', 'INTEGER'],
      ['resolved_at', 'INTEGER'],
      ['rejection_reason', 'TEXT'],
      ['published_bottle_id', 'TEXT'],
    ];
    for (const [name, definition] of moderationMigrations) {
      if (!moderationColumns.some((column) => column.name === name)) {
        this.database.exec(`ALTER TABLE bottle_moderation_records ADD COLUMN ${name} ${definition}`);
      }
    }
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottle_webui_credentials (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottle_webui_accounts (
        user_id INTEGER PRIMARY KEY,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        approved_by INTEGER
      );
      CREATE TABLE IF NOT EXISTS bottle_webui_registration_requests (
        user_id INTEGER PRIMARY KEY,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottle_operation_records (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor_id INTEGER,
        bottle_id TEXT,
        target_user_id INTEGER,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS bottle_operation_records_created_at
      ON bottle_operation_records (created_at, id);
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS bottle_webui_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        moderation_mode TEXT,
        moderation_model TEXT,
        owner_ids TEXT NOT NULL,
        webui_path TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    const settingsColumns = this.database.prepare('PRAGMA table_info(bottle_webui_settings)').all() as {
      name: string;
    }[];
    if (!settingsColumns.some((column) => column.name === 'moderation_mode')) {
      this.database.exec('ALTER TABLE bottle_webui_settings ADD COLUMN moderation_mode TEXT');
    }
  }

  async add(input: NewDriftBottle): Promise<DriftBottle> {
    const bottle: DriftBottle = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    const database = this.getDatabase();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`
          INSERT INTO bottle_threads (id, sender_id, created_at, display_name)
          VALUES (?, ?, ?, ?)
        `)
        .run(bottle.id, bottle.senderId, bottle.createdAt, bottle.displayName ?? null);
      database
        .prepare(`
          INSERT INTO bottles (id, sender_id, created_at, display_name, source_scene, source_peer_id, segments)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          bottle.id,
          bottle.senderId,
          bottle.createdAt,
          bottle.displayName ?? null,
          bottle.source.scene,
          bottle.source.peerId,
          JSON.stringify(bottle.segments),
        );
      database.exec('COMMIT');
      return bottle;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  async pick(removeAfterPick: boolean, randomValue = Math.random()): Promise<DriftBottle | undefined> {
    const database = this.getDatabase();
    database.exec('BEGIN IMMEDIATE');

    try {
      const count = this.count();
      if (count === 0) {
        database.exec('COMMIT');
        return undefined;
      }

      const offset = Math.floor(randomValue * count);
      const row = database.prepare('SELECT * FROM bottles ORDER BY created_at, id LIMIT 1 OFFSET ?').get(offset) as
        | BottleRow
        | undefined;

      if (!row) {
        database.exec('COMMIT');
        return undefined;
      }

      if (removeAfterPick) {
        database.prepare('DELETE FROM bottles WHERE id = ?').run(row.id);
      }
      database.exec('COMMIT');
      return this.toBottle(row);
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  count(): number {
    const row = this.getDatabase().prepare('SELECT COUNT(*) AS count FROM bottles').get() as { count: number };
    return row.count;
  }

  bottles(limit = 20, offset = 0): DriftBottle[] {
    const rows = this.getDatabase()
      .prepare('SELECT * FROM bottles ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as unknown as BottleRow[];
    return rows.map((row) => this.toBottle(row));
  }

  deleteBottle(id: string): boolean {
    const database = this.getDatabase();
    database.exec('BEGIN IMMEDIATE');
    try {
      database.prepare('DELETE FROM bottle_comments WHERE bottle_id = ?').run(id);
      database.prepare('DELETE FROM bottles WHERE id = ?').run(id);
      const deleted = database.prepare('DELETE FROM bottle_threads WHERE id = ?').run(id).changes > 0;
      database.exec('COMMIT');
      return deleted;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  hasBottle(id: string): boolean {
    return Boolean(this.getDatabase().prepare('SELECT 1 FROM bottle_threads WHERE id = ?').get(id));
  }

  isBottleOwner(id: string, userId: number): boolean {
    return Boolean(
      this.getDatabase().prepare('SELECT 1 FROM bottle_threads WHERE id = ? AND sender_id = ?').get(id, userId),
    );
  }

  addComment(input: NewBottleComment): BottleComment | undefined {
    if (!this.hasBottle(input.bottleId)) {
      return undefined;
    }

    const comment: BottleComment = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...input,
    };
    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_comments (id, bottle_id, sender_id, created_at, display_name, content)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        comment.id,
        comment.bottleId,
        comment.senderId,
        comment.createdAt,
        comment.displayName ?? null,
        comment.content,
      );
    return comment;
  }

  commentsFor(bottleId: string, limit = 20): BottleComment[] {
    const rows = this.getDatabase()
      .prepare(`
        SELECT * FROM bottle_comments
        WHERE bottle_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `)
      .all(bottleId, limit) as unknown as BottleCommentRow[];
    return rows.reverse().map((row) => this.toComment(row));
  }

  commentCount(bottleId: string): number {
    const row = this.getDatabase()
      .prepare('SELECT COUNT(*) AS count FROM bottle_comments WHERE bottle_id = ?')
      .get(bottleId) as { count: number };
    return row.count;
  }

  addModerator(userId: number): boolean {
    return (
      this.getDatabase()
        .prepare('INSERT OR IGNORE INTO bottle_moderators (user_id, created_at) VALUES (?, ?)')
        .run(userId, Date.now()).changes > 0
    );
  }

  removeModerator(userId: number): boolean {
    return this.getDatabase().prepare('DELETE FROM bottle_moderators WHERE user_id = ?').run(userId).changes > 0;
  }

  isModerator(userId: number): boolean {
    return Boolean(this.getDatabase().prepare('SELECT 1 FROM bottle_moderators WHERE user_id = ?').get(userId));
  }

  moderators(): number[] {
    const rows = this.getDatabase()
      .prepare('SELECT user_id FROM bottle_moderators ORDER BY created_at, user_id')
      .all() as {
      user_id: number;
    }[];
    return rows.map((row) => row.user_id);
  }

  setRepeatPick(userId: number, enabled?: boolean): void {
    if (enabled === undefined) {
      this.getDatabase().prepare('DELETE FROM bottle_pick_preferences WHERE user_id = ?').run(userId);
      return;
    }
    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_pick_preferences (user_id, repeat_pick)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET repeat_pick = excluded.repeat_pick
      `)
      .run(userId, enabled ? 1 : 0);
  }

  repeatPickFor(userId: number): boolean | undefined {
    const row = this.getDatabase()
      .prepare('SELECT repeat_pick FROM bottle_pick_preferences WHERE user_id = ?')
      .get(userId) as { repeat_pick: number } | undefined;
    return row ? Boolean(row.repeat_pick) : undefined;
  }

  addModerationRecord(input: NewModerationRecord): ModerationRecord {
    const record: ModerationRecord = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...input,
    };
    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_moderation_records (
          id, created_at, content, process, input_tokens, output_tokens, total_tokens, success, approved,
          target_type, bottle_draft, resolution, resolved_by, resolved_at, rejection_reason, published_bottle_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.id,
        record.createdAt,
        JSON.stringify(record.content),
        JSON.stringify(record.process),
        record.inputTokens ?? null,
        record.outputTokens ?? null,
        record.totalTokens ?? null,
        record.success ? 1 : 0,
        record.approved === undefined ? null : record.approved ? 1 : 0,
        record.target ?? null,
        record.bottleDraft ? JSON.stringify(record.bottleDraft) : null,
        record.resolution ?? null,
        record.resolvedBy ?? null,
        record.resolvedAt ?? null,
        record.rejectionReason ?? null,
        record.publishedBottleId ?? null,
      );
    return record;
  }

  moderationRecords(limit = 100): ModerationRecord[] {
    const rows = this.getDatabase()
      .prepare('SELECT * FROM bottle_moderation_records ORDER BY created_at DESC, rowid DESC LIMIT ?')
      .all(limit) as unknown as ModerationRecordRow[];
    return rows.map((row) => this.toModerationRecord(row));
  }

  pendingModerationRecords(limit = 20, offset = 0): ModerationRecord[] {
    const rows = this.getDatabase()
      .prepare(`
        SELECT * FROM bottle_moderation_records
        WHERE resolution IS NULL
          AND (success = 0 OR json_type(process, '$.manual') = 'object')
        ORDER BY created_at DESC, rowid DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset) as unknown as ModerationRecordRow[];
    return rows.map((row) => this.toModerationRecord(row));
  }

  pendingModerationCount(): number {
    const row = this.getDatabase()
      .prepare(
        `SELECT COUNT(*) AS count
         FROM bottle_moderation_records
         WHERE resolution IS NULL
           AND (success = 0 OR json_type(process, '$.manual') = 'object')`,
      )
      .get() as { count: number };
    return row.count;
  }

  approveModerationRecord(id: string, actorId: number): ApproveModerationRecordResult {
    const database = this.getDatabase();
    database.exec('BEGIN IMMEDIATE');
    try {
      const row = database.prepare('SELECT * FROM bottle_moderation_records WHERE id = ?').get(id) as
        | ModerationRecordRow
        | undefined;
      if (!row) {
        database.exec('ROLLBACK');
        return { status: 'not-found' };
      }
      const unavailable = moderationActionUnavailable(row);
      if (unavailable) {
        database.exec('ROLLBACK');
        return { status: unavailable };
      }
      if (!row.bottle_draft) {
        database.exec('ROLLBACK');
        return { status: 'publish-unavailable' };
      }

      const draft = JSON.parse(row.bottle_draft) as NewDriftBottle;
      const bottle: DriftBottle = { id: randomUUID(), createdAt: Date.now(), ...draft };
      database
        .prepare(`
          INSERT INTO bottle_threads (id, sender_id, created_at, display_name)
          VALUES (?, ?, ?, ?)
        `)
        .run(bottle.id, bottle.senderId, bottle.createdAt, bottle.displayName ?? null);
      database
        .prepare(`
          INSERT INTO bottles (id, sender_id, created_at, display_name, source_scene, source_peer_id, segments)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          bottle.id,
          bottle.senderId,
          bottle.createdAt,
          bottle.displayName ?? null,
          bottle.source.scene,
          bottle.source.peerId,
          JSON.stringify(bottle.segments),
        );
      database
        .prepare(`
          UPDATE bottle_moderation_records
          SET resolution = 'approved', resolved_by = ?, resolved_at = ?, published_bottle_id = ?
          WHERE id = ?
        `)
        .run(actorId, Date.now(), bottle.id, id);
      this.addOperationRecord({
        action: 'moderation-approved',
        actorId,
        bottleId: bottle.id,
        detail: id,
      });
      database.exec('COMMIT');
      return { status: 'approved', bottle };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  rejectModerationRecord(id: string, actorId: number, reason: string): RejectModerationRecordResult {
    const normalizedReason = reason.trim();
    if (!normalizedReason || [...normalizedReason].length > 500) {
      return { status: 'invalid-reason' };
    }
    const database = this.getDatabase();
    database.exec('BEGIN IMMEDIATE');
    try {
      const row = database.prepare('SELECT * FROM bottle_moderation_records WHERE id = ?').get(id) as
        | ModerationRecordRow
        | undefined;
      if (!row) {
        database.exec('ROLLBACK');
        return { status: 'not-found' };
      }
      const unavailable = moderationActionUnavailable(row);
      if (unavailable) {
        database.exec('ROLLBACK');
        return { status: unavailable };
      }
      database
        .prepare(`
          UPDATE bottle_moderation_records
          SET resolution = 'rejected', resolved_by = ?, resolved_at = ?, rejection_reason = ?
          WHERE id = ?
        `)
        .run(actorId, Date.now(), normalizedReason, id);
      this.addOperationRecord({ action: 'moderation-rejected', actorId, detail: normalizedReason });
      database.exec('COMMIT');
      return { status: 'rejected' };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  addOperationRecord(input: NewBottleOperationRecord): BottleOperationRecord {
    const record: BottleOperationRecord = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...input,
    };
    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_operation_records (
          id, created_at, action, actor_id, bottle_id, target_user_id, detail
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.id,
        record.createdAt,
        record.action,
        record.actorId ?? null,
        record.bottleId ?? null,
        record.targetUserId ?? null,
        record.detail ?? null,
      );
    return record;
  }

  operationRecords(limit = 100): BottleOperationRecord[] {
    const rows = this.getDatabase()
      .prepare('SELECT * FROM bottle_operation_records ORDER BY created_at DESC, rowid DESC LIMIT ?')
      .all(limit) as unknown as OperationRecordRow[];
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      action: row.action,
      ...(row.actor_id === null ? {} : { actorId: row.actor_id }),
      ...(row.bottle_id === null ? {} : { bottleId: row.bottle_id }),
      ...(row.target_user_id === null ? {} : { targetUserId: row.target_user_id }),
      ...(row.detail === null ? {} : { detail: row.detail }),
    }));
  }

  webuiPasswordHash(): string | undefined {
    const row = this.getDatabase().prepare('SELECT password_hash FROM bottle_webui_credentials WHERE id = 1').get() as
      | { password_hash: string }
      | undefined;
    return row?.password_hash;
  }

  setWebuiPasswordHash(hash: string): void {
    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_webui_credentials (id, password_hash, created_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash
      `)
      .run(hash, Date.now());
  }

  clearWebuiPasswordHash(): void {
    this.getDatabase().prepare('DELETE FROM bottle_webui_credentials WHERE id = 1').run();
  }

  webuiAccountCount(): number {
    const row = this.getDatabase().prepare('SELECT COUNT(*) AS count FROM bottle_webui_accounts').get() as {
      count: number;
    };
    return row.count;
  }

  webuiAccountPasswordHash(userId: number): string | undefined {
    const row = this.getDatabase()
      .prepare('SELECT password_hash FROM bottle_webui_accounts WHERE user_id = ?')
      .get(userId) as { password_hash: string } | undefined;
    return row?.password_hash;
  }

  setWebuiAccount(userId: number, passwordHash: string, approvedBy?: number): void {
    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_webui_accounts (user_id, password_hash, created_at, approved_by)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash
      `)
      .run(userId, passwordHash, Date.now(), approvedBy ?? null);
  }

  removeWebuiAccount(userId: number): void {
    this.getDatabase().prepare('DELETE FROM bottle_webui_accounts WHERE user_id = ?').run(userId);
  }

  hasWebuiRegistrationRequest(userId: number): boolean {
    return Boolean(
      this.getDatabase().prepare('SELECT 1 FROM bottle_webui_registration_requests WHERE user_id = ?').get(userId),
    );
  }

  createWebuiRegistrationRequest(userId: number, passwordHash: string): void {
    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_webui_registration_requests (user_id, password_hash, created_at)
        VALUES (?, ?, ?)
      `)
      .run(userId, passwordHash, Date.now());
  }

  removeWebuiRegistrationRequest(userId: number): void {
    this.getDatabase().prepare('DELETE FROM bottle_webui_registration_requests WHERE user_id = ?').run(userId);
  }

  approveWebuiRegistrationRequest(userId: number, approvedBy: number): boolean {
    const database = this.getDatabase();
    database.exec('BEGIN IMMEDIATE');
    try {
      const request = database
        .prepare('SELECT password_hash FROM bottle_webui_registration_requests WHERE user_id = ?')
        .get(userId) as { password_hash: string } | undefined;
      if (!request) {
        database.exec('ROLLBACK');
        return false;
      }
      database
        .prepare(`
          INSERT INTO bottle_webui_accounts (user_id, password_hash, created_at, approved_by)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id) DO NOTHING
        `)
        .run(userId, request.password_hash, Date.now(), approvedBy);
      database.prepare('DELETE FROM bottle_webui_registration_requests WHERE user_id = ?').run(userId);
      database.exec('COMMIT');
      return true;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  webuiRegistrationRequestCount(): number {
    const row = this.getDatabase()
      .prepare('SELECT COUNT(*) AS count FROM bottle_webui_registration_requests')
      .get() as {
      count: number;
    };
    return row.count;
  }

  webuiRegistrationRequests(limit: number, offset: number): WebuiRegistrationRequestRecord[] {
    const rows = this.getDatabase()
      .prepare(`
        SELECT user_id, created_at
        FROM bottle_webui_registration_requests
        ORDER BY created_at DESC, user_id DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset) as { user_id: number; created_at: number }[];
    return rows.map((row) => ({ userId: row.user_id, createdAt: row.created_at }));
  }

  webuiSettings(): PersistedWebuiSettings | undefined {
    const row = this.getDatabase()
      .prepare(
        'SELECT moderation_mode, moderation_model, owner_ids, webui_path FROM bottle_webui_settings WHERE id = 1',
      )
      .get() as
      | {
          moderation_mode: BottleModerationMode | null;
          moderation_model: string | null;
          owner_ids: string;
          webui_path: string;
        }
      | undefined;
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

  setWebuiSettings(settings: Omit<PersistedWebuiSettings, 'ownerIds'> & { ownerIds: number[] }): void {
    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_webui_settings (id, moderation_mode, moderation_model, owner_ids, webui_path, updated_at)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          moderation_mode = excluded.moderation_mode,
          moderation_model = excluded.moderation_model,
          owner_ids = excluded.owner_ids,
          webui_path = excluded.webui_path,
          updated_at = excluded.updated_at
      `)
      .run(
        settings.moderationMode ?? null,
        settings.moderationModel ?? null,
        JSON.stringify(settings.ownerIds),
        settings.webuiPath,
        Date.now(),
      );
  }

  setSignature(senderId: number, signature: BottleSignature): void {
    if (signature.type === 'anonymous') {
      this.getDatabase().prepare('DELETE FROM bottle_profiles WHERE sender_id = ?').run(senderId);
      return;
    }

    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_profiles (sender_id, alias, mode)
        VALUES (?, ?, ?)
        ON CONFLICT(sender_id) DO UPDATE SET alias = excluded.alias, mode = excluded.mode
      `)
      .run(senderId, signature.type === 'alias' ? signature.name : '', signature.type);
  }

  signatureFor(senderId: number): BottleSignature {
    const row = this.getDatabase()
      .prepare('SELECT alias, mode FROM bottle_profiles WHERE sender_id = ?')
      .get(senderId) as { alias: string; mode: string } | undefined;
    if (!row) {
      return { type: 'anonymous' };
    }
    return row.mode === 'original' ? { type: 'original' } : { type: 'alias', name: row.alias };
  }

  dispose(): void {
    this.database?.close();
    this.database = undefined;
  }

  private getDatabase(): DatabaseSync {
    if (!this.database) {
      throw new Error('漂流瓶数据库尚未加载');
    }

    return this.database;
  }

  private toBottle(row: BottleRow): DriftBottle {
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

  private toComment(row: BottleCommentRow): BottleComment {
    return {
      id: row.id,
      bottleId: row.bottle_id,
      senderId: row.sender_id,
      createdAt: row.created_at,
      displayName: row.display_name ?? undefined,
      content: row.content,
    };
  }

  private toModerationRecord(row: ModerationRecordRow): ModerationRecord {
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
}

function moderationActionUnavailable(row: ModerationRecordRow): 'already-resolved' | 'not-pending' | undefined {
  if (row.resolution) return 'already-resolved';
  const process = JSON.parse(row.process) as ModerationProcess;
  if (row.success !== 0 && !('manual' in process)) return 'not-pending';
  return undefined;
}
