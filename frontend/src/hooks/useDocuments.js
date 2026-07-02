/**
 * hooks/useDocuments.js
 * ---------------------
 * Owns the uploaded-document list and the upload lifecycle.
 *
 * The backend ingests in a single request, so the staged progress
 * (Uploading → Chunking → Generating Embeddings → Indexing → Completed) is
 * animated on the client for a modern feel and settles on the real result
 * when the request resolves. The document list is session-scoped
 * (sessionStorage) so names survive a reload but not a browser restart.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "../lib/api.js";

const STORAGE_KEY = "kp_documents";
const ACCEPTED = ["pdf", "docx", "txt", "md"];
const STAGES = ["Uploading...", "Chunking...", "Generating Embeddings...", "Indexing..."];

function loadDocs() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function useDocuments() {
  const [documents, setDocuments] = useState(loadDocs);
  // Transient upload banner: { fileName, stage, error } | null
  const [upload, setUpload] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    } catch {
      /* storage disabled */
    }
  }, [documents]);

  // Clean up the staging interval if the component unmounts mid-upload.
  useEffect(() => () => clearInterval(timerRef.current), []);

  const uploadFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setUpload({ fileName: file.name, stage: null, error: `Unsupported file type ".${ext}". Use PDF, DOCX or TXT.` });
      return;
    }

    // Kick off the animated staging while the real request runs.
    setUpload({ fileName: file.name, stage: STAGES[0], error: null });
    let i = 0;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i = Math.min(i + 1, STAGES.length - 1);
      setUpload((u) => (u && !u.error ? { ...u, stage: STAGES[i] } : u));
    }, 550);

    try {
      const data = await api.ingest(file);
      clearInterval(timerRef.current);
      setUpload({ fileName: data.file, stage: "Completed", error: null });
      // De-dupe by name so re-uploading updates the chunk count.
      setDocuments((prev) => [
        ...prev.filter((d) => d.name !== data.file),
        { name: data.file, chunks: data.chunks },
      ]);
      // Auto-dismiss the "Completed" banner shortly after.
      setTimeout(
        () => setUpload((u) => (u && u.stage === "Completed" ? null : u)),
        2500
      );
    } catch (err) {
      clearInterval(timerRef.current);
      setUpload({ fileName: file.name, stage: null, error: err.message });
    }
  }, []);

  const clearDocuments = useCallback(async () => {
    await api.clearDocuments();
    setDocuments([]);
    setUpload(null);
  }, []);

  return { documents, upload, uploadFile, clearDocuments };
}
