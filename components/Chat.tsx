"use client";
import { Button } from "primereact/button";
import { Card } from "primereact/card";

interface ChatProps {
  role: string;
  message: string;
}

export default function Chat({ role, message }: ChatProps) {
  switch (role) {
    case "assistant":
      return (
        <div className="flex flex-col mr-4 ml-4 gap-3 mb-4">
          <Button icon="pi pi-slack" text raised aria-label="Assistant" />
          {message !== "" && (
            <Card className="w-fit">
              <p className="m-0">{message}</p>
            </Card>
          )}
        </div>
      );
    case "user":
      return (
        <div className="flex flex-col ml-4 mr-4 gap-3 mb-4">
          <Button
            icon="pi pi-face-smile"
            className="self-end"
            text
            raised
            aria-label="Assistant"
          />
          {message !== "" && (
            <Card className="w-fit self-end">
              <p className="m-0">{message}</p>
            </Card>
          )}
        </div>
      );
    default:
      return null;
  }
}
