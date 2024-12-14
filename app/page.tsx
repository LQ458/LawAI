"use client";
import { Splitter, SplitterPanel } from "primereact/splitter";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Divider } from "primereact/divider";
import { Button } from "primereact/button";
import ChatComponent from "@/components/ChatComponent";
import { Toast } from "primereact/toast";
import { useSession } from "next-auth/react";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { Chat, Message, MessageRole } from "@/types";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import AuthForm from "@/components/AuthForm";
import { useRouter } from "next/navigation";
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

// 添加一个工具函数来计算实际对话数量
const getActualMessageCount = (messages: Message[] = []) => {
  return messages.filter((msg) => msg.role !== "system").length;
};

// 修改 LoadingMessage 组件
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

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const toast = useRef<Toast>(null);

  // 使用抽离的状态管理hooks
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
    username: session?.user?.name || "",
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

  const [initChat, setInitChat] = useState(false); // 是否初始化聊天
  const [isInitialScrollRef, setIsInitialScrollRef] = useState(true); // 是否为初始滚动

  const chatRef = useRef<HTMLFormElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 使用滚动管理器
  const { scrollToBottom } = useScrollManager({
    smoothScroll: true,
    debounceMs: 100,
  });

  useEffect(() => {}, [initChat]);

  // 添加状态
  const [showScrollButton, setShowScrollButton] = useState(true);

  // 使用自定义hook管理认证状态
  const { isAuthenticated, isLoading } = useAuth();

  /**
   * 初始滚动
   */
  useEffect(() => {
    if (isInitialScrollRef && markdownRendered && chatEndRef.current) {
      setIsInitialScrollRef(false);
      scrollToBottom(chatEndRef.current);
    }
  }, [markdownRendered]);

  UseTour(steps, isAuthenticated ? "authenticated" : "unauthenticated"); // 添加用户引导

  // 修改获取聊天列表的函数
  const fetchChats = useCallback(async () => {
    if (!session?.user?.name) return;

    try {
      const response = await fetch("/api/getChats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: session.user.name }),
      });

      if (response.ok) {
        const { chats } = await response.json();

        // 使用单个状态更新
        setChatLists(() => {
          if (chats.length === 0) {
            const newChat = {
              _id: "",
              title: "新的聊天",
              userId: session?.user?.name || "",
              time: getCurrentTimeInLocalTimeZone(),
              messages: [],
            };
            setSelectedChat(newChat);
            return [newChat];
          }

          // 更新选中的聊天
          const currentSelectedId = selectedChat?._id;
          const updatedSelectedChat = currentSelectedId
            ? chats.find((chat: Chat) => chat._id === currentSelectedId)
            : chats[0];

          setSelectedChat(updatedSelectedChat || chats[0]);

          // 更新聊天信息
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
  }, [session?.user?.name, updateChatInfo]); // 移除 selectedChat 依赖

  // 处理聊天选择
  const handleChatSelect = useCallback((chat: Chat) => {
    setSelectedChat(chat);
  }, []);

  // 修改 requestAi 函数
  const requestAi = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedChat || !message.trim()) return;

      const currentMessage = message;
      setMessage("");
      setIsSending(true);

      // 保存请求的聊天状态，用于失败时回滚
      const previousChat = { ...selectedChat };

      try {
        // 生成新标题
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

        // 创建初始聊天象
        const initialChat = {
          ...selectedChat,
          title: newTitle,
          messages: [
            ...selectedChat.messages,
            { role: "user", content: currentMessage, timestamp: new Date() },
          ],
          time: getCurrentTimeInLocalTimeZone(),
        };
        // 更显示信息（只包含用户消息）
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

        // 发送 POST 请求
        const response = await fetch("/api/fetchAi", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: session?.user?.name,
            chatId: selectedChat._id.toString(),
            message: currentMessage,
          }),
        });

        if (!response.ok) throw new Error("Failed to fetch");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let result = "";

        // 处理流式响应
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                const content = data.content;
                if (content === "[DONE]") continue;

                result = content; // 使用完整的markdown内容

                // 更新选中聊天的内容
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
                  // 使用新的计算方式更新显示信息
                  updateChatInfo(updatedChat);
                  return updatedChat;
                });

                // 更新聊天列表 - 确保使用相同的条件
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
              } catch (error) {
                console.error("Error parsing chunk:", error);
              }
            }
          }
        }

        // 更新最终状
        const finalChat = {
          ...initialChat,
          messages: [
            ...initialChat.messages,
            { role: "assistant", content: result, timestamp: new Date() },
          ],
        };
        updateChatInfo(finalChat as Chat);

        // 如果是新聊天，更新标题和ID
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

            // 使用时间戳来确保只更新正确的新聊天
            setChatLists((prevLists) =>
              prevLists.map((chat) =>
                chat.time === selectedChat.time && !chat._id
                  ? updatedChat
                  : chat,
              ),
            );
          }
        } else {
          // 现有聊天的更逻辑保持不变
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
        // 回滚到之前的状态
        setSelectedChat(previousChat);

        // 回滚聊天列表
        setChatLists((prevLists) => {
          // 如果是新聊天（没有_id），则从列表中移除
          if (!previousChat._id) {
            return prevLists.filter((chat) => chat.time !== previousChat.time);
          }
          // 如果是现有聊天，恢复到原始状态
          return prevLists.map((chat) =>
            chat._id === previousChat._id ? previousChat : chat,
          );
        });

        // 回滚聊天信息
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
    [message, selectedChat, session?.user?.name, updateChatInfo],
  );

  // 添加删除确认对话框
  const confirmDelete = useCallback(
    (chatId: string) => {
      confirmDialog({
        message: "确定删除这个聊天吗？",
        header: "删除确认",
        icon: "pi pi-exclamation-triangle",
        acceptLabel: "确定",
        rejectLabel: "取消",
        accept: () => {
          deleteChat(chatId, session?.user?.name || "");
          toast.current?.show({
            severity: "success",
            summary: "删除成功",
            detail: "聊天已删除",
            life: 3000,
          });
        },
      });
    },
    [deleteChat, session?.user?.name],
  );

  // 添加监听聊天列表变化的 effect
  UseObChatList(
    chatLists,
    setChatLists,
    selectedChat!,
    setSelectedChat,
    session!,
  );

  //增加监听底部元素的effect
  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: false,
  });

  // 添加 IntersectionObserver
  useEffect(() => {
    setShowScrollButton(!inView);
  }, [inView]);

  // 初始化显示信息
  UseInitInfo(chatLists, updateChatInfo, chatInfo);

  // 添加网络状态监听
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

  // 添加 useEffect 来控制初始化
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setInitChat(true);
      fetchChats();
    }
  }, [isAuthenticated, isLoading]);

  return (
    <div className="flex h-screen w-screen relative">
      <Toast ref={toast} />
      <ConfirmDialog />
      <Dialog
        visible={!isAuthenticated && !isLoading}
        onHide={() => {}}
        content={() => (
          <AuthForm
            toast={toast}
            setInitChat={setInitChat}
            onSuccess={() => fetchChats()}
          />
        )}
      />
      <Splitter className="h-full w-full">
        <SplitterPanel
          className="flex align-items-center justify-content-center bg-cyan-50"
          size={30}
          minSize={20}
        >
          <div className="flex flex-col w-full p-4 relative h-full overflow-hidden">
            <ChatHeader
              onNewChat={createNewChat}
              onRefresh={fetchChats}
              isAuthenticated={isAuthenticated}
              disableNewChat={chatLists.some(
                (chat) => chat.title === "新的聊天" && !chat._id,
              )}
              onSummary={() => router.push("/summary")}
            />
            <ChatList
              chats={chatLists}
              selectedChat={selectedChat}
              onSelect={handleChatSelect}
              onDelete={confirmDelete}
              chatInfo={chatInfo}
            />
          </div>
        </SplitterPanel>
        <SplitterPanel
          className="flex flex-col h-full max-w-[80%] relative"
          size={70}
          minSize={70}
          style={{ overflow: "auto" }}
        >
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
                </div>
                {/* <div className="flex gap-3 self-center mr-3">
                  <Button
                    icon="pi pi-refresh"
                    rounded
                    outlined
                    severity="secondary"
                    aria-label="Refresh"
                  />
                  <Button
                    icon="pi pi-file-export"
                    rounded
                    outlined
                    severity="secondary"
                    aria-label="Export"
                  />
                  <Button
                    icon="pi pi-pencil"
                    rounded
                    outlined
                    severity="secondary"
                    aria-label="Edit"
                  />
                </div> */}
              </div>
              <Divider />
            </div>

            <div
              ref={chatEndRef}
              className="flex flex-col h-[58.3%] overflow-auto chat-container"
            >
              {initChat ? (
                <>
                  {selectedChat?.messages
                    ?.filter((msg) => msg.role !== "system")
                    .map((message, index) => (
                      <ChatComponent
                        key={index + message.timestamp.toString()}
                        role={message.role}
                        message={message.content}
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
              {/* 添加底部观察元素 */}
              <div ref={ref} className="p-[1px] w-full relative" />
            </div>
            <form
              ref={chatRef}
              onSubmit={(e) => {
                e.preventDefault(); // 阻止表单的默认提交行为
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
                onKeyDown={(e) => handleKeyDown(e, requestAi)} // 确保件绑定正确
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
        </SplitterPanel>
      </Splitter>
    </div>
  );
}
