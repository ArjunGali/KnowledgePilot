/**
 * lib/api.js
 * ----------
 * Single source of truth for backend calls. Every fetch lives here so the
 * base URL and error handling are never duplicated across components.
 * The backend contract is unchanged and fully backward compatible.
 */

const API_BASE = "http://localhost:3000";

/**
 * Ask the agent a question.
 * @param {string} query - the user's question
 * @param {Array<{role: string, content: string}>} [history] - prior turns
 *        (omitted entirely when session memory is disabled)
 * @returns {Promise<object>} the raw result envelope
 *          { tool, reason, status, executionTimeMs, answer, context? }
 */
export async function ask(query, history) {
  // Only include history when we actually have some — keeps old-style
  // { query } requests on the wire when memory is off.
  const body = history && history.length ? { query, history } : { query };

  const res = await fetch(`${API_BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    // Surface the backend's error text so the UI can show a friendly message.
    throw new Error(data.error || data.details || "Request failed");
  }
  return data;
}

/**
 * Upload and ingest a document.
 * @param {File} file
 * @returns {Promise<{file: string, chunks: number}>}
 */
export async function ingest(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/ingest`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.details || "Upload failed");
  return data;
}

/**
 * Clear the entire knowledge base (Qdrant collection).
 * @returns {Promise<{message: string}>}
 */
export async function clearDocuments() {
  const res = await fetch(`${API_BASE}/api/documents`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.details || "Clear failed");
  return data;
}
