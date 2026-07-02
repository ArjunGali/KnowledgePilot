/**
 * hooks/useChat.js
 * ----------------
 * Owns the conversation: message list, the send flow, session memory and the
 * "thinking" state. Messages are persisted to sessionStorage so the thread
 * survives a reload but not a browser restart (session-only memory).
 */

import { useState, useEffect, useCallback } from "react";
import * as api from "../lib/api.js";

const STORAGE_KEY = "kp_messages";
/** How many prior turns to send as memory (bounds token usage). */
const HISTORY_LIMIT = 10;

function loadMessages() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/** Turn a raw error message into a friendly, on-brand UI line. */
function friendlyError(message = "") {
  const m = message.toLowerCase();
  if (m.includes("qdrant") || m.includes("collection") || m.includes("ingest"))
    return "No documents uploaded yet. Upload a PDF, DOCX or TXT to start asking questions.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Cannot reach the server. Make sure the backend is running on port 3000.";
  return message || "Something went wrong. Please try again.";
}

export function useChat() {
  const [messages, setMessages] = useState(loadMessages);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* storage disabled */
    }
  }, [messages]);

  /**
   * Send a question. `memoryEnabled` decides whether prior turns are sent.
   */
  const send = useCallback(
    async (text, memoryEnabled) => {
      const query = text.trim();
      if (!query) return;

      // Build history from the CURRENT thread (before adding this turn),
      // excluding error bubbles, capped to the most recent HISTORY_LIMIT.
      const history = memoryEnabled
        ? messages
            .filter((m) => !m.error && m.content)
            .slice(-HISTORY_LIMIT)
            .map((m) => ({ role: m.role, content: m.content }))
        : undefined;

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: query },
      ]);
      setIsThinking(true);

      try {
        const data = await api.ask(query, history);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.answer,
            tool: data.tool,
            reason: data.reason,
            status: data.status,
            executionTimeMs: data.executionTimeMs,
            context: data.context,
            fresh: true, // triggers the one-time agent-step animation
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: friendlyError(err.message),
            error: true,
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [messages]
  );

  const clearConversation = useCallback(() => setMessages([]), []);

  return { messages, isThinking, send, clearConversation };
}
