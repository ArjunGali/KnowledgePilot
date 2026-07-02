/**
 * components/PlannerDetails.jsx
 * ----------------------------
 * Collapsible block exposing the planner's decision (tool + reason).
 * Collapsed by default, as required.
 */

import React, { useState } from "react";
import { toolMeta } from "../lib/tools.js";

function PlannerDetails({ tool, reason }) {
  const [open, setOpen] = useState(false);
  const { label } = toolMeta(tool);

  return (
    <div className="planner">
      <button
        type="button"
        className="planner__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={`planner__caret ${open ? "is-open" : ""}`}>▶</span>
        Planner Details
      </button>

      {open && (
        <div className="planner__body">
          <div className="planner__row">
            <span className="planner__key">Tool</span>
            <span className="planner__val">{label}</span>
          </div>
          <div className="planner__row">
            <span className="planner__key">Reason</span>
            <span className="planner__val">{reason || "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(PlannerDetails);
