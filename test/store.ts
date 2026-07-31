import { Context, definePlugin } from '@fraqjs/fraq';
import { createMockMilkyClient } from '@fraqjs/mock';
import { KyselyPlugin, KyselyService } from '@fraqjs/plugin-kysely';

import { BottleStore } from '../src/persistence/bottle-store.js';
import { registerBottleSchema } from '../src/persistence/schema.js';

import type { TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';

export async function createTestStore(testContext: TestContext, filePath: string): Promise<BottleStore> {
  const context = Context.fromClient(createMockMilkyClient());
  let store: BottleStore | undefined;

  context.install(KyselyPlugin, {
    sqliteUrl: pathToFileURL(filePath).href,
    autoVacuum: { enabled: false },
  });
  context.install(
    definePlugin({
      name: 'drift-bottle-test-store',
      inject: { kysely: KyselyService },
      apply(ctx) {
        registerBottleSchema(ctx.kysely);
        store = new BottleStore(ctx.kysely.db, () => context.stop());
      },
    }),
  );
  await context.start();
  void testContext;

  if (!store) {
    throw new Error('测试数据库未初始化');
  }
  return store;
}
