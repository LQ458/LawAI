"use client";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Card } from "primereact/card";
import { InputTextarea } from "primereact/inputtextarea";
import { Panel } from "primereact/panel";
import React, { useState, useLayoutEffect } from "react";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import axios from "axios";
import { Toast } from "primereact/toast";
import { useRouter } from "next/navigation";

export default function Summary() {
  const [textToSummarize, setTextToSummarize] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const toast = React.useRef<Toast>(null);
  const router = useRouter();

  // 检测是否为移动设备
  useLayoutEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
      console.error("Error copying to clipboard:", error);
      toast.current?.show({
        severity: "error",
        summary: "复制失败",
        detail: "无法复制文本",
        life: 3000,
      });
    }
  };

  // 移动端内容布局
  const MobileContent = () => (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <Panel header="需要总结的文本" className="shadow-md">
        <div className="flex flex-col gap-3">
          <InputTextarea
            value={textToSummarize}
            onChange={(e) => setTextToSummarize(e.target.value)}
            rows={8}
            autoResize
            className="w-full p-3"
            placeholder="输入需要总结的文本..."
          />
          <Button
            label="生成总结"
            icon="pi pi-send"
            onClick={requestSummary}
            className="w-full"
            disabled={loading || !textToSummarize.trim()}
          />
        </div>
      </Panel>

      <Panel header="总结结果" className="shadow-md">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-6">
            <ProgressSpinner />
            <p className="mt-3">正在总结文本，请稍候...</p>
          </div>
        ) : summary ? (
          <div className="flex flex-col gap-3">
            <Card className="shadow-sm">
              <div className="whitespace-pre-wrap">{summary}</div>
            </Card>
            <Button
              label="复制总结"
              icon="pi pi-copy"
              onClick={copyToClipboard}
              severity="secondary"
              className="w-full"
            />
          </div>
        ) : (
          <Card className="shadow-sm">
            <p className="text-gray-500 text-center">
              还没有总结结果。请输入文本并点击&quot;生成总结&quot;。
            </p>
          </Card>
        )}
      </Panel>
    </div>
  );

  // 桌面端内容布局
  const DesktopContent = () => (
    <Splitter className="h-full">
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
              disabled={loading || !textToSummarize.trim()}
            />
          </div>
        </Panel>
      </SplitterPanel>

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
                  还没有总结结果。请输入文本并点击&quot;生成总结&quot;。
                </p>
              </Card>
            )}
          </div>
        </Panel>
      </SplitterPanel>
    </Splitter>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Toast ref={toast} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Button
              icon="pi pi-home"
              tooltip="返回首页"
              tooltipOptions={{ position: "bottom" }}
              className="p-button-text"
              onClick={() => router.push("/")}
            />
            <h1 className="text-2xl font-bold text-gray-800">案例总结</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              icon="pi pi-star-fill"
              tooltip="推荐案例"
              tooltipOptions={{ position: "bottom" }}
              className="p-button-text"
              onClick={() => router.push("/recommend")}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {isMobile ? <MobileContent /> : <DesktopContent />}
      </main>
    </div>
  );
}
