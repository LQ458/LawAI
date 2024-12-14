import { useState, useCallback } from "react";
import { Chat } from "@/types";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";

interface UseChatStateProps {
  username: string;
}

export const useChatState = ({ username }: UseChatStateProps) => {
  const [chatLists, setChatLists] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chatInfo, setChatInfo] = useState<
    Record<string, { time: string; count: number }>
  >({});

  // 更新聊天信息
  const updateChatInfo = useCallback((chat: Chat) => {
    const count = chat.messages.filter((msg) => msg.role !== "system").length;
    setChatInfo((prev) => ({
      ...prev,
      [chat._id || "new"]: {
        time: chat.time,
        count,
      },
    }));
  }, []);

  // 创建新聊天
  const createNewChat = useCallback(() => {
    const newChat: Chat = {
      _id: "",
      title: "新的聊天",
      userId: username,
      time: getCurrentTimeInLocalTimeZone(),
      messages: [],
    };

    setChatLists((prev) => [newChat, ...prev]);
    setSelectedChat(newChat);
    updateChatInfo(newChat);
  }, [username, updateChatInfo]);

  // 删除聊天
  const deleteChat = useCallback(
    async (chatId: string, username: string) => {
      try {
        const response = await fetch("/api/deleteChat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, username }),
        });

        if (response.ok) {
          setChatLists((prev) => prev.filter((chat) => chat._id !== chatId));
          if (selectedChat?._id === chatId) {
            setSelectedChat(null);
          }
        }
      } catch (error) {
        console.error("Error deleting chat:", error);
      }
    },
    [selectedChat],
  );

  return {
    chatLists,
    setChatLists,
    selectedChat,
    setSelectedChat,
    chatInfo,
    updateChatInfo,
    createNewChat,
    deleteChat,
  };
};
