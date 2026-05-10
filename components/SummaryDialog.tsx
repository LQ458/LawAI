"use client";
import { useState } from "react";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import { Toast } from "primereact/toast";

interface SummaryDialogProps {
  visible: boolean;
  onHide: () => void;
  toast: React.MutableRefObject<Toast | null>;
}

export default function SummaryDialog({
  visible,
  onHide,
  toast,
}: SummaryDialogProps) {
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSummarize = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setSummary("");
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      toast.current?.show({
        severity: "error",
        summary: "总结失败",
        detail: "请稍后重试",
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast.current?.show({
        severity: "success",
        summary: "已复制",
        detail: "总结文本已复制到剪贴板",
        life: 2000,
      });
    } catch {
      toast.current?.show({
        severity: "error",
        summary: "复制失败",
        detail: "",
        life: 2000,
      });
    }
  };

  const handleClear = () => {
    setText("");
    setSummary("");
  };

  return (
    <Dialog
      header="文本总结"
      visible={visible}
      onHide={onHide}
      style={{ width: "700px", maxWidth: "95vw" }}
      dismissableMask
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="font-semibold">输入文本</label>
            <Button
              label="清空"
              icon="pi pi-times"
              size="small"
              severity="secondary"
              text
              onClick={handleClear}
              disabled={!text && !summary}
            />
          </div>
          <InputTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            autoResize
            className="w-full"
            placeholder="粘贴需要总结的法律文本..."
          />
        </div>

        <Button
          label="生成总结"
          icon={loading ? "pi pi-spin pi-spinner" : "pi pi-send"}
          onClick={handleSummarize}
          loading={loading}
          disabled={!text.trim()}
        />

        {loading && (
          <div className="flex flex-col items-center py-4">
            <ProgressSpinner style={{ width: "40px", height: "40px" }} />
            <p className="mt-2 text-sm text-gray-500">正在总结...</p>
          </div>
        )}

        {summary && !loading && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-semibold">总结结果</label>
              <Button
                label="复制"
                icon="pi pi-copy"
                size="small"
                severity="info"
                text
                onClick={handleCopy}
              />
            </div>
            <div className="p-3 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm">
              {summary}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
