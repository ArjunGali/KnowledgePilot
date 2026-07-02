/**
 * components/AgentSteps.jsx
 * ------------------------
 * The Demo Mode timeline. Given a completed result it renders the agent's
 * reasoning steps as a vertical, staggered-animated sequence:
 *
 *   🧠 Thinking → 🔍 Planner selected <tool> → ⚡ Executing
 *   → 📄 Retrieving Context (document tool only) → ✍ Generating Answer
 *   → ✅ Complete
 *
 * Animation is pure CSS: each step's `animation-delay` is derived from its
 * index, so the steps cascade in with no JS timers or re-renders.
 */

import React, { useMemo } from "react";
import { toolMeta } from "../lib/tools.js";

function AgentSteps({ tool, executionTimeMs, context, animate }) {
  const { label } = toolMeta(tool);

  // Build the step list once per result.
  const steps = useMemo(() => {
    const list = [
      { icon: "🧠", text: "Thinking" },
      { icon: "🔍", text: `Planner selected ${label}` },
      { icon: "⚡", text: "Executing" },
    ];
    if (tool === "document" && context?.length) {
      list.push({ icon: "📄", text: `Retrieved ${context.length} relevant chunks` });
    }
    list.push({ icon: "✍️", text: "Generating answer" });
    list.push({ icon: "✅", text: `Complete in ${executionTimeMs} ms` });
    return list;
  }, [tool, label, context, executionTimeMs]);

  return (
    <div className={`agent-steps ${animate ? "is-fresh" : ""}`}>
      {steps.map((s, i) => (
        <div key={i} className="agent-step" style={{ "--i": i }}>
          <span className="agent-step__icon">{s.icon}</span>
          <span className="agent-step__text">{s.text}</span>
        </div>
      ))}
    </div>
  );
}

export default React.memo(AgentSteps);
