import { Button } from "primereact/button";
import { Divider } from "primereact/divider";
import { signOut } from "next-auth/react";
import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ChatHeaderProps {
  onNewChat: () => void;
  onRefresh: () => void;
  isAuthenticated: boolean;
  disableNewChat: boolean;
  onSummary: () => void;
  isMobile: boolean;
}

const ChatHeader = memo(
  ({
    onNewChat,
    onRefresh,
    isMobile,
    isAuthenticated,
    disableNewChat,
    onSummary,
  }: ChatHeaderProps) => {
    const [titleStyle, setTitleStyle] = useState<"full" | "hidden">("full");
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    useEffect(() => {
      if (!containerRef.current || isMobile) return;

      const observer = new ResizeObserver((entries) => {
        const width = entries[0].contentRect.width;
        if (width >= 340) {
          setTitleStyle("full");
        } else {
          setTitleStyle("hidden");
        }
      });

      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [isMobile]);

    const renderTitle = () => {
      switch (titleStyle) {
        case "full":
          return (
            <div>
              <h1 className="text-2xl">法律AI</h1>
              <p>你的私人法律顾问</p>
            </div>
          );
        case "hidden":
          return null;
      }
    };

    return (
      <>
        <div
          className={`flex flex-row ${titleStyle === "hidden" || isMobile ? "justify-center" : "justify-between"}`}
          ref={containerRef}
        >
          {!isMobile && renderTitle()}
          <div className="flex gap-2 self-center">
            <Button
              icon="pi pi-file-edit"
              className="self-center size-[2.1rem]"
              onClick={onSummary}
              tooltip="总结"
              data-tour="summary"
            />
            <Button
              icon="pi pi-sync"
              className="self-center size-[2.1rem]"
              onClick={onRefresh}
              tooltip="刷新列表"
              data-tour="refresh-list"
              disabled={!isAuthenticated}
            />
            <Button
              icon="pi pi-plus"
              className="self-center size-[2.1rem]"
              onClick={onNewChat}
              tooltip="新建聊天"
              data-tour="new-chat"
              disabled={disableNewChat}
            />
            <Button
              icon="pi pi-sign-out"
              className="self-center size-[2.1rem]"
              data-tour="logout"
              onClick={() => signOut({ callbackUrl: window.location.origin })}
              tooltip="退出登录"
            />
            <Button
              icon="pi pi-star-fill"
              className="self-center size-[2.1rem]"
              onClick={() => router.push("/recommend")}
              tooltip="推荐案例"
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
