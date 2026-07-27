import { useEffect, useState } from 'react';

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
        const response = await fetch('./api/dashboard', {
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
            <div>
              <h2 id="updates-title">更新日志</h2>
              <p>最近发布的功能与体验改进</p>
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
            <div className="connection-label">
              <span className="connection-dot" aria-hidden="true" />
              <h2 id="uptime-title">实例连接时长</h2>
            </div>
            <time className="uptime-value" dateTime={durationDateTime(now - (snapshot?.instanceStartedAt ?? now))}>
              {snapshot ? uptime : '—'}
            </time>
            <p>从本次插件实例载入开始计算</p>
          </section>

          <section className="dashboard-panel dashboard-counts" aria-label="漂流瓶数量概览">
            <div className="dashboard-metric">
              <span>全部漂流瓶</span>
              <strong>{snapshot ? snapshot.counts.totalBottles.toLocaleString('zh-CN') : '—'}</strong>
            </div>
            <div className="dashboard-metric dashboard-metric--pending">
              <span>待审核</span>
              <strong>{snapshot ? snapshot.counts.pendingReview.toLocaleString('zh-CN') : '—'}</strong>
            </div>
          </section>
        </div>
      </div>

      <section className="dashboard-panel dashboard-activity" aria-labelledby="activity-title">
        <header className="dashboard-panel-header dashboard-activity-header">
          <div>
            <h2 id="activity-title">操作记录</h2>
            <p>投瓶、捡瓶、审核和管理操作会保存在这里</p>
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
