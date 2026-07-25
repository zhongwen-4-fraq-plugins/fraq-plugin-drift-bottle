import type { Context } from '@fraqjs/fraq';

import type { DriftBottleApi } from '../api/drift-bottle-api.js';
import { registerAdministrationCommands } from './administration.js';
import { registerDriftBottleCommands } from './bottle.js';
import { registerCommentCommands } from './comments.js';
import { registerHelpCommand } from './help.js';
import { registerPickPreferenceCommand } from './pick-preference.js';
import { registerSignatureCommands } from './signature.js';

export function buildDriftBottleCommands(ctx: Context, api: DriftBottleApi, ownerIds: number[]): void {
  registerDriftBottleCommands(ctx, api);
  registerSignatureCommands(ctx, api);
  registerHelpCommand(ctx);
  registerAdministrationCommands(ctx, api, ownerIds);
  registerPickPreferenceCommand(ctx, api);
  registerCommentCommands(ctx, api);
}
