import { useState, useCallback } from "react";
import { Chat } from "@/types";
import { getCurrentTimeInLocalTimeZone } from "@/components/tools";

interface UseChatStateProps {
  userId: string;
}

export const useChatState = ({ userId }: UseChatStateProps) => {
  const [chatLists, setChatLists] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chatInfo, setChatInfo] = useState<
    Record<string, { time: string; count: number }>
  >({});

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

  const createNewChat = useCallback(() => {
    const newChat: Chat = {
      _id: "",
      title: "新的聊天",
      userId: userId,
      time: getCurrentTimeInLocalTimeZone(),
      messages: [],
    };

    setChatLists((prev) => [newChat, ...prev]);
    setSelectedChat(newChat);
    updateChatInfo(newChat);
  }, [userId, updateChatInfo]);

  const deleteChat = useCallback(
    async (chatId: string, userIdParam: string) => {
      try {
        const response = await fetch("/api/deleteChat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, userId: userIdParam }),
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
