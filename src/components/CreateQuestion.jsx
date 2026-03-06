import { useState } from "react";
import { FileUploader } from "react-drag-drop-files";

export default function CreateQuestion({
  handleCreateQuestion,
  newNoteText,
  setNewNoteText,
  newFiles, // Received from parent (Home.jsx) to perform sorting
  setNewFiles,
  setMode,
}) {
  const [isBulkMode, setIsBulkMode] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isBulkMode && newFiles && newFiles.length > 0) {
      // 1. Sort files using "Natural Sort" order (e.g., 1, 2, 10 instead of 1, 10, 2)
      const sortedFiles = [...newFiles].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

      // 2. Trigger parent handler with sorted files and bulk flag = true
      // The parent (Home.jsx) needs to accept: (e, bulkFiles, isBulk)
      handleCreateQuestion(e, sortedFiles, true);
    } else {
      // 3. Normal Mode: Pass null for bulkFiles and false for isBulk
      handleCreateQuestion(e, null, false);
    }
  };

  return (
    <div className="form-page">
      <h2>{isBulkMode ? "Bulk Upload Questions" : "Create Question"}</h2>

      {/* --- Toggle Switch for Bulk Mode --- */}
      <div className="toggle-container">
        <span className="toggle-label">Bulk Mode (One Question per Image)</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={isBulkMode}
            onChange={(e) => setIsBulkMode(e.target.checked)}
          />
          <span className="slider"></span>
        </label>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Only show Note input if NOT in Bulk Mode */}
        {!isBulkMode && (
          <>
            <label style={{ fontWeight: "bold" }}>Note</label>
            <textarea
              id="new-question-note"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Enter question details..."
            />
          </>
        )}

        <div style={{ marginTop: isBulkMode ? 0 : 15, marginBottom: 15 }}>
          <label
            style={{ fontWeight: "bold", display: "block", marginBottom: 8 }}
          >
            {isBulkMode
              ? "Upload Images (Will be sorted by filename)"
              : "Attachments"}
          </label>

          <FileUploader
            handleChange={(files) => setNewFiles([...files])}
            name="new-question-files"
            types={["JPG", "PNG", "GIF", "JPEG"]}
            maxSize={10}
            multiple
          />

          {/* Helper text showing how many questions will be created */}
          {isBulkMode && newFiles?.length > 0 && (
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                marginTop: 8,
              }}
            >
              <strong>{newFiles.length}</strong> images selected. This will
              create <strong>{newFiles.length}</strong> separate questions.
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="btn-primary" type="submit">
            {isBulkMode ? "Create All Questions" : "Add Question"}
          </button>
          <button
            type="button"
            className="btn-outline-secondary"
            onClick={() => setMode("view")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
