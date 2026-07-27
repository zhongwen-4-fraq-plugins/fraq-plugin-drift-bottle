import { useEffect, useState } from 'react';

import { webuiUrl } from './location';

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

type DashboardIconName = 'activity' | 'bottle' | 'release' | 'review' | 'uptime';

function DashboardIcon({ name }: { name: DashboardIconName }) {
  return (
    <svg className="dashboard-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'release' ? (
        <>
          <path d="M6 3.5h8.5l3.5 3.5v13.5H6z" />
          <path d="M14.5 3.5V7H18M9 11h6M9 15h6" />
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
