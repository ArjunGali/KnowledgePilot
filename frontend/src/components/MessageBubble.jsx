/**
 * components/MessageBubble.jsx
 * ---------------------------
 * Renders one chat message. User messages are a simple accent bubble.
 * Assistant messages add (per settings): the Demo Mode step timeline,
 * a tool badge, execution timing and collapsed planner details. Error
 * messages get a distinct warning style.
 */

import React from "react";
import { User, Bot, AlertTriangle } from "lucide-react";
import ToolBadge from "./ToolBadge.jsx";
import PlannerDetails from "./PlannerDetails.jsx";
import AgentSteps from "./AgentSteps.jsx";

function MessageBubble({ message, settings }) {
  const isUser = message.role === "user";

  // --- User message -------------------------------------------------------
  if (isUser) {
    return (
      <div className="msg msg--user">
        <div className="msg__bubble msg__bubble--user">{message.content}</div>
        <div className="msg__avatar msg__avatar--user">
          <User size={18} />
        </div>
      </div>
    );
  }

  // --- Assistant error message -------------------------------------------
  if (message.error) {
    return (
      <div className="msg msg--assistant">
        <div className="msg__avatar msg__avatar--error">
          <AlertTriangle size={18} />
        </div>
        <div className="msg__bubble msg__bubble--error">{message.content}</div>
      </div>
    );
  }

  // --- Assistant answer ---------------------------------------------------
  return (
    <div className="msg msg--assistant">
      <div className="msg__avatar msg__avatar--bot">
        <Bot size={18} />
      </div>
      <div className="msg__bubble">
        {settings.demoMode && (
          <AgentSteps
            tool={message.tool}
            executionTimeMs={message.executionTimeMs}
            context={message.context}
            animate={message.fresh}
          />
        )}

        <div className="msg__text">{message.content}</div>

        {/* Meta row: tool badge + execution time */}
        <div className="msg__meta">
          {message.tool && <ToolBadge tool={message.tool} />}
          {settings.showTiming && typeof message.executionTimeMs === "number" && (
            <span className="msg__timing">⚡ {message.executionTimeMs} ms</span>
          )}
          {message.tool === "document" && message.context?.length > 0 && (
            <span className="msg__sources">
              {message.context.length} chunks retrieved
            </span>
          )}
        </div>

        {settings.showPlanner && message.tool && (
          <PlannerDetails tool={message.tool} reason={message.reason} />
        )}
      </div>
    </div>
  );
}

/**
 * Re-render only when the message identity or the display settings change.
 * Messages are immutable once created, so a shallow compare of message +
 * the three relevant settings flags is sufficient.
 */
export default React.memo(MessageBubble, (prev, next) => {
  return (
    prev.message === next.message &&
    prev.settings.demoMode === next.settings.demoMode &&
    prev.settings.showTiming === next.settings.showTiming &&
    prev.settings.showPlanner === next.settings.showPlanner
  );
});
