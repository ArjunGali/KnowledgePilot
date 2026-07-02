/**
 * tools/webSearchTool.js
 * ----------------------
 * The Web Search Tool — live internet search via the Tavily Search API.
 *
 * Feature-gated: enabled only when TAVILY_API_KEY is present in the
 * environment. Without a key the tool degrades gracefully (it returns a
 * clear "not configured" answer instead of crashing), so the rest of the
 * agent keeps working on machines where web search isn't set up.
 *
 * Uses the global fetch available in Node 18+ — no extra SDK dependency.
 */

import "dotenv/config";

/** Tavily's REST search endpoint (OpenAI-style bearer auth). */
const TAVILY_ENDPOINT = "https://api.tavily.com/search";

/** How many results to request from Tavily. */
const MAX_RESULTS = 5;

/**
 * Search the web for the user's query.
 *
 * @param {string} query - the user's natural-language question
 * @returns {Promise<{tool: string, answer: string, results: Array<{title: string, url: string, snippet: string}>}>}
 */
export async function webSearchTool(query) {
  const apiKey = process.env.TAVILY_API_KEY;

  // Graceful fallback when the feature isn't configured.
  if (!apiKey) {
    return {
      tool: "web",
      answer:
        "Web search is not configured on this server. " +
        "Add TAVILY_API_KEY to the .env file to enable live web results.",
      results: [],
    };
  }

  const response = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic", // "basic" is fast + cheap; "advanced" digs deeper
      max_results: MAX_RESULTS,
      include_answer: true, // ask Tavily for a synthesized answer too
    }),
  });

  if (!response.ok) {
    // Bubble a descriptive error up to the executor, which converts it
    // into a structured { status: "error" } result.
    const body = await response.text().catch(() => "");
    throw new Error(`Tavily API returned ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();

  // Normalize Tavily's result shape into our unified tool contract.
  const results = (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }));

  // Prefer Tavily's synthesized answer; otherwise list the top hits.
  const answer =
    data.answer ||
    (results.length
      ? "Top results:\n" +
        results.slice(0, 3).map((r) => `• ${r.title} — ${r.url}`).join("\n")
      : "No web results found for that query.");

  return { tool: "web", answer, results };
}
