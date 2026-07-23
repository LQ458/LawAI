"use client";
import React, { useState, useEffect, useCallback } from "react";
import DynamicMarkdownRenderer from "./DynamicMarkdown";
import { Avatar } from "primereact/avatar";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";

interface CaseDetail {
  title: string;
  source: string;
  url?: string;
  id: string;
}

interface ChatComponentProps {
  role: string;
  message: string;
  retrievalQuery?: string;
  isTemporary?: boolean;
  onRender?: () => void;
}

const ChatComponent: React.FC<ChatComponentProps> = ({
  role,
  message,
  retrievalQuery,
  isTemporary = false,
  onRender,
}) => {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [showCases, setShowCases] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [hasFetched, setHasFetched] = useState(false);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [caseContent, setCaseContent] = useState<Record<string, string>>({});
  const [loadingCase, setLoadingCase] = useState<string | null>(null);

  const fetchCaseDetails = useCallback(async () => {
    try {
      setLoadingCases(true);
      const response = await fetch("/api/rag-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: (retrievalQuery || message).slice(0, 1_000),
        }),
      });
      if (!response.ok) throw new Error("Failed");
      const res = await response.json();
      if (res.mode !== "grounded_rag" || res.grounded !== true) {
        throw new Error("Unexpected retrieval response");
      }
      setCases(res.sources || []);
      setAiSummary(res.answer || "");
      setHasFetched(true);
    } catch {
      setCases([]);
      setAiSummary("检索服务暂时不可用。当前聊天回复不是检索式 RAG 回答。");
    } finally {
      setLoadingCases(false);
    }
  }, [message, retrievalQuery]);

  useEffect(() => {
    if (isRendered) {
      onRender?.();
    }
  }, [isRendered, onRender]);

  const handleMarkdownRender = () => setIsRendered(true);
  const handleCopyMessage = () => {
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const toggleGroundedSources = async () => {
    const nextVisible = !showCases;
    setShowCases(nextVisible);
    if (nextVisible && !hasFetched && !loadingCases) {
      await fetchCaseDetails();
    }
  };

  const toggleCaseDetail = async (caseId: string) => {
    if (expandedCase === caseId) {
      setExpandedCase(null);
      return;
    }
    setExpandedCase(caseId);
    if (!caseContent[caseId]) {
      setLoadingCase(caseId);
      try {
        const res = await fetch(`/api/case-detail?id=${caseId}`);
        if (res.ok) {
          const data = await res.json();
          setCaseContent((prev) => ({
            ...prev,
            [caseId]: data.content || data.description || "暂无详情",
          }));
        }
      } catch {
        // ignore
      }
      setLoadingCase(null);
    }
  };

  return (
    <div
      className={`flex flex-col items-start gap-2 p-4 ${role === "user" ? "items-end" : ""}`}
    >
      <div
        className={`flex ${role === "user" ? "justify-end" : "justify-start"} items-start gap-2`}
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
              <DynamicMarkdownRenderer
                content={message}
                onLoad={handleMarkdownRender}
              />
              <div className="mt-3 flex justify-between items-center border-t border-gray-200 pt-2">
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
                  severity={cases.length ? "info" : "secondary"}
                  text
                  size="small"
                  icon={
                    loadingCases
                      ? "pi pi-spin pi-spinner"
                      : showCases
                        ? "pi pi-chevron-up"
                        : "pi pi-book"
                  }
                  label={
                    cases.length
                      ? `检索式依据 · ${cases.length}`
                      : "单独检索依据"
                  }
                  onClick={toggleGroundedSources}
                  disabled={loadingCases}
                />
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

      {/* 参考案例区 */}
      {showCases && !loadingCases && (
        <div className="ml-12 w-full max-w-[80%]">
          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            {cases.length > 0 ? (
              <>
                <div className="px-4 pt-3 pb-2">
                  <p className="mb-2 text-xs font-medium text-gray-500">
                    以下内容由单独的检索与授权流程生成；上方普通聊天回复未经该次
                    retrieval，不能视为 RAG-grounded。
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {aiSummary}
                  </p>
                </div>

                <div className="px-2 pb-1">
                  {cases.map((c, i) => (
                    <div key={c.id || i}>
                      <button
                        onClick={() => toggleCaseDetail(c.id)}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-xs text-gray-400 w-4 text-right font-mono">
                          {i + 1}
                        </span>
                        <span className="text-blue-600 text-sm flex-1">
                          {c.title}
                        </span>
                        <span className="text-xs text-gray-400">
                          {c.source}
                        </span>
                        <i
                          className={`pi pi-chevron-${expandedCase === c.id ? "up" : "down"} text-xs text-gray-400`}
                        />
                      </button>

                      {expandedCase === c.id && (
                        <div className="mx-4 mb-2 p-3 bg-gray-100 rounded text-sm text-gray-700 leading-relaxed">
                          {loadingCase === c.id ? (
                            <div className="flex items-center gap-2 text-gray-400 py-2">
                              <ProgressSpinner
                                style={{ width: "14px", height: "14px" }}
                                strokeWidth="6"
                              />
                              加载中...
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">
                              {caseContent[c.id] || "暂无详细内容"}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm text-center py-6">
                未找到相关案例
              </p>
            )}
          </div>
        </div>
      )}

      {showCases && loadingCases && (
        <div className="ml-12 py-3">
          <ProgressSpinner style={{ width: "20px", height: "20px" }} />
        </div>
      )}
    </div>
  );
};

export default ChatComponent;
