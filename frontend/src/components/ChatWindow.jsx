/**
 * components/ChatWindow.jsx
 * ------------------------
 * The main chat column: landing/empty state, the scrolling message list
 * with auto-scroll, the "thinking" indicator, and the input bar. Owns only
 * the input's local text state so keystrokes don't re-render the message
 * list.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Menu, Bot } from "lucide-react";
import MessageBubble from "./MessageBubble.jsx";

/** Landing screen shown before the first message. */
function EmptyState() {
  return (
    <div className="empty-state">
      <h1 className="empty-state__title">KnowledgePilot</h1>
      <p className="empty-state__subtitle">Agentic AI Knowledge Assistant</p>
      <p className="empty-state__desc">
        Search documents, browse the web, perform calculations, and answer
        intelligently using AI tools.
      </p>
      <p className="empty-state__cta">Ask me anything.</p>
    </div>
  );
}

/** Animated "thinking" bubble shown while awaiting a response. */
function Thinking() {
  return (
    <div className="msg msg--assistant">
      <div className="msg__avatar msg__avatar--bot">
        <Bot size={18} />
      </div>
      <div className="msg__bubble msg__bubble--thinking">
        <span className="thinking__label">🧠 Thinking</span>
        <span className="dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
      </div>
    </div>
  );
}

function ChatWindow({ messages, isThinking, onSend, settings, onOpenSidebar }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  // Auto-scroll to the newest content.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const submit = useCallback(
    (e) => {
      e.preventDefault();
      if (!text.trim() || isThinking) return;
      onSend(text);
      setText("");
    },
    [text, isThinking, onSend]
  );

  return (
    <main className="chat">
      <header className="chat__header">
        <button className="icon-btn chat__menu" onClick={onOpenSidebar} aria-label="Open menu">
          <Menu size={18} />
        </button>
        <span className="chat__title">KnowledgePilot</span>
      </header>

      <div className="chat__messages">
        {messages.length === 0 && !isThinking ? (
          <EmptyState />
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} settings={settings} />
          ))
        )}
        {isThinking && <Thinking />}
        <div ref={endRef} />
      </div>

      <div className="chat__input-area">
        <form className="composer" onSubmit={submit}>
          <input
            className="composer__input"
            type="text"
            placeholder="Ask me anything…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isThinking}
          />
          <button
            className="composer__send"
            type="submit"
            disabled={!text.trim() || isThinking}
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </main>
  );
}

export default React.memo(ChatWindow);
