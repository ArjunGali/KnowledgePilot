/**
 * agent/executor.js
 * -----------------
 * The Executor — the "hands" of the agent. Given the planner's decision it
 * invokes EXACTLY ONE tool and wraps the outcome in a uniform envelope:
 *
 *   { tool, status: "success" | "error", executionTimeMs, ...toolResult }
 *
 * Design decisions:
 *  - The registry maps planner tool names -> implementations, so adding a
 *    tool is: write the module, add one registry entry, mention it in the
 *    planner prompt. server.js never changes.
 *  - Unknown tool names fall back to "document" (the safest default for a
 *    knowledge assistant) instead of failing the request.
 *  - Tool failures are caught and returned as structured errors with
 *    timing, so the API can always report what was attempted and how long
 *    it took — useful for both debugging and demos.
 */

import { documentTool } from "../tools/documentTool.js";
import { calculatorTool } from "../tools/calculatorTool.js";
import { dateTool } from "../tools/dateTool.js";
import { webSearchTool } from "../tools/webSearchTool.js";

/** Planner tool name -> tool implementation. */
const TOOL_REGISTRY = {
  document: documentTool,
  calculator: calculatorTool,
  date: dateTool,
  web: webSearchTool,
};

/**
 * Execute a single tool for the given query.
 *
 * @param {string} toolName - tool chosen by the planner
 * @param {string} query    - the user's original query (passed verbatim)
 * @param {Array<{role: string, content: string}>} [history] - prior turns;
 *        only the document tool uses it, the others accept and ignore it.
 * @returns {Promise<object>} uniform result envelope (see module header)
 */
export async function execute(toolName, query, history = []) {
  const startedAt = Date.now();

  // Resolve the tool, falling back to document search for unknown names.
  const resolvedName = TOOL_REGISTRY[toolName] ? toolName : "document";
  const tool = TOOL_REGISTRY[resolvedName];

  try {
    // The single tool invocation — exactly one tool runs per request.
    // history is passed to every tool; tools that don't need it ignore it.
    const result = await tool(query, history);
    return {
      tool: resolvedName,
      ...result,
      status: "success",
      executionTimeMs: Date.now() - startedAt,
    };
  } catch (error) {
    // Structured failure: the caller still learns which tool ran, why it
    // failed and how long it took before failing.
    return {
      tool: resolvedName,
      status: "error",
      error: error.message,
      executionTimeMs: Date.now() - startedAt,
    };
  }
}
