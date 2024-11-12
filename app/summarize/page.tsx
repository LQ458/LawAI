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

export default function SummarizePage() {
  const [textToSummarize, setTextToSummarize] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="flex h-screen w-screen relative">
      <Splitter className="flex-grow-[1]" style={{ height: "100%" }}>
        {/* Left Panel - Text Input */}
        <SplitterPanel size={40} minSize={30}>
          <Panel header="Text to Summarize" className="h-full">
            <div className="flex flex-col h-full">
              <div className="flex-grow">
                <InputTextarea
                  value={textToSummarize}
                  onChange={(e) => setTextToSummarize(e.target.value)}
                  rows={15}
                  cols={30}
                  autoResize
                  className="w-full p-3"
                  placeholder="Enter text to summarize..."
                />
              </div>
              <Divider />
              <Button
                label="Summarize"
                icon="pi pi-send"
                onClick={requestSummary}
                className="w-full"
                disabled={loading || !textToSummarize.trim()}
              />
            </div>
          </Panel>
        </SplitterPanel>

        {/* Right Panel - Summary Output */}
        <SplitterPanel size={60} minSize={40}>
          <Panel header="Summary" className="h-full">
            <div className="flex flex-col justify-center items-center h-full">
              {loading ? (
                <div className="flex flex-col justify-center items-center">
                  <ProgressSpinner />
                  <p className="mt-3">Summarizing text, please wait...</p>
                </div>
              ) : summary ? (
                <Card className="w-full p-4">
                  <p>{summary}</p>
                </Card>
              ) : (
                <Card className="w-full p-4">
                  <p>
                    No summary yet. Please enter text and click
                    &quot;Summarize&quot;.
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
