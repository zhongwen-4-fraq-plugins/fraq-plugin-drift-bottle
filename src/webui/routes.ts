import type { HonoService } from '@fraqjs/plugin-hono';

import type { BottleComments, BottleImageResult } from '../api/drift-bottle-api.js';
import type { BottleUpdateInput, DriftBottle, NewDriftBottle, UpdateBottleResult } from '../models/index.js';
import type { ApproveModerationRecordResult, RejectModerationRecordResult } from '../persistence/bottle-store.js';
import { isValidWebuiPassword, parseQqAccount, type WebuiAuth } from './auth.js';
import type { DashboardSnapshot } from './dashboard.js';
import type {
  WebuiBottleListItem,
  WebuiListPage,
  WebuiPendingReviewItem,
  WebuiRegistrationRequestItem,
} from './lists.js';
import type { WebuiRegistration } from './registration.js';
import {
  type EditableWebuiSettings,
  normalizeModerationMode,
  normalizeModerationModel,
  normalizeOwnerIds,
  normalizeWebuiPath,
  type WebuiSettingsSnapshot,
} from './settings.js';

import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface WebuiRouteOptions {
  basePath?: string;
  directory?: string;
  auth: WebuiAuth;
  dashboard: () => Promise<DashboardSnapshot>;
  bottles: (page: number) => Promise<WebuiListPage<WebuiBottleListItem>>;
  bottleComments: (id: string) => Promise<BottleComments | undefined>;
  bottleImage: (id: string, segmentIndex: number) => Promise<BottleImageResult>;
  createBottle: (input: NewDriftBottle, actorId: number) => Promise<DriftBottle>;
  updateBottle: (id: string, input: BottleUpdateInput, actorId: number) => Promise<UpdateBottleResult>;
  deleteBottle: (id: string, actorId: number) => Promise<boolean>;
  pendingReviews: (page: number) => Promise<WebuiListPage<WebuiPendingReviewItem>>;
  canModerate: (userId: number) => Promise<boolean>;
  approveReview: (id: string, actorId: number) => Promise<ApproveModerationRecordResult>;
  rejectReview: (id: string, actorId: number, reason: string) => Promise<RejectModerationRecordResult>;
  registration: Pick<WebuiRegistration, 'submit'>;
  registrationRequests: (page: number) => Promise<WebuiListPage<WebuiRegistrationRequestItem>>;
  ownerIds: number[];
  settings: () => WebuiSettingsSnapshot;
  updateSettings: (settings: EditableWebuiSettings) => Promise<WebuiSettingsSnapshot>;
}

const SESSION_COOKIE = 'drift_bottle_session';

export function registerWebuiRoutes(service: Pick<HonoService, 'app'>, options: WebuiRouteOptions): string {
  const basePath = normalizeWebuiPath(options.basePath ?? '/drift-bottle');
  const directory = options.directory ?? fileURLToPath(new URL('./webui/', import.meta.url));

  service.app.get(basePath, (context) => context.redirect(`${basePath}/`, 308));
  service.app.get(`${basePath}/api/session`, async (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    const canModerate =
      userId !== undefined && (options.ownerIds.includes(userId) || (await options.canModerate(userId)));
    return context.json(
      {
        account: userId ? String(userId) : null,
        authenticated: userId !== undefined,
        isOwner: userId !== undefined && options.ownerIds.includes(userId),
        canModerate,
        avatarUrl: qqAvatarUrl(userId),
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  });
  service.app.post(`${basePath}/api/session`, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: '请求格式无效' }, 400, { 'Cache-Control': 'no-store' });
    }

    const credentials = readCredentials(body);
    if (!credentials) {
      return context.json({ error: '请输入 QQ 号和密码' }, 400, { 'Cache-Control': 'no-store' });
    }

    const userId = parseQqAccount(credentials.account);
    if (!userId) {
      return context.json({ error: '账号或密码不正确' }, 401, { 'Cache-Control': 'no-store' });
    }
    const token = await options.auth.createSession(userId, credentials.password);
    if (!token) {
      return context.json({ error: '账号或密码不正确' }, 401, { 'Cache-Control': 'no-store' });
    }

    const secure = new URL(context.req.url).protocol === 'https:';
    const canModerate = options.ownerIds.includes(userId) || (await options.canModerate(userId));
    return context.json(
      {
        account: String(userId),
        authenticated: true,
        avatarUrl: qqAvatarUrl(userId),
        isOwner: options.ownerIds.includes(userId),
        canModerate,
      },
      200,
      {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(token, basePath, secure),
      },
    );
  });
  service.app.post(`${basePath}/api/registrations`, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: '请求格式无效' }, 400, { 'Cache-Control': 'no-store' });
    }

    const credentials = readCredentials(body);
    if (!credentials) {
      return context.json({ error: '请输入 QQ 号和密码' }, 400, { 'Cache-Control': 'no-store' });
    }
    const userId = parseQqAccount(credentials.account);
    if (!userId) {
      return context.json({ error: '账号必须是 5–12 位 QQ 号' }, 400, { 'Cache-Control': 'no-store' });
    }
    if (!isValidWebuiPassword(credentials.password)) {
      return context.json({ error: '密码必须为 6–10 位，并同时包含大写字母、小写字母和数字' }, 400, {
        'Cache-Control': 'no-store',
      });
    }

    const result = await options.registration.submit(userId, credentials.password);
    if (result === 'account-exists') {
      return context.json({ error: '该 QQ 已有账号，请直接登录' }, 409, { 'Cache-Control': 'no-store' });
    }
    if (result === 'notification-unavailable') {
      return context.json({ error: '暂时无法联系插件主人，请稍后重试' }, 503, { 'Cache-Control': 'no-store' });
    }
    return context.json(
      {
        status: 'pending',
        message: result === 'created' ? '申请已发送，请等待插件主人同意' : '该 QQ 的申请正在等待主人同意',
      },
      202,
      { 'Cache-Control': 'no-store' },
    );
  });
  service.app.delete(`${basePath}/api/session`, (context) => {
    options.auth.revokeSession(readSessionCookie(context.req.header('cookie')));
    const secure = new URL(context.req.url).protocol === 'https:';
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie('', basePath, secure, 0),
      },
    });
  });
  service.app.get(`${basePath}/api/dashboard`, async (context) => {
    if (!options.auth.isSessionValid(readSessionCookie(context.req.header('cookie')))) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    return context.json(await options.dashboard(), 200, { 'Cache-Control': 'no-store' });
  });
  service.app.get(`${basePath}/api/reviews/pending`, async (context) => {
    if (!options.auth.isSessionValid(readSessionCookie(context.req.header('cookie')))) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    return context.json(await options.pendingReviews(readPage(context.req.query('page'))), 200, {
      'Cache-Control': 'no-store',
    });
  });
  service.app.post(`${basePath}/api/reviews/:id/approve`, async (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    if (!options.ownerIds.includes(userId) && !(await options.canModerate(userId))) {
      return context.json({ error: '仅插件主人或管理员可以处理审核记录' }, 403, { 'Cache-Control': 'no-store' });
    }

    const result = await options.approveReview(context.req.param('id'), userId);
    if (result.status === 'approved') {
      return context.json({ status: result.status, bottleId: result.bottle.id }, 200, { 'Cache-Control': 'no-store' });
    }
    if (result.status === 'not-found') {
      return context.json({ error: '没有找到这条审核记录' }, 404, { 'Cache-Control': 'no-store' });
    }
    if (result.status === 'publish-unavailable') {
      return context.json({ error: '该记录缺少完整投瓶信息，不能通过投放' }, 409, { 'Cache-Control': 'no-store' });
    }
    return context.json({ error: '该记录已处理或不在待审核队列中' }, 409, { 'Cache-Control': 'no-store' });
  });
  service.app.post(`${basePath}/api/reviews/:id/reject`, async (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    if (!options.ownerIds.includes(userId) && !(await options.canModerate(userId))) {
      return context.json({ error: '仅插件主人或管理员可以处理审核记录' }, 403, { 'Cache-Control': 'no-store' });
    }

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: '请输入拒绝理由' }, 400, { 'Cache-Control': 'no-store' });
    }
    const reason = readRejectionReason(body);
    if (!reason) {
      return context.json({ error: '拒绝理由不能为空，且不能超过 500 个字符' }, 400, {
        'Cache-Control': 'no-store',
      });
    }

    const result = await options.rejectReview(context.req.param('id'), userId, reason);
    if (result.status === 'rejected') {
      return context.json({ status: result.status }, 200, { 'Cache-Control': 'no-store' });
    }
    if (result.status === 'not-found') {
      return context.json({ error: '没有找到这条审核记录' }, 404, { 'Cache-Control': 'no-store' });
    }
    if (result.status === 'invalid-reason') {
      return context.json({ error: '拒绝理由不能为空，且不能超过 500 个字符' }, 400, {
        'Cache-Control': 'no-store',
      });
    }
    return context.json({ error: '该记录已处理或不在待审核队列中' }, 409, { 'Cache-Control': 'no-store' });
  });
  service.app.get(`${basePath}/api/bottles`, async (context) => {
    if (!options.auth.isSessionValid(readSessionCookie(context.req.header('cookie')))) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    return context.json(await options.bottles(readPage(context.req.query('page'))), 200, {
      'Cache-Control': 'no-store',
    });
  });
  service.app.post(`${basePath}/api/bottles`, async (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    if (!options.ownerIds.includes(userId) && !(await options.canModerate(userId))) {
      return context.json({ error: '仅插件主人或管理员可以新增漂流瓶' }, 403, { 'Cache-Control': 'no-store' });
    }

    const parsed = await readBottleInput(
      context.req.json().catch(() => undefined),
      true,
    );
    if ('error' in parsed) {
      return context.json({ error: parsed.error }, 400, { 'Cache-Control': 'no-store' });
    }
    const bottle = await options.createBottle(
      {
        senderId: parsed.value.senderId,
        displayName: parsed.value.displayName,
        source: parsed.value.source,
        segments: [{ type: 'text', data: { text: parsed.value.content as string } }],
      },
      userId,
    );
    return context.json({ id: bottle.id }, 201, { 'Cache-Control': 'no-store' });
  });
  service.app.put(`${basePath}/api/bottles/:id`, async (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    if (!options.ownerIds.includes(userId) && !(await options.canModerate(userId))) {
      return context.json({ error: '仅插件主人或管理员可以修改漂流瓶' }, 403, { 'Cache-Control': 'no-store' });
    }

    const parsed = await readBottleInput(
      context.req.json().catch(() => undefined),
      false,
    );
    if ('error' in parsed) {
      return context.json({ error: parsed.error }, 400, { 'Cache-Control': 'no-store' });
    }
    const result = await options.updateBottle(context.req.param('id'), parsed.value, userId);
    if (result.status === 'updated') {
      return context.json({ status: result.status }, 200, { 'Cache-Control': 'no-store' });
    }
    if (result.status === 'content-read-only') {
      return context.json({ error: '漂流瓶内容已发生变化，请刷新后重试' }, 409, { 'Cache-Control': 'no-store' });
    }
    return context.json({ error: '没有找到这个漂流瓶' }, 404, { 'Cache-Control': 'no-store' });
  });
  service.app.delete(`${basePath}/api/bottles/:id`, async (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    if (!options.ownerIds.includes(userId) && !(await options.canModerate(userId))) {
      return context.json({ error: '仅插件主人或管理员可以删除漂流瓶' }, 403, { 'Cache-Control': 'no-store' });
    }
    if (!(await options.deleteBottle(context.req.param('id'), userId))) {
      return context.json({ error: '没有找到这个漂流瓶' }, 404, { 'Cache-Control': 'no-store' });
    }
    return context.body(null, 204, { 'Cache-Control': 'no-store' });
  });
  service.app.get(`${basePath}/api/bottles/:id/images/:index`, async (context) => {
    if (!options.auth.isSessionValid(readSessionCookie(context.req.header('cookie')))) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    const segmentIndex = Number(context.req.param('index'));
    if (!Number.isSafeInteger(segmentIndex) || segmentIndex < 0) {
      return context.json({ error: '图片索引无效' }, 400, { 'Cache-Control': 'no-store' });
    }
    const image = await options.bottleImage(context.req.param('id'), segmentIndex);
    if (image.status === 'found') {
      return context.json({ url: image.url }, 200, { 'Cache-Control': 'no-store' });
    }
    if (image.status === 'not-found') {
      return context.json({ error: '没有找到这个漂流瓶' }, 404, { 'Cache-Control': 'no-store' });
    }
    if (image.status === 'not-image') {
      return context.json({ error: '这个消息段不是图片' }, 400, { 'Cache-Control': 'no-store' });
    }
    return context.json({ error: '图片地址暂时不可用' }, 502, { 'Cache-Control': 'no-store' });
  });
  service.app.get(`${basePath}/api/bottles/:id/comments`, async (context) => {
    if (!options.auth.isSessionValid(readSessionCookie(context.req.header('cookie')))) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    const comments = await options.bottleComments(context.req.param('id'));
    if (!comments) {
      return context.json({ error: '没有找到这个漂流瓶' }, 404, { 'Cache-Control': 'no-store' });
    }
    return context.json(comments, 200, { 'Cache-Control': 'no-store' });
  });
  service.app.get(`${basePath}/api/registrations/pending`, async (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    if (!options.ownerIds.includes(userId)) {
      return context.json({ error: '仅插件主人可以查看账号请求' }, 403, { 'Cache-Control': 'no-store' });
    }
    return context.json(await options.registrationRequests(readPage(context.req.query('page'))), 200, {
      'Cache-Control': 'no-store',
    });
  });
  service.app.get(`${basePath}/api/settings`, (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    if (!options.ownerIds.includes(userId)) {
      return context.json({ error: '仅插件主人可以查看插件配置' }, 403, { 'Cache-Control': 'no-store' });
    }
    return context.json(options.settings(), 200, { 'Cache-Control': 'no-store' });
  });
  service.app.put(`${basePath}/api/settings`, async (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    if (!options.ownerIds.includes(userId)) {
      return context.json({ error: '仅插件主人可以修改插件配置' }, 403, { 'Cache-Control': 'no-store' });
    }

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: '请求格式无效' }, 400, { 'Cache-Control': 'no-store' });
    }
    const settings = readSettings(body);
    if ('error' in settings) {
      return context.json({ error: settings.error }, 400, { 'Cache-Control': 'no-store' });
    }
    if (!settings.value.ownerIds.includes(userId)) {
      return context.json({ error: '为避免失去设置权限，主人列表必须保留当前账号' }, 400, {
        'Cache-Control': 'no-store',
      });
    }

    try {
      return context.json(await options.updateSettings(settings.value), 200, { 'Cache-Control': 'no-store' });
    } catch {
      return context.json({ error: '配置暂时无法保存，请稍后重试' }, 500, { 'Cache-Control': 'no-store' });
    }
  });
  service.app.put(`${basePath}/api/account/password`, async (context) => {
    const token = readSessionCookie(context.req.header('cookie'));
    const userId = options.auth.sessionUserId(token);
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: '请求格式无效' }, 400, { 'Cache-Control': 'no-store' });
    }
    const passwords = readPasswordChange(body);
    if (!passwords) {
      return context.json({ error: '请输入当前密码和新密码' }, 400, { 'Cache-Control': 'no-store' });
    }
    if (!isValidWebuiPassword(passwords.newPassword)) {
      return context.json({ error: '新密码必须为 6–10 位，并同时包含大写字母、小写字母和数字' }, 400, {
        'Cache-Control': 'no-store',
      });
    }
    if (passwords.currentPassword === passwords.newPassword) {
      return context.json({ error: '新密码不能与当前密码相同' }, 400, { 'Cache-Control': 'no-store' });
    }
    if (!(await options.auth.changePassword(userId, passwords.currentPassword, passwords.newPassword, token))) {
      return context.json({ error: '当前密码不正确，请重新输入' }, 400, { 'Cache-Control': 'no-store' });
    }
    return context.json({ status: 'changed' }, 200, { 'Cache-Control': 'no-store' });
  });
  service.app.get(`${basePath}/`, async () => serveWebuiFile(directory, 'index.html'));
  service.app.get(`${basePath}/*`, async (context) => {
    let requestPath: string;
    try {
      requestPath = decodeURIComponent(context.req.path.slice(basePath.length + 1));
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const response = await serveWebuiFile(directory, requestPath);
    if (response.status !== 404 || extname(requestPath)) {
      return response;
    }
    return serveWebuiFile(directory, 'index.html');
  });
  return basePath;
}

function readCredentials(body: unknown): { account: string; password: string } | undefined {
  if (
    !body ||
    typeof body !== 'object' ||
    !('account' in body) ||
    typeof body.account !== 'string' ||
    !('password' in body) ||
    typeof body.password !== 'string'
  ) {
    return undefined;
  }
  return { account: body.account, password: body.password };
}

function readRejectionReason(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('reason' in body) || typeof body.reason !== 'string') {
    return undefined;
  }
  const reason = body.reason.trim();
  return reason && [...reason].length <= 500 ? reason : undefined;
}

async function readBottleInput(
  bodyRequest: Promise<unknown>,
  contentRequired: boolean,
): Promise<{ value: BottleUpdateInput } | { error: string }> {
  const body = await bodyRequest;
  if (!body || typeof body !== 'object') return { error: '请求格式无效' };

  const senderId = 'senderId' in body ? parseQqAccount(String(body.senderId)) : undefined;
  const peerId = 'peerId' in body && typeof body.peerId === 'number' ? body.peerId : undefined;
  const scene = 'scene' in body && typeof body.scene === 'string' ? body.scene : undefined;
  if (!senderId) return { error: '请输入有效的发送者 QQ 号' };
  if (!Number.isSafeInteger(peerId) || !peerId || peerId < 1) return { error: '请输入有效的来源 ID' };
  if (scene !== 'friend' && scene !== 'group' && scene !== 'temp') return { error: '请选择有效的会话类型' };

  const displayName = 'displayName' in body && typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if ([...displayName].length > 50) return { error: '显示名称不能超过 50 个字符' };

  const hasContent = 'content' in body;
  const rawContent = hasContent ? body.content : undefined;
  if ((contentRequired || hasContent) && typeof rawContent !== 'string') return { error: '请输入漂流瓶内容' };
  const content = typeof rawContent === 'string' ? rawContent.trim() : undefined;
  if (content !== undefined && (!content || [...content].length > 500)) {
    return { error: '漂流瓶内容不能为空，且不能超过 500 个字符' };
  }

  const parsedTextSegments = readBottleTextSegments(body);
  if ('error' in parsedTextSegments) return parsedTextSegments;
  if (content !== undefined && parsedTextSegments.value !== undefined) {
    return { error: '不能同时提交正文和文字消息段' };
  }

  return {
    value: {
      senderId,
      displayName: displayName || undefined,
      source: { scene, peerId },
      ...(content === undefined ? {} : { content }),
      ...(parsedTextSegments.value === undefined ? {} : { textSegments: parsedTextSegments.value }),
    },
  };
}

function readBottleTextSegments(body: object): { value: BottleUpdateInput['textSegments'] } | { error: string } {
  if (!('textSegments' in body)) return { value: undefined };
  if (!Array.isArray(body.textSegments) || body.textSegments.length === 0) {
    return { error: '请输入有效的文字内容' };
  }

  const indexes = new Set<number>();
  const updates: NonNullable<BottleUpdateInput['textSegments']> = [];
  for (const item of body.textSegments) {
    if (!item || typeof item !== 'object' || !('segmentIndex' in item) || !('text' in item)) {
      return { error: '文字内容格式无效' };
    }
    const segmentIndex = item.segmentIndex;
    const rawText = item.text;
    if (!Number.isSafeInteger(segmentIndex) || (segmentIndex as number) < 0 || indexes.has(segmentIndex as number)) {
      return { error: '文字消息段索引无效' };
    }
    if (typeof rawText !== 'string') return { error: '文字内容格式无效' };
    const text = rawText.trim();
    if (!text || [...text].length > 500) return { error: '每段文字不能为空，且不能超过 500 个字符' };
    indexes.add(segmentIndex as number);
    updates.push({ segmentIndex: segmentIndex as number, text });
  }
  return { value: updates };
}

function readSettings(body: unknown): { value: EditableWebuiSettings } | { error: string } {
  if (
    !body ||
    typeof body !== 'object' ||
    !('moderationMode' in body) ||
    typeof body.moderationMode !== 'string' ||
    !('moderationModel' in body) ||
    typeof body.moderationModel !== 'string' ||
    !('ownerIds' in body) ||
    !Array.isArray(body.ownerIds) ||
    body.ownerIds.some((ownerId) => typeof ownerId !== 'number') ||
    !('webuiPath' in body) ||
    typeof body.webuiPath !== 'string'
  ) {
    return { error: '请填写完整的插件配置' };
  }

  try {
    return {
      value: {
        moderationMode: normalizeModerationMode(body.moderationMode as 'ai' | 'manual'),
        moderationModel: normalizeModerationModel(body.moderationModel),
        ownerIds: normalizeOwnerIds(body.ownerIds as number[]),
        webuiPath: normalizeWebuiPath(body.webuiPath),
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : '插件配置无效' };
  }
}

function readPasswordChange(body: unknown): { currentPassword: string; newPassword: string } | undefined {
  if (
    !body ||
    typeof body !== 'object' ||
    !('currentPassword' in body) ||
    typeof body.currentPassword !== 'string' ||
    !('newPassword' in body) ||
    typeof body.newPassword !== 'string'
  ) {
    return undefined;
  }
  return { currentPassword: body.currentPassword, newPassword: body.newPassword };
}

function readPage(value: string | undefined): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function qqAvatarUrl(userId: number | undefined): string | undefined {
  if (!Number.isSafeInteger(userId) || !userId || userId < 1) {
    return undefined;
  }
  return `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`;
}

function readSessionCookie(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const cookie of header.split(';')) {
    const [name, ...value] = cookie.trim().split('=');
    if (name === SESSION_COOKIE) {
      return value.join('=');
    }
  }
  return undefined;
}

function sessionCookie(token: string, basePath: string, secure: boolean, maxAge = 12 * 60 * 60): string {
  const attributes = [
    `${SESSION_COOKIE}=${token}`,
    `Path=${basePath}`,
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (secure) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}

async function serveWebuiFile(directory: string, requestPath: string): Promise<Response> {
  const filePath = resolve(directory, requestPath);
  const relativePath = relative(directory, filePath);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return new Response('Not Found', { status: 404 });
  }

  let content: Uint8Array;
  try {
    content = await readFile(filePath);
  } catch (error) {
    if (isMissingFile(error)) {
      return new Response('Not Found', { status: 404 });
    }
    throw error;
  }

  return new Response(content, {
    headers: {
      'Cache-Control': requestPath === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'Content-Type': contentTypeFor(requestPath),
    },
  });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'EISDIR');
}

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}
