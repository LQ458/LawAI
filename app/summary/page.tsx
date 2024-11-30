"use client";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Card } from "primereact/card";
import { InputTextarea } from "primereact/inputtextarea";
import { Panel } from "primereact/panel";
import React, { useState } from "react";
import { Divider } from "primereact/divider";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import axios from "axios";
import { Toast } from "primereact/toast";

export default function Summary() {
  const [textToSummarize, setTextToSummarize] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = React.useRef<Toast>(null);

  const requestSummary = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/api/summary", {
        text: textToSummarize,
      });
      setSummary(response.data.summary);
    } catch (error) {
      console.error("Error fetching summary:", error);
      setSummary("Failed to summarize the text.");
    }
    setLoading(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast.current?.show({
        severity: "success",
        summary: "复制成功",
        detail: "文本已复制到剪贴板",
        life: 3000,
      });
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: "复制失败",
        detail: "无法复制文本",
        life: 3000,
      });
    }
  };

  return (
    <div className="flex h-screen w-screen relative overflow-hidden">
      <Toast ref={toast} />
      <Splitter className="flex-grow-[1]" style={{ height: "100%" }}>
        {/* Left Panel - Text Input */}
        <SplitterPanel size={40} minSize={30}>
          <Panel header="需要总结的文本" className="h-full">
            <div className="flex flex-col h-full gap-3 p-2">
              <InputTextarea
                value={textToSummarize}
                onChange={(e) => setTextToSummarize(e.target.value)}
                rows={15}
                autoResize
                className="w-full p-3 flex-grow-[1] overflow-y-auto"
                style={{
                  maxHeight: "calc(100vh - 200px)",
                  minHeight: "200px",
                }}
                placeholder="输入需要总结的文本..."
              />
              <Button
                label="生成总结"
                icon="pi pi-send"
                onClick={requestSummary}
                className="w-full mt-auto"
                severity="primary"
                disabled={loading || !textToSummarize.trim()}
              />
            </div>
          </Panel>
        </SplitterPanel>

        {/* Right Panel - Summary Output */}
        <SplitterPanel size={60} minSize={40}>
          <Panel header="总结结果" className="h-full">
            <div className="flex flex-col h-full p-2">
              {loading ? (
                <div className="flex flex-col justify-center items-center flex-grow">
                  <ProgressSpinner />
                  <p className="mt-3">正在总结文本，请稍候...</p>
                </div>
              ) : summary ? (
                <div className="flex flex-col gap-3 h-full">
                  <Card
                    className="w-full shadow-md flex-grow-[1] overflow-y-auto"
                    style={{
                      maxHeight: "calc(100vh - 200px)",
                    }}
                  >
                    <div className="whitespace-pre-wrap h-full">{summary}</div>
                  </Card>
                  <Button
                    label="复制总结"
                    icon="pi pi-copy"
                    onClick={copyToClipboard}
                    severity="secondary"
                    className="w-full mt-auto"
                  />
                </div>
              ) : (
                <Card className="w-full shadow-md">
                  <p className="text-gray-500 text-center">
                    还没有总结结果。请输入文本并点击"生成总结"。
                  </p>
                </Card>
              )}
            </div>
          </Panel>
        </SplitterPanel>
      </Splitter>
    </div>
  );
}