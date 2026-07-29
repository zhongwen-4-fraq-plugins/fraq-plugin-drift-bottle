import type { BottleModerationMode, DriftBottleOptions } from '../models/index.js';
import type { BottleStore, PersistedWebuiSettings } from '../persistence/bottle-store.js';
import { parseQqAccount } from './auth.js';

export interface EditableWebuiSettings {
  moderationMode: BottleModerationMode;
  moderationModel?: string;
  ownerIds: number[];
  webuiPath: string;
}

export interface WebuiSettingsSnapshot extends EditableWebuiSettings {
  activeWebuiPath: string;
  restartRequired: boolean;
  storagePath: string;
}

export class WebuiSettings {
  private activeWebuiPath = '';
  private desiredWebuiPath: string;
  private mode: BottleModerationMode;
  private model?: string;
  readonly ownerIds: number[];
  readonly storagePath: string;

  constructor(
    private readonly store: BottleStore,
    options: DriftBottleOptions,
  ) {
    const persisted = store.webuiSettings();
    this.storagePath = options.storagePath ?? './data/drift-bottles.db';
    this.mode = readModerationMode(persisted) ?? normalizeModerationMode(options.moderationMode);
    this.model = persisted ? readModerationModel(persisted) : normalizeModerationModel(options.moderationModel);
    this.ownerIds = readOwnerIds(persisted) ?? normalizeConfiguredOwnerIds(options.ownerIds ?? []);
    this.desiredWebuiPath = readWebuiPath(persisted) ?? normalizeWebuiPath(options.webuiPath ?? '/drift-bottle');
  }

  get moderationModel(): string | undefined {
    return this.model;
  }

  get moderationMode(): BottleModerationMode {
    return this.mode;
  }

  get webuiPath(): string {
    return this.desiredWebuiPath;
  }

  setActiveWebuiPath(path: string): void {
    this.activeWebuiPath = path;
  }

  update(settings: EditableWebuiSettings): void {
    const mode = normalizeModerationMode(settings.moderationMode);
    const model = normalizeModerationModel(settings.moderationModel);
    const ownerIds = normalizeOwnerIds(settings.ownerIds);
    const webuiPath = normalizeWebuiPath(settings.webuiPath);
    this.store.setWebuiSettings({
      moderationMode: mode,
      moderationModel: model,
      ownerIds,
      webuiPath,
    });
    this.mode = mode;
    this.model = model;
    this.ownerIds.splice(0, this.ownerIds.length, ...ownerIds);
    this.desiredWebuiPath = webuiPath;
  }

  snapshot(): WebuiSettingsSnapshot {
    return {
      activeWebuiPath: this.activeWebuiPath || this.desiredWebuiPath,
      moderationMode: this.mode,
      moderationModel: this.model,
      ownerIds: [...this.ownerIds],
      restartRequired: Boolean(this.activeWebuiPath && this.activeWebuiPath !== this.desiredWebuiPath),
      storagePath: this.storagePath,
      webuiPath: this.desiredWebuiPath,
    };
  }
}

export function normalizeModerationMode(mode: BottleModerationMode | undefined): BottleModerationMode {
  if (mode === undefined || mode === 'ai') return 'ai';
  if (mode === 'manual') return 'manual';
  throw new Error('投瓶审核方式必须是 AI 审核或人工审核');
}

export function normalizeWebuiPath(path: string): string {
  const normalized = `/${path.trim().split('/').filter(Boolean).join('/')}`;
  if (normalized === '/' || path.includes('?') || path.includes('#')) {
    throw new Error('WebUI 挂载路径必须是非根路径，且不能包含查询参数或片段');
  }
  return normalized;
}

export function normalizeModerationModel(model: string | undefined): string | undefined {
  const normalized = model?.trim();
  if (!normalized) return undefined;
  if ([...normalized].length > 200) {
    throw new Error('审核模型不能超过 200 个字符');
  }
  return normalized;
}

export function normalizeOwnerIds(ownerIds: number[]): number[] {
  const normalized = [...new Set(ownerIds)];
  if (normalized.length === 0 || normalized.some((ownerId) => parseQqAccount(String(ownerId)) !== ownerId)) {
    throw new Error('主人列表必须包含至少一个有效 QQ 号');
  }
  return normalized;
}

function readModerationModel(settings: PersistedWebuiSettings | undefined): string | undefined {
  if (!settings || settings.moderationModel === undefined) return undefined;
  try {
    return normalizeModerationModel(settings.moderationModel);
  } catch {
    return undefined;
  }
}

function readModerationMode(settings: PersistedWebuiSettings | undefined): BottleModerationMode | undefined {
  if (!settings || settings.moderationMode === undefined) return undefined;
  try {
    return normalizeModerationMode(settings.moderationMode);
  } catch {
    return undefined;
  }
}

function readOwnerIds(settings: PersistedWebuiSettings | undefined): number[] | undefined {
  if (!settings || !Array.isArray(settings.ownerIds)) return undefined;
  try {
    return normalizeOwnerIds(settings.ownerIds.filter((ownerId): ownerId is number => typeof ownerId === 'number'));
  } catch {
    return undefined;
  }
}

function normalizeConfiguredOwnerIds(ownerIds: number[]): number[] {
  return [...new Set(ownerIds.filter((ownerId) => parseQqAccount(String(ownerId)) === ownerId))];
}

function readWebuiPath(settings: PersistedWebuiSettings | undefined): string | undefined {
  if (!settings) return undefined;
  try {
    return normalizeWebuiPath(settings.webuiPath);
  } catch {
    return undefined;
  }
}
