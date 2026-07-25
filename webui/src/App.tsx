import { type FormEvent, useEffect, useRef, useState } from 'react';

type View = 'checking' | 'login' | 'main';

export function App() {
  const [view, setView] = useState<View>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void fetch('./api/session', { credentials: 'same-origin' })
      .then(async (response) => (response.ok ? ((await response.json()) as { authenticated?: boolean }) : undefined))
      .then((session) => {
        if (!active) return;
        const authenticated = Boolean(session?.authenticated);
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
        return;
      }
      setView('main');
      syncLocation(true);
    } catch {
      setError('暂时无法连接到管理服务');
    } finally {
      setSubmitting(false);
    }
  }

  if (view === 'checking' || view === 'main') {
    return <main className="app-shell" aria-label="漂流瓶审核管理后台" tabIndex={-1} />;
  }

  return (
    <main className="login-page">
      <form className="login-form" onSubmit={handleSubmit} aria-busy={submitting}>
        <div className="login-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" />
            <path d="M4.25 20.25c.72-3.36 3.68-5.5 7.75-5.5s7.03 2.14 7.75 5.5" />
          </svg>
        </div>
        <label className="visually-hidden" htmlFor="admin-password">
          管理密码
        </label>
        <div className={`password-field${error ? ' password-field--error' : ''}`}>
          <input
            ref={inputRef}
            id="admin-password"
            type="password"
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
          <button type="submit" aria-label="登录" disabled={!password || submitting}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m7 4 6 6-6 6" />
            </svg>
          </button>
        </div>
        <p id="login-error" className="login-error" aria-live="polite">
          {error || '\u00a0'}
        </p>
      </form>
    </main>
  );
}

function syncLocation(authenticated: boolean) {
  const suffix = authenticated ? 'app' : '';
  const target = new URL(suffix || '.', window.location.href);
  if (window.location.pathname !== target.pathname) {
    window.history.replaceState(null, '', target);
  }
}
