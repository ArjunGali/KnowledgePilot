/**
 * lib/tools.js
 * ------------
 * Display metadata for each agent tool — one place that maps a backend tool
 * id to its badge label, emoji and colour. Used by tool badges, planner
 * details and the demo-mode timeline so nothing is hardcoded twice.
 */

export const TOOLS = {
  document: { label: "Document Search", emoji: "📄", color: "#3b82f6" },
  calculator: { label: "Calculator", emoji: "🧮", color: "#22c55e" },
  date: { label: "Date & Time", emoji: "📅", color: "#f59e0b" },
  web: { label: "Web Search", emoji: "🌐", color: "#a855f7" },
};

/** Safe lookup with a sensible fallback for unknown tool ids. */
export function toolMeta(id) {
  return TOOLS[id] || { label: id || "Agent", emoji: "🤖", color: "#9a9aa5" };
}
