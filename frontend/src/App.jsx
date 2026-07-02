/**
 * App.jsx
 * -------
 * Top-level shell. Composes the three domain hooks (chat, documents,
 * settings) and lays out the sidebar + chat window + settings panel.
 * Deliberately thin: all logic lives in hooks, all markup in components.
 */

import React, { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import { useChat } from "./hooks/useChat.js";
import { useDocuments } from "./hooks/useDocuments.js";
import { useSettings } from "./hooks/useSettings.js";
import "./index.css";

export default function App() {
  const { settings, toggle } = useSettings();
  const { messages, isThinking, send, clearConversation } = useChat();
  const { documents, upload, uploadFile, clearDocuments } = useDocuments();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile off-canvas

  // Send wired to the current memory setting (read at call time).
  const handleSend = useCallback(
    (text) => send(text, settings.memory),
    [send, settings.memory]
  );

  const handleClearDocuments = useCallback(async () => {
    if (!window.confirm("Clear all uploaded documents from the knowledge base?"))
      return;
    try {
      await clearDocuments();
    } catch (err) {
      window.alert(`Could not clear documents: ${err.message}`);
    }
  }, [clearDocuments]);

  const handleClearConversation = useCallback(() => {
    clearConversation();
    setSettingsOpen(false);
  }, [clearConversation]);

  return (
    <div className="app">
      <div className={`sidebar-wrap ${sidebarOpen ? "is-open" : ""}`}>
        <Sidebar
          documents={documents}
          upload={upload}
          onFile={uploadFile}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* Backdrop for the mobile off-canvas sidebar */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <ChatWindow
        messages={messages}
        isThinking={isThinking}
        onSend={handleSend}
        settings={settings}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          toggle={toggle}
          onClose={() => setSettingsOpen(false)}
          onClearConversation={handleClearConversation}
          onClearDocuments={handleClearDocuments}
        />
      )}
    </div>
  );
}
