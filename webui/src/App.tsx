import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { AllBottleList, PendingReviewList } from './BottleLists';
import { Dashboard } from './Dashboard';
import { type AppPage, pageFromLocation, pageUrl, webuiUrl } from './location';
import { RegistrationRequests } from './RegistrationRequests';

type View = 'checking' | 'login' | 'main';
type AuthMode = 'login' | 'register';
type Session = {
  account?: string | null;
  authenticated?: boolean;
  avatarUrl?: string;
  isOwner?: boolean;
  canModerate?: boolean;
};
type SidebarIconName = 'accounts' | 'bottles' | 'collapse' | 'expand' | 'home' | 'review' | 'settings';

export function App() {
  const [view, setView] = useState<View>('checking');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordHelpVisible, setPasswordHelpVisible] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [loginAvatarFailed, setLoginAvatarFailed] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mainPage, setMainPage] = useState<AppPage>(() => pageFromLocation());
  const accountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void fetch(webuiUrl('api/session'), { credentials: 'same-origin' })
      .then(async (response) => (response.ok ? ((await response.json()) as Session) : undefined))
      .then((session) => {
        if (!active) return;
        const authenticated = Boolean(session?.authenticated);
        const owner = Boolean(session?.isOwner);
        const requestedPage = pageFromLocation();
        const page = requestedPage === 'registrations' && !owner ? 'home' : requestedPage;
        setAvatarUrl(session?.avatarUrl);
        setIsOwner(owner);
        setCanModerate(Boolean(session?.canModerate));
        setMainPage(page);
        setView(authenticated ? 'main' : 'login');
        syncLocation(authenticated, page);
      })
      .catch(() => {
        if (active) {
          setError('暂时无法连接到管理服务');
          setView('login');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const updatePageFromHistory = () => {
      const page = pageFromLocation();
      if (page === 'registrations' && !isOwner) {
        setMainPage('home');
        syncLocation(view === 'main', 'home');
        return;
      }
      setMainPage(page);
    };
    window.addEventListener('popstate', updatePageFromHistory);
    return () => window.removeEventListener('popstate', updatePageFromHistory);
  }, [isOwner, view]);

  useEffect(() => {
    if (view === 'login') {
      accountInputRef.current?.focus();
    }
  }, [view]);

  const handleSessionExpired = useCallback(() => {
    setPassword('');
    setConfirmPassword('');
    setPasswordVisible(false);
    setAuthMode('login');
    setRegistrationMessage('');
    setSucceeded(false);
    setIsOwner(false);
    setCanModerate(false);
    setError('登录已过期，请重新登录');
    setView('login');
    syncLocation(false, 'home');
  }, []);

  function openMainPage(page: AppPage) {
    setMainPage(page);
    syncLocation(true, page, false);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('#app-main')?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account || !password || submitting) return;

    if (authMode === 'register') {
      if (!/^[1-9]\d{4,11}$/.test(account)) {
        setError('账号必须是 5–12 位 QQ 号');
        return;
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,10}$/.test(password)) {
        setError('密码必须为 6–10 位，并同时包含大写字母、小写字母和数字');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(webuiUrl(authMode === 'login' ? 'api/session' : 'api/registrations'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password }),
      });
      const result = (await response.json().catch(() => undefined)) as
        | { avatarUrl?: string; canModerate?: boolean; error?: string; isOwner?: boolean; message?: string }
        | undefined;
      if (!response.ok) {
        setError(result?.error ?? (authMode === 'login' ? '登录失败，请稍后重试' : '申请提交失败，请稍后重试'));
        setPassword('');
        setConfirmPassword('');
        setPasswordVisible(false);
        return;
      }
      if (authMode === 'register') {
        setPassword('');
        setConfirmPassword('');
        setPasswordVisible(false);
        setRegistrationMessage(result?.message ?? '申请已发送，请等待插件主人同意');
        return;
      }
      setSucceeded(true);
      const owner = Boolean(result?.isOwner);
      setAvatarUrl(result?.avatarUrl ?? qqAvatarUrl(account));
      setIsOwner(owner);
      setCanModerate(Boolean(result?.canModerate));
      await new Promise((resolve) =>
        window.setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 420),
      );
      setView('main');
      const page = mainPage === 'registrations' && !owner ? 'home' : mainPage;
      setMainPage(page);
      syncLocation(true, page);
    } catch {
      setError('暂时无法连接到管理服务');
    } finally {
      setSubmitting(false);
    }
  }

  function changeAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setPassword('');
    setConfirmPassword('');
    setPasswordVisible(false);
    setPasswordHelpVisible(false);
    setRegistrationMessage('');
    setError('');
    setSucceeded(false);
    window.requestAnimationFrame(() => accountInputRef.current?.focus());
  }

  if (view === 'checking') {
    return <main className="checking-page" aria-label="正在载入漂流瓶审核管理后台" tabIndex={-1} />;
  }

  if (view === 'main') {
    const pageLabel =
      mainPage === 'pending'
        ? '待审核'
        : mainPage === 'bottles'
          ? '全部瓶子'
          : mainPage === 'registrations'
            ? '账号请求'
            : '主页';
    return (
      <div className={`app-shell${sidebarCollapsed ? ' app-shell--sidebar-collapsed' : ''}`}>
        <a className="skip-link" href="#app-main">
          跳转到当前页面内容
        </a>
        <aside className="app-sidebar">
          <div className="app-sidebar-header">
            <div className="sidebar-avatar" aria-hidden="true">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setAvatarUrl(undefined)} />
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" />
                  <path d="M4.25 20.25c.72-3.36 3.68-5.5 7.75-5.5s7.03 2.14 7.75 5.5" />
                </svg>
              )}
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={sidebarCollapsed ? '展开侧边导航' : '收起侧边导航'}
              aria-expanded={!sidebarCollapsed}
              aria-controls="primary-navigation"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              <SidebarIcon name={sidebarCollapsed ? 'expand' : 'collapse'} />
            </button>
          </div>
          <nav id="primary-navigation" className="sidebar-nav" aria-label="主要导航">
            <button
              type="button"
              className="sidebar-nav-button"
              aria-current={mainPage === 'home' ? 'page' : undefined}
              title={sidebarCollapsed ? '主页' : undefined}
              onClick={() => openMainPage('home')}
            >
              <SidebarIcon name="home" />
              <span className="sidebar-nav-label">主页</span>
            </button>
            <button
              type="button"
              className="sidebar-nav-button"
              aria-current={mainPage === 'pending' ? 'page' : undefined}
              title={sidebarCollapsed ? '待审核' : undefined}
              onClick={() => openMainPage('pending')}
            >
              <SidebarIcon name="review" />
              <span className="sidebar-nav-label">待审核</span>
            </button>
            <button
              type="button"
              className="sidebar-nav-button"
              aria-current={mainPage === 'bottles' ? 'page' : undefined}
              title={sidebarCollapsed ? '全部瓶子' : undefined}
              onClick={() => openMainPage('bottles')}
            >
              <SidebarIcon name="bottles" />
              <span className="sidebar-nav-label">全部瓶子</span>
            </button>
            {isOwner ? (
              <button
                type="button"
                className="sidebar-nav-button"
                aria-current={mainPage === 'registrations' ? 'page' : undefined}
                title={sidebarCollapsed ? '账号请求' : undefined}
                onClick={() => openMainPage('registrations')}
              >
                <SidebarIcon name="accounts" />
                <span className="sidebar-nav-label">账号请求</span>
              </button>
            ) : null}
            <button
              type="button"
              className="sidebar-nav-button sidebar-nav-button--settings"
              title={sidebarCollapsed ? '设置' : undefined}
            >
              <SidebarIcon name="settings" />
              <span className="sidebar-nav-label">设置</span>
            </button>
          </nav>
        </aside>
        <main id="app-main" className="app-main" aria-label={pageLabel} tabIndex={-1}>
          {mainPage === 'home' ? <Dashboard onSessionExpired={handleSessionExpired} /> : null}
          {mainPage === 'pending' ? (
            <PendingReviewList canModerate={canModerate} onSessionExpired={handleSessionExpired} />
          ) : null}
          {mainPage === 'bottles' ? <AllBottleList onSessionExpired={handleSessionExpired} /> : null}
          {mainPage === 'registrations' && isOwner ? (
            <RegistrationRequests onSessionExpired={handleSessionExpired} />
          ) : null}
        </main>
      </div>
    );
  }

  const isRegistration = authMode === 'register';
  const accountAvatarUrl = loginAvatarFailed ? undefined : qqAvatarUrl(account);
  const submitDisabled =
    !account || !password || submitting || (isRegistration && (!confirmPassword || Boolean(registrationMessage)));

  return (
    <main className="login-page">
      <form className="login-form" onSubmit={handleSubmit} aria-busy={submitting}>
        <div className="login-avatar" aria-hidden="true">
          {accountAvatarUrl ? (
            <img
              src={accountAvatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setLoginAvatarFailed(true)}
            />
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" />
              <path d="M4.25 20.25c.72-3.36 3.68-5.5 7.75-5.5s7.03 2.14 7.75 5.5" />
            </svg>
          )}
        </div>
        <div className="auth-mode-switch" aria-label="账号操作">
          <button
            type="button"
            aria-pressed={!isRegistration}
            onClick={() => changeAuthMode('login')}
            disabled={submitting}
          >
            登录
          </button>
          <button
            type="button"
            aria-pressed={isRegistration}
            onClick={() => changeAuthMode('register')}
            disabled={submitting}
          >
            注册账号
          </button>
        </div>
        {registrationMessage ? (
          <div className="registration-success" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="m8 12.25 2.5 2.5 5.5-5.5" />
            </svg>
            <strong>申请已发送</strong>
            <p>{registrationMessage}</p>
            <p>任一插件主人同意后，即可使用该 QQ 号登录。</p>
            <button type="button" onClick={() => changeAuthMode('login')}>
              返回登录
            </button>
          </div>
        ) : (
          <>
            <div className="auth-fields">
              <div className="auth-control">
                <label htmlFor="admin-account">QQ 账号</label>
                <div className={`auth-field${error ? ' auth-field--error' : ''}`}>
                  <input
                    ref={accountInputRef}
                    id="admin-account"
                    type="text"
                    inputMode="numeric"
                    autoComplete="username"
                    value={account}
                    maxLength={12}
                    onChange={(event) => {
                      setAccount(event.target.value.replace(/\D/g, '').slice(0, 12));
                      setLoginAvatarFailed(false);
                      if (error) setError('');
                    }}
                    placeholder="请输入 QQ 号"
                    aria-describedby="login-error"
                    aria-invalid={Boolean(error)}
                    disabled={submitting}
                    required
                  />
                </div>
              </div>
              <div className="auth-control">
                <label htmlFor="admin-password">{isRegistration ? '设置密码' : '密码'}</label>
                <div className={`auth-field${error ? ' auth-field--error' : ''}`}>
                  <input
                    id="admin-password"
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error) setError('');
                    }}
                    placeholder={isRegistration ? '设置登录密码' : '请输入密码'}
                    autoComplete={isRegistration ? 'new-password' : 'current-password'}
                    aria-describedby={isRegistration ? 'registration-password-hint login-error' : 'login-error'}
                    aria-invalid={Boolean(error)}
                    disabled={submitting}
                    required
                  />
                  <PasswordVisibilityButton
                    visible={passwordVisible}
                    disabled={submitting}
                    onToggle={() => setPasswordVisible((visible) => !visible)}
                  />
                  {!isRegistration ? (
                    <LoginSubmitButton succeeded={succeeded} disabled={submitDisabled} label="登录" />
                  ) : null}
                </div>
                {isRegistration ? (
                  <p id="registration-password-hint" className="auth-field-hint">
                    6–10 位，必须同时包含大小写英文字母和数字
                  </p>
                ) : null}
              </div>
              {isRegistration ? (
                <div className="auth-control">
                  <label htmlFor="confirm-password">确认密码</label>
                  <div className={`auth-field${error ? ' auth-field--error' : ''}`}>
                    <input
                      id="confirm-password"
                      type={passwordVisible ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        if (error) setError('');
                      }}
                      placeholder="再次输入密码"
                      autoComplete="new-password"
                      aria-describedby="login-error"
                      aria-invalid={Boolean(error)}
                      disabled={submitting}
                      required
                    />
                    <LoginSubmitButton succeeded={false} disabled={submitDisabled} label="提交注册申请" />
                  </div>
                </div>
              ) : null}
            </div>
            <span className="visually-hidden" role="status">
              {succeeded ? '登录成功' : ''}
            </span>
            <p id="login-error" className="login-error" aria-live="polite">
              {error || '\u00a0'}
            </p>
            {!isRegistration ? (
              <>
                <button
                  type="button"
                  className="forgot-password-button"
                  aria-expanded={passwordHelpVisible}
                  aria-controls="password-recovery-help"
                  onClick={() => setPasswordHelpVisible((visible) => !visible)}
                >
                  忘记密码？
                </button>
                {passwordHelpVisible ? (
                  <p id="password-recovery-help" className="password-recovery-help">
                    密码无法直接找回，请联系插件主人处理对应 QQ 账号。
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </form>
    </main>
  );
}

function PasswordVisibilityButton({
  visible,
  disabled,
  onToggle,
}: {
  visible: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="password-toggle"
      aria-label={visible ? '隐藏密码' : '查看密码'}
      aria-pressed={visible}
      onClick={onToggle}
      disabled={disabled}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.75 12s3.25-5 9.25-5 9.25 5 9.25 5-3.25 5-9.25 5-9.25-5-9.25-5Z" />
        <circle cx="12" cy="12" r="2.25" />
        {visible ? <path d="m4 4 16 16" /> : null}
      </svg>
    </button>
  );
}

function LoginSubmitButton({ succeeded, disabled, label }: { succeeded: boolean; disabled: boolean; label: string }) {
  return (
    <button
      type="submit"
      className={succeeded ? 'login-submit login-submit--success' : 'login-submit'}
      aria-label={succeeded ? '登录成功' : label}
      disabled={disabled}
    >
      <svg className="login-submit-arrow" viewBox="0 0 20 20" aria-hidden="true">
        <path d="m7 4 6 6-6 6" />
      </svg>
      <svg className="login-submit-check" viewBox="0 0 20 20" aria-hidden="true">
        <path d="m4.5 10.25 3.5 3.5 7.5-7.5" />
      </svg>
    </button>
  );
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'home' ? (
        <>
          <path d="m3.5 10.5 8.5-7 8.5 7" />
          <path d="M5.5 9.25V20h13V9.25M9.25 20v-6.25h5.5V20" />
        </>
      ) : null}
      {name === 'review' ? (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </>
      ) : null}
      {name === 'bottles' ? (
        <>
          <path d="M9.5 3h5M10 3v4.2c0 .8-.38 1.55-1.03 2.02A4.6 4.6 0 0 0 7 13v5.5A2.5 2.5 0 0 0 9.5 21h5a2.5 2.5 0 0 0 2.5-2.5V13a4.6 4.6 0 0 0-1.97-3.78A2.46 2.46 0 0 1 14 7.2V3" />
          <path d="M7 14h10" />
        </>
      ) : null}
      {name === 'settings' ? (
        <>
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="8" cy="17" r="2" />
        </>
      ) : null}
      {name === 'accounts' ? (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19c.45-3.2 2.3-5 5.5-5 1.8 0 3.2.57 4.14 1.64" />
          <path d="m15 18 2 2 4-4" />
        </>
      ) : null}
      {name === 'collapse' || name === 'expand' ? (
        <>
          <path d="M4 4.5h16v15H4zM9 4.5v15" />
          <path d={name === 'collapse' ? 'm15 9-3 3 3 3' : 'm12 9 3 3-3 3'} />
        </>
      ) : null}
    </svg>
  );
}

function syncLocation(authenticated: boolean, page: AppPage, replace = true) {
  const target = authenticated ? pageUrl(page) : webuiUrl();
  if (window.location.pathname === target.pathname) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', target);
}

function qqAvatarUrl(account: string): string | undefined {
  if (!/^[1-9]\d{4,11}$/.test(account)) return undefined;
  return `https://q1.qlogo.cn/g?b=qq&nk=${account}&s=640`;
}
