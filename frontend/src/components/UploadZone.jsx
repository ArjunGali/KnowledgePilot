/**
 * components/UploadZone.jsx
 * ------------------------
 * Modern upload surface: drag & drop OR click to browse. Shows the staged
 * upload progress (Uploading → Chunking → … → Completed) and inline errors.
 */

import React, { useRef, useState, useCallback } from "react";
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

function UploadZone({ upload, onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const handleFiles = useCallback(
    (files) => {
      const file = files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const busy = upload && upload.stage && upload.stage !== "Completed" && !upload.error;
  const done = upload && upload.stage === "Completed";

  return (
    <div>
      <div
        className={`dropzone ${dragging ? "is-dragging" : ""}`}
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPicker()}
      >
        <UploadCloud size={26} className="dropzone__icon" />
        <p className="dropzone__title">Drop a PDF to begin</p>
        <p className="dropzone__hint">Drag &amp; drop or click to browse</p>
        <p className="dropzone__types">PDF · DOCX · TXT</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
          hidden
        />
      </div>

      {/* Status banner */}
      {upload && (
        <div
          className={`upload-status ${
            upload.error ? "is-error" : done ? "is-done" : "is-busy"
          }`}
        >
          {busy && <Loader2 size={15} className="spin" />}
          {done && <CheckCircle2 size={15} />}
          {upload.error && <AlertTriangle size={15} />}
          <span className="upload-status__text">
            {upload.error
              ? upload.error
              : done
              ? `Indexed “${upload.fileName}” successfully`
              : `${upload.stage} ${upload.fileName}`}
          </span>
        </div>
      )}
    </div>
  );
}

export default React.memo(UploadZone);
