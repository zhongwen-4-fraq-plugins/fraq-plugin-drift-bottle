import { type FormEvent, useEffect, useState } from 'react';

import { webuiUrl } from './location';
import { PasswordVisibilityButton } from './PasswordVisibilityButton';

interface SettingsPageProps {
  isOwner: boolean;
  onSessionExpired: () => void;
}

interface PluginSettings {
  activeWebuiPath: string;
  moderationMode: 'ai' | 'manual';
  moderationModel?: string;
  ownerIds: number[];
  restartRequired: boolean;
  storagePath: string;
  webuiPath: string;
}

interface FormMessage {
  tone: 'error' | 'success';
  text: string;
}

interface PasswordErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,10}$/;

export function SettingsPage({ isOwner, onSessionExpired }: SettingsPageProps) {
  const [settings, setSettings] = useState<PluginSettings>();
  const [moderationMode, setModerationMode] = useState<'ai' | 'manual'>('ai');
  const [moderationModel, setModerationModel] = useState('');
  const [ownerIds, setOwnerIds] = useState('');
  const [webuiPath, setWebuiPath] = useState('');
  const [configLoading, setConfigLoading] = useState(isOwner);
  const [configSaving, setConfigSaving] = useState(false);
  const [configErrors, setConfigErrors] = useState<{ ownerIds?: string; webuiPath?: string }>({});
  const [configMessage, setConfigMessage] = useState<FormMessage>();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordMessage, setPasswordMessage] = useState<FormMessage>();

  useEffect(() => {
    if (!isOwner) return;
    const request = new AbortController();
    setConfigLoading(true);
    void fetch(webuiUrl('api/settings'), { credentials: 'same-origin', signal: request.signal })
      .then(async (response) => {
        if (response.status === 401) {
          onSessionExpired();
          return undefined;
        }
        const result = (await response.json().catch(() => undefined)) as
          | (PluginSettings & { error?: string })
          | undefined;
        if (!response.ok || !result) {
          throw new Error(result?.error ?? '插件配置暂时无法载入');
        }
        return result;
      })
      .then((result) => {
        if (!result) return;
        setSettings(result);
        setModerationMode(result.moderationMode);
        setModerationModel(result.moderationModel ?? '');
        setOwnerIds(result.ownerIds.join('\n'));
        setWebuiPath(result.webuiPath);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setConfigMessage({ tone: 'error', text: error instanceof Error ? error.message : '插件配置暂时无法载入' });
        }
      })
      .finally(() => {
        if (!request.signal.aborted) setConfigLoading(false);
      });
    return () => request.abort();
  }, [isOwner, onSessionExpired]);

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configSaving) return;

    const parsedOwners = parseOwnerIds(ownerIds);
    const nextErrors: typeof configErrors = {};
    if ('error' in parsedOwners) nextErrors.ownerIds = parsedOwners.error;
    if (!isValidWebuiPath(webuiPath)) nextErrors.webuiPath = '路径必须以 / 开头，且不能是根路径或包含 ?、#';
    setConfigErrors(nextErrors);
    setConfigMessage(undefined);
    if (Object.keys(nextErrors).length > 0 || 'error' in parsedOwners) return;

    setConfigSaving(true);
    try {
      const response = await fetch(webuiUrl('api/settings'), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderationMode, moderationModel, ownerIds: parsedOwners.value, webuiPath }),
      });
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      const result = (await response.json().catch(() => undefined)) as
        | (PluginSettings & { error?: string })
        | undefined;
      if (!response.ok || !result) {
        const message = result?.error ?? '配置暂时无法保存，请稍后重试';
        if (message.includes('主人列表') || message.includes('QQ 号')) {
          setConfigErrors((current) => ({ ...current, ownerIds: message }));
        } else if (message.includes('路径')) {
          setConfigErrors((current) => ({ ...current, webuiPath: message }));
        } else {
          setConfigMessage({ tone: 'error', text: message });
        }
        return;
      }
      setSettings(result);
      setModerationMode(result.moderationMode);
      setModerationModel(result.moderationModel ?? '');
      setOwnerIds(result.ownerIds.join('\n'));
      setWebuiPath(result.webuiPath);
      setConfigMessage({
        tone: 'success',
        text: result.restartRequired ? '配置已保存。WebUI 路径将在重启 Fraq 后生效。' : '配置已保存并立即生效。',
      });
    } catch {
      setConfigMessage({ tone: 'error', text: '无法连接到管理服务，请检查网络后重试' });
    } finally {
      setConfigSaving(false);
    }
  }

  function validatePasswordField(field: keyof PasswordErrors): string | undefined {
    if (field === 'currentPassword') return currentPassword ? undefined : '请输入当前密码';
    if (field === 'newPassword') {
      return passwordPattern.test(newPassword) ? undefined : '新密码需要 6–10 位，并同时包含大写字母、小写字母和数字';
    }
    return confirmPassword === newPassword && confirmPassword ? undefined : '两次输入的新密码不一致';
  }

  function handlePasswordBlur(field: keyof PasswordErrors) {
    setPasswordErrors((current) => ({ ...current, [field]: validatePasswordField(field) }));
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordSaving) return;

    const nextErrors: PasswordErrors = {
      currentPassword: validatePasswordField('currentPassword'),
      newPassword: validatePasswordField('newPassword'),
      confirmPassword: validatePasswordField('confirmPassword'),
    };
    setPasswordErrors(nextErrors);
    setPasswordMessage(undefined);
    if (Object.values(nextErrors).some(Boolean)) return;

    setPasswordSaving(true);
    try {
      const response = await fetch(webuiUrl('api/account/password'), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      const result = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
      if (!response.ok) {
        const message = result?.error ?? '密码暂时无法修改，请稍后重试';
        if (message.includes('当前密码')) {
          setPasswordErrors((current) => ({ ...current, currentPassword: message }));
        } else if (message.includes('新密码')) {
          setPasswordErrors((current) => ({ ...current, newPassword: message }));
        } else {
          setPasswordMessage({ tone: 'error', text: message });
        }
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
      setCurrentPasswordVisible(false);
      setNewPasswordVisible(false);
      setConfirmPasswordVisible(false);
      setPasswordMessage({ tone: 'success', text: '密码已修改。当前登录保持有效，其他会话已退出。' });
    } catch {
      setPasswordMessage({ tone: 'error', text: '无法连接到管理服务，请检查网络后重试' });
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <h1>设置</h1>
        <p>管理插件运行配置与当前账号安全。</p>
      </header>

      {isOwner ? (
        <section className="settings-section" aria-labelledby="plugin-settings-title">
          <header className="settings-section-header">
            <h2 id="plugin-settings-title">插件配置</h2>
            <p>审核方式、模型和主人列表保存后立即生效；修改 WebUI 路径需要重启 Fraq。</p>
          </header>
          {configLoading ? (
            <div className="settings-form-skeleton" aria-label="正在载入插件配置">
              <span />
              <span />
              <span />
            </div>
          ) : settings ? (
            <form
              className="settings-form settings-form--configuration"
              onSubmit={saveConfiguration}
              aria-busy={configSaving}
            >
              <div className="settings-field-grid">
                <div className="settings-field">
                  <label htmlFor="moderation-mode">投瓶审核方式</label>
                  <select
                    id="moderation-mode"
                    value={moderationMode}
                    onChange={(event) => {
                      setModerationMode(event.target.value as 'ai' | 'manual');
                      setConfigMessage(undefined);
                    }}
                    disabled={configSaving}
                  >
                    <option value="ai">AI 自动审核</option>
                    <option value="manual">人工审核</option>
                  </select>
                  <p className="settings-field-hint">
                    {moderationMode === 'manual'
                      ? '所有新投瓶会进入待审核列表，通过后才会公开。'
                      : 'AI 通过后立即公开；未通过或中断时转入待审核列表。'}
                  </p>
                </div>
                <div className="settings-field">
                  <label htmlFor="moderation-model">AI 审核模型</label>
                  <input
                    id="moderation-model"
                    value={moderationModel}
                    maxLength={200}
                    placeholder="留空时使用 AI 插件默认模型"
                    onChange={(event) => {
                      setModerationModel(event.target.value);
                      setConfigMessage(undefined);
                    }}
                    disabled={configSaving}
                  />
                  <p className="settings-field-hint">可填写模型别名或“提供商/模型”；评论与署名审核仍会使用此模型。</p>
                </div>
                <div className="settings-field">
                  <label htmlFor="webui-path">WebUI 路径</label>
                  <input
                    id="webui-path"
                    value={webuiPath}
                    aria-invalid={Boolean(configErrors.webuiPath)}
                    aria-describedby="webui-path-hint webui-path-error"
                    onChange={(event) => {
                      setWebuiPath(event.target.value);
                      setConfigErrors((current) => ({ ...current, webuiPath: undefined }));
                      setConfigMessage(undefined);
                    }}
                    onBlur={() =>
                      setConfigErrors((current) => ({
                        ...current,
                        webuiPath: isValidWebuiPath(webuiPath)
                          ? undefined
                          : '路径必须以 / 开头，且不能是根路径或包含 ?、#',
                      }))
                    }
                    disabled={configSaving}
                  />
                  <p id="webui-path-hint" className="settings-field-hint">
                    当前生效路径：{settings.activeWebuiPath}
                  </p>
                  <p id="webui-path-error" className="settings-field-error">
                    {configErrors.webuiPath}
                  </p>
                </div>
                <div className="settings-field settings-field--wide">
                  <label htmlFor="owner-ids">主人 QQ 号</label>
                  <textarea
                    id="owner-ids"
                    value={ownerIds}
                    rows={4}
                    aria-invalid={Boolean(configErrors.ownerIds)}
                    aria-describedby="owner-ids-hint owner-ids-error"
                    onChange={(event) => {
                      setOwnerIds(event.target.value);
                      setConfigErrors((current) => ({ ...current, ownerIds: undefined }));
                      setConfigMessage(undefined);
                    }}
                    onBlur={() => {
                      const result = parseOwnerIds(ownerIds);
                      setConfigErrors((current) => ({
                        ...current,
                        ownerIds: 'error' in result ? result.error : undefined,
                      }));
                    }}
                    disabled={configSaving}
                  />
                  <p id="owner-ids-hint" className="settings-field-hint">
                    每行填写一个 QQ 号。新增主人如无账号，插件会私聊发送初始密码。
                  </p>
                  <p id="owner-ids-error" className="settings-field-error">
                    {configErrors.ownerIds}
                  </p>
                </div>
                <div className="settings-field settings-field--wide">
                  <label htmlFor="storage-path">数据库路径</label>
                  <input id="storage-path" value={settings.storagePath} readOnly aria-describedby="storage-path-hint" />
                  <p id="storage-path-hint" className="settings-field-hint">
                    数据库路径在插件启动前确定，请在 Fraq 插件配置中修改后重启。
                  </p>
                </div>
              </div>
              <div className="settings-form-actions">
                <button type="submit" disabled={configSaving}>
                  {configSaving ? '正在保存配置…' : '保存配置'}
                </button>
                <p
                  className={`settings-form-message${configMessage ? ` settings-form-message--${configMessage.tone}` : ''}`}
                  role={configMessage?.tone === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {configMessage?.text}
                </p>
              </div>
            </form>
          ) : (
            <div className="settings-load-error" role="alert">
              <p>{configMessage?.text ?? '插件配置暂时无法载入'}</p>
              <button type="button" onClick={() => window.location.reload()}>
                重新载入页面
              </button>
            </div>
          )}
        </section>
      ) : null}

      <section className="settings-section" aria-labelledby="password-settings-title">
        <header className="settings-section-header">
          <h2 id="password-settings-title">修改密码</h2>
          <p>修改当前登录账号的密码，其他已登录会话将自动退出。</p>
        </header>
        <form className="settings-form settings-form--password" onSubmit={changePassword} aria-busy={passwordSaving}>
          <PasswordField
            id="current-password"
            label="当前密码"
            value={currentPassword}
            visible={currentPasswordVisible}
            autoComplete="current-password"
            error={passwordErrors.currentPassword}
            disabled={passwordSaving}
            onBlur={() => handlePasswordBlur('currentPassword')}
            onChange={(value) => {
              setCurrentPassword(value);
              setPasswordErrors((current) => ({ ...current, currentPassword: undefined }));
              setPasswordMessage(undefined);
            }}
            onToggle={() => setCurrentPasswordVisible((visible) => !visible)}
          />
          <PasswordField
            id="new-password"
            label="新密码"
            value={newPassword}
            visible={newPasswordVisible}
            autoComplete="new-password"
            error={passwordErrors.newPassword}
            hint="需要 6–10 位，并同时包含大写字母、小写字母和数字。"
            maxLength={10}
            disabled={passwordSaving}
            onBlur={() => handlePasswordBlur('newPassword')}
            onChange={(value) => {
              setNewPassword(value);
              setPasswordErrors((current) => ({ ...current, newPassword: undefined, confirmPassword: undefined }));
              setPasswordMessage(undefined);
            }}
            onToggle={() => setNewPasswordVisible((visible) => !visible)}
          />
          <PasswordField
            id="confirm-new-password"
            label="确认新密码"
            value={confirmPassword}
            visible={confirmPasswordVisible}
            autoComplete="new-password"
            error={passwordErrors.confirmPassword}
            maxLength={10}
            disabled={passwordSaving}
            onBlur={() => handlePasswordBlur('confirmPassword')}
            onChange={(value) => {
              setConfirmPassword(value);
              setPasswordErrors((current) => ({ ...current, confirmPassword: undefined }));
              setPasswordMessage(undefined);
            }}
            onToggle={() => setConfirmPasswordVisible((visible) => !visible)}
          />
          <div className="settings-form-actions">
            <button type="submit" disabled={passwordSaving}>
              {passwordSaving ? '正在修改密码…' : '修改密码'}
            </button>
            <p
              className={`settings-form-message${passwordMessage ? ` settings-form-message--${passwordMessage.tone}` : ''}`}
              role={passwordMessage?.tone === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {passwordMessage?.text}
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  autoComplete: string;
  disabled: boolean;
  error?: string;
  hint?: string;
  maxLength?: number;
  onBlur: () => void;
  onChange: (value: string) => void;
  onToggle: () => void;
}

function PasswordField({
  id,
  label,
  value,
  visible,
  autoComplete,
  disabled,
  error,
  hint,
  maxLength,
  onBlur,
  onChange,
  onToggle,
}: PasswordFieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className="settings-field">
      <label htmlFor={id}>{label}</label>
      <div className="settings-password-control" data-invalid={Boolean(error) || undefined}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
        <PasswordVisibilityButton visible={visible} disabled={disabled} onToggle={onToggle} />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="settings-field-hint">
          {hint}
        </p>
      ) : null}
      <p id={`${id}-error`} className="settings-field-error">
        {error}
      </p>
    </div>
  );
}

function parseOwnerIds(value: string): { value: number[] } | { error: string } {
  const entries = value
    .split(/[\s,，]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return { error: '请至少保留一个主人 QQ 号' };
  if (entries.some((entry) => !/^[1-9]\d{4,11}$/.test(entry))) {
    return { error: '每项都需要是 5–12 位 QQ 号' };
  }
  return { value: [...new Set(entries.map(Number))] };
}

function isValidWebuiPath(path: string): boolean {
  const trimmed = path.trim();
  return trimmed.startsWith('/') && trimmed !== '/' && !trimmed.includes('?') && !trimmed.includes('#');
}
