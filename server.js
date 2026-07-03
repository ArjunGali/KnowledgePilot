/**
 * server.js
 * ---------
 * Express entry point for the Agentic AI Knowledge Assistant.
 *
 * Routes:
 *   POST /api/ingest  multipart upload (field "file": PDF/DOCX/TXT/MD) ->
 *                     extract text -> chunk -> embed locally -> store in Qdrant
 *   POST /api/ask     { query } -> planner picks ONE tool -> executor runs it
 *                     -> { answer, context?, tool, reason, status, executionTimeMs }
 *
 * All heavy lifting lives in modules:
 *   agent/planner.js   - decides which tool to use (OpenRouter, JSON output)
 *   agent/executor.js  - runs exactly one tool, adds status + timing
 *   tools/*            - document (RAG), calculator, date, web search
 *   services/*         - shared LLM factory, local embeddings, Qdrant access
 */

import "dotenv/config"; // must load first so every module sees the env vars
import express from "express";
import cors from "cors";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
// NOTE: pdf-parse's root entry runs debug code when imported from ESM
// (module.parent is undefined there), so import the library file directly.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { plan } from "./agent/planner.js";
import { execute } from "./agent/executor.js";
import { ingestDocuments, clearCollection } from "./services/qdrant.js";
import { isRateLimitError, RATE_LIMIT_MESSAGE } from "./services/llm.js";
import { warmUpEmbeddings } from "./services/embeddings.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ------------------------------------------------------------------ */
/* Upload-based ingestion                                              */
/* ------------------------------------------------------------------ */

/** File types we know how to extract text from. */
const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

// Multer buffers uploads to uploads/ under random names; each temp file is
// deleted after its text has been extracted and vectorised.
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB cap
});

/** Chunking parameters (unchanged from the original app). */
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

/**
 * Extract plain text from an uploaded file based on its extension.
 * @param {Express.Multer.File} file
 * @returns {Promise<string>}
 */
async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === ".pdf") {
    // pdf-parse works on a raw buffer.
    const data = await pdfParse(fs.readFileSync(file.path));
    return data.text;
  }
  if (ext === ".docx") {
    // .docx is a zip container — mammoth extracts the raw text. (The old
    // code read it with fs.readFileSync(..., "utf-8"), producing garbage.)
    const { value } = await mammoth.extractRawText({ path: file.path });
    return value;
  }
  // .txt / .md are already plain text.
  return fs.readFileSync(file.path, "utf-8");
}

/**
 * POST /api/ingest — upload one document and add it to the knowledge base.
 * Replaces the previous hardcoded-path ingestion.
 */
app.post("/api/ingest", upload.single("file"), async (req, res) => {
  // Remove the multer temp file no matter how the request ends.
  const cleanup = () =>
    req.file && fs.promises.unlink(req.file.path).catch(() => {});

  try {
    if (!req.file) {
      return res.status(400).json({
        error:
          "No file uploaded. Send multipart/form-data with a 'file' field " +
          `(supported: ${SUPPORTED_EXTENSIONS.join(", ")}).`,
      });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        error: `Unsupported file type "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}.`,
      });
    }

    console.log(`[ingest] extracting text from "${req.file.originalname}"...`);
    const text = await extractText(req.file);
    if (!text.trim()) {
      return res.status(400).json({ error: "No text could be extracted from the file." });
    }

    const docs = await splitter.createDocuments(
      [text],
      // Store the source filename as metadata alongside each chunk.
      [{ source: req.file.originalname }]
    );
    console.log(`[ingest] split "${req.file.originalname}" into ${docs.length} chunks; storing in Qdrant...`);

    await ingestDocuments(docs);

    console.log("[ingest] completed successfully");
    res.json({
      message: "Ingestion completed successfully!",
      file: req.file.originalname,
      chunks: docs.length,
    });
  } catch (error) {
    console.error("[ingest] error:", error);
    res.status(500).json({ error: "Failed to ingest document", details: error.message });
  } finally {
    await cleanup();
  }
});

/* ------------------------------------------------------------------ */
/* Agentic question answering                                          */
/* ------------------------------------------------------------------ */

/**
 * POST /api/ask — the agent loop: plan -> execute exactly one tool ->
 * respond with the answer plus planner/execution metadata.
 */
app.post("/api/ask", async (req, res) => {
  try {
    // `history` is OPTIONAL and backward compatible: old { query } requests
    // still work; new requests may add history: [{ role, content }, ...].
    const { query, history } = req.body;
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "Query is required" });
    }
    const safeHistory = Array.isArray(history) ? history : [];

    // 1. PLAN — ask the LLM which tool should handle this query.
    //    (The planner logs its own decision with timing.)
    const decision = await plan(query);

    // 2. EXECUTE — run exactly one tool; failures come back structured.
    //    History is threaded through (only the document tool consumes it).
    const result = await execute(decision.tool, query, safeHistory);
    console.log(
      `[executor] tool=${result.tool} status=${result.status} (${result.executionTimeMs}ms)`
    );

    // 3. RESPOND — answer (+ retrieved context for the document tool) plus
    //    planner/execution metadata: tool, reason, status, executionTimeMs.
    const payload = { ...result, reason: decision.reason };

    if (result.status === "error") {
      // Provider rate limit inside a tool (e.g. document LLM call) ->
      // friendly 429, never the raw API error text.
      if (isRateLimitError(result.error)) {
        console.warn("[ask] OpenRouter rate limit hit (tool)");
        return res.status(429).json({ ...payload, error: RATE_LIMIT_MESSAGE });
      }
      // Other tool-level failure (e.g. Qdrant down) -> 500 with metadata.
      return res.status(500).json(payload);
    }
    res.json(payload);
  } catch (error) {
    // Rate limit thrown before a tool ran (planner) -> same friendly 429.
    if (isRateLimitError(error)) {
      console.warn("[ask] OpenRouter rate limit hit (planner)");
      return res.status(429).json({ error: RATE_LIMIT_MESSAGE });
    }
    console.error("[ask] error:", error);
    res.status(500).json({ error: "Failed to process query", details: error.message });
  }
});

/**
 * DELETE /api/documents — clear the entire knowledge base (Qdrant collection).
 * The collection is recreated automatically on the next upload.
 */
app.delete("/api/documents", async (_req, res) => {
  try {
    const { deleted } = await clearCollection();
    console.log(`[documents] cleared knowledge base (deleted=${deleted})`);
    res.json({
      message: deleted
        ? "Knowledge base cleared."
        : "Knowledge base was already empty.",
    });
  } catch (error) {
    console.error("[documents] clear error:", error);
    res.status(500).json({ error: "Failed to clear documents", details: error.message });
  }
});

app.listen(port, async () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  // Preload the local embedding model so the FIRST upload/query is fast and
  // the first Qdrant write doesn't get dropped mid-request.
  try {
    console.log("[startup] warming up local embedding model...");
    await warmUpEmbeddings();
    console.log("[startup] embedding model ready.");
  } catch (err) {
    console.warn("[startup] embedding warm-up failed (will load on first use):", err.message);
  }
});
