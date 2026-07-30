import type { DriftBottleApi } from '../api/drift-bottle-api.js';
import type { BottleOperationRecord } from '../models/index.js';
import type { ModerationRecord } from '../processing/moderation-records.js';

export interface DashboardRelease {
  version: string;
  items: string[];
}

export interface DashboardOperation {
  id: string;
  createdAt: number;
  title: string;
  detail?: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}

export interface DashboardRuntimeInfo {
  fraqVersion: string;
  protocolEndpoint?: {
    name: string;
    version: string;
  };
}

export interface DashboardSnapshot {
  generatedAt: number;
  instanceStartedAt: number;
  counts: {
    totalBottles: number;
    pendingReview: number;
  };
  changelog: DashboardRelease[];
  operations: DashboardOperation[];
  runtime: DashboardRuntimeInfo;
}

const CHANGELOG: DashboardRelease[] = [
  {
    version: '0.3.17',
    items: [
      '操作记录会记录人工提交待审核瓶子的动作，便于主人追踪审核流程。',
      '瓶子评论新增评论者 QQ 头像，明确拒绝的瓶子不再进入待审核列表。',
      '全部瓶子列表将图片显示为“[点击查看图片]”，支持登录鉴权、按需刷新地址和响应式弹窗预览。',
    ],
  },
  {
    version: '0.3.16',
    items: [
      '投瓶审核支持 AI 与人工模式切换，人工审核会保留完整投瓶草稿供主人或管理员处理。',
      '机器人新增待审核投瓶的通过与拒绝命令，并要求拒绝时填写理由。',
      '全部瓶子列表可按需向下展开评论，桌面与移动端共享缓存并支持加载失败重试。',
    ],
  },
  {
    version: '0.3.15',
    items: [
      'AI 审核结构不匹配时会进行一次受限重试，并保存响应摘要、校验原因和 Token 等诊断信息。',
      '全部瓶子列表统一按瓶子 ID、时间、来源、消息段类型和内容排列，并完整显示瓶子 ID。',
      '设置页面新增插件配置和当前账号密码修改，支持权限校验、持久化与响应式表单。',
    ],
  },
  {
    version: '0.3.14',
    items: [
      '待审核与全部瓶子列表的内容类型改为响应式标签。',
      '待审核列表新增勾号通过投放和叉号拒绝归档，拒绝理由必须填写。',
      '插件主人和数据库管理员均可人工审核；旧记录缺少投瓶上下文时仅允许拒绝归档。',
    ],
  },
  {
    version: '0.3.13',
    items: ['关于区域的 GitHub、Bug 和帮助入口改为底部图标操作，并完善键盘提示与触控尺寸。'],
  },
  {
    version: '0.3.12',
    items: ['关于区域改为两列布局，集中展示项目入口与运行环境信息。', '新增实际 Fraq 版本及协议端名称、版本展示。'],
  },
  {
    version: '0.3.11',
    items: [
      '登录页头像会跟随当前输入的 QQ 账号更新。',
      '插件启动时为所有尚无账号的主人分别生成并私聊初始密码。',
      '初始密码发送失败时自动撤销新账号，以便下次启动重新生成并发送。',
    ],
  },
  {
    version: '0.3.10',
    items: [
      'WebUI 登录改为 QQ 账号与密码，并加入主人审批注册流程。',
      '主人侧边栏新增响应式账号请求列表，集中查看待审批申请。',
      '账号审批改为回复机器人注册请求并发送“同意”，同时校验引用来源。',
      '主页新增项目地址、问题反馈、帮助入口和当前版本信息。',
    ],
  },
  {
    version: '0.3.9',
    items: ['登录页新增“忘记密码”入口，提供安全、明确的密码恢复指引。'],
  },
  {
    version: '0.3.6',
    items: ['侧边栏左上角新增主人头像，折叠与移动端布局保持清爽。'],
  },
  {
    version: '0.3.5',
    items: ['侧边栏导航加入统一图标，并支持在桌面端收起。'],
  },
  {
    version: '0.3.4',
    items: ['主页加入响应式侧边栏，提供主页、待审核、全部瓶子和设置入口。'],
  },
];

export function createDashboardSnapshot(
  api: DriftBottleApi,
  instanceStartedAt: number,
  runtime: DashboardRuntimeInfo = { fraqVersion: '未知' },
): DashboardSnapshot {
  const operations = [
    ...api.operationRecords(100).map(formatDomainOperation),
    ...api.moderationRecords(100).map(formatModerationOperation),
  ]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 60);

  return {
    generatedAt: Date.now(),
    instanceStartedAt,
    counts: {
      totalBottles: api.count(),
      pendingReview: api.pendingModerationCount(),
    },
    changelog: CHANGELOG,
    operations,
    runtime: {
      fraqVersion: runtime.fraqVersion,
      protocolEndpoint: runtime.protocolEndpoint ? { ...runtime.protocolEndpoint } : undefined,
    },
  };
}

function formatDomainOperation(record: BottleOperationRecord): DashboardOperation {
  const actor = record.actorId ? `QQ ${record.actorId}` : '系统';
  const bottle = record.bottleId ? `瓶子 ${shortId(record.bottleId)}` : undefined;

  switch (record.action) {
    case 'bottle-created':
      return operation(record, '投递漂流瓶', joinDetail(actor, bottle), 'success');
    case 'bottle-picked':
      return operation(
        record,
        record.detail === 'retained' ? '捡取漂流瓶并保留' : '捡取漂流瓶',
        joinDetail(actor, bottle),
      );
    case 'comment-created':
      return operation(record, '发布漂流瓶评论', joinDetail(actor, bottle), 'success');
    case 'bottle-deleted':
      return operation(record, '删除漂流瓶', joinDetail(actor, bottle), 'warning');
    case 'signature-updated':
      return operation(record, '更新漂流瓶署名', joinDetail(actor, signatureLabel(record.detail)));
    case 'moderator-added':
      return operation(record, '添加管理权限', joinDetail(actor, targetUser(record.targetUserId)), 'success');
    case 'moderator-removed':
      return operation(record, '移除管理权限', joinDetail(actor, targetUser(record.targetUserId)), 'warning');
    case 'repeat-pick-updated':
      return operation(record, '更新重复捡取设置', joinDetail(actor, repeatPickLabel(record.detail)));
    case 'moderation-approved':
      return operation(record, '人工审核通过并投放', joinDetail(actor, bottle), 'success');
    case 'moderation-rejected':
      return operation(record, '人工审核拒绝并归档', joinDetail(actor, record.detail), 'danger');
  }
}

function formatModerationOperation(record: ModerationRecord): DashboardOperation {
  if ('manual' in record.process) {
    return {
      id: `moderation-${record.id}`,
      createdAt: record.createdAt,
      title: '提交漂流瓶审核',
      detail: joinDetail(
        record.bottleDraft ? `QQ ${record.bottleDraft.senderId}` : undefined,
        record.process.manual.reason,
      ),
      tone: 'warning',
    };
  }
  if ('error' in record.process) {
    return {
      id: `moderation-${record.id}`,
      createdAt: record.createdAt,
      title: 'AI 审核执行失败',
      detail: record.process.error.message,
      tone: 'danger',
    };
  }

  const result = record.process.result;
  return {
    id: `moderation-${record.id}`,
    createdAt: record.createdAt,
    title: result.approved ? 'AI 审核通过' : 'AI 审核未通过',
    detail: joinDetail(result.reason || undefined, tokenUsage(record.totalTokens)),
    tone: result.approved ? 'success' : 'warning',
  };
}

function operation(
  record: BottleOperationRecord,
  title: string,
  detail?: string,
  tone: DashboardOperation['tone'] = 'neutral',
): DashboardOperation {
  return { id: record.id, createdAt: record.createdAt, title, detail, tone };
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function targetUser(userId: number | undefined): string | undefined {
  return userId ? `目标 QQ ${userId}` : undefined;
}

function signatureLabel(detail: string | undefined): string | undefined {
  if (detail === 'anonymous') return '匿名';
  if (detail === 'original') return '原名';
  if (detail === 'alias') return '别名';
  return undefined;
}

function repeatPickLabel(detail: string | undefined): string | undefined {
  if (detail === 'enabled') return '开启';
  if (detail === 'disabled') return '关闭';
  if (detail === 'default') return '恢复默认';
  return undefined;
}

function tokenUsage(totalTokens: number | undefined): string | undefined {
  return totalTokens === undefined ? undefined : `${totalTokens} Token`;
}

function joinDetail(...parts: (string | undefined)[]): string | undefined {
  const detail = parts.filter(Boolean).join(' · ');
  return detail || undefined;
}
