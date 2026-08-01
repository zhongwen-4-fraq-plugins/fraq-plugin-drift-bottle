import { restartNoticeAction } from '../webui/src/settings-state.js';

import assert from 'node:assert/strict';
import test from 'node:test';

test('待重启提示只在需重启配置变化时重新显示', () => {
  assert.equal(restartNoticeAction('/drift-bottle', '/new-drift-bottle', true), 'show');
  assert.equal(restartNoticeAction('/new-drift-bottle', '/new-drift-bottle', true), 'preserve');
  assert.equal(restartNoticeAction('/new-drift-bottle', '/drift-bottle', false), 'hide');
});
