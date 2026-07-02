/**
 * services/llm.js
 * ---------------
 * Central factory for chat LLM instances, all routed through OpenRouter.
 *
 * Why this exists:
 *  - The OpenRouter base URL, headers, API key and default model were
 *    previously duplicated in server.js, ask.js and agent/planner.js.
 *    Any config drift between those copies caused subtle bugs.
 *  - Every part of the app (planner, document tool, future tools) now
 *    obtains its LLM from this single factory, so switching models or
 *    providers is a one-line change.
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

/** OpenRouter exposes an OpenAI-compatible API at this base URL. */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * The default chat model. Can be overridden per-environment via
 * OPENROUTER_MODEL without touching code.
 */
export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ||
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

/**
 * Create a ChatOpenAI instance pointed at OpenRouter.
 *
 * @param {object} [options]
 * @param {string} [options.modelName]   - OpenRouter model id (defaults to DEFAULT_MODEL)
 * @param {number} [options.temperature] - sampling temperature (0 = deterministic;
 *                                         the planner uses 0, answering uses 0.2)
 * @returns {ChatOpenAI}
 */
export function createLLM({ modelName = DEFAULT_MODEL, temperature = 0.2 } = {}) {
  if (!process.env.OPENROUTER_API_KEY) {
    // Fail loudly at construction time rather than with a confusing 401 later.
    console.warn(
      "[services/llm] OPENROUTER_API_KEY is not set — LLM calls will fail."
    );
  }

  return new ChatOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        // OpenRouter uses these headers for app attribution / rankings.
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Agentic RAG Assistant",
      },
    },
    modelName,
    temperature,
    // Do NOT retry failed calls. OpenRouter free-tier 429s are daily quotas:
    // retrying cannot succeed and previously hung the UI for ~100s honouring
    // retry-after backoff. Failing fast lets the API return a friendly
    // rate-limit message immediately; transient errors just surface and the
    // user can resend.
    maxRetries: 0,
  });
}

/** Friendly, user-facing text for provider rate limits (no raw API errors). */
export const RATE_LIMIT_MESSAGE =
  "OpenRouter's daily free-model limit has been reached. " +
  "Please add credits, switch to another configured model, or try again after the quota resets.";

/**
 * True when an error (Error object or plain message string) is a provider
 * rate limit — HTTP 429 or a "rate limit" message from OpenRouter/LangChain.
 *
 * @param {unknown} err - Error instance or error-message string
 * @returns {boolean}
 */
export function isRateLimitError(err) {
  const msg = typeof err === "string" ? err : err?.message ?? "";
  return err?.status === 429 || /\b429\b|rate.?limit/i.test(msg);
}
