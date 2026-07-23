"use client";
import { Splitter, SplitterPanel } from "primereact/splitter";
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { Divider } from "primereact/divider";
import { Button } from "primereact/button";
import ChatComponent from "@/components/ChatComponent";
import { Toast } from "primereact/toast";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { Chat, Message, MessageRole } from "@/types";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import AuthForm from "@/components/AuthForm";
import SummaryDialog from "@/components/SummaryDialog";
import { DriveStep } from "driver.js";
import UseTour from "@/hooks/useTour";
import UseObChatList from "@/hooks/useObChatList";
import UseInitInfo from "@/hooks/useInitInfo";
import { useScrollManager } from "@/hooks/useScrollManager";
import ScrollBottomButton from "@/components/ScrollBottomButton";
import { useInView } from "react-intersection-observer";
import ChatList from "@/components/ChatList";
import ChatHeader from "@/components/ChatHeader";
import { useChatState } from "../hooks/useChatState";
import { useMessageState } from "../hooks/useMessageState";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "primereact/skeleton";
import { Sidebar } from "primereact/sidebar";
import { useSwipeable } from "react-swipeable";

const steps: DriveStep[] = [
  {
    element: '[data-tour="new-chat"]',
    popover: {
      title: "新建对话",
      description: "点击这里创建新的对话",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="chat-list"]',
    popover: {
      title: "对话列表",
      description: "这里显示您的所有对话记录",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="chat-input"]',
    popover: {
      title: "输入框",
      description: "在这里输入您的问题，按Enter发送",
      side: "top",
      align: "start",
    },
  },
  {
    element: '[data-tour="summary"]',
    popover: {
      title: "数据统计",
      description: "查看您的对话统计和总结",
      side: "bottom",
      align: "start",
    },
  },
];

const getActualMessageCount = (messages: Message[] = []) => {
  return messages.filter((msg) => msg.role !== "system").length;
};

const LoadingMessage = () => (
  <div className="flex gap-3 px-4 py-2">
    <Skeleton
      shape="circle"
      size="2rem"
      className="flex-shrink-0 self-start mt-1"
    />
    <div className="flex-1 max-w-[85%]">
      <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
        <Skeleton className="w-full" height="1rem" />
        <Skeleton className="w-[95%]" height="1rem" />
        <Skeleton className="w-[90%]" height="1rem" />
        <Skeleton className="w-[60%]" height="1rem" />
      </div>
      <div className="mt-1">
        <Skeleton width="5rem" height="0.75rem" />
      </div>
    </div>
  </div>
);

const ResponsiveTitle = () => {
  const [titleRef, setTitleRef] = useState<HTMLDivElement | null>(null);
  const [showFullTitle, setShowFullTitle] = useState(true);

  useEffect(() => {
    if (!titleRef) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setShowFullTitle(width >= 200);
    });

    observer.observe(titleRef);
    return () => observer.disconnect();
  }, [titleRef]);

  return (
    <div
      ref={setTitleRef}
      className="flex flex-col items-center justify-center py-2 px-4"
    >
      <div className="relative flex items-center gap-2">
        <h1 className="text-responsive font-bold text-gray-800 whitespace-nowrap">
          法律AI
        </h1>
        {showFullTitle ? (
          <div className="flex items-center gap-4">
            <span className="text-subtitle text-gray-600 whitespace-nowrap">
              一般法律信息助手
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="text-2xl cursor-help"
              title="法律AI - 一般法律信息助手"
            >
              ⚖️
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const MobileLayout = ({
  children,
  sidebar,
  showSidebar,
  onToggleSidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  showSidebar: boolean;
  onToggleSidebar: () => void;
}) => {
  const swipeHandlers = useSwipeable({
    onSwipedRight: () => !showSidebar && onToggleSidebar(),
    onSwipedLeft: () => showSidebar && onToggleSidebar(),
    trackMouse: false,
    delta: 50,
  });

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      {...swipeHandlers}
    >
      <Button
        icon="pi pi-bars"
        className="fixed top-3 left-3 z-50 bg-primary-10 hover:bg-primary-20 active:bg-primary-30"
        onClick={onToggleSidebar}
        aria-label="Toggle menu"
        text
      />

      <Sidebar
        visible={showSidebar}
        onHide={onToggleSidebar}
        className="custom-sidebar p-0 shadow-elevation-2 bg-cyan-50"
        position="left"
        showCloseIcon={false}
        modal={true}
        dismissable={true}
      >
        <div className="h-full overflow-hidden custom-scrollbar px-2">
          <ResponsiveTitle />
          {sidebar}
        </div>
      </Sidebar>

      <div className="chat-mobile h-full custom-scrollbar">{children}</div>
    </div>
  );
};

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
};

export default function Home() {
  const { user: auth0User } = useUser();
  const toast = useRef<Toast>(null);

  const {
    chatLists,
    setChatLists,
    selectedChat,
    setSelectedChat,
    chatInfo,
    updateChatInfo,
    createNewChat,
    deleteChat,
  } = useChatState({
    userId: auth0User?.sub || "",
  });

  const {
    message,
    setMessage,
    isSending,
    setIsSending,
    tempMessage,
    markdownRendered,
    setMarkdownRendered,
    handleMessageChange,
    handleKeyDown,
  } = useMessageState();

  const [initChat, setInitChat] = useState(false);
  const [isInitialScrollRef, setIsInitialScrollRef] = useState(true);

  const chatRef = useRef<HTMLFormElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { scrollToBottom } = useScrollManager({
    smoothScroll: true,
    debounceMs: 100,
  });

  useEffect(() => {}, [initChat]);

  const [showScrollButton, setShowScrollButton] = useState(true);

  const { isAuthenticated, isLoading } = useAuth();

  const [showSidebar, setShowSidebar] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const isMobile = useResponsive();

  useEffect(() => {
    if (isInitialScrollRef && markdownRendered && chatEndRef.current) {
      setIsInitialScrollRef(false);
      scrollToBottom(chatEndRef.current);
    }
  }, [markdownRendered, isInitialScrollRef, scrollToBottom]);

  UseTour(steps, isAuthenticated ? "authenticated" : "unauthenticated");

  const fetchChats = useCallback(async () => {
    if (!auth0User?.sub) return;

    try {
      const response = await fetch("/api/getChats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const { chats } = await response.json();

        setChatLists(() => {
          if (chats.length === 0) {
            const newChat = {
              _id: "",
              title: "新的聊天",
              userId: auth0User.sub || "",
              time: getCurrentTimeInLocalTimeZone(),
              messages: [],
            };
            setSelectedChat(newChat);
            return [newChat];
          }

          const currentSelectedId = selectedChat?._id;
          const updatedSelectedChat = currentSelectedId
            ? chats.find((chat: Chat) => chat._id === currentSelectedId)
            : chats[0];

          setSelectedChat(updatedSelectedChat || chats[0]);

          chats.forEach((chat: Chat) => updateChatInfo(chat));

          return chats;
        });
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
      toast.current?.show({
        severity: "error",
        summary: "错误",
        detail: "获取聊天列表失败",
      });
    }
  }, [
    auth0User?.sub,
    updateChatInfo,
    selectedChat?._id,
    setChatLists,
    setSelectedChat,
  ]);

  const handleChatSelect = useCallback(
    (chat: Chat) => {
      setSelectedChat(chat);
    },
    [setSelectedChat],
  );

  const requestAi = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedChat || !message.trim()) return;

      const currentMessage = message;
      setMessage("");
      setIsSending(true);

      const previousChat = { ...selectedChat };

      try {
        let newTitle = selectedChat.title;
        if (
          selectedChat.title === "新的聊天" &&
          (!selectedChat._id || selectedChat._id === "")
        ) {
          newTitle =
            currentMessage.length > 20
              ? currentMessage.substring(0, 20) + "..."
              : currentMessage;
        }

        const initialChat = {
          ...selectedChat,
          title: newTitle,
          messages: [
            ...selectedChat.messages,
            { role: "user", content: currentMessage, timestamp: new Date() },
          ],
          time: getCurrentTimeInLocalTimeZone(),
        };
        updateChatInfo({
          ...initialChat,
          messages: initialChat.messages.map((msg) => ({
            ...msg,
            role: msg.role as MessageRole,
          })),
        });
        setSelectedChat({
          ...initialChat,
          messages: initialChat.messages.map((msg) => ({
            ...msg,
            role: msg.role as MessageRole,
          })),
        });

        const response = await fetch("/api/fetchAi", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: selectedChat._id || "",
            message: currentMessage,
          }),
        });

        if (!response.ok) throw new Error("Failed to fetch");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Missing response body");
        const decoder = new TextDecoder();
        let result = "";
        let eventBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          eventBuffer += decoder.decode(value, { stream: true });
          const events = eventBuffer.split("\n\n");
          eventBuffer = events.pop() || "";

          for (const event of events) {
            const dataLine = event
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) continue;

            const data = JSON.parse(dataLine.slice(6)) as {
              content?: string;
              error?: string;
            };
            if (data.error) throw new Error("AI service unavailable");
            if (!data.content || data.content === "[DONE]") continue;

            result = data.content;

            setSelectedChat((prevChat) => {
              if (!prevChat) return prevChat;
              const messages = [...prevChat.messages];
              const lastMessage = messages[messages.length - 1];
              if (lastMessage && lastMessage.role === "assistant") {
                lastMessage.content = result;
              } else {
                messages.push({
                  role: "assistant",
                  content: result,
                  timestamp: new Date(),
                });
              }
              const updatedChat = { ...prevChat, messages };
              updateChatInfo(updatedChat);
              return updatedChat;
            });

            setChatLists((prevLists) =>
              prevLists.map((chat) => {
                if (
                  chat.time === selectedChat.time &&
                  (chat._id === selectedChat._id ||
                    (!chat._id && !selectedChat._id))
                ) {
                  const messages = [...chat.messages];
                  const lastMessage = messages[messages.length - 1];
                  if (lastMessage && lastMessage.role === "assistant") {
                    lastMessage.content = result;
                  } else {
                    messages.push({
                      role: "assistant",
                      content: result,
                      timestamp: new Date(),
                    });
                  }
                  return { ...chat, messages };
                }
                return chat;
              }),
            );
          }
        }

        if (!result) throw new Error("AI service returned no content");

        const finalChat = {
          ...initialChat,
          messages: [
            ...initialChat.messages,
            { role: "assistant", content: result, timestamp: new Date() },
          ],
        };
        updateChatInfo(finalChat as Chat);

        if (!selectedChat._id) {
          const sessionId = response.headers.get("X-Session-Id");
          if (sessionId) {
            const updatedChat: Chat = {
              ...finalChat,
              _id: sessionId,
              messages: finalChat.messages.map((msg) => ({
                ...msg,
                role: msg.role as MessageRole,
              })),
            };

            setSelectedChat(updatedChat);

            setChatLists((prevLists) =>
              prevLists.map((chat) =>
                chat.time === selectedChat.time && !chat._id
                  ? updatedChat
                  : chat,
              ),
            );
          }
        } else {
          setChatLists((prevLists) =>
            prevLists.map((chat) => {
              if (chat._id === selectedChat._id) {
                return {
                  ...chat,
                  messages: [
                    ...chat.messages,
                    {
                      role: "assistant",
                      content: result,
                      timestamp: new Date(),
                    },
                  ],
                };
              }
              return chat;
            }),
          );
        }
      } catch (error) {
        console.error("Error:", error);
        setSelectedChat(previousChat);

        setChatLists((prevLists) => {
          if (!previousChat._id) {
            return prevLists.filter((chat) => chat.time !== previousChat.time);
          }
          return prevLists.map((chat) =>
            chat._id === previousChat._id ? previousChat : chat,
          );
        });

        updateChatInfo(previousChat);

        toast.current?.show({
          severity: "error",
          summary: "错误",
          detail: "网络连接常，请检查网络后重试",
          life: 3000,
        });
      } finally {
        setIsSending(false);
      }
    },
    [
      message,
      selectedChat,
      updateChatInfo,
      setChatLists,
      setIsSending,
      setMessage,
      setSelectedChat,
    ],
  );

  const confirmDelete = useCallback(
    (chatId: string) => {
      confirmDialog({
        message: "确定删除这个聊天吗？",
        header: "删除确认",
        icon: "pi pi-exclamation-triangle",
        acceptLabel: "确定",
        rejectLabel: "取消",
        accept: () => {
          deleteChat(chatId);
          toast.current?.show({
            severity: "success",
            summary: "删除成功",
            detail: "聊天已删除",
            life: 3000,
          });
        },
      });
    },
    [deleteChat],
  );

  UseObChatList(
    chatLists,
    setChatLists,
    selectedChat!,
    setSelectedChat,
    auth0User?.sub || "",
  );

  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: false,
  });

  useEffect(() => {
    setShowScrollButton(!inView);
  }, [inView]);

  UseInitInfo(chatLists, updateChatInfo, chatInfo);

  useEffect(() => {
    const handleOffline = () => {
      toast.current?.show({
        severity: "error",
        summary: "网络连接断开",
        detail: "请检查网络连接",
        life: 3000,
      });
    };

    const handleOnline = () => {
      toast.current?.show({
        severity: "success",
        summary: "网络已连接",
        detail: "网络连接已恢复",
        life: 3000,
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setInitChat(true);
      fetchChats();
    }
  }, [isAuthenticated, isLoading, fetchChats]);

  const sidebarContent = (
    <div className="flex flex-col w-full h-full p-4">
      <ChatHeader
        onNewChat={createNewChat}
        onRefresh={fetchChats}
        isAuthenticated={isAuthenticated}
        disableNewChat={chatLists.some(
          (chat) => chat.title === "新的聊天" && !chat._id,
        )}
        onSummary={() => setShowSummary(true)}
        isMobile={isMobile}
      />
      <ChatList
        chats={chatLists}
        selectedChat={selectedChat}
        onSelect={(chat) => {
          handleChatSelect(chat);
          if (isMobile) setShowSidebar(false);
        }}
        onDelete={confirmDelete}
        chatInfo={chatInfo}
      />
    </div>
  );

  const visibleMessages =
    selectedChat?.messages?.filter((message) => message.role !== "system") ||
    [];

  const chatContent = (
    <div className="flex flex-col h-full">
      <div className="w-full h-full">
        <ScrollBottomButton
          visible={showScrollButton}
          onClick={() => {
            if (chatEndRef.current) {
              scrollToBottom(chatEndRef.current);
              setShowScrollButton(false);
            }
          }}
        />
        <div className="p-4 pb-0 pt-0 h-[16.7%] flex flex-col">
          <div className="flex flex-row justify-between">
            <div className="self-center">
              <h1 className="text-2xl">{selectedChat?.title}</h1>
              <p className="m-0">
                {selectedChat?.messages
                  ? getActualMessageCount(selectedChat.messages)
                  : 0}
                条对话
              </p>
              <p className="m-0 mt-1 text-xs text-gray-500">
                普通聊天未连接资料检索；回答仅为一般法律信息，不构成法律意见。
              </p>
            </div>
          </div>
          <Divider />
        </div>

        <div
          ref={chatEndRef}
          className="flex flex-col h-[58.3%] overflow-auto chat-container"
        >
          {initChat ? (
            <>
              {visibleMessages.map((message, index) => (
                <ChatComponent
                  key={index + message.timestamp.toString()}
                  role={message.role}
                  message={message.content}
                  retrievalQuery={
                    message.role === "assistant" &&
                    index > 0 &&
                    visibleMessages[index - 1].role === "user"
                      ? visibleMessages[index - 1].content
                      : undefined
                  }
                  onRender={() => setMarkdownRendered(true)}
                />
              ))}
              {tempMessage && (
                <ChatComponent
                  role="user"
                  message={tempMessage}
                  isTemporary={true}
                />
              )}
            </>
          ) : (
            <div className="flex flex-col">
              <LoadingMessage />
              <LoadingMessage />
              <LoadingMessage />
              <div className="flex gap-3 px-4 py-2">
                <Skeleton
                  shape="circle"
                  size="2rem"
                  className="flex-shrink-0 self-start mt-1"
                />
                <div className="flex-1 max-w-[85%]">
                  <div className="flex items-center gap-2 p-3">
                    <Skeleton
                      width="8rem"
                      height="1rem"
                      className="animate-pulse"
                    />
                    <i className="pi pi-spin pi-spinner text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={ref} className="p-[1px] w-full relative" />
        </div>
        <form
          ref={chatRef}
          onSubmit={(e) => {
            e.preventDefault();
            requestAi(e);
          }}
          className="relative flex justify-center items-center h-1/4 p-4 border-gray-300 border-solid border-t-[1px] border-b-0 border-l-0 border-r-0 shadow-md"
        >
          <InputTextarea
            data-tour="chat-input"
            rows={5}
            autoResize={true}
            value={message}
            onChange={handleMessageChange}
            className="w-full max-h-[600px] overflow-y-auto h-auto p-2 border border-gray-300 rounded-lg"
            placeholder="Enter发送，Shift+Enter换行"
            maxLength={4000}
            onKeyDown={(e) => handleKeyDown(e, requestAi)}
            disabled={isSending || !initChat}
          />
          <Divider layout="vertical" className="mx-3" />
          <Button
            label="发送"
            icon="pi pi-send"
            className="self-center h-1/4 p-button-primary min-w-28"
            type="submit"
            loading={isSending}
            disabled={!initChat || isSending}
          />
        </form>
      </div>
    </div>
  );

  return (
    <div className="chat-layout">
      <Toast ref={toast} />
      <ConfirmDialog />
      <Dialog
        visible={!isAuthenticated && !isLoading}
        onHide={() => {}}
        content={() => (
          <AuthForm setInitChat={setInitChat} onSuccess={() => fetchChats()} />
        )}
      />
      <SummaryDialog
        visible={showSummary}
        onHide={() => setShowSummary(false)}
        toast={toast}
      />
      {isMobile ? (
        <MobileLayout
          sidebar={sidebarContent}
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
        >
          {chatContent}
        </MobileLayout>
      ) : (
        <Splitter className="h-full w-full">
          <SplitterPanel
            className="bg-cyan-50 custom-scrollbar"
            size={30}
            minSize={20}
          >
            {sidebarContent}
          </SplitterPanel>
          <SplitterPanel
            className="flex flex-col relative"
            size={70}
            minSize={60}
          >
            {chatContent}
          </SplitterPanel>
        </Splitter>
      )}
    </div>
  );
}
