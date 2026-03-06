import ImageInput from "../ui/InputImage";
import { PhotoProvider, PhotoView } from "react-photo-view";

export default function QuestionCard({
  activeQuestion,
  handleDeleteQuestion,
  moveOpen,
  setMoveOpen,
  moveTab,
  setMoveTab,
  moveTargetChapter,
  setMoveTargetChapter,
  setMoveTargetAssignment,
  assignmentsByChapter,
  loadAssignmentsForAllChapters,
  chapters,
  moveTargetAssignment,
  handleMoveQuestion,
  moveLoading,
  bulkNumbersInput,
  handleBulkMoveByNumbers,
  setBulkNumbersInput,
  bulkByNumbersLoading,
  photoIndex,
  setPhotoIndex,
  photoViewerVisible,
  setPhotoViewerVisible,
  handleDeleteImage,
  noteEdit,
  setNoteEdit,
  saveNoteBtn,
  moreFiles,
  setMoreFiles,
  handleUploadMoreImages,
  uploadImagesBtn,
  handleSaveNote,
  showToast,
  selectedChapter,
  selectedAssignment,
}) {
  function openMoveUI() {
    if (!activeQuestion) {
      showToast("Select a question first", "error");
      return;
    }
    setMoveOpen(true);
    setMoveTargetChapter(selectedChapter || "");
    setMoveTargetAssignment(selectedAssignment || "");
    loadAssignmentsForAllChapters();
  }
  return (
    <div className="question-card">
      <div className="qhead">
        <h3>Question {activeQuestion.number}</h3>
        <div>
          <button
            className="btn-danger btn-sm"
            onClick={() => handleDeleteQuestion(activeQuestion.id)}
          >
            Delete Question
          </button>

          {/* MOVE BUTTON triggers popup */}
          <button
            className="btn-outline-primary btn-sm"
            onClick={openMoveUI}
            style={{ marginLeft: 8 }}
          >
            Move
          </button>
        </div>
      </div>

      {/* Move POPUP (modal) */}
      {moveOpen && (
        <div className="modal-backdrop" onClick={() => setMoveOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h4 style={{ margin: 0 }}>Move Question</h4>

              {/* simple tab buttons */}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  className={`btn-outline-primary btn-sm ${
                    moveTab === "move" ? "active" : ""
                  }`}
                  onClick={() => setMoveTab("move")}
                >
                  Move
                </button>
                <button
                  className={`btn-outline-primary btn-sm ${
                    moveTab === "bulk" ? "active" : ""
                  }`}
                  onClick={() => setMoveTab("bulk")}
                >
                  Bulk Move
                </button>
              </div>
            </div>

            <p style={{ marginTop: 6, color: "#555" }}>
              {moveTab === "move"
                ? "Choose destination chapter and assignment"
                : "Enter comma-separated question numbers from the current assignment"}
            </p>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <select
                  value={moveTargetChapter}
                  onChange={async (e) => {
                    const chapId = e.target.value;
                    setMoveTargetChapter(chapId);
                    setMoveTargetAssignment("");
                    if (!assignmentsByChapter[chapId]) {
                      const map = await loadAssignmentsForAllChapters();
                      if (map[chapId] && map[chapId].length > 0) {
                        setMoveTargetAssignment(map[chapId][0].id);
                      }
                    } else {
                      if (
                        assignmentsByChapter[chapId] &&
                        assignmentsByChapter[chapId].length > 0
                      ) {
                        setMoveTargetAssignment(
                          assignmentsByChapter[chapId][0].id,
                        );
                      }
                    }
                  }}
                >
                  <option value="">Select chapter</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={moveTargetAssignment}
                  onChange={(e) => setMoveTargetAssignment(e.target.value)}
                >
                  <option value="">Select assignment</option>
                  {(assignmentsByChapter[moveTargetChapter] || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "end",
                  width: "100%",
                }}
              >
                {/* tab-specific controls */}
                {moveTab === "move" ? (
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <button
                      className="btn-primary" // Main action
                      onClick={handleMoveQuestion}
                      disabled={moveLoading}
                    >
                      {moveLoading ? "Moving..." : "Move"}
                    </button>
                    <button
                      className="btn-outline-secondary"
                      onClick={() => {
                        setMoveOpen(false);
                        setMoveTargetAssignment("");
                        setMoveTargetChapter("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="(e.g. 19, 12, 7, 2-5, 3 - 9)"
                      value={bulkNumbersInput}
                      onChange={(e) => setBulkNumbersInput(e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        minWidth: 160,
                      }}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleBulkMoveByNumbers}
                      disabled={bulkByNumbersLoading}
                    >
                      {bulkByNumbersLoading ? "Moving..." : "Move"}
                    </button>
                    <button
                      className="btn-outline-secondary"
                      onClick={() => {
                        setMoveOpen(false);
                        setBulkNumbersInput("");
                        setMoveTargetAssignment("");
                        setMoveTargetChapter("");
                        setMoveTab("move");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
              {moveTab === "move"
                ? "The question's note and images will be copied to the destination and removed from the current assignment. Numbers in both assignments will be re-ordered."
                : "Numbers that don't exist in the current assignment will be reported and prevent the move. Matching questions will be moved in ascending-number order and appended to the destination."}
            </div>
          </div>
        </div>
      )}
      {activeQuestion?.images?.length > 0 && (
        <div className="photo-nav-helper">
          <button
            className="ghost-btn"
            disabled={photoIndex === 0}
            onClick={() => setPhotoIndex((prev) => prev - 1)}
          >
            Previous Image
          </button>
          <h5>
            Showing {photoIndex + 1}/{activeQuestion.images?.length || 0}
          </h5>
          <button
            className="ghost-btn"
            disabled={photoIndex + 1 === (activeQuestion.images?.length || 0)}
            onClick={() => setPhotoIndex((prev) => prev + 1)}
          >
            Next Image
          </button>
        </div>
      )}
      <PhotoProvider
        key={activeQuestion.id}
        pullClosable={true}
        maskClosable={true}
        index={photoIndex}
        visible={photoViewerVisible}
        onVisibleChange={setPhotoViewerVisible}
        onIndexChange={setPhotoIndex}
        toolbarRender={() => {
          return (
            <>
              <button className="btn-danger" onClick={handleDeleteImage}>
                Delete
              </button>
            </>
          );
        }}
      >
        <div className="foo">
          {(activeQuestion.images || []).map((img_url, index) => (
            <PhotoView key={index} src={img_url}>
              <img
                src={img_url}
                alt=""
                className={`thumbnail ${
                  index === photoIndex ? "fill" : "invisible"
                }`}
              />
            </PhotoView>
          ))}
        </div>
      </PhotoProvider>

      <div className="note-section">
        <label>Note</label>
        <textarea
          value={noteEdit}
          onChange={(e) => setNoteEdit(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {saveNoteBtn ? (
            <button className="btn-success" onClick={handleSaveNote}>
              {" "}
              {/* Use SUCCESS for saving */}
              Save Note
            </button>
          ) : (
            <button
              className="btn-primary"
              style={{ cursor: "no-drop" }}
              disabled
            >
              Loading...
            </button>
          )}
        </div>
      </div>

      <div className="upload-more">
        <label>Upload More Images</label>

        <ImageInput files={moreFiles} setFiles={setMoreFiles} />

        <div style={{ marginTop: 8 }}>
          {uploadImagesBtn ? (
            <button
              className="btn-primary btn-sm"
              onClick={handleUploadMoreImages}
              disabled={moreFiles?.length === 0}
            >
              Upload & Append
            </button>
          ) : (
            <button
              className="btn-primary btn-sm"
              style={{ cursor: "no-drop" }}
              disabled
            >
              Loading...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
