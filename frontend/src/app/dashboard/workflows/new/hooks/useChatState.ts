import { useState, useRef } from "react";
import { ChatMessage, createInitialChatMessages } from "../constants";

export function useChatState() {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => createInitialChatMessages());
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  const focusChatInput = () => {
    requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
  };

  const applyChatSuggestion = (value: string) => {
    setChatInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return value;
      if (trimmed.endsWith(value)) return trimmed;
      return `${trimmed} ${value}`;
    });
    focusChatInput();
  };

  const applyStarterPrompt = (value: string) => {
    setChatInput(value);
    focusChatInput();
  };

  const resetChat = () => {
    setChatMessages(createInitialChatMessages());
    setSelectedDeliverableId(null);
    setChatInput("");
  };

  return {
    chatInput, setChatInput,
    chatMessages, setChatMessages,
    selectedDeliverableId, setSelectedDeliverableId,
    chatScrollRef,
    chatInputRef,
    focusChatInput,
    applyChatSuggestion,
    applyStarterPrompt,
    resetChat,
  };
}
