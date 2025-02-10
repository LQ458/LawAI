"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import DynamicMarkdownRenderer from "./DynamicMarkdown";
import { Avatar } from "primereact/avatar";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Button } from "primereact/button";
import { ProgressSpinner } from 'primereact/progressspinner';

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
  const [copiedMessage, setCopiedMessage] = useState(false); // Add state for message copy
  const [copiedAiMessage, setCopiedAiMessage] = useState(false); // Add state for AI message copy
  const [isRendered, setIsRendered] = useState(false);
  const [caseDetails, setCaseDetails] = useState<any[]>([]);
  const [showCaseDetails, setShowCaseDetails] = useState(false);
  const [loading, setLoading] = useState(false); // Add loading state
  const [aiMessage, setAiMessage] = useState<string>(""); // Add state for AI message
  const [hasFetched, setHasFetched] = useState(false); // Add state to track if fetching has been done
  const [showAiResponse, setShowAiResponse] = useState(false); // Add state to toggle AI response visibility

  useEffect(() => {
    if (isRendered && !hasFetched) {
      onRender?.();
      if (role === "assistant") {
        fetchCaseDetails();
        setHasFetched(true); // Set hasFetched to true after fetching
      }
    }
  }, [isRendered, onRender, role, hasFetched]);

  const fetchCaseDetails = async () => {
    try {
      setLoading(true); // Set loading to true when fetching starts
      const response = await fetch(
        `/api/getCase?search=${encodeURIComponent(message)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch case details");
      }

      const res = await response.json();
      console.log("Response format:", res); // Print the format of the response
      const links = res.cases.map((caseDetail: any) => caseDetail.link);
      console.log("Fetched case links:", links); // Print only the "link" content
      setCaseDetails(res.cases);
      setAiMessage(res.data); // Set AI message
      setShowCaseDetails(true);
    } catch (error) {
      console.error("Error fetching case details:", error);
    } finally {
      setLoading(false); // Set loading to false when fetching ends
    }
  };

  const handleMarkdownRender = () => {
    setIsRendered(true);
  };

  const handleCopyMessage = () => {
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleCopyAiMessage = () => {
    setCopiedAiMessage(true);
    setTimeout(() => setCopiedAiMessage(false), 2000);
  };

  const handleToggleAiResponse = () => {
    setShowAiResponse(!showAiResponse);
  };

  return (
    <div className="flex flex-col items-start gap-2 p-4">
      <div
        className={`flex ${
          role === "user" ? "justify-end" : "justify-start"
        } items-start gap-2`}
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

              {/* 复制按钮 */}
              <div className="mt-2 flex justify-end items-center">
                <CopyToClipboard text={message} onCopy={handleCopyMessage}>
                  <Button
                    severity="secondary"
                    text
                    size="small"
                    icon={copiedMessage ? "pi pi-check" : "pi pi-copy"}
                    label={copiedMessage ? "已复制" : "复制"}
                  />
                </CopyToClipboard>
                <Button
                  severity="secondary"
                  text
                  size="small"
                  icon={showAiResponse ? "pi pi-chevron-up" : "pi pi-chevron-down"}
                  onClick={handleToggleAiResponse}
                  className="rainbow-text"
                />
                <span className="rainbow-text ml-2">查看相关文献</span>
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
      {/* 在这里加入extractive ai的返回部分，可以参考dynamicMarkdownRenderer的渲染模式 */}
      {showAiResponse && (
        loading ? (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg w-full flex justify-center">
            <ProgressSpinner />
          </div>
        ) : (
          showCaseDetails && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg w-full">
              <h3 className="text-lg font-bold">相关按例解读</h3>
              <p dangerouslySetInnerHTML={{ __html: aiMessage.replace(/\n/g, '<br>') }}></p> {/* Display AI message */}
              <div className="mt-2 flex justify-end">
                <CopyToClipboard text={aiMessage} onCopy={handleCopyAiMessage}>
                  <Button
                    severity="secondary"
                    text
                    size="small"
                    icon={copiedAiMessage ? "pi pi-check" : "pi pi-copy"}
                    label={copiedAiMessage ? "已复制" : "复制"}
                  />
                </CopyToClipboard>
              </div>
              <h3 className="text-lg font-bold">相关案例:</h3>
              {caseDetails.length > 0 ? (
                <ol className="list-decimal pl-5"> {/* Change to ordered list */}
                  {caseDetails.map((caseDetail, index) => (
                    <li key={index}>
                      <a
                        href={caseDetail.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 underline"
                      >
                        {caseDetail.title}
                      </a>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>未找到相关按例</p>
              )}
            </div>
          )
        )
      )}
    </div>
  );
};

// Add CSS for rainbow text effect
const styles = `
  @keyframes rainbow {
    0% { color: red; }
    14% { color: orange; }
    42% { color: green; }
    57% { color: blue; }
    71% { color: indigo; }
    85% { color: violet; }
    100% { color: red; }
  }
  .rainbow-text {
    animation: rainbow 10s infinite;
  }
`;

export default ChatComponent;

// Inject styles into the document head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
