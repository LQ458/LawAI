"use client";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Card } from "primereact/card";
import React, { useEffect, useState } from "react";
import { Divider } from "primereact/divider";
import { Button } from "primereact/button";
import Chat from "@/components/Chat";
import axios from "axios";

interface Message {
  role: string;
  content: string;
  timestamp: Date; // 添加时间戳字段
}

interface Chat {
  id: string;
  title: string;
  chatNum: number;
  time: string;
  messages: Message[];
}

export default function Home() {
  const [chatLists, setChatLists] = useState([] as Chat[]);
  const [selectedChat, setSelectedChat] = useState({} as Chat);
  const [initChat, setInitChat] = useState(false);

  // useEffect(() => {
  //   const fetchChats = async () => {
  //     const response = await axios.get("/api/fetchAi");
  //     setChatLists(response.data);
  //   };
  //   fetchChats();
  // }, []);

  const requestAI = async () => {
    const response = await axios.post("/api/fetchAi", {
      id: selectedChat.id,
      message: { role: "user", content: "Hello" },
    });
    const updatedChat = response.data;
    setChatLists((prevChats) =>
      prevChats.map((chat) =>
        chat.id === updatedChat.id ? updatedChat : chat,
      ),
    );
    setSelectedChat(updatedChat);
  };

  return (
    <div className="flex h-screen w-screen relative">
      <Splitter className="flex-grow-[1]">
        <SplitterPanel
          className="flex align-items-center justify-content-center"
          size={30}
          minSize={20}
        >
          <div className="flex flex-col w-full p-4 relative h-full overflow-hidden">
            <div className="flex justify-between flex-row">
              <div>
                <h1 className="text-2xl">法律AI</h1>
                <p>你的私人法律顾问。</p>
              </div>
              <i className="pi pi-hammer text-5xl self-center"></i>
            </div>
            <Divider className="mb-10" />
            <div className="flex flex-col gap-4 overflow-auto scrollbar-thin scrollbar-thumb-rounded">
              {chatLists &&
                chatLists.map((chat) => (
                  <Card
                    title={chat.title}
                    key={chat.id}
                    className={`cursor-pointer rounded-xl border-2 borderTransparent ${selectedChat && selectedChat.id === chat.id && "chatBorder"}`}
                    onClick={() => setSelectedChat(chat)}
                  >
                    <div className="flex justify-between">
                      <p className="m-0">{chat.chatNum}条对话</p>
                      <p className="m-0">{chat.time}</p>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        </SplitterPanel>
        <SplitterPanel className="flex flex-col" size={70} minSize={70}>
          <div className="flex flex-col">
            <div className="flex flex-row justify-between p-4 pb-0 pt-0">
              <div>
                <h1 className="text-2xl">{selectedChat?.title}</h1>
                <p className="m-0">{selectedChat?.chatNum}条对话</p>
              </div>
              <div className="flex gap-3 self-center mr-3">
                <Button
                  icon="pi pi-refresh"
                  rounded
                  outlined
                  severity="secondary"
                  aria-label="Refresh"
                  onClick={requestAI}
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
            <div className="flex flex-col">
              {selectedChat?.messages?.map((msg, index) => (
                <Chat key={index} role={msg.role} message={msg.content} />
              ))}
            </div>
          </div>
        </SplitterPanel>
      </Splitter>
    </div>
  );
}
