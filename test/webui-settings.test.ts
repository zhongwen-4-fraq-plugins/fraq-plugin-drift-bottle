import { BottleStore } from '../src/persistence/bottle-store.js';
import { normalizeOwnerIds, normalizeWebuiPath, WebuiSettings } from '../src/webui/settings.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('WebUI 配置会持久化，并区分立即生效与重启生效字段', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-settings-'));
  const storagePath = join(directory, 'bottles.db');
  const store = new BottleStore(storagePath);
  await store.load();
  t.after(async () => {
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const settings = new WebuiSettings(store, {
    moderationMode: 'manual',
    moderationModel: 'openai/original',
    ownerIds: [123456789],
    storagePath,
    webuiPath: '/drift-bottle',
  });
  settings.setActiveWebuiPath('/drift-bottle');
  const liveOwnerIds = settings.ownerIds;
  settings.update({
    moderationMode: 'ai',
    moderationModel: '',
    ownerIds: [123456789, 987654321],
    webuiPath: '/manage/drift-bottle/',
  });
  assert.deepEqual(settings.snapshot(), {
    activeWebuiPath: '/drift-bottle',
    moderationMode: 'ai',
    moderationModel: undefined,
    ownerIds: [123456789, 987654321],
    restartRequired: true,
    storagePath,
    webuiPath: '/manage/drift-bottle',
  });
  assert.strictEqual(settings.ownerIds, liveOwnerIds);

  const reloaded = new WebuiSettings(store, {
    moderationMode: 'manual',
    moderationModel: 'openai/should-not-return',
    ownerIds: [111111111],
    storagePath,
    webuiPath: '/ignored',
  });
  assert.equal(reloaded.moderationMode, 'ai');
  assert.equal(reloaded.moderationModel, undefined);
  assert.deepEqual(reloaded.ownerIds, [123456789, 987654321]);
  assert.equal(reloaded.webuiPath, '/manage/drift-bottle');
});

test('WebUI 配置拒绝空主人列表和无效挂载路径', () => {
  assert.throws(() => normalizeOwnerIds([]), /至少一个有效 QQ 号/);
  assert.throws(() => normalizeOwnerIds([123]), /至少一个有效 QQ 号/);
  assert.throws(() => normalizeWebuiPath('/'), /非根路径/);
  assert.throws(() => normalizeWebuiPath('/settings?tab=1'), /不能包含查询参数/);
});
