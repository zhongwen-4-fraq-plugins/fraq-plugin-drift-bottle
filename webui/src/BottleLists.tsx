import { Fragment, useEffect, useState } from 'react';

import { webuiUrl } from './location';

interface ContentSummary {
  preview: string;
  kinds: string[];
}

interface PendingReviewItem {
  id: string;
  createdAt: number;
  content: ContentSummary;
  status: 'pending' | 'rejected' | 'error';
  reason: string;
  categories: string[];
  totalTokens?: number;
  target: string;
  canApprove: boolean;
  bottleDraft?: {
    senderId: number;
    displayName?: string;
    source: { scene: string; peerId: number };
  };
}

interface BottleItem {
  id: string;
  createdAt: number;
  commentCount: number;
  senderId: number;
  displayName?: string;
  content: ContentSummary;
  source: {
    scene: string;
    peerId: number;
  };
}

interface BottleComment {
  id: string;
  bottleId: string;
  senderId: number;
  createdAt: number;
  displayName?: string;
  content: string;
}

interface BottleCommentsResponse {
  comments: BottleComment[];
  total: number;
}

interface BottleCommentsState {
  data?: BottleCommentsResponse;
  error?: string;
  loading: boolean;
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

interface PendingReviewListProps extends BottleListProps {
  canModerate: boolean;
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function PendingReviewList({ canModerate, onSessionExpired }: PendingReviewListProps) {
  const list = useListPage<PendingReviewItem>('api/reviews/pending', onSessionExpired);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  async function submitReview(id: string, action: 'approve' | 'reject', reason?: string): Promise<string | undefined> {
    const response = await fetch(webuiUrl(`api/reviews/${encodeURIComponent(id)}/${action}`), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: action === 'reject' ? JSON.stringify({ reason }) : undefined,
    });
    if (response.status === 401) {
      onSessionExpired();
      return '登录已过期，请重新登录';
    }
    const result = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    if (!response.ok) {
      return result?.error ?? '处理失败，请稍后重试';
    }
    setDismissedIds((current) => new Set(current).add(id));
    list.retry();
    return undefined;
  }

  return (
    <ListPageFrame
      title="待审核"
      description="等待人工处理、AI 未通过或审核中断的内容会集中在这里。"
      emptyTitle="没有待审核记录"
      emptyDescription="需要人工处理的投瓶内容会自动出现在这里。"
      {...list}
    >
      {(data) => (
        <>
          <div className="data-table-scroll list-desktop-view">
            <table className="data-table data-table--reviews">
              <caption className="visually-hidden">待审核记录</caption>
              <thead>
                <tr>
                  <th scope="col">内容</th>
                  <th scope="col">状态</th>
                  <th scope="col">原因</th>
                  <th scope="col">提交时间</th>
                  {canModerate ? (
                    <th scope="col" className="review-actions-heading">
                      操作
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {data.items
                  .filter((item) => !dismissedIds.has(item.id))
                  .map((item) => (
                    <tr key={item.id}>
                      <td>
                        <ContentSummaryView content={item.content} />
                        {item.bottleDraft ? <ReviewBottleContext draft={item.bottleDraft} /> : null}
                      </td>
                      <td>
                        <ReviewStatus status={item.status} />
                      </td>
                      <td>
                        <div className="review-reason">
                          <span>{item.reason}</span>
                          {item.categories.length ? <small>{item.categories.join(' · ')}</small> : null}
                          <small>{item.target}</small>
                        </div>
                      </td>
                      <td>
                        <FormattedTime value={item.createdAt} />
                      </td>
                      {canModerate ? (
                        <td className="review-actions-cell">
                          <ReviewActions item={item} onSubmit={submitReview} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <ol className="mobile-record-list list-mobile-view">
            {data.items
              .filter((item) => !dismissedIds.has(item.id))
              .map((item) => (
                <li key={item.id} className="mobile-record">
                  <div className="mobile-record-heading">
                    <span className="record-id">#{shortId(item.id)}</span>
                    <ReviewStatus status={item.status} />
                  </div>
                  <ContentSummaryView content={item.content} />
                  <div className="review-reason">
                    <span>{item.reason}</span>
                    {item.categories.length ? <small>{item.categories.join(' · ')}</small> : null}
                    <small>{item.target}</small>
                  </div>
                  {item.bottleDraft ? <ReviewBottleContext draft={item.bottleDraft} /> : null}
                  <FormattedTime value={item.createdAt} />
                  {canModerate ? <ReviewActions item={item} onSubmit={submitReview} /> : null}
                </li>
              ))}
          </ol>
        </>
      )}
    </ListPageFrame>
  );
}

function ReviewBottleContext({ draft }: { draft: NonNullable<PendingReviewItem['bottleDraft']> }) {
  return (
    <div className="review-bottle-context">
      <span>
        {draft.displayName || '匿名'} · QQ {draft.senderId}
      </span>
      <small>
        {sourceScene(draft.source.scene)} {draft.source.peerId}
      </small>
    </div>
  );
}

function ReviewActions({
  item,
  onSubmit,
}: {
  item: PendingReviewItem;
  onSubmit: (id: string, action: 'approve' | 'reject', reason?: string) => Promise<string | undefined>;
}) {
  const [mode, setMode] = useState<'approve' | 'reject'>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const errorId = `review-action-error-${item.id}`;
  const reasonHelpId = `review-reason-help-${item.id}`;

  function close() {
    if (submitting) return;
    setMode(undefined);
    setReason('');
    setError('');
  }

  async function submit(action: 'approve' | 'reject') {
    const normalizedReason = reason.trim();
    if (action === 'reject' && !normalizedReason) {
      setError('请输入拒绝理由');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const nextError = await onSubmit(item.id, action, normalizedReason);
      if (nextError) setError(nextError);
    } catch {
      setError('网络连接异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === 'approve') {
    return (
      <div className="review-action-panel review-action-panel--approve" aria-busy={submitting}>
        <strong>确认通过并立即投放？</strong>
        <div className="review-action-confirm-buttons">
          <button
            type="button"
            className="review-confirm-button review-confirm-button--approve"
            disabled={submitting}
            onClick={() => void submit('approve')}
          >
            确认投放
          </button>
          <button type="button" className="review-cancel-button" disabled={submitting} onClick={close}>
            取消
          </button>
        </div>
        {error ? (
          <p id={errorId} className="review-action-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (mode === 'reject') {
    return (
      <div className="review-action-panel review-action-panel--reject" aria-busy={submitting}>
        <label htmlFor={`review-reason-${item.id}`}>拒绝理由</label>
        <textarea
          id={`review-reason-${item.id}`}
          value={reason}
          maxLength={500}
          rows={2}
          autoFocus
          disabled={submitting}
          aria-describedby={`${reasonHelpId}${error ? ` ${errorId}` : ''}`}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setReason(event.target.value);
            if (error) setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        />
        <small id={reasonHelpId}>必填，最多 500 个字符</small>
        <div className="review-action-confirm-buttons">
          <button
            type="button"
            className="review-confirm-button review-confirm-button--reject"
            disabled={submitting}
            onClick={() => void submit('reject')}
          >
            确认拒绝
          </button>
          <button type="button" className="review-cancel-button" disabled={submitting} onClick={close}>
            取消
          </button>
        </div>
        {error ? (
          <p id={errorId} className="review-action-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="review-action-buttons" aria-label="审核操作">
      <IconActionButton
        action="approve"
        label={item.canApprove ? '通过并投放' : '缺少完整投瓶信息，无法通过'}
        disabled={!item.canApprove}
        onClick={() => setMode('approve')}
      />
      <IconActionButton action="reject" label="拒绝并归档" onClick={() => setMode('reject')} />
    </div>
  );
}

function IconActionButton({
  action,
  label,
  disabled = false,
  onClick,
}: {
  action: 'approve' | 'reject';
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <span className="review-icon-action">
      <button
        type="button"
        className={`review-icon-button review-icon-button--${action}`}
        aria-label={label}
        aria-disabled={disabled}
        onClick={disabled ? undefined : onClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={action === 'approve' ? 'm5 12.5 4.25 4.25L19 7' : 'M6 6l12 12M18 6 6 18'} />
        </svg>
      </button>
      <span className="review-action-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}

export function AllBottleList({ onSessionExpired }: BottleListProps) {
  const list = useListPage<BottleItem>('api/bottles', onSessionExpired);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [commentsByBottle, setCommentsByBottle] = useState<Record<string, BottleCommentsState>>({});

  async function loadComments(id: string) {
    setCommentsByBottle((current) => ({ ...current, [id]: { ...current[id], error: undefined, loading: true } }));
    try {
      const response = await fetch(webuiUrl(`api/bottles/${encodeURIComponent(id)}/comments`), {
        credentials: 'same-origin',
      });
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (!response.ok) throw new Error(`评论请求失败，状态码 ${response.status}`);
      const data = (await response.json()) as BottleCommentsResponse;
      setCommentsByBottle((current) => ({ ...current, [id]: { data, loading: false } }));
    } catch {
      setCommentsByBottle((current) => ({
        ...current,
        [id]: { ...current[id], error: '评论暂时无法载入，请稍后重试。', loading: false },
      }));
    }
  }

  function toggleComments(item: BottleItem) {
    const opening = !expandedIds.has(item.id);
    setExpandedIds((current) => {
      const next = new Set(current);
      if (opening) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
    const comments = commentsByBottle[item.id];
    if (opening && !comments?.data && !comments?.loading) void loadComments(item.id);
  }

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
              <colgroup>
                <col className="bottle-column-id" />
                <col className="bottle-column-time" />
                <col className="bottle-column-source" />
                <col className="bottle-column-types" />
                <col className="bottle-column-content" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">瓶子 ID</th>
                  <th scope="col">时间</th>
                  <th scope="col">来源</th>
                  <th scope="col">消息段类型</th>
                  <th scope="col">内容</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const open = expandedIds.has(item.id);
                  return (
                    <Fragment key={item.id}>
                      <tr className={item.commentCount > 0 ? 'bottle-row bottle-row--expandable' : 'bottle-row'}>
                        <td>
                          <span className="record-id record-id--full">{item.id}</span>
                        </td>
                        <td>
                          <FormattedTime value={item.createdAt} />
                        </td>
                        <td>
                          <BottleSource item={item} />
                        </td>
                        <td>
                          <ContentTypeTags kinds={item.content.kinds} />
                        </td>
                        <td>
                          <div className="bottle-content-cell">
                            <ContentPreview preview={item.content.preview} />
                            {item.commentCount > 0 ? (
                              <BottleCommentsToggle
                                item={item}
                                open={open}
                                view="desktop"
                                onToggle={() => toggleComments(item)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {item.commentCount > 0 ? (
                        <tr className="bottle-comments-row">
                          <td colSpan={5}>
                            <BottleCommentsPanel
                              id={`bottle-comments-desktop-${item.id}`}
                              open={open}
                              state={commentsByBottle[item.id]}
                              onRetry={() => void loadComments(item.id)}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ol className="mobile-record-list list-mobile-view">
            {data.items.map((item) => (
              <li key={item.id} className="mobile-record">
                <dl className="mobile-bottle-fields">
                  <div className="mobile-bottle-field">
                    <dt>瓶子 ID</dt>
                    <dd>
                      <span className="record-id record-id--full">{item.id}</span>
                    </dd>
                  </div>
                  <div className="mobile-bottle-field">
                    <dt>时间</dt>
                    <dd>
                      <FormattedTime value={item.createdAt} />
                    </dd>
                  </div>
                  <div className="mobile-bottle-field">
                    <dt>来源</dt>
                    <dd>
                      <BottleSource item={item} />
                    </dd>
                  </div>
                  <div className="mobile-bottle-field">
                    <dt>消息段类型</dt>
                    <dd>
                      <ContentTypeTags kinds={item.content.kinds} />
                    </dd>
                  </div>
                  <div className="mobile-bottle-field">
                    <dt>内容</dt>
                    <dd>
                      <ContentPreview preview={item.content.preview} />
                    </dd>
                  </div>
                </dl>
                {item.commentCount > 0 ? (
                  <>
                    <BottleCommentsToggle
                      item={item}
                      open={expandedIds.has(item.id)}
                      view="mobile"
                      onToggle={() => toggleComments(item)}
                    />
                    <BottleCommentsPanel
                      id={`bottle-comments-mobile-${item.id}`}
                      open={expandedIds.has(item.id)}
                      state={commentsByBottle[item.id]}
                      onRetry={() => void loadComments(item.id)}
                    />
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      )}
    </ListPageFrame>
  );
}

function BottleCommentsToggle({
  item,
  open,
  view,
  onToggle,
}: {
  item: BottleItem;
  open: boolean;
  view: 'desktop' | 'mobile';
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="bottle-comments-toggle"
      aria-expanded={open}
      aria-controls={`bottle-comments-${view}-${item.id}`}
      onClick={onToggle}
    >
      <span>{item.commentCount} 条评论</span>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </button>
  );
}

function BottleCommentsPanel({
  id,
  open,
  state,
  onRetry,
}: {
  id: string;
  open: boolean;
  state?: BottleCommentsState;
  onRetry: () => void;
}) {
  return (
    <div
      id={id}
      className={`bottle-comments-collapse${open ? ' bottle-comments-collapse--open' : ''}`}
      aria-hidden={!open}
    >
      <div className="bottle-comments-overflow">
        <div className="bottle-comments-panel">
          {state?.loading ? (
            <div className="bottle-comments-loading" role="status">
              正在载入评论…
            </div>
          ) : null}
          {state?.error ? (
            <div className="bottle-comments-error" role="alert">
              <span>{state.error}</span>
              <button type="button" onClick={onRetry}>
                重试
              </button>
            </div>
          ) : null}
          {state?.data ? (
            <>
              {state.data.comments.length > 0 ? (
                <ol className="bottle-comment-list">
                  {state.data.comments.map((comment) => (
                    <li key={comment.id} className="bottle-comment">
                      <div className="bottle-comment-meta">
                        <strong>{comment.displayName || '匿名'}</strong>
                        <span>QQ {comment.senderId}</span>
                        <FormattedTime value={comment.createdAt} />
                      </div>
                      <p>{comment.content}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="bottle-comments-empty">暂时没有评论。</p>
              )}
              {state.data.total > state.data.comments.length ? (
                <p className="bottle-comments-limit">
                  仅显示最新 {state.data.comments.length} 条，共 {state.data.total} 条。
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
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
      <ContentPreview preview={content.preview} />
      <ContentTypeTags kinds={content.kinds} />
    </div>
  );
}

function ContentPreview({ preview }: { preview: string }) {
  return <span className="content-preview">{preview}</span>;
}

function ContentTypeTags({ kinds }: { kinds: string[] }) {
  return (
    <ul className="content-type-tags" aria-label="消息段类型">
      {kinds.map((kind) => (
        <li key={kind} className="content-type-tag">
          {kind}
        </li>
      ))}
    </ul>
  );
}

function ReviewStatus({ status }: { status: PendingReviewItem['status'] }) {
  const label = status === 'pending' ? '待人工审核' : status === 'error' ? '审核中断' : '未通过';
  return <span className={`review-status review-status--${status}`}>{label}</span>;
}

function BottleSource({ item }: { item: BottleItem }) {
  return (
    <div className="record-source">
      <span>QQ {item.senderId}</span>
      <small>
        {item.source.scene === 'group' ? '群' : sourceScene(item.source.scene)} {item.source.peerId}
      </small>
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
