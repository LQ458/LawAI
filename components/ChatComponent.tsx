"use client";
import React from "react";
import DynamicMarkdownRenderer from "./DynamicMarkdown";
import { Avatar } from "primereact/avatar";
import { MessageRole } from "@/types";

interface ChatComponentProps {
  role: MessageRole;
  message: string;
  isTemporary?: boolean;
}

const ChatComponent: React.FC<ChatComponentProps> = ({
  role,
  message,
  isTemporary = false,
}) => {
  return (
    <div
      className={`flex ${
        role === "user" ? "justify-end" : "justify-start"
      } items-start gap-2 p-4`}
    >
      {role === "assistant" && (
        <Avatar
          icon="pi pi-slack"
          size="large"
          shape="circle"
          className="bg-purple-100 text-purple-600"
        />
      )}
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          role === "user"
            ? "bg-blue-500 text-white"
            : "bg-gray-100 text-gray-800"
        } ${isTemporary ? "opacity-50" : ""}`}
      >
        {role === "assistant" ? (
          <DynamicMarkdownRenderer content={message} />
        ) : (
          <p className="whitespace-pre-wrap">{message}</p>
        )}
      </div>
      {role === "user" && (
        <Avatar
          icon="pi pi-user"
          size="large"
          shape="circle"
          className="bg-blue-500 text-white"
        />
      )}
    </div>
  );
};

export default ChatComponent;
