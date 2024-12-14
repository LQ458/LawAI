import { Button } from "primereact/button";
import { Divider } from "primereact/divider";
import { signOut } from "next-auth/react";
import { memo } from "react";

interface ChatHeaderProps {
  onNewChat: () => void;
  onRefresh: () => void;
  isAuthenticated: boolean;
  disableNewChat: boolean;
  onSummary: () => void;
}

const ChatHeader = memo(
  ({
    onNewChat,
    onRefresh,
    isAuthenticated,
    disableNewChat,
    onSummary,
  }: ChatHeaderProps) => {
    return (
      <>
        <div className="flex justify-between flex-row">
          <div>
            <h1 className="text-2xl">法律AI</h1>
            <p>你的私人法律顾问。</p>
          </div>
          <div className="flex gap-2 self-center">
            <Button
              icon="pi pi-chart-line"
              className="self-center"
              onClick={onSummary}
              tooltip="总结"
              data-tour="summary"
            />
            <Button
              icon="pi pi-sync"
              className="self-center"
              onClick={onRefresh}
              tooltip="刷新列表"
              data-tour="refresh-list"
              disabled={!isAuthenticated}
            />
            <Button
              icon="pi pi-plus"
              className="self-center"
              onClick={onNewChat}
              tooltip="新建聊天"
              data-tour="new-chat"
              disabled={disableNewChat}
            />
            <Button
              icon="pi pi-sign-out"
              className="self-center"
              data-tour="logout"
              onClick={() => signOut({ callbackUrl: window.location.origin })}
              tooltip="退出登录"
            />
          </div>
        </div>
        <Divider className="mb-10" />
      </>
    );
  },
);

ChatHeader.displayName = "ChatHeader";

export default ChatHeader;
