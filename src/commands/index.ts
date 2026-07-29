import type { Context } from '@fraqjs/fraq';

import type { DriftBottleApi } from '../api/drift-bottle-api.js';
import type { WebuiRegistration } from '../webui/registration.js';
import { registerAdministrationCommands } from './administration.js';
import { registerDriftBottleCommands } from './bottle.js';
import { registerCommentCommands } from './comments.js';
import { registerHelpCommand } from './help.js';
import { registerModerationCommands } from './moderation.js';
import { registerPickPreferenceCommand } from './pick-preference.js';
import { registerSignatureCommands } from './signature.js';
import { registerWebuiAccountCommands } from './webui-accounts.js';

export function buildDriftBottleCommands(
  ctx: Context,
  api: DriftBottleApi,
  registration: WebuiRegistration,
  ownerIds: number[],
): void {
  registerDriftBottleCommands(ctx, api);
  registerSignatureCommands(ctx, api);
  registerHelpCommand(ctx);
  registerAdministrationCommands(ctx, api, ownerIds);
  registerModerationCommands(ctx, api, ownerIds);
  registerPickPreferenceCommand(ctx, api);
  registerCommentCommands(ctx, api);
  registerWebuiAccountCommands(ctx, registration, ownerIds);
}
