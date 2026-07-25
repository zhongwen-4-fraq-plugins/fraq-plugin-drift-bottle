import { generateInitialPassword, WebuiAuth } from '../src/webui/auth.js';

import assert from 'node:assert/strict';
import test from 'node:test';

test('首次载入生成 10 位且包含大小写字母和数字的 WebUI 密码', () => {
  for (let index = 0; index < 100; index += 1) {
    const password = generateInitialPassword();
    assert.match(password, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{10}$/);
  }
});

test('WebUI 密码只生成一次并以哈希形式持久化', async () => {
  let storedHash: string | undefined;
  const store = {
    webuiPasswordHash: () => storedHash,
    setWebuiPasswordHash: (hash: string) => {
      storedHash = hash;
    },
  };

  const firstAuth = new WebuiAuth(store);
  const password = await firstAuth.initialize();
  assert.ok(password);
  assert.ok(storedHash);
  assert.doesNotMatch(storedHash, new RegExp(password));
  assert.equal(await firstAuth.createSession('incorrect'), undefined);
  assert.ok(await firstAuth.createSession(password));

  const nextAuth = new WebuiAuth(store);
  assert.equal(await nextAuth.initialize(), undefined);
  assert.ok(await nextAuth.createSession(password));
});
