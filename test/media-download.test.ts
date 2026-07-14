import { retryMediaDownload } from '../src/media-download.js';

import assert from 'node:assert/strict';
import test from 'node:test';

test('媒体下载瞬时失败时最多重试三次', async () => {
  let attempts = 0;
  const result = await retryMediaDownload(async () => {
    attempts += 1;
    if (attempts < 3) {
      const error = new Error('fetch failed');
      error.name = 'AI_DownloadError';
      throw error;
    }
    return 'ok';
  }, 0);

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('非媒体下载错误不会重试', async () => {
  let attempts = 0;
  await assert.rejects(
    retryMediaDownload(async () => {
      attempts += 1;
      throw new Error('model failed');
    }, 0),
    /model failed/,
  );
  assert.equal(attempts, 1);
});

test('媒体下载连续失败三次后会抛出错误', async () => {
  let attempts = 0;
  await assert.rejects(
    retryMediaDownload(async () => {
      attempts += 1;
      const error = new Error('fetch failed');
      error.name = 'AI_DownloadError';
      throw error;
    }, 0),
    { name: 'AI_DownloadError' },
  );
  assert.equal(attempts, 3);
});
