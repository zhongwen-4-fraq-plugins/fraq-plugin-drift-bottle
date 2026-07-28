import { FormattedTime, ListPageFrame, useListPage } from './BottleLists';

interface RegistrationRequestItem {
  userId: number;
  createdAt: number;
}

interface RegistrationRequestsProps {
  onSessionExpired: () => void;
}

export function RegistrationRequests({ onSessionExpired }: RegistrationRequestsProps) {
  const list = useListPage<RegistrationRequestItem>('api/registrations/pending', onSessionExpired);

  return (
    <ListPageFrame
      {...list}
      title="账号请求"
      description="查看等待主人处理的 WebUI 注册申请。审批请通过机器人命令完成。"
      emptyTitle="没有待处理的账号请求"
      emptyDescription="新的注册申请会显示在这里。"
    >
      {(data) => (
        <>
          <div className="data-table-scroll list-desktop-view">
            <table className="data-table data-table--registrations">
              <caption className="visually-hidden">待审批 WebUI 账号请求</caption>
              <thead>
                <tr>
                  <th scope="col">申请账号</th>
                  <th scope="col">申请时间</th>
                  <th scope="col">状态</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.userId}>
                    <td>
                      <div className="record-person">
                        <strong>QQ {item.userId}</strong>
                        <small>WebUI 账号注册</small>
                      </div>
                    </td>
                    <td>
                      <FormattedTime value={item.createdAt} />
                    </td>
                    <td>
                      <span className="registration-status">待审批</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="mobile-record-list list-mobile-view">
            {data.items.map((item) => (
              <li key={item.userId} className="mobile-record">
                <div className="mobile-record-heading">
                  <div className="record-person">
                    <strong>QQ {item.userId}</strong>
                    <small>WebUI 账号注册</small>
                  </div>
                  <span className="registration-status">待审批</span>
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
