import { useState, useCallback } from "react";

export const useMessageState = () => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [tempMessage, setTempMessage] = useState("");
  const [markdownRendered, setMarkdownRendered] = useState(false);

  const handleMessageChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      onSubmit: (e: React.FormEvent) => Promise<void>,
    ) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isSending && message.trim()) {
          onSubmit(e);
        }
      }
    },
    [isSending, message],
  );

  return {
    message,
    setMessage,
    isSending,
    setIsSending,
    tempMessage,
    setTempMessage,
    markdownRendered,
    setMarkdownRendered,
    handleMessageChange,
    handleKeyDown,
  };
};
