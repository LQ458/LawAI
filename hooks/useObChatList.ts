"use client";

import { getCurrentTimeInLocalTimeZone } from "@/components/tools";
import { Dispatch, SetStateAction, useEffect } from "react";
import { Chat } from "@/types";

const UseObChatList = (
  chatLists: Chat[],
  setChatLists: Dispatch<SetStateAction<Chat[]>>,
  selectedChat: Chat,
  setSelectedChat: (chat: Chat) => void,
  userId: string,
) => {
  useEffect(() => {
    if (chatLists.length === 0 && userId) {
      const newChat = {
        _id: "",
        title: "新的聊天",
        userId: userId,
        time: getCurrentTimeInLocalTimeZone(),
        messages: [],
      };
      setChatLists([newChat]);
      setSelectedChat(newChat);
    } else if (chatLists.length > 0 && !selectedChat) {
      setSelectedChat(chatLists[0]);
    }
  }, [chatLists, selectedChat, userId, setChatLists, setSelectedChat]);
};

export default UseObChatList;
