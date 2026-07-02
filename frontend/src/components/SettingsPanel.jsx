/**
 * components/SettingsPanel.jsx
 * ---------------------------
 * Slide-over panel with demo controls: toggle planner details, execution
 * timing, memory and demo mode, plus destructive actions to clear the
 * conversation or the uploaded documents.
 */

import React from "react";
import { X, Trash2, Database } from "lucide-react";

/** A single labelled on/off switch. */
function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="setting">
      <div className="setting__info">
        <span className="setting__label">{label}</span>
        {description && <span className="setting__desc">{description}</span>}
      </div>
      <span className={`switch ${checked ? "is-on" : ""}`} onClick={onChange}>
        <span className="switch__knob" />
      </span>
    </label>
  );
}

function SettingsPanel({ settings, toggle, onClose, onClearConversation, onClearDocuments }) {
  return (
    <div className="panel-overlay" onClick={onClose}>
      <aside className="panel" onClick={(e) => e.stopPropagation()}>
        <header className="panel__head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>

        <div className="panel__body">
          <Toggle
            label="Planner details"
            description="Show the tool + reason block on answers"
            checked={settings.showPlanner}
            onChange={() => toggle("showPlanner")}
          />
          <Toggle
            label="Execution timing"
            description="Show how long each tool took"
            checked={settings.showTiming}
            onChange={() => toggle("showTiming")}
          />
          <Toggle
            label="Conversation memory"
            description="Remember earlier messages this session"
            checked={settings.memory}
            onChange={() => toggle("memory")}
          />
          <Toggle
            label="Demo mode"
            description="Animate the agent's reasoning steps"
            checked={settings.demoMode}
            onChange={() => toggle("demoMode")}
          />

          <div className="panel__actions">
            <button className="danger-btn" onClick={onClearConversation}>
              <Trash2 size={16} /> Clear Conversation
            </button>
            <button className="danger-btn" onClick={onClearDocuments}>
              <Database size={16} /> Clear Documents
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default React.memo(SettingsPanel);
