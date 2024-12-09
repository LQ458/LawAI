"use client";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Card } from "primereact/card";
import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import { Divider } from "primereact/divider";
import { Button } from "primereact/button";
import ChatComponent from "@/components/ChatComponent";
import { Toast } from "primereact/toast";
import { useSession, signOut } from "next-auth/react";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { Chat, Message, MessageRole } from "@/types";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import AuthForm from "../components/AuthForm";
import { useRouter } from "next/navigation";
import { DriveStep } from "driver.js";
import UseTour from "@/hooks/useTour";
import UseObChatList from "@/hooks/useObChatList";
import UseInitInfo from "@/hooks/useInitInfo";
import { useScrollManager } from "@/hooks/useScrollManager";
// 在组件外部定义一个不可变的时间和消息显示组件
const StaticInfo = memo(({ time, count }: { time: string; count: number }) => (
  <p className="text-sm text-gray-500">
    {time} ({count} 条对话)
  </p>
));
StaticInfo.displayName = "StaticInfo";

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

export default function Home() {
  const router = useRouter();
  const [chatLists, setChatLists] = useState<Chat[]>([]); // 聊天列表
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null); // 当前选中的聊天
  const [initChat, setInitChat] = useState(false); // 是否初始化聊天
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [tempMessage] = useState(""); // 添加临时消息状态
  const isInitialScrollRef = useRef(true); // 是否为初始滚动

  const toast = useRef<Toast>(null);
  const chatRef = useRef<HTMLFormElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: session, status } = useSession();

  // 添加一个状态来存储固定的显示信息
  const [chatInfo, setChatInfo] = useState<
    Record<string, { time: string; count: number }>
  >({});

  // 添加新的状态来跟踪 Markdown 渲染
  const [markdownRendered, setMarkdownRendered] = useState(false);

  // 使用滚动管理器
  const { containerRef, messageRenderIndex, handleScroll, scrollToBottom } =
    useScrollManager({
      threshold: 70, // 滚动阈值
      smoothScroll: true, // 启用平滑滚动
      debounceMs: 150, // 防抖延迟
      markdownRendered, // Markdown 渲染状态
      isAIGenerating: isSending, // AI 生成状态
      isMobileScreen: false, // 移动设备检测
      pageSize: 20, // 每页消息数
      endRef: chatEndRef, // 滚动目标引用
    });

  /**
   * 初始滚动
   */
  useEffect(() => {
    if (isInitialScrollRef.current && markdownRendered) {
      isInitialScrollRef.current = false;
      scrollToBottom();
    }
    console.log(markdownRendered);
  }, [markdownRendered]);

  // 可见消息状态管理
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);

  // 更新可见消息
  useEffect(() => {
    if (selectedChat?.messages) {
      const endIndex = Math.min(
        messageRenderIndex,
        selectedChat.messages.length,
      );
      setVisibleMessages(selectedChat.messages.slice(0, endIndex));
    }
  }, [selectedChat?.messages, messageRenderIndex]);

  UseTour(steps, status); // 添加用户引导

  // 修改 ChatCard 组件
  const ChatCard = memo(
    ({
      chat,
      isSelected,
      onSelect,
      onDelete,
    }: {
      chat: Chat;
      isSelected: boolean;
      onSelect: (chat: Chat) => void;
      onDelete: (chatId: string) => void;
    }) => {
      const info = chatInfo[chat._id || "new"];

      return (
        <Card
          key={chat._id || chat.time}
          title={
            <div className="flex justify-between items-center">
              <span>{chat.title}</span>
              {chat._id && (
                <Button
                  icon="pi pi-trash"
                  className="p-button-text p-button-rounded delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(chat._id);
                  }}
                  tooltip="删除聊天"
                />
              )}
            </div>
          }
          className={`cursor-pointer rounded-xl border-2 borderTransparent shadow-none chatCard ${
            isSelected ? "chatBorder" : ""
          }`}
          onClick={() => onSelect(chat)}
        >
          {info && <StaticInfo time={info.time} count={info.count} />}
        </Card>
      );
    },
  );

  ChatCard.displayName = "ChatCard";

  // 修改 updateChatInfo 函数
  const updateChatInfo = useCallback((chat: Chat) => {
    const count = getActualMessageCount(chat.messages);
    setChatInfo((prev) => ({
      ...prev,
      [chat._id || "new"]: {
        time: chat.time,
        count: count,
      },
    }));
  }, []);

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

  // 修改创建新聊天的函数
  const createNewChat = useCallback(() => {
    // 检查是否已经存在"新的聊天"
    const existingNewChat = chatLists.find(
      (chat: Chat) => chat.title === "新的聊天" && !chat._id,
    );

    if (existingNewChat) {
      setSelectedChat(existingNewChat);
      return;
    }

    // 创建新聊天
    const newChat: Chat = {
      _id: "",
      title: "新的聊天",
      userId: session?.user?.name || "",
      time: getCurrentTimeInLocalTimeZone(),
      messages: [],
    };

    setChatLists((prev) => [newChat, ...prev]);
    setSelectedChat(newChat);
  }, [chatLists, session?.user?.name]);

  // 处理聊天选择
  const handleChatSelect = useCallback((chat: Chat) => {
    setSelectedChat(chat);
  }, []);

  // 处理消息输入
  const handleMessageChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
    },
    [],
  );

  // 添加更新标题的函数
  const updateChatTitle = async (chatId: string, newTitle: string) => {
    try {
      const response = await fetch("/api/updateChatTitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, newTitle }),
      });

      if (!response.ok) {
        throw new Error("Failed to update chat title");
      }
    } catch (error) {
      console.error("Error updating chat title:", error);
    }
  };

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

            updateChatTitle(sessionId, newTitle);
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

  // 处理请求错误
  // const handleRequestError = useCallback((error: any) => {
  //   console.error("Error:", error);
  //   toast.current?.show({
  //     severity: "error",
  //     summary: "错误",
  //     detail: "请求失败",
  //   });
  // }, []);

  // 初始化 effect
  useEffect(() => {
    // 只在认证状态改变且已认证时初始化一次
    if (status === "authenticated" && !initChat) {
      fetchChats();
      setInitChat(true);
    }
  }, [status, fetchChats, initChat]); // 移除其他不必要的依赖

  // 认证状态 effect
  useEffect(() => {
    if (status === "authenticated") {
      fetchChats();
    }
  }, [status, fetchChats]);

  // 优化删除聊天的函数
  const deleteChat = useCallback(
    async (chatId: string) => {
      try {
        const response = await fetch(`/api/deleteChat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, username: session?.user?.name }),
        });

        if (!response.ok) {
          throw new Error("Failed to delete chat");
        }

        // 更新状态
        setChatLists((prev) => {
          const updatedLists = prev.filter((chat) => chat._id !== chatId);

          // 只有当删除后没有任何聊天时才添加新的空聊天
          if (updatedLists.length === 0) {
            const newChat = {
              _id: "",
              title: "新的聊天",
              userId: session?.user?.name || "",
              time: getCurrentTimeInLocalTimeZone(),
              messages: [],
            };
            updatedLists.push(newChat);
          }

          if (selectedChat?._id === chatId) {
            setSelectedChat(updatedLists[0]);
          }

          return updatedLists;
        });

        toast.current?.show({
          severity: "success",
          summary: "成功",
          detail: "聊天已删除",
        });
      } catch (error) {
        console.error("删除聊天失败:", error);
        toast.current?.show({
          severity: "error",
          summary: "错误",
          detail: "删除聊天失败",
        });
      }
    },
    [selectedChat, session?.user?.name],
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
        accept: () => deleteChat(chatId),
      });
    },
    [deleteChat],
  );

  // 添加监听聊天列表变化的 effect
  UseObChatList(
    chatLists,
    setChatLists,
    selectedChat!,
    setSelectedChat,
    session!,
  );

  // 优化 selectedChat 监听
  useEffect(() => {
    if (!selectedChat) return;

    const updateChatList = () => {
      setChatLists((prevLists) => {
        // 使用 Map 优化查找
        const chatMap = new Map(
          prevLists.map((chat) => [chat._id || chat.time, chat]),
        );

        if (selectedChat._id) {
          chatMap.set(selectedChat._id, selectedChat);
        } else if (!chatMap.has(selectedChat.time)) {
          chatMap.set(selectedChat.time, selectedChat);
        }

        return Array.from(chatMap.values());
      });
    };

    // 使用 requestIdleCallback 延迟更新
    window.requestIdleCallback(() => updateChatList(), { timeout: 2000 });
  }, [selectedChat]);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isSending && message.trim()) {
          requestAi(e as unknown as React.FormEvent);
        }
      }
    },
    [isSending, message, requestAi],
  );

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

  return (
    <div className="flex h-screen w-screen relative">
      <Toast ref={toast} />
      <ConfirmDialog />
      <Dialog
        visible={status === "unauthenticated" || status === "loading"}
        onHide={() => {}} // 移除 hide 处理,因为未认证状态下不应该允许关闭
        content={() => (
          <AuthForm
            toast={toast}
            onSuccess={() => {}} // 不再需要手动关闭,因为 status 变化会自动关闭
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
            <div className="flex justify-between flex-row">
              <div>
                <h1 className="text-2xl">法律AI</h1>
                <p>你的私人法律顾问。</p>
              </div>
              <div className="flex gap-2 self-center">
                <Button
                  icon="pi pi-chart-line"
                  className="self-center"
                  onClick={() => router.push("/summary")}
                  tooltip="总结"
                  data-tour="summary"
                />
                <Button
                  icon="pi pi-sync"
                  className="self-center"
                  onClick={fetchChats}
                  tooltip="刷新列表"
                  data-tour="refresh-list"
                  disabled={status !== "authenticated"}
                />
                <Button
                  icon="pi pi-plus"
                  className="self-center"
                  onClick={createNewChat}
                  tooltip="新建聊天"
                  data-tour="new-chat"
                  disabled={chatLists.some(
                    (chat) => chat.title === "新的聊天" && !chat._id,
                  )}
                />
                <Button
                  icon="pi pi-sign-out"
                  className="self-center"
                  data-tour="logout"
                  onClick={() =>
                    signOut({ callbackUrl: window.location.origin })
                  }
                  tooltip="退出登录"
                />
              </div>
            </div>
            <Divider className="mb-10" />
            <div
              className="flex flex-col gap-4 overflow-auto scrollbar-thin scrollbar-thumb-rounded"
              data-tour="chat-list"
            >
              {chatLists.map((chat) => (
                <ChatCard
                  key={chat._id || chat.time}
                  chat={chat}
                  isSelected={selectedChat?._id === chat._id}
                  onSelect={handleChatSelect}
                  onDelete={confirmDelete}
                />
              ))}
            </div>
          </div>
        </SplitterPanel>
        <SplitterPanel
          className="flex flex-col h-full max-w-[80%]"
          size={70}
          minSize={70}
          style={{ overflow: "auto" }}
        >
          <div className="w-full h-full">
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
              ref={containerRef}
              className="flex flex-col h-[58.3%] overflow-auto chat-container"
              onScroll={handleScroll}
            >
              {visibleMessages
                ?.filter((msg) => msg.role !== "system")
                .map((message, index) => (
                  <ChatComponent
                    key={index + message.timestamp.toString()}
                    role={message.role}
                    message={message.content}
                    onRender={() => setMarkdownRendered(true)}
                  />
                ))}

              {/* 显示临时消息 */}
              {tempMessage && (
                <ChatComponent
                  role="user"
                  message={tempMessage}
                  isTemporary={true}
                />
              )}
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
                onKeyDown={handleKeyDown} // 确保件绑定正确
                disabled={isSending}
              />
              <Divider layout="vertical" className="mx-3" />
              <Button
                label="发送"
                icon="pi pi-send"
                className="self-center h-1/4 p-button-primary min-w-28"
                type="submit"
                loading={isSending}
              />
            </form>
          </div>
        </SplitterPanel>
      </Splitter>
    </div>
  );
}
