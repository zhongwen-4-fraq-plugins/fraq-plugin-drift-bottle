import { useEffect, useState } from 'react';

import { webuiUrl } from './location';

declare const __PLUGIN_VERSION__: string;

type DashboardTone = 'neutral' | 'success' | 'warning' | 'danger';

interface DashboardSnapshot {
  generatedAt: number;
  instanceStartedAt: number;
  counts: {
    totalBottles: number;
    pendingReview: number;
  };
  changelog: {
    version: string;
    items: string[];
  }[];
  operations: {
    id: string;
    createdAt: number;
    title: string;
    detail?: string;
    tone: DashboardTone;
  }[];
  runtime: {
    fraqVersion: string;
    protocolEndpoint?: {
      name: string;
      version: string;
    };
  };
}

interface DashboardProps {
  onSessionExpired: () => void;
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const skeletonRows = ['first', 'second', 'third', 'fourth'];

export function Dashboard({ onSessionExpired }: DashboardProps) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>();
  const [now, setNow] = useState(() => Date.now());
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    let active = true;
    let request: AbortController | undefined;

    async function refresh() {
      if (document.hidden) return;
      request?.abort();
      request = new AbortController();
      try {
        const response = await fetch(webuiUrl('api/dashboard'), {
          credentials: 'same-origin',
          signal: request.signal,
        });
        if (response.status === 401) {
          onSessionExpired();
          return;
        }
        if (!response.ok) {
          throw new Error(`Dashboard request failed with status ${response.status}`);
        }
        const nextSnapshot = (await response.json()) as DashboardSnapshot;
        if (active) {
          setSnapshot(nextSnapshot);
          setSyncError('');
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          setSyncError('数据同步暂时中断，正在自动重试');
        }
      }
    }

    const refreshWhenVisible = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    const polling = window.setInterval(() => void refresh(), 5000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      request?.abort();
      window.clearInterval(polling);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [onSessionExpired]);

  const uptime = formatDuration(now - (snapshot?.instanceStartedAt ?? now));

  return (
    <div className="dashboard" aria-busy={!snapshot}>
      <h1 className="visually-hidden">漂流瓶主页概览</h1>
      <div className="dashboard-overview">
        <section className="dashboard-panel dashboard-updates" aria-labelledby="updates-title">
          <header className="dashboard-panel-header">
            <div className="dashboard-section-heading">
              <DashboardIcon name="release" />
              <div>
                <h2 id="updates-title">更新日志</h2>
                <p>最近发布的功能与体验改进</p>
              </div>
            </div>
          </header>
          {snapshot ? (
            <ol className="release-list">
              {snapshot.changelog.map((release) => (
                <li key={release.version} className="release-entry">
                  <span className="release-version">v{release.version}</span>
                  <ul>
                    {release.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : (
            <PanelSkeleton rows={3} />
          )}
        </section>

        <div className="dashboard-status-column">
          <div className="dashboard-status-top">
            <section className="dashboard-panel dashboard-uptime" aria-labelledby="uptime-title">
              <div className="dashboard-section-heading">
                <DashboardIcon name="uptime" />
                <div className="connection-label">
                  <h2 id="uptime-title">实例连接时长</h2>
                  <span className="connection-dot" aria-hidden="true" />
                </div>
              </div>
              <time className="uptime-value" dateTime={durationDateTime(now - (snapshot?.instanceStartedAt ?? now))}>
                {snapshot ? uptime : '—'}
              </time>
              <p>从本次插件实例载入开始计算</p>
            </section>

            <section className="dashboard-panel dashboard-about" aria-labelledby="about-title">
              <header className="dashboard-panel-header">
                <div className="dashboard-section-heading">
                  <DashboardIcon name="about" />
                  <h2 id="about-title">关于</h2>
                </div>
              </header>
              <dl className="about-runtime-list" aria-label="运行环境版本">
                <RuntimeVersion name="漂流瓶" version={__PLUGIN_VERSION__} />
                <RuntimeVersion name="Fraq" version={snapshot?.runtime.fraqVersion} />
                <RuntimeVersion
                  name={snapshot?.runtime.protocolEndpoint?.name ?? '协议端'}
                  version={snapshot?.runtime.protocolEndpoint?.version}
                />
              </dl>
              <nav className="about-actions" aria-label="项目链接">
                <AboutAction
                  href="https://github.com/zhongwen-4-fraq-plugins/fraq-plugin-drift-bottle"
                  icon="github"
                  label="GitHub 项目"
                />
                <AboutAction
                  href="https://github.com/zhongwen-4-fraq-plugins/fraq-plugin-drift-bottle/issues/new?labels=bug&amp;title=%5BBug%5D%20"
                  icon="bug"
                  label="提交 Bug"
                />
                <AboutAction
                  href="https://github.com/zhongwen-4-fraq-plugins/fraq-plugin-drift-bottle/issues/new?labels=question&amp;title=%5BHelp%5D%20"
                  icon="help"
                  label="需要帮助"
                />
              </nav>
            </section>
          </div>

          <section className="dashboard-panel dashboard-counts" aria-label="漂流瓶数量概览">
            <div className="dashboard-metric">
              <div className="dashboard-metric-label">
                <DashboardIcon name="bottle" />
                <span>全部漂流瓶</span>
              </div>
              <strong>{snapshot ? snapshot.counts.totalBottles.toLocaleString('zh-CN') : '—'}</strong>
            </div>
            <div className="dashboard-metric dashboard-metric--pending">
              <div className="dashboard-metric-label">
                <DashboardIcon name="review" />
                <span>待审核</span>
              </div>
              <strong>{snapshot ? snapshot.counts.pendingReview.toLocaleString('zh-CN') : '—'}</strong>
            </div>
          </section>
        </div>
      </div>

      <section className="dashboard-panel dashboard-activity" aria-labelledby="activity-title">
        <header className="dashboard-panel-header dashboard-activity-header">
          <div className="dashboard-section-heading">
            <DashboardIcon name="activity" />
            <div>
              <h2 id="activity-title">操作记录</h2>
              <p>投瓶、捡瓶、审核和管理操作会保存在这里</p>
            </div>
          </div>
          <span className={syncError ? 'sync-status sync-status--error' : 'sync-status'} role="status">
            {syncError || (snapshot ? '实时同步' : '正在载入')}
          </span>
        </header>
        {snapshot?.operations.length ? (
          <ol className="activity-list">
            {snapshot.operations.map((operation) => (
              <li key={operation.id} className="activity-entry">
                <span className={`activity-marker activity-marker--${operation.tone}`} aria-hidden="true" />
                <div className="activity-copy">
                  <strong>{operation.title}</strong>
                  {operation.detail ? <span>{operation.detail}</span> : null}
                </div>
                <time dateTime={new Date(operation.createdAt).toISOString()}>
                  {dateTimeFormatter.format(operation.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        ) : snapshot ? (
          <div className="activity-empty">
            <strong>暂无操作记录</strong>
            <p>升级后产生的新操作会自动显示在这里。</p>
          </div>
        ) : (
          <PanelSkeleton rows={4} />
        )}
      </section>
    </div>
  );
}

type DashboardIconName = 'about' | 'activity' | 'bottle' | 'release' | 'review' | 'uptime';

function DashboardIcon({ name }: { name: DashboardIconName }) {
  return (
    <svg className="dashboard-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'release' ? (
        <>
          <path d="M6 3.5h8.5l3.5 3.5v13.5H6z" />
          <path d="M14.5 3.5V7H18M9 11h6M9 15h6" />
        </>
      ) : null}
      {name === 'about' ? (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 10.5v6M12 7.25v.25" />
        </>
      ) : null}
      {name === 'uptime' ? (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </>
      ) : null}
      {name === 'bottle' ? (
        <>
          <path d="M9.5 3h5M10 3v4.2c0 .8-.38 1.55-1.03 2.02A4.6 4.6 0 0 0 7 13v5.5A2.5 2.5 0 0 0 9.5 21h5a2.5 2.5 0 0 0 2.5-2.5V13a4.6 4.6 0 0 0-1.97-3.78A2.46 2.46 0 0 1 14 7.2V3" />
          <path d="M7 14h10" />
        </>
      ) : null}
      {name === 'review' ? (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
          <path d="M8.5 3.9 7.3 2.7M15.5 3.9l1.2-1.2" />
        </>
      ) : null}
      {name === 'activity' ? (
        <>
          <path d="M5.5 6.5h13M5.5 12h13M5.5 17.5h13" />
          <circle cx="3" cy="6.5" r="0.75" />
          <circle cx="3" cy="12" r="0.75" />
          <circle cx="3" cy="17.5" r="0.75" />
        </>
      ) : null}
    </svg>
  );
}

type AboutActionIcon = 'bug' | 'github' | 'help';

function AboutAction({ href, icon, label }: { href: string; icon: AboutActionIcon; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label}（在新标签页打开）`}
      data-tooltip={label}
      title={label}
    >
      <svg className="about-action-icon" viewBox="0 0 24 24" aria-hidden="true">
        {icon === 'github' ? (
          <>
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.28-.36 6.72-1.61 6.72-7.5A5.8 5.8 0 0 0 18.22 3 5.4 5.4 0 0 0 18.13 0S16.95-.36 15 1.5a13.38 13.38 0 0 0-7 0C5.05-.36 3.87 0 3.87 0a5.4 5.4 0 0 0-.09 3 5.8 5.8 0 0 0-1.5 4c0 5.88 3.44 7.12 6.72 7.5A4.8 4.8 0 0 0 8 18v4" />
            <path d="M8 19c-3 .92-3-2.3-4-2.5" />
          </>
        ) : null}
        {icon === 'bug' ? (
          <>
            <path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3 3 0 0 1 6 0v1" />
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6ZM12 20v-9M6.5 9C4.6 8.7 3 7.1 3 5M6 13H2M5.8 17C3.7 17.2 2 19 2 21M17.5 9C19.4 8.7 21 7.1 21 5M18 13h4M18.2 17c2.1.2 3.8 2 3.8 4" />
          </>
        ) : null}
        {icon === 'help' ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.4 9a2.8 2.8 0 1 1 4.8 1.94C13.14 12 12 12.45 12 14M12 18h.01" />
          </>
        ) : null}
      </svg>
    </a>
  );
}

function RuntimeVersion({ name, version }: { name: string; version?: string }) {
  return (
    <div className="about-runtime-entry">
      <dt>{name}</dt>
      <dd>（{formatVersion(version)}）</dd>
    </div>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="dashboard-skeleton" aria-hidden="true">
      {skeletonRows.slice(0, rows).map((row) => (
        <span key={row} />
      ))}
    </div>
  );
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  return days > 0 ? `${days} 天 ${clock}` : clock;
}

function durationDateTime(milliseconds: number): string {
  return `PT${Math.max(0, Math.floor(milliseconds / 1000))}S`;
}

function formatVersion(version: string | undefined): string {
  if (!version || version === '未知') return '—';
  return /^v/i.test(version) ? version : `v${version}`;
}
