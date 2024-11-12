// 主页
"use client";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Card } from "primereact/card";
import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import { Divider } from "primereact/divider";
import { Button } from "primereact/button";
import ChatComponent from "@/components/ChatComponent";
import { Toast } from "primereact/toast";
import { useSession } from "next-auth/react";
import { Dialog } from "primereact/dialog";
import Login from "../components/Login";
import { InputTextarea } from "primereact/inputtextarea";
import ScrollView from "@/components/ScrollView";
import { Chat, MessageRole } from "@/types";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";

// 在组件外部定义一个不可变的时间和消息数量显示组件
const StaticInfo = memo(({ time, count }: { time: string; count: number }) => (
  <p className="text-sm text-gray-500">
    {time} ({count} 条对话)
  </p>
));
StaticInfo.displayName = "StaticInfo";

export default function Home() {
  const [chatLists, setChatLists] = useState<Chat[]>([]); // 聊天列表
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null); // 当前选中的聊天
  const [initChat, setInitChat] = useState(false); // 是否初始化聊
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true); // 添加自动滚动状态
  const [tempMessage] = useState(""); // 添加临时消息状态

  const toast = useRef<Toast>(null);
  const chatRef = useRef<HTMLFormElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: session, status } = useSession();

  // 添加一个状态来存储固定的显示信息
  const [chatInfo, setChatInfo] = useState<
    Record<string, { time: string; count: number }>
  >({});

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

  // 在 AI 请求开始时更新显示信息
  const updateChatInfo = useCallback((chat: Chat) => {
    const count = chat.messages.length;
    setChatInfo((prev) => ({
      ...prev,
      [chat._id || "new"]: {
        time: chat.time,
        count: count,
      },
    }));
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      setVisible(true);
    }
  }, [status, session]); // 处理未登录状态

  // 获取聊天列表
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

        setChatLists(() => {
          // 检查是否有非空聊天记录
          const hasNonEmptyChats = chats.some(
            (chat: Chat) => chat.messages.length > 0,
          );

          // 如果没有任何聊天或所有聊天都是空的，才添加"新的聊天"
          if (chats.length === 0 || !hasNonEmptyChats) {
            const newChat = {
              _id: "",
              title: "新的聊天",
              userId: session?.user?.name || "",
              time: getCurrentTimeInLocalTimeZone(),
              messages: [],
            };
            // 自动选择新的聊天
            setSelectedChat(newChat);
            return [newChat];
          }

          // 找到第一个非空聊天
          const firstNonEmptyChat = chats.find(
            (chat: Chat) => chat.messages.length > 0,
          );
          if (firstNonEmptyChat) {
            setSelectedChat(firstNonEmptyChat);
          } else {
            setSelectedChat(chats[0]);
          }

          return chats;
        });

        // 初始化聊天信息显示
        chats.forEach((chat: Chat) => {
          updateChatInfo(chat);
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
  }, [session?.user?.name, updateChatInfo]);

  // 添加一个 useEffect 来处理初始化
  useEffect(() => {
    if (session?.user?.name && !initChat) {
      fetchChats();
      setInitChat(true);
    }
  }, [session?.user?.name, fetchChats, initChat]);

  // 处理滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    setAutoScroll(
      e.currentTarget.scrollHeight - scrollTop === e.currentTarget.clientHeight,
    );
  }, []);

  // 修改创建新聊天的函数
  const createNewChat = useCallback(() => {
    // 检查是否已经存在"新的聊天"
    const existingNewChat = chatLists.find(
      (chat) => chat.title === "新的聊天" && !chat._id,
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

      // 保存请求前的聊天状态，用于失败时回滚
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

        // 创建初始聊天对象
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
            chatId: selectedChat._id,
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
              const content = line.slice(6);
              if (content === "[DONE]") continue;

              result += content;

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
                return { ...prevChat, messages };
              });

              // 更新聊天列表
              setChatLists((prevLists) =>
                prevLists.map((chat) => {
                  if (
                    chat._id === initialChat._id ||
                    (!chat._id && !initialChat._id)
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

              if (autoScroll) {
                chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }
            }
          }
        }

        // 更新最终状态
        const finalChat = {
          ...initialChat,
          messages: [
            ...initialChat.messages,
            { role: "assistant", content: result, timestamp: new Date() },
          ],
        };
        updateChatInfo(finalChat as Chat);

        // 如果是新聊天，更新标题
        if (!selectedChat._id) {
          const sessionId = response.url.split("chatId=")[1]?.split("&")[0];
          if (sessionId) {
            updateChatTitle(sessionId, newTitle);
          }
        } else {
          // 如果是现有聊天，直接更新内容
          setChatLists((prevLists) =>
            prevLists.map((chat) => {
              if (chat._id === selectedChat._id) {
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
      } catch (error) {
        console.error("Error:", error);
        // 回滚状态
        setSelectedChat(previousChat);
        setChatLists((prevLists) =>
          prevLists.map((chat) =>
            chat._id === selectedChat._id ? previousChat : chat,
          ),
        );
        updateChatInfo(previousChat);

        toast.current?.show({
          severity: "error",
          summary: "错误",
          detail: "请求失败，请重试",
          life: 3000,
        });
      } finally {
        setIsSending(false);
      }
    },
    [message, selectedChat, session?.user?.name, autoScroll, updateChatInfo],
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
    fetchChats();
  }, [fetchChats]);

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
        message: "确定要删除这个聊天吗？",
        header: "删除确认",
        icon: "pi pi-exclamation-triangle",
        acceptLabel: "确定",
        rejectLabel: "取消",
        accept: () => deleteChat(chatId),
      });
    },
    [deleteChat],
  );

  ScrollView({
    data: selectedChat,
    ref: chatEndRef,
  });

  // 添加监听聊天列表变化的 effect
  useEffect(() => {
    if (chatLists.length === 0 && session?.user?.name) {
      const newChat = {
        _id: "",
        title: "新的聊天",
        userId: session.user.name,
        time: getCurrentTimeInLocalTimeZone(),
        messages: [],
      };
      setChatLists([newChat]);
      setSelectedChat(newChat);
    } else if (chatLists.length > 0 && !selectedChat) {
      setSelectedChat(chatLists[0]);
    }
  }, [chatLists, selectedChat, session?.user?.name]);

  // 添加一个 useEffect 来处理初始滚动
  useEffect(() => {
    if (selectedChat?._id) {
      // 使用 setTimeout 确保在 DOM 更新后执行滚动
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [selectedChat?._id]); // 当选中的聊天改变时触发

  // 监听 selectedChat 的变化
  useEffect(() => {
    if (selectedChat) {
      setChatLists((prevLists) => {
        // 检查是否已经存在相同的聊天
        const chatExists = prevLists.some(
          (chat) =>
            chat._id === selectedChat._id ||
            (!chat._id && !selectedChat._id && chat.title === "新的聊天"),
        );

        if (!chatExists) {
          return [...prevLists, selectedChat];
        }

        return prevLists.map((chat) => {
          if (
            chat._id === selectedChat._id ||
            (!chat._id && !selectedChat._id && chat.title === "新的聊天")
          ) {
            return selectedChat;
          }
          return chat;
        });
      });
    }
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
  useEffect(() => {
    chatLists.forEach((chat) => {
      if (!chatInfo[chat._id || "new"]) {
        updateChatInfo(chat);
      }
    });
  }, [chatLists, updateChatInfo]);

  return (
    <div className="flex h-screen w-screen relative">
      <Toast ref={toast} />
      <ConfirmDialog />
      <Dialog
        visible={visible}
        modal
        style={{ boxShadow: "none" }}
        onHide={() => {
          if (!visible) return;
          setVisible(false);
        }}
        content={({ hide }) => <Login toast={toast} hide={hide} />}
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
              <Button
                icon="pi pi-plus"
                className="self-center"
                onClick={createNewChat}
                tooltip="新建聊天"
                disabled={chatLists.some(
                  (chat) => chat.title === "新的聊天" && !chat._id,
                )}
              />
            </div>
            <Divider className="mb-10" />
            <div className="flex flex-col gap-4 overflow-auto scrollbar-thin scrollbar-thumb-rounded">
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
                    {selectedChat?.messages?.length || 0}条对话
                  </p>
                </div>
                <div className="flex gap-3 self-center mr-3">
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
                </div>
              </div>
              <Divider />
            </div>

            <div
              className="flex flex-col h-[58.3%] overflow-auto chat-container"
              onScroll={handleScroll}
            >
              {/* 显示已保存的消息 */}
              {selectedChat?.messages?.map((msg, index) => (
                <ChatComponent
                  key={index}
                  role={msg.role}
                  message={msg.content}
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

              <div ref={chatEndRef} />
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
