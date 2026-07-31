import { generateInitialPassword, WebuiAuth } from '../src/webui/auth.js';
import { createTestStore } from './store.js';

import assert from 'node:assert/strict';
import { scrypt } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('首次载入生成 6 至 10 位且包含大小写字母和数字的 WebUI 密码', () => {
  const lengths = new Set<number>();
  for (let index = 0; index < 200; index += 1) {
    const password = generateInitialPassword();
    assert.match(password, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,10}$/);
    lengths.add(password.length);
  }
  assert.ok(lengths.size > 1);
});

test('主人列表中的每位主人获得独立初始账号，已有账号不会被覆盖', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-auth-'));
  const store = await createTestStore(t, join(directory, 'bottles.db'));
  t.after(async () => {
    await store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const auth = new WebuiAuth(store);
  const credentials = await auth.initializeOwners([123456789, 987654320, 123456789, 0]);
  assert.deepEqual(
    credentials.map((credential) => credential.userId),
    [123456789, 987654320],
  );
  assert.notEqual(credentials[0]?.password, credentials[1]?.password);
  assert.ok(await auth.createSession(123456789, credentials[0]?.password ?? ''));
  assert.ok(await auth.createSession(987654320, credentials[1]?.password ?? ''));
  assert.deepEqual(await auth.initializeOwners([123456789, 987654320]), []);

  await auth.removeAccount(987654320);
  assert.equal(await auth.createSession(987654320, credentials[1]?.password ?? ''), undefined);
  const [replacement] = await auth.initializeOwners([987654320]);
  assert.equal(replacement?.userId, 987654320);

  assert.equal(await auth.requestRegistration(987654321, 'ValidA123'), 'created');
  assert.equal(await auth.requestRegistration(987654321, 'ValidA123'), 'pending');
  assert.equal(await auth.createSession(987654321, 'ValidA123'), undefined);
  assert.equal(await auth.approveRegistration(987654321, 123456789), true);
  assert.ok(await auth.createSession(987654321, 'ValidA123'));
  assert.equal(await auth.approveRegistration(987654321, 123456789), false);
  assert.equal(await auth.requestRegistration(987654321, 'OtherA123'), 'account-exists');
});

test('旧版单密码哈希会迁移到首位主人 QQ 账号', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-auth-migration-'));
  const store = await createTestStore(t, join(directory, 'bottles.db'));
  t.after(async () => {
    await store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  await store.setWebuiPasswordHash(await legacyPasswordHash('LegacyA1'));
  const auth = new WebuiAuth(store);
  const credentials = await auth.initializeOwners([123456789, 987654321]);
  assert.deepEqual(
    credentials.map((credential) => credential.userId),
    [987654321],
  );
  assert.equal(await store.webuiPasswordHash(), undefined);
  assert.ok(await auth.createSession(123456789, 'LegacyA1'));
  assert.ok(await auth.createSession(987654321, credentials[0]?.password ?? ''));
});

test('修改密码会保留当前会话并注销同账号的其他会话', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-auth-password-'));
  const store = await createTestStore(t, join(directory, 'bottles.db'));
  t.after(async () => {
    await store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const auth = new WebuiAuth(store);
  const [credential] = await auth.initializeOwners([123456789]);
  assert.ok(credential);
  const currentSession = await auth.createSession(123456789, credential.password);
  const otherSession = await auth.createSession(123456789, credential.password);
  assert.ok(currentSession);
  assert.ok(otherSession);

  assert.equal(await auth.changePassword(123456789, 'WrongA1', 'ChangedA1', currentSession), false);
  assert.equal(await auth.changePassword(123456789, credential.password, 'ChangedA1', currentSession), true);
  assert.equal(auth.sessionUserId(currentSession), 123456789);
  assert.equal(auth.sessionUserId(otherSession), undefined);
  assert.equal(await auth.createSession(123456789, credential.password), undefined);
  assert.ok(await auth.createSession(123456789, 'ChangedA1'));
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
