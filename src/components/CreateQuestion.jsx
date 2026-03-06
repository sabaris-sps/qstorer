import { useState } from "react";
import ImageInput from "../ui/InputImage";

export default function CreateQuestion({
  handleCreateQuestion,
  newNoteText,
  setNewNoteText,
  newFiles,
  setNewFiles,
  setMode,
}) {
  const [isBulkMode, setIsBulkMode] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isBulkMode && newFiles && newFiles.length > 0) {
      handleCreateQuestion(e, newFiles, true);
    } else {
      handleCreateQuestion(e, null, false);
    }
  };

  return (
    <div className="form-page">
      <h2>{isBulkMode ? "Bulk Upload Questions" : "Create Question"}</h2>

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
        {!isBulkMode && (
          <>
            <label style={{ fontWeight: "bold" }}>Note</label>
            <textarea
              id="new-question-note"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Enter question details or paste an image..."
            />
          </>
        )}

        <div style={{ marginTop: isBulkMode ? 0 : 15, marginBottom: 15 }}>
          {/* Files are sorted/reordered inside this component */}
          <ImageInput files={newFiles} setFiles={setNewFiles} />

          {isBulkMode && newFiles?.length > 0 && (
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                marginTop: 8,
              }}
            >
              Will create <strong>{newFiles.length}</strong> separate questions
              in the order shown above.
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
