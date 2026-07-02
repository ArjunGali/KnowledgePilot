/**
 * services/embeddings.js
 * ----------------------
 * Local embedding service built on HuggingFace Transformers (Xenova).
 *
 * Why this exists:
 *  - Both ingestion (writing vectors) and retrieval (querying vectors) MUST
 *    use the exact same embedding model, otherwise vector dimensions and
 *    semantics won't match and Qdrant search silently degrades or errors.
 *    Centralising the model here guarantees consistency.
 *  - The model runs fully locally (no API key, no network cost) using
 *    "Xenova/all-MiniLM-L6-v2" (384-dimensional sentence embeddings).
 *
 * Exports a single shared `embeddings` instance so the underlying model is
 * loaded at most once per process.
 */

import { Embeddings } from "@langchain/core/embeddings";
import { pipeline } from "@xenova/transformers";

/**
 * LangChain-compatible wrapper around a local Xenova feature-extraction
 * pipeline. Implements the two methods LangChain vector stores require:
 * `embedDocuments` (bulk, used at ingest time) and `embedQuery`
 * (single string, used at question time).
 */
class LocalEmbeddings extends Embeddings {
  constructor() {
    super({});
    // We cache the *promise* (not the resolved pipeline) so that concurrent
    // callers during startup all await the same model load instead of
    // triggering multiple loads (a race in the previous implementation).
    this.pipelinePromise = null;
  }

  /** Lazily load the embedding model on first use. */
  getPipeline() {
    if (!this.pipelinePromise) {
      this.pipelinePromise = pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );
    }
    return this.pipelinePromise;
  }

  /**
   * Embed a batch of document chunks (used during ingestion).
   * @param {string[]} documents - plain-text chunks
   * @returns {Promise<number[][]>} one 384-dim vector per chunk
   */
  async embedDocuments(documents) {
    const pipe = await this.getPipeline();
    const results = await Promise.all(
      documents.map((text) => pipe(text, { pooling: "mean", normalize: true }))
    );
    return results.map((res) => Array.from(res.data));
  }

  /**
   * Embed a single query string (used at retrieval time).
   * @param {string} document - the user's question
   * @returns {Promise<number[]>} a single 384-dim vector
   */
  async embedQuery(document) {
    const pipe = await this.getPipeline();
    const res = await pipe(document, { pooling: "mean", normalize: true });
    return Array.from(res.data);
  }
}

/** Shared singleton — import this everywhere embeddings are needed. */
export const embeddings = new LocalEmbeddings();
