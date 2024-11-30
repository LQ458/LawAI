"use client";

import { getCurrentTimeInLocalTimeZone } from "@/components/tools";
import { Dispatch, SetStateAction, useEffect } from "react";
import { Chat } from "@/types";
import { Session } from "next-auth";

const UseObChatList = (
  chatLists: Chat[],
  setChatLists: Dispatch<SetStateAction<Chat[]>>,
  selectedChat: Chat,
  setSelectedChat: (chat: Chat) => void,
  session: Session,
) => {
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
};

export default UseObChatList;
