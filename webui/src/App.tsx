import { type FormEvent, useEffect, useRef, useState } from 'react';

type View = 'checking' | 'login' | 'main';
type Session = { authenticated?: boolean; avatarUrl?: string };
type SidebarIconName = 'bottles' | 'collapse' | 'expand' | 'home' | 'review' | 'settings';

export function App() {
  const [view, setView] = useState<View>('checking');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void fetch('./api/session', { credentials: 'same-origin' })
      .then(async (response) => (response.ok ? ((await response.json()) as Session) : undefined))
      .then((session) => {
        if (!active) return;
        const authenticated = Boolean(session?.authenticated);
        setAvatarUrl(session?.avatarUrl);
        setView(authenticated ? 'main' : 'login');
        syncLocation(authenticated);
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
    if (view === 'login') {
      inputRef.current?.focus();
    }
  }, [view]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('./api/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
        setError(result?.error ?? '登录失败，请稍后重试');
        setPassword('');
        setPasswordVisible(false);
        return;
      }
      setSucceeded(true);
      await new Promise((resolve) =>
        window.setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 420),
      );
      setView('main');
      syncLocation(true);
    } catch {
      setError('暂时无法连接到管理服务');
    } finally {
      setSubmitting(false);
    }
  }

  if (view === 'checking') {
    return <main className="checking-page" aria-label="正在载入漂流瓶审核管理后台" tabIndex={-1} />;
  }

  if (view === 'main') {
    return (
      <div className={`app-shell${sidebarCollapsed ? ' app-shell--sidebar-collapsed' : ''}`}>
        <aside className="app-sidebar">
          <div className="app-sidebar-header">
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
              aria-current="page"
              title={sidebarCollapsed ? '主页' : undefined}
            >
              <SidebarIcon name="home" />
              <span className="sidebar-nav-label">主页</span>
            </button>
            <button type="button" className="sidebar-nav-button" title={sidebarCollapsed ? '待审核' : undefined}>
              <SidebarIcon name="review" />
              <span className="sidebar-nav-label">待审核</span>
            </button>
            <button type="button" className="sidebar-nav-button" title={sidebarCollapsed ? '全部瓶子' : undefined}>
              <SidebarIcon name="bottles" />
              <span className="sidebar-nav-label">全部瓶子</span>
            </button>
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
        <main className="app-main" aria-label="主页" tabIndex={-1} />
      </div>
    );
  }

  return (
    <main className="login-page">
      <form className="login-form" onSubmit={handleSubmit} aria-busy={submitting}>
        <div className="login-avatar" aria-hidden="true">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setAvatarUrl(undefined)} />
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" />
              <path d="M4.25 20.25c.72-3.36 3.68-5.5 7.75-5.5s7.03 2.14 7.75 5.5" />
            </svg>
          )}
        </div>
        <label className="visually-hidden" htmlFor="admin-password">
          管理密码
        </label>
        <div className={`password-field${error ? ' password-field--error' : ''}`}>
          <input
            ref={inputRef}
            id="admin-password"
            type={passwordVisible ? 'text' : 'password'}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError('');
            }}
            placeholder="输入管理密码"
            autoComplete="current-password"
            aria-describedby="login-error"
            aria-invalid={Boolean(error)}
            disabled={submitting}
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={passwordVisible ? '隐藏密码' : '查看密码'}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
            disabled={submitting}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.75 12s3.25-5 9.25-5 9.25 5 9.25 5-3.25 5-9.25 5-9.25-5-9.25-5Z" />
              <circle cx="12" cy="12" r="2.25" />
              {passwordVisible ? <path d="m4 4 16 16" /> : null}
            </svg>
          </button>
          <button
            type="submit"
            className={succeeded ? 'login-submit login-submit--success' : 'login-submit'}
            aria-label={succeeded ? '登录成功' : '登录'}
            disabled={!password || submitting}
          >
            <svg className="login-submit-arrow" viewBox="0 0 20 20" aria-hidden="true">
              <path d="m7 4 6 6-6 6" />
            </svg>
            <svg className="login-submit-check" viewBox="0 0 20 20" aria-hidden="true">
              <path d="m4.5 10.25 3.5 3.5 7.5-7.5" />
            </svg>
          </button>
        </div>
        <span className="visually-hidden" role="status">
          {succeeded ? '登录成功' : ''}
        </span>
        <p id="login-error" className="login-error" aria-live="polite">
          {error || '\u00a0'}
        </p>
      </form>
    </main>
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
      {name === 'collapse' || name === 'expand' ? (
        <>
          <path d="M4 4.5h16v15H4zM9 4.5v15" />
          <path d={name === 'collapse' ? 'm15 9-3 3 3 3' : 'm12 9 3 3-3 3'} />
        </>
      ) : null}
    </svg>
  );
}

function syncLocation(authenticated: boolean) {
  const suffix = authenticated ? 'app' : '';
  const target = new URL(suffix || '.', window.location.href);
  if (window.location.pathname !== target.pathname) {
    window.history.replaceState(null, '', target);
  }
}
