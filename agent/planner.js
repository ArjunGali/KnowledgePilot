/**
 * agent/planner.js
 * ----------------
 * The Planner — the "brain" of the agent. It asks the OpenRouter model
 * which single tool should handle the user's query and returns a
 * structured decision:
 *
 *   { tool: "document" | "calculator" | "date" | "web", reason: string }
 *
 * Robustness measures (LLMs don't always follow instructions perfectly):
 *  - temperature 0 for deterministic routing;
 *  - the JSON object is extracted from the response even if the model
 *    wraps it in markdown fences or reasoning text;
 *  - the tool name is validated against a whitelist;
 *  - any failure falls back to "document" (the safest default for a
 *    knowledge assistant) instead of crashing the request.
 *
 * Every decision is logged for debugging and demo purposes.
 */

import { createLLM } from "../services/llm.js";

/** The only tool names the planner is allowed to choose. */
const VALID_TOOLS = ["document", "calculator", "date", "web"];

/** Deterministic routing: temperature 0, same OpenRouter model as the app. */
const plannerLLM = createLLM({ temperature: 0 });

/**
 * Pull the first JSON object that contains a "tool" key out of raw model
 * output. Handles markdown fences, reasoning preambles, etc.
 */
function extractDecision(text) {
  const candidates = text.match(/\{[^{}]*\}/g) ?? [];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed.tool === "string") return parsed;
    } catch {
      // Not valid JSON — try the next candidate.
    }
  }
  return null;
}

/**
 * Decide which tool should handle the query.
 *
 * @param {string} query - the user's natural-language query
 * @returns {Promise<{tool: string, reason: string}>}
 */
export async function plan(query) {
  const startedAt = Date.now();

  const prompt = `You are the planner of an agentic AI knowledge assistant.
Choose exactly ONE tool to handle the user's question.

Available tools:
- "document": answer questions about the ingested documents / knowledge base (default choice)
- "calculator": evaluate a mathematical expression (e.g. "what is 25 * (4 + 3)")
- "date": tell the current date and/or time
- "web": questions about current events or live information from the internet

Respond ONLY with valid JSON, no markdown, in exactly this shape:
{"tool":"document","reason":"one short sentence explaining the choice"}

Question: ${query}`;

  let decision;
  try {
    const response = await plannerLLM.invoke(prompt);
    // content is normally a string; stringify defensively for models that
    // return structured content blocks.
    const text =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const parsed = extractDecision(text);
    if (parsed && VALID_TOOLS.includes(parsed.tool)) {
      decision = {
        tool: parsed.tool,
        reason: parsed.reason || "No reason provided by the planner.",
      };
    } else {
      decision = {
        tool: "document",
        reason: "Planner returned invalid JSON — falling back to document search.",
      };
    }
  } catch (error) {
    // Planner LLM unreachable — degrade to the default tool rather than
    // failing the whole request.
    decision = {
      tool: "document",
      reason: `Planner failed (${error.message}) — falling back to document search.`,
    };
  }

  // Decision log — useful for debugging routing and for live demos.
  console.log(
    `[planner] query="${query}" -> tool=${decision.tool} ` +
      `(${Date.now() - startedAt}ms) reason: ${decision.reason}`
  );

  return decision;
}
