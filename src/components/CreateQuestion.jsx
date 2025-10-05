import { FileUploader } from "react-drag-drop-files";

export default function CreateQuestion({
  handleCreateQuestion,
  newNoteText,
  setNewNoteText,
  setNewFiles,
  setMode,
}) {
  return (
    <div className="form-page">
      <h2>Create Question</h2>
      <form onSubmit={handleCreateQuestion}>
        <label style={{ fontWeight: "bold" }}>Note</label>
        <textarea
          id="new-question-note"
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
        />

        <FileUploader
          handleChange={(files) => setNewFiles([...files])}
          name="new-question-files"
          types={["JPG", "PNG", "GIF", "JPEG"]}
          maxSize={10}
          multiple
        />

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="primary" type="submit">
            Add Question
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setMode("view")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
