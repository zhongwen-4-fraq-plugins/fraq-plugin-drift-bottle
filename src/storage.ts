import type { Disposable } from '@fraqjs/fraq';

import type { DriftBottle, NewDriftBottle } from './types.js';

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
      CREATE TABLE IF NOT EXISTS bottle_profiles (
        sender_id INTEGER PRIMARY KEY,
        alias TEXT NOT NULL
      )
    `);
  }

  async add(input: NewDriftBottle): Promise<DriftBottle> {
    const bottle: DriftBottle = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    this.getDatabase()
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
    return bottle;
  }

  async pick(deleteAfterPick: boolean, randomValue = Math.random()): Promise<DriftBottle | undefined> {
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

      if (deleteAfterPick) {
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

  setAlias(senderId: number, alias?: string): void {
    if (!alias) {
      this.getDatabase().prepare('DELETE FROM bottle_profiles WHERE sender_id = ?').run(senderId);
      return;
    }

    this.getDatabase()
      .prepare(`
        INSERT INTO bottle_profiles (sender_id, alias)
        VALUES (?, ?)
        ON CONFLICT(sender_id) DO UPDATE SET alias = excluded.alias
      `)
      .run(senderId, alias);
  }

  aliasFor(senderId: number): string | undefined {
    const row = this.getDatabase().prepare('SELECT alias FROM bottle_profiles WHERE sender_id = ?').get(senderId) as
      | { alias: string }
      | undefined;
    return row?.alias;
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
}
