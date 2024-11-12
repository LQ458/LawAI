"use client";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import type { ChatProps } from "@/types";

export default function Chat({
  role,
  message,
  isTemporary = false,
}: ChatProps) {
  switch (role) {
    case "user":
      return (
        <div
          className={`flex flex-col gap-3 mb-4 w-full relative pl-4 pr-4 ${isTemporary ? "opacity-60" : ""}`}
        >
          <div className="flex items-start justify-end gap-3">
            {message !== "" && (
              <Card className="max-w-[85%] bg-blue-100">
                <p className="m-0 break-words">{message}</p>
              </Card>
            )}
            <Button
              icon="pi pi-user"
              text
              raised
              aria-label="User"
              className="min-w-[2.5rem] h-[2.5rem]"
            />
          </div>
        </div>
      );

    case "assistant":
      return (
        <div className="flex flex-col gap-3 mb-4 w-full relative pl-4 pr-4">
          <div className="flex items-start gap-3">
            <Button
              icon="pi pi-android"
              text
              raised
              aria-label="Assistant"
              className="min-w-[2.5rem] h-[2.5rem]"
            />
            {message !== "" && (
              <Card className="max-w-[85%]">
                <p className="m-0 break-words whitespace-pre-wrap">{message}</p>
              </Card>
            )}
          </div>
        </div>
      );

    default:
      return null;
  }
}
