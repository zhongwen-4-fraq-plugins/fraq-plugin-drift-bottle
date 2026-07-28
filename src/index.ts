import { definePlugin } from '@fraqjs/fraq';
import { AiService } from '@fraqjs/plugin-ai';
import { HonoService } from '@fraqjs/plugin-hono';

import { DriftBottleApi } from './api/drift-bottle-api.js';
import { buildDriftBottleCommands } from './commands/index.js';
import type { DriftBottleOptions } from './models/index.js';
import { BottleStore } from './persistence/bottle-store.js';
import { moderateBottle } from './processing/moderation.js';
import { withModerationRecords } from './processing/moderation-records.js';
import { WebuiAuth } from './webui/auth.js';
import { createDashboardSnapshot } from './webui/dashboard.js';
import { createBottleListPage, createPendingReviewListPage, createRegistrationRequestListPage } from './webui/lists.js';
import { WebuiRegistration } from './webui/registration.js';
import { registerWebuiRoutes } from './webui/routes.js';
import { buildWebuiUrl } from './webui/url.js';

export type {
  BottleComments,
  CreateBottleResult,
  DriftBottleApiErrorCode,
  PublishCommentResult,
  UpdateSignatureResult,
} from './api/drift-bottle-api.js';
export { DriftBottleApi, DriftBottleApiError } from './api/drift-bottle-api.js';
export type {
  BottleComment,
  BottleOperationAction,
  BottleOperationRecord,
  BottleSegment,
  BottleSignature,
  DriftBottle,
  DriftBottleOptions,
  NewBottleComment,
  NewBottleOperationRecord,
  NewDriftBottle,
} from './models/index.js';
export type { ModerationProcess, ModerationRecord } from './processing/moderation-records.js';
export type { DashboardOperation, DashboardRelease, DashboardSnapshot } from './webui/dashboard.js';
export type {
  WebuiBottleListItem,
  WebuiContentSummary,
  WebuiListPage,
  WebuiPendingReviewItem,
  WebuiRegistrationRequestItem,
} from './webui/lists.js';

export default definePlugin({
  name: 'drift-bottle',
  inject: {
    ai: AiService,
    hono: HonoService,
  },
  provides: [DriftBottleApi],
  async apply(ctx, options: DriftBottleOptions = {}) {
    const instanceStartedAt = Date.now();
    const store = new BottleStore(options.storagePath ?? './data/drift-bottles.db');
    await store.load();
    const ownerIds = options.ownerIds ?? [];
    const webuiAuth = new WebuiAuth(store);
    const initialCredential = await webuiAuth.initialize(ownerIds[0]);
    if (initialCredential) {
      ctx.logger.warn(
        `漂流瓶 WebUI 初始账号：${initialCredential.userId}，初始密码：${initialCredential.password}（仅在首次生成时显示，请妥善保存）`,
      );
    }
    const webuiRegistration = new WebuiRegistration(webuiAuth, ctx.client, ownerIds, ctx.logger);
    const moderator = withModerationRecords(store, ctx.logger, (segments) =>
      moderateBottle(ctx.ai, segments, options.moderationModel),
    );
    const api = new DriftBottleApi(ctx.client, store, moderator);
    ctx.provide(DriftBottleApi, api);
    const webuiPath = registerWebuiRoutes(ctx.hono, {
      auth: webuiAuth,
      basePath: options.webuiPath,
      bottles: (page) => createBottleListPage(api, page),
      dashboard: () => createDashboardSnapshot(api, instanceStartedAt),
      ownerIds,
      pendingReviews: (page) => createPendingReviewListPage(api, page),
      registration: webuiRegistration,
      registrationRequests: (page) => createRegistrationRequestListPage(store, page),
    });
    ctx.logger.info(`漂流瓶 WebUI：${buildWebuiUrl(ctx.hono, webuiPath)}`);
    buildDriftBottleCommands(ctx, api, webuiRegistration, ownerIds);
  },
});
