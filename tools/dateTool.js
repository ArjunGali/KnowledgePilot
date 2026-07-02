/**
 * tools/dateTool.js
 * -----------------
 * The Date Tool — answers questions about the current date and time.
 * Deliberately LLM-free: this information is deterministic, so calling a
 * model would only add latency and a hallucination risk (LLMs do not know
 * the current time).
 */

/**
 * Report the server's current date and time.
 *
 * @returns {Promise<{tool: string, answer: string, iso: string}>}
 *          `iso` is included as machine-readable metadata for clients.
 */
export async function dateTool() {
  const now = new Date();

  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-US");

  return {
    tool: "date",
    answer: `Today's date is ${date} and the current time is ${time}.`,
    iso: now.toISOString(),
  };
}
