// role = assistant 时，渲染markdown,即ai聊天返回内容部分
// role = user 时，渲染纯文本（用户输入）

"use client";
import React, { useState, useEffect } from "react";
import DynamicMarkdownRenderer from "./DynamicMarkdown";
import { Avatar } from "primereact/avatar";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Button } from "primereact/button";

interface ChatComponentProps {
  role: string;
  message: string;
  isTemporary?: boolean;
  onRender?: () => void;
}

const ChatComponent: React.FC<ChatComponentProps> = ({
  role,
  message,
  isTemporary = false,
  onRender,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (isRendered) {
      onRender?.();
    }
  }, [isRendered, onRender]);

  const handleMarkdownRender = () => {
    setIsRendered(true);
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <>
            {/* 渲染markdown,即聊天返回内容部分 */}
            <DynamicMarkdownRenderer
              content={message}
              onLoad={handleMarkdownRender}
            />

            {/* 在这里加入extractive ai的返回部分，可以参考dynamicMarkdownRenderer的渲染模式 */}

            {/* 复制按钮 */}
            <div className="mt-2 flex justify-end">
              <CopyToClipboard text={message} onCopy={handleCopy}>
                <Button
                  severity="secondary"
                  text
                  size="small"
                  icon={copied ? "pi pi-check" : "pi pi-copy"}
                  label={copied ? "已复制" : "复制"}
                />
              </CopyToClipboard>
            </div>
          </>
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
