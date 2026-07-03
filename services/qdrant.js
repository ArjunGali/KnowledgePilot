/**
 * services/qdrant.js
 * ------------------
 * Central access point for the Qdrant vector store.
 *
 * Why this exists:
 *  - The Qdrant URL and collection name were previously hardcoded in three
 *    different files. Keeping them here (with env overrides) means ingestion
 *    and retrieval can never point at different collections by accident.
 *  - Always pairs Qdrant with the shared LOCAL embeddings service, fixing a
 *    previous bug where ingestion used 768-dim cloud embeddings while the
 *    server queried with 384-dim local embeddings (dimension mismatch).
 */

import "dotenv/config";
import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { embeddings } from "./embeddings.js";

/** Qdrant connection settings — overridable via environment variables. */
export const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
export const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION || "rag_collection";

/**
 * Connect to the EXISTING collection for retrieval (question answering).
 * Throws a friendly error if Qdrant is unreachable or nothing was ingested.
 *
 * @returns {Promise<QdrantVectorStore>}
 */
export async function getVectorStore() {
  try {
    return await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: QDRANT_URL,
      collectionName: COLLECTION_NAME,
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to Qdrant at ${QDRANT_URL} ` +
        `(collection "${COLLECTION_NAME}"). Make sure Qdrant is running ` +
        `(docker run -p 6333:6333 qdrant/qdrant) and a document has been ` +
        `ingested first. Underlying error: ${error.message}`
    );
  }
}

/**
 * Retry a Qdrant operation that fails with a transient network error
 * (ECONNRESET / "fetch failed" / socket hang up). These appear mainly on the
 * first large write of a fresh server run and succeed on a quick retry, so we
 * retry automatically instead of surfacing the failure to the user.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withRetry(fn, attempts = 3, baseDelayMs = 800) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      const detail = `${error?.message ?? ""} ${error?.cause?.message ?? ""}`;
      const transient =
        /ECONNRESET|fetch failed|socket hang up|ETIMEDOUT|ECONNREFUSED/i.test(detail);
      if (!transient || i === attempts - 1) throw error;
      console.warn(
        `[qdrant] transient write error (attempt ${i + 1}/${attempts}) — retrying: ${detail.trim()}`
      );
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
}

/**
 * Write document chunks (already split) into the collection.
 * Used by both the /api/ingest endpoint and the ingest.js CLI. Wrapped in a
 * transient-error retry so the first cold-start write can't fail the upload.
 *
 * @param {import("@langchain/core/documents").Document[]} docs
 * @returns {Promise<QdrantVectorStore>}
 */
export async function ingestDocuments(docs) {
  return withRetry(() =>
    QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: QDRANT_URL,
      collectionName: COLLECTION_NAME,
    })
  );
}

/**
 * Clear the knowledge base by deleting the whole collection. It is recreated
 * automatically on the next ingest (QdrantVectorStore.fromDocuments creates
 * it if missing). Safe to call when the collection does not exist — Qdrant
 * returns 404 for a missing collection, which we treat as "already clear".
 *
 * @returns {Promise<{deleted: boolean}>}
 */
export async function clearCollection() {
  const client = new QdrantClient({ url: QDRANT_URL });
  try {
    await client.deleteCollection(COLLECTION_NAME);
    return { deleted: true };
  } catch (error) {
    // 404 = nothing to delete; anything else is a real failure.
    if (error?.status === 404) return { deleted: false };
    throw new Error(
      `Failed to clear Qdrant collection "${COLLECTION_NAME}": ${error.message}`
    );
  }
}
