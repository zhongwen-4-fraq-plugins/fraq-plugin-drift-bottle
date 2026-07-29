import { useEffect, useState } from 'react';

import { webuiUrl } from './location';

interface ContentSummary {
  preview: string;
  kinds: string[];
}

interface PendingReviewItem {
  id: string;
  createdAt: number;
  content: ContentSummary;
  status: 'rejected' | 'error';
  reason: string;
  categories: string[];
  totalTokens?: number;
}

interface BottleItem {
  id: string;
  createdAt: number;
  senderId: number;
  displayName?: string;
  content: ContentSummary;
  source: {
    scene: string;
    peerId: number;
  };
}

export interface ListPage<T> {
  generatedAt: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
}

interface BottleListProps {
  onSessionExpired: () => void;
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function PendingReviewList({ onSessionExpired }: BottleListProps) {
  const list = useListPage<PendingReviewItem>('api/reviews/pending', onSessionExpired);

  return (
    <ListPageFrame
      title="待审核"
      description="AI 未通过或审核中断的内容会集中在这里。"
      emptyTitle="没有待审核记录"
      emptyDescription="AI 审核未通过或中断的内容会自动出现在这里。"
      {...list}
    >
      {(data) => (
        <>
          <div className="data-table-scroll list-desktop-view">
            <table className="data-table">
              <caption className="visually-hidden">待审核记录</caption>
              <thead>
                <tr>
                  <th scope="col">内容</th>
                  <th scope="col">状态</th>
                  <th scope="col">原因</th>
                  <th scope="col">提交时间</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <ContentSummaryView content={item.content} />
                    </td>
                    <td>
                      <ReviewStatus status={item.status} />
                    </td>
                    <td>
                      <div className="review-reason">
                        <span>{item.reason}</span>
                        {item.categories.length ? <small>{item.categories.join(' · ')}</small> : null}
                      </div>
                    </td>
                    <td>
                      <FormattedTime value={item.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="mobile-record-list list-mobile-view">
            {data.items.map((item) => (
              <li key={item.id} className="mobile-record">
                <div className="mobile-record-heading">
                  <span className="record-id">#{shortId(item.id)}</span>
                  <ReviewStatus status={item.status} />
                </div>
                <ContentSummaryView content={item.content} />
                <div className="review-reason">
                  <span>{item.reason}</span>
                  {item.categories.length ? <small>{item.categories.join(' · ')}</small> : null}
                </div>
                <FormattedTime value={item.createdAt} />
              </li>
            ))}
          </ol>
        </>
      )}
    </ListPageFrame>
  );
}

export function AllBottleList({ onSessionExpired }: BottleListProps) {
  const list = useListPage<BottleItem>('api/bottles', onSessionExpired);

  return (
    <ListPageFrame
      title="全部瓶子"
      description="浏览目前仍在海面上的全部漂流瓶。"
      emptyTitle="海面上还没有漂流瓶"
      emptyDescription="用户投递的漂流瓶会自动出现在这里。"
      {...list}
    >
      {(data) => (
        <>
          <div className="data-table-scroll list-desktop-view">
            <table className="data-table data-table--bottles">
              <caption className="visually-hidden">全部漂流瓶</caption>
              <thead>
                <tr>
                  <th scope="col">内容</th>
                  <th scope="col">投瓶者</th>
                  <th scope="col">来源</th>
                  <th scope="col">创建时间</th>
                  <th scope="col">瓶子 ID</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <ContentSummaryView content={item.content} />
                    </td>
                    <td>
                      <Author item={item} />
                    </td>
                    <td>
                      <Source item={item} />
                    </td>
                    <td>
                      <FormattedTime value={item.createdAt} />
                    </td>
                    <td>
                      <span className="record-id">{shortId(item.id)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="mobile-record-list list-mobile-view">
            {data.items.map((item) => (
              <li key={item.id} className="mobile-record">
                <div className="mobile-record-heading">
                  <Author item={item} />
                  <span className="record-id">#{shortId(item.id)}</span>
                </div>
                <ContentSummaryView content={item.content} />
                <div className="mobile-record-meta">
                  <Source item={item} />
                  <FormattedTime value={item.createdAt} />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </ListPageFrame>
  );
}

interface ListPageFrameProps<T> extends ReturnType<typeof useListPage<T>> {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  children: (data: ListPage<T>) => React.ReactNode;
}

export function ListPageFrame<T>({
  title,
  description,
  emptyTitle,
  emptyDescription,
  data,
  error,
  loading,
  page,
  setPage,
  retry,
  children,
}: ListPageFrameProps<T>) {
  return (
    <div className="list-page" aria-busy={loading}>
      <header className="list-page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span className="list-total" aria-live="polite">
          共 {data?.total ?? '—'} 条
        </span>
      </header>

      <section className="list-surface" aria-label={`${title}列表`}>
        {loading && !data ? <ListSkeleton /> : null}
        {error && !data ? (
          <div className="list-state" role="alert">
            <strong>列表暂时无法载入</strong>
            <p>{error}</p>
            <button type="button" onClick={retry}>
              重新加载
            </button>
          </div>
        ) : null}
        {data && data.items.length === 0 ? (
          <div className="list-state">
            <strong>{emptyTitle}</strong>
            <p>{emptyDescription}</p>
          </div>
        ) : null}
        {data?.items.length ? children(data) : null}
      </section>

      {data && data.totalPages > 1 ? (
        <nav className="list-pagination" aria-label={`${title}分页`}>
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <span aria-live="polite">
            第 {data.page} / {data.totalPages} 页
          </span>
          <button type="button" disabled={page >= data.totalPages || loading} onClick={() => setPage(page + 1)}>
            下一页
          </button>
        </nav>
      ) : null}
      {error && data ? (
        <p className="list-refresh-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function useListPage<T>(endpoint: string, onSessionExpired: () => void) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListPage<T>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setError('');
    const requestUrl = webuiUrl(endpoint);
    requestUrl.searchParams.set('page', String(page));
    requestUrl.searchParams.set('refresh', String(revision));
    requestUrl.searchParams.set('_request', String(revision));
    void fetch(requestUrl, { credentials: 'same-origin', signal: request.signal })
      .then(async (response) => {
        if (response.status === 401) {
          onSessionExpired();
          return undefined;
        }
        if (!response.ok) {
          throw new Error(`列表请求失败，状态码 ${response.status}`);
        }
        return (await response.json()) as ListPage<T>;
      })
      .then((nextData) => {
        if (nextData) setData(nextData);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError('请检查网络连接后重新加载。');
        }
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, [endpoint, onSessionExpired, page, revision]);

  return { data, error, loading, page, setPage, retry: () => setRevision((value) => value + 1) };
}

function ContentSummaryView({ content }: { content: ContentSummary }) {
  return (
    <div className="content-summary">
      <span>{content.preview}</span>
      <ul className="content-type-tags" aria-label="内容类型">
        {content.kinds.map((kind) => (
          <li key={kind} className="content-type-tag">
            {kind}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewStatus({ status }: { status: PendingReviewItem['status'] }) {
  return <span className={`review-status review-status--${status}`}>{status === 'error' ? '审核中断' : '未通过'}</span>;
}

function Author({ item }: { item: BottleItem }) {
  return (
    <div className="record-person">
      <strong>{item.displayName || '匿名'}</strong>
      <small>QQ {item.senderId}</small>
    </div>
  );
}

function Source({ item }: { item: BottleItem }) {
  return (
    <div className="record-source">
      <span>{sourceScene(item.source.scene)}</span>
      <small>{item.source.peerId}</small>
    </div>
  );
}

export function FormattedTime({ value }: { value: number }) {
  return (
    <time className="record-time" dateTime={new Date(value).toISOString()}>
      {dateTimeFormatter.format(value)}
    </time>
  );
}

function sourceScene(scene: string): string {
  if (scene === 'group') return '群聊';
  if (scene === 'friend') return '私聊';
  if (scene === 'temp') return '临时会话';
  return '其他来源';
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function ListSkeleton() {
  return (
    <div className="list-skeleton" aria-hidden="true">
      {['first', 'second', 'third', 'fourth', 'fifth'].map((row) => (
        <span key={row} />
      ))}
    </div>
  );
}
