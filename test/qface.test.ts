import { resolveQqFaceAsset } from '../webui/src/qface.js';

import assert from 'node:assert/strict';
import test from 'node:test';

test('QFace 索引优先使用与表情 ID 同名的静态资源', () => {
  assert.deepEqual(
    resolveQqFaceAsset(
      [
        {
          emojiId: '5',
          describe: '/流泪',
          assets: [
            { type: 0, name: '5_0.png', path: 'assets/qq_emoji/5/png/5_0.png' },
            { type: 0, name: '5.png', path: 'assets/qq_emoji/5/png/5.png' },
            { type: 2, name: '5.png', path: 'assets/qq_emoji/5/apng/5.png' },
          ],
        },
      ],
      '5',
    ),
    {
      label: '流泪',
      url: 'https://koishi.js.org/QFace/assets/qq_emoji/5/png/5.png',
    },
  );
});

test('QFace 索引拒绝表情目录外的资源并允许无资源回退', () => {
  assert.equal(
    resolveQqFaceAsset([{ emojiId: '14', assets: [{ type: 0, name: '14.png', path: '../outside.png' }] }], '14'),
    undefined,
  );
  assert.equal(
    resolveQqFaceAsset([{ emojiId: '14', assets: [{ type: 0, name: '14.png', path: 'http://[' }] }], '14'),
    undefined,
  );
  assert.equal(resolveQqFaceAsset([], '14'), undefined);
});
