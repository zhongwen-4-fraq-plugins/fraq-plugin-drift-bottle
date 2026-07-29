import { type Context, definePlugin, type milky, msg } from '@fraqjs/fraq';
import { AiService } from '@fraqjs/plugin-ai';
import { HonoService } from '@fraqjs/plugin-hono';

import { DriftBottleApi } from './api/drift-bottle-api.js';
import { buildDriftBottleCommands } from './commands/index.js';
import type { DriftBottleOptions } from './models/index.js';
import { BottleStore } from './persistence/bottle-store.js';
import { moderateBottle } from './processing/moderation.js';
import { withModerationRecords } from './processing/moderation-records.js';
import { WebuiAuth, type WebuiInitialCredential } from './webui/auth.js';
import { createDashboardSnapshot, type DashboardRuntimeInfo } from './webui/dashboard.js';
import { createBottleListPage, createPendingReviewListPage, createRegistrationRequestListPage } from './webui/lists.js';
import { WebuiRegistration } from './webui/registration.js';
import { registerWebuiRoutes } from './webui/routes.js';
import { buildWebuiUrl } from './webui/url.js';

import { readFileSync } from 'node:fs';

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
export type { ApproveModerationRecordResult, RejectModerationRecordResult } from './persistence/bottle-store.js';
export type { ModerationContext, ModerationTarget } from './processing/moderation.js';
export type { ModerationProcess, ModerationRecord } from './processing/moderation-records.js';
export type {
  DashboardOperation,
  DashboardRelease,
  DashboardRuntimeInfo,
  DashboardSnapshot,
} from './webui/dashboard.js';
export type {
  WebuiBottleListItem,
  WebuiContentSummary,
  WebuiListPage,
  WebuiPendingReviewItem,
  WebuiRegistrationRequestItem,
} from './webui/lists.js';

interface PendingOwnerInitialization {
  auth: WebuiAuth;
  ownerIds: number[];
  runtime: DashboardRuntimeInfo;
}

const pendingOwnerInitializations = new WeakMap<Context, PendingOwnerInitialization>();

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
    const runtime: DashboardRuntimeInfo = { fraqVersion: readFraqVersion() };
    pendingOwnerInitializations.set(ctx, { auth: webuiAuth, ownerIds, runtime });
    const webuiRegistration = new WebuiRegistration(webuiAuth, ctx.client, ownerIds, ctx.logger);
    const moderator = withModerationRecords(store, ctx.logger, (segments) =>
      moderateBottle(ctx.ai, segments, options.moderationModel),
    );
    const api = new DriftBottleApi(ctx.client, store, moderator);
    ctx.provide(DriftBottleApi, api);
    const webuiPath = registerWebuiRoutes(ctx.hono, {
      auth: webuiAuth,
      approveReview: (id, actorId) => api.approveModerationRecord(id, actorId),
      basePath: options.webuiPath,
      bottles: (page) => createBottleListPage(api, page),
      canModerate: (userId) => api.isModerator(userId),
      dashboard: () => createDashboardSnapshot(api, instanceStartedAt, runtime),
      ownerIds,
      pendingReviews: (page) => createPendingReviewListPage(api, page),
      rejectReview: (id, actorId, reason) => api.rejectModerationRecord(id, actorId, reason),
      registration: webuiRegistration,
      registrationRequests: (page) => createRegistrationRequestListPage(store, page),
    });
    ctx.logger.info(`漂流瓶 WebUI：${buildWebuiUrl(ctx.hono, webuiPath)}`);
    buildDriftBottleCommands(ctx, api, webuiRegistration, ownerIds);
  },
  async start(ctx) {
    const initialization = pendingOwnerInitializations.get(ctx);
    pendingOwnerInitializations.delete(ctx);
    if (!initialization) return;

    const credentials = await initialization.auth.initializeOwners(initialization.ownerIds);
    await Promise.all([
      refreshProtocolEndpoint(ctx, initialization.runtime),
      ...credentials.map((credential) => sendInitialPassword(ctx, initialization.auth, credential)),
    ]);
  },
});

async function refreshProtocolEndpoint(ctx: Context, runtime: DashboardRuntimeInfo): Promise<void> {
  try {
    const info: milky.GetImplInfoOutput = await ctx.client.get_impl_info({});
    runtime.protocolEndpoint = {
      name: info.impl_name,
      version: info.impl_version,
    };
  } catch (error) {
    ctx.logger.warn('读取协议端名称和版本失败，WebUI 将暂时隐藏该版本信息', error);
  }
}

function readFraqVersion(): string {
  try {
    const metadata = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.resolve('@fraqjs/fraq')), 'utf8'),
    ) as { version?: unknown };
    return typeof metadata.version === 'string' && metadata.version ? metadata.version : '未知';
  } catch {
    return '未知';
  }
}

async function sendInitialPassword(ctx: Context, auth: WebuiAuth, credential: WebuiInitialCredential): Promise<void> {
  const text = `您的密码是：${credential.password}，请妥善保管您的密码以防丢失，如若丢失请联系插件拥有者前往数据库删除您的密码`;
  try {
    await ctx.client.send_private_message({ user_id: credential.userId, message: msg`${text}` });
  } catch (error) {
    auth.removeAccount(credential.userId);
    ctx.logger.error(`向插件主人 ${credential.userId} 发送 WebUI 初始密码失败，已撤销该账号以便下次重试`, error);
  }
}
