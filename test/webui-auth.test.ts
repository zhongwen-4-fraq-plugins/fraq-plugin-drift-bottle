import { BottleStore } from '../src/persistence/bottle-store.js';
import { generateInitialPassword, WebuiAuth } from '../src/webui/auth.js';

import assert from 'node:assert/strict';
import { scrypt } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('首次载入生成 10 位且包含大小写字母和数字的 WebUI 密码', () => {
  for (let index = 0; index < 100; index += 1) {
    const password = generateInitialPassword();
    assert.match(password, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{10}$/);
  }
});

test('首位主人获得初始账号，注册账号需审批后才能登录', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-auth-'));
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  t.after(async () => {
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const auth = new WebuiAuth(store);
  const initialCredential = await auth.initialize(123456789);
  assert.ok(initialCredential);
  assert.equal(initialCredential.userId, 123456789);
  assert.equal(await auth.createSession(123456789, 'incorrect'), undefined);
  assert.ok(await auth.createSession(123456789, initialCredential.password));
  assert.equal(await auth.initialize(123456789), undefined);

  assert.equal(await auth.requestRegistration(987654321, 'ValidA123'), 'created');
  assert.equal(await auth.requestRegistration(987654321, 'ValidA123'), 'pending');
  assert.equal(await auth.createSession(987654321, 'ValidA123'), undefined);
  assert.equal(auth.approveRegistration(987654321, 123456789), true);
  assert.ok(await auth.createSession(987654321, 'ValidA123'));
  assert.equal(auth.approveRegistration(987654321, 123456789), false);
  assert.equal(await auth.requestRegistration(987654321, 'OtherA123'), 'account-exists');
});

test('旧版单密码哈希会迁移到首位主人 QQ 账号', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-auth-migration-'));
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  t.after(async () => {
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  store.setWebuiPasswordHash(await legacyPasswordHash('LegacyA1'));
  const auth = new WebuiAuth(store);
  assert.equal(await auth.initialize(123456789), undefined);
  assert.equal(store.webuiPasswordHash(), undefined);
  assert.ok(await auth.createSession(123456789, 'LegacyA1'));
});

function legacyPasswordHash(password: string): Promise<string> {
  const salt = Buffer.from('migration-test-salt');
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(`scrypt-v1:${salt.toString('base64url')}:${derivedKey.toString('base64url')}`);
    });
  });
}
