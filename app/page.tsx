"use client";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Card } from "primereact/card";
import React, { useEffect } from "react";
import { Divider } from "primereact/divider";
import { useState } from "react";

interface Chat {
  id: string;
  title: string;
  chatNum: number;
  time: string;
}

export default function Home() {
  const [chatLists, setProducts] = useState([] as Chat[]);
  useEffect(() => {
    setProducts([
      {
        id: "1",
        title: "Chat 1",
        chatNum: 1,
        time: "10:00 AM",
      },
      {
        id: "2",
        title: "Chat 2",
        chatNum: 2,
        time: "11:00 AM",
      },
      {
        id: "3",
        title: "Chat 3",
        chatNum: 3,
        time: "12:00 PM",
      },
      {
        id: "4",
        title: "Chat 4",
        chatNum: 4,
        time: "1:00 PM",
      },
      {
        id: "5",
        title: "Chat 5",
        chatNum: 5,
        time: "2:00 PM",
      },
      {
        id: "6",
        title: "Chat 6",
        chatNum: 6,
        time: "3:00 PM",
      },
      {
        id: "7",
        title: "Chat 7",
        chatNum: 7,
        time: "4:00 PM",
      },
      {
        id: "8",
        title: "Chat 8",
        chatNum: 8,
        time: "5:00 PM",
      },
      {
        id: "9",
        title: "Chat 9",
        chatNum: 9,
        time: "6:00 PM",
      },
      {
        id: "10",
        title: "Chat 10",
        chatNum: 10,
        time: "7:00 PM",
      },
    ]);
  }, []);

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
                <h1 className="text-2xl">Law AI</h1>
                <p>Your personal law counselor.</p>
              </div>
              <i className="pi pi-hammer text-5xl self-center"></i>
            </div>
            <Divider className="mb-10" />
            <div className="flex flex-col gap-4 overflow-auto">
            {chatLists &&
              chatLists.map((chat) => (
                <Card title={chat.title} key={chat.id} className="cursor-pointer">
                  <div className="flex justify-between">
                    <p className="m-0">{chat.chatNum}条对话</p>
                    <p className="m-0">{chat.time}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </SplitterPanel>
        <SplitterPanel
          className="flex align-items-center justify-content-center"
          size={70}
          minSize={70}
        >
          Panel 2
        </SplitterPanel>
      </Splitter>
    </div>
  );
}
