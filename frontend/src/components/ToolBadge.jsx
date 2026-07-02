/**
 * components/ToolBadge.jsx
 * -----------------------
 * Small coloured pill showing which tool produced an answer.
 * Colour + label + emoji come from the shared tool metadata.
 */

import React from "react";
import { toolMeta } from "../lib/tools.js";

function ToolBadge({ tool }) {
  const { label, emoji, color } = toolMeta(tool);
  return (
    <span className="tool-badge" style={{ "--badge-color": color }}>
      <span className="tool-badge__emoji">{emoji}</span>
      {label}
    </span>
  );
}

// Memoised: a badge only depends on its `tool` string.
export default React.memo(ToolBadge);
