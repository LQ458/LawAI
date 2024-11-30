"use client";

import { Chat } from "@/types";
import { useEffect } from "react";

const UseInitInfo = (
  chatLists: Chat[],
  updateChatInfo: (chat: Chat) => void,
  chatInfo: Record<string, { time: string; count: number }>,
) => {
  useEffect(() => {
    chatLists.forEach((chat) => {
      if (!chatInfo[chat._id || "new"]) {
        updateChatInfo(chat);
      }
    });
  }, [chatLists, updateChatInfo, chatInfo]);
};

export default UseInitInfo;
