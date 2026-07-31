import type { KyselyService } from '@fraqjs/plugin-kysely';
import { type Kysely, sql } from 'kysely';

import type { BottleModerationMode, BottleOperationAction } from '../models/index.js';
import type { ModerationRecord } from '../processing/moderation-records.js';

export interface BottleTable {
  id: string;
  sender_id: number;
  created_at: number;
  display_name: string | null;
  source_scene: 'friend' | 'group' | 'temp';
  source_peer_id: number;
  segments: string;
}

export interface BottleThreadTable {
  id: string;
  sender_id: number;
  created_at: number;
  display_name: string | null;
}

export interface BottleCommentTable {
  id: string;
  bottle_id: string;
  sender_id: number;
  created_at: number;
  display_name: string | null;
  content: string;
}

export interface BottleProfileTable {
  sender_id: number;
  alias: string;
  mode: 'alias' | 'original';
}

export interface BottleModeratorTable {
  user_id: number;
  created_at: number;
}

export interface BottlePickPreferenceTable {
  user_id: number;
  repeat_pick: number;
}

export interface BottleModerationRecordTable {
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

export interface BottleWebuiCredentialTable {
  id: number;
  password_hash: string;
  created_at: number;
}

export interface BottleWebuiAccountTable {
  user_id: number;
  password_hash: string;
  created_at: number;
  approved_by: number | null;
}

export interface BottleWebuiRegistrationRequestTable {
  user_id: number;
  password_hash: string;
  created_at: number;
}

export interface BottleOperationRecordTable {
  id: string;
  created_at: number;
  action: BottleOperationAction;
  actor_id: number | null;
  bottle_id: string | null;
  target_user_id: number | null;
  detail: string | null;
}

export interface BottleWebuiSettingTable {
  id: number;
  moderation_mode: BottleModerationMode | null;
  moderation_model: string | null;
  owner_ids: string;
  webui_path: string;
  updated_at: number;
}

declare module '@fraqjs/plugin-kysely' {
  interface FraqDatabase {
    bottles: BottleTable;
    bottle_threads: BottleThreadTable;
    bottle_comments: BottleCommentTable;
    bottle_profiles: BottleProfileTable;
    bottle_moderators: BottleModeratorTable;
    bottle_pick_preferences: BottlePickPreferenceTable;
    bottle_moderation_records: BottleModerationRecordTable;
    bottle_webui_credentials: BottleWebuiCredentialTable;
    bottle_webui_accounts: BottleWebuiAccountTable;
    bottle_webui_registration_requests: BottleWebuiRegistrationRequestTable;
    bottle_operation_records: BottleOperationRecordTable;
    bottle_webui_settings: BottleWebuiSettingTable;
  }
}

export function registerBottleSchema(service: KyselyService): void {
  service.schemas.register({
    name: 'drift_bottle',
    migrations: {
      '001_adopt_existing_schema': {
        async up(db) {
          await createTables(db);
          await addLegacyColumns(db);
          await sql`
            INSERT OR IGNORE INTO bottle_threads (id, sender_id, created_at, display_name)
            SELECT id, sender_id, created_at, display_name FROM bottles
          `.execute(db);
        },
      },
    },
  });
}

async function createTables(db: Kysely<unknown>): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS bottles (
      id TEXT PRIMARY KEY,
      sender_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      display_name TEXT,
      source_scene TEXT NOT NULL,
      source_peer_id INTEGER NOT NULL,
      segments TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bottle_threads (
      id TEXT PRIMARY KEY,
      sender_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      display_name TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS bottle_comments (
      id TEXT PRIMARY KEY,
      bottle_id TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      display_name TEXT,
      content TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS bottle_comments_bottle_id_created_at
      ON bottle_comments (bottle_id, created_at, id)`,
    `CREATE TABLE IF NOT EXISTS bottle_profiles (
      sender_id INTEGER PRIMARY KEY,
      alias TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'alias'
    )`,
    `CREATE TABLE IF NOT EXISTS bottle_moderators (
      user_id INTEGER PRIMARY KEY,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bottle_pick_preferences (
      user_id INTEGER PRIMARY KEY,
      repeat_pick INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bottle_moderation_records (
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
    )`,
    `CREATE INDEX IF NOT EXISTS bottle_moderation_records_created_at
      ON bottle_moderation_records (created_at, id)`,
    `CREATE TABLE IF NOT EXISTS bottle_webui_credentials (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bottle_webui_accounts (
      user_id INTEGER PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      approved_by INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS bottle_webui_registration_requests (
      user_id INTEGER PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bottle_operation_records (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      action TEXT NOT NULL,
      actor_id INTEGER,
      bottle_id TEXT,
      target_user_id INTEGER,
      detail TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS bottle_operation_records_created_at
      ON bottle_operation_records (created_at, id)`,
    `CREATE TABLE IF NOT EXISTS bottle_webui_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      moderation_mode TEXT,
      moderation_model TEXT,
      owner_ids TEXT NOT NULL,
      webui_path TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  ];

  for (const statement of statements) {
    await sql.raw(statement).execute(db);
  }
}

async function addLegacyColumns(db: Kysely<unknown>): Promise<void> {
  await addMissingColumns(db, 'bottles', [['display_name', 'TEXT']]);
  await addMissingColumns(db, 'bottle_profiles', [['mode', "TEXT NOT NULL DEFAULT 'alias'"]]);
  await addMissingColumns(db, 'bottle_moderation_records', [
    ['target_type', 'TEXT'],
    ['bottle_draft', 'TEXT'],
    ['resolution', 'TEXT'],
    ['resolved_by', 'INTEGER'],
    ['resolved_at', 'INTEGER'],
    ['rejection_reason', 'TEXT'],
    ['published_bottle_id', 'TEXT'],
  ]);
  await addMissingColumns(db, 'bottle_webui_settings', [['moderation_mode', 'TEXT']]);
}

async function addMissingColumns(
  db: Kysely<unknown>,
  table: string,
  columns: readonly (readonly [name: string, definition: string])[],
): Promise<void> {
  const existing = await sql<{ name: string }>`PRAGMA table_info(${sql.raw(table)})`.execute(db);
  const names = new Set(existing.rows.map((column) => column.name));
  for (const [name, definition] of columns) {
    if (!names.has(name)) {
      await sql.raw(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).execute(db);
    }
  }
}
