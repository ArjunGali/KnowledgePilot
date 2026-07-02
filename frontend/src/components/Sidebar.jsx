/**
 * components/Sidebar.jsx
 * ---------------------
 * Left rail: brand, Knowledge Base (upload), Uploaded Documents list,
 * Settings entry and an About blurb. Presentational — all state comes in
 * as props.
 */

import React from "react";
import { Compass, FileText, Settings, CheckCircle2 } from "lucide-react";
import UploadZone from "./UploadZone.jsx";

function Sidebar({ documents, upload, onFile, onOpenSettings }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Compass size={22} className="brand__icon" />
        <span className="brand__name">KnowledgePilot</span>
      </div>

      {/* Knowledge Base ---------------------------------------------------- */}
      <section className="side-section">
        <h3 className="side-section__title">Knowledge Base</h3>
        <UploadZone upload={upload} onFile={onFile} />
      </section>

      {/* Uploaded Documents ------------------------------------------------ */}
      <section className="side-section side-section--docs">
        <h3 className="side-section__title">Uploaded Documents</h3>
        {documents.length === 0 ? (
          <p className="empty-hint">No documents uploaded.</p>
        ) : (
          <ul className="doc-list">
            {documents.map((doc) => (
              <li key={doc.name} className="doc-item">
                <CheckCircle2 size={15} className="doc-item__check" />
                <FileText size={15} className="doc-item__icon" />
                <span className="doc-item__name" title={doc.name}>
                  {doc.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Footer: Settings + About ----------------------------------------- */}
      <div className="sidebar__footer">
        <button className="side-btn" onClick={onOpenSettings}>
          <Settings size={16} /> Settings
        </button>
        <div className="about">
          <span className="about__title">About</span>
          <p className="about__text">
            An agentic assistant that routes each question to the right tool —
            documents, web, calculator or date — via an LLM planner.
          </p>
        </div>
      </div>
    </aside>
  );
}

export default React.memo(Sidebar);
