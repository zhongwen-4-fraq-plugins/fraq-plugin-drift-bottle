import { definePlugin } from '@fraqjs/fraq';

import { registerDriftBottleCommands } from './commands.js';
import { BottleStore } from './storage.js';
import type { DriftBottleOptions } from './types.js';

export type { DriftBottle, DriftBottleOptions } from './types.js';

export default definePlugin({
  name: 'drift-bottle',
  async apply(ctx, options: DriftBottleOptions = {}) {
    const store = new BottleStore(options.storagePath ?? 'data/drift-bottles.json');
    await store.load();
    registerDriftBottleCommands(ctx, store);
  },
});
