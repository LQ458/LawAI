import { Chat } from "@/types";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { memo } from "react";

interface ChatCardProps {
  chat: Chat;
  isSelected: boolean;
  onSelect: (chat: Chat) => void;
  onDelete: (chatId: string) => void;
  info?: {
    time: string;
    count: number;
  };
}

// 静态信息组件
const StaticInfo = memo(({ time, count }: { time: string; count: number }) => (
  <p className="text-sm text-gray-500">
    {time} ({count} 条对话)
  </p>
));

StaticInfo.displayName = "StaticInfo";

// Chat卡片组件
export const ChatCard = memo(
  ({ chat, isSelected, onSelect, onDelete, info }: ChatCardProps) => {
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

interface ChatListProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelect: (chat: Chat) => void;
  onDelete: (chatId: string) => void;
  chatInfo: Record<string, { time: string; count: number }>;
}

// 聊天列表组件
const ChatList = memo(
  ({ chats, selectedChat, onSelect, onDelete, chatInfo }: ChatListProps) => {
    return (
      <div
        className="flex flex-col gap-4 overflow-auto scrollbar-thin scrollbar-thumb-rounded"
        data-tour="chat-list"
      >
        {chats.map((chat) => (
          <ChatCard
            key={chat._id || chat.time}
            chat={chat}
            isSelected={selectedChat?._id === chat._id}
            onSelect={onSelect}
            onDelete={onDelete}
            info={chatInfo[chat._id || "new"]}
          />
        ))}
      </div>
    );
  },
);

ChatList.displayName = "ChatList";

export default ChatList;
