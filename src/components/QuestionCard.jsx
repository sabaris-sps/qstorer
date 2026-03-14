import ImageInput from "../ui/InputImage";
import { PhotoProvider, PhotoView } from "react-photo-view";
import React, { useState, useContext } from "react";
import TagInput from "./TagInput";
import { AppContext } from "../App";
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  collection,
  setDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";

const COLORS = [
  "#ef476f", // Red/Pink
  "#ffd166", // Yellow/Gold
  "#06d6a0", // Green
  "#118ab2", // Blue
  "#b185db", // Purple
];

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
  handleUpdateColor,
  isCopyMode,
  setIsCopyMode,
  isVirtual,
  setQuestions, // We need this to update the local state instantly
}) {
  const [showColorTray, setShowColorTray] = useState(false);

  // Bring in Global Tag state from Context
  const { tags, setTags, showTags } = useContext(AppContext);

  function openMoveUI() {
    if (!activeQuestion) {
      showToast("Select a question first", "error");
      return;
    }
    setMoveOpen(true);
    setMoveTargetChapter(selectedChapter || "");
    setMoveTargetAssignment(selectedAssignment || "");
    loadAssignmentsForAllChapters();
    if (setIsCopyMode) setIsCopyMode(false);
  }

  // ==========================================
  // TAG LOGIC
  // ==========================================
  const handleAddTag = async (tagName) => {
    try {
      const uid = auth.currentUser.uid;
      const { chapterId, assignmentId, questionId } =
        activeQuestion.originalPath;
      const questionRef = doc(
        db,
        "users",
        uid,
        "chapters",
        chapterId,
        "assignments",
        assignmentId,
        "questions",
        questionId,
      );

      // Check if tag already exists globally (case insensitive)
      let existingTag = tags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase(),
      );
      let tagIdToUse;

      if (existingTag) {
        tagIdToUse = existingTag.id;
        // Don't add if the question already has it
        if ((activeQuestion.tags || []).includes(tagIdToUse)) return;

        // 1. Update global tag count (+1)
        const tagRef = doc(db, "users", uid, "tags", tagIdToUse);
        await updateDoc(tagRef, { count: increment(1) });

        // Update local tags state to reflect the +1 count
        setTags((prev) =>
          prev.map((t) =>
            t.id === tagIdToUse ? { ...t, count: (t.count || 0) + 1 } : t,
          ),
        );
      } else {
        // Create brand new tag globally
        const newTagRef = doc(collection(db, "users", uid, "tags"));
        tagIdToUse = newTagRef.id;
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

        const newTagObj = { name: tagName, color: randomColor, count: 1 };

        // Use setDoc for brand new documents
        await setDoc(newTagRef, newTagObj);

        // Update local tags state
        setTags((prev) => [...prev, { id: tagIdToUse, ...newTagObj }]);
      }

      // 2. Add tag to the specific Question
      await updateDoc(questionRef, { tags: arrayUnion(tagIdToUse) });

      // 3. Instantly update UI (Local Question State)
      if (setQuestions) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === activeQuestion.id
              ? { ...q, tags: [...(q.tags || []), tagIdToUse] }
              : q,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to add tag:", error);
      showToast("Failed to add tag", "error");
    }
  };

  const handleRemoveTag = async (tagId) => {
    try {
      const uid = auth.currentUser.uid;
      const { chapterId, assignmentId, questionId } =
        activeQuestion.originalPath;

      // 1. Remove from Question
      const questionRef = doc(
        db,
        "users",
        uid,
        "chapters",
        chapterId,
        "assignments",
        assignmentId,
        "questions",
        questionId,
      );
      await updateDoc(questionRef, { tags: arrayRemove(tagId) });

      // 2. Update global tag count (-1)
      const tagRef = doc(db, "users", uid, "tags", tagId);
      await updateDoc(tagRef, { count: increment(-1) });

      // 3. Update local states
      setTags((prev) =>
        prev.map((t) =>
          t.id === tagId ? { ...t, count: Math.max(0, (t.count || 0) - 1) } : t,
        ),
      );

      if (setQuestions) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === activeQuestion.id
              ? { ...q, tags: (q.tags || []).filter((id) => id !== tagId) }
              : q,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to remove tag:", error);
      showToast("Failed to remove tag", "error");
    }
  };

  let sourceChapterName = "Unknown Chapter";
  let sourceAssignmentName = "Unknown Assignment";

  if (isVirtual && activeQuestion?.originalPath) {
    const { chapterId, assignmentId } = activeQuestion.originalPath;
    const sourceChap = chapters?.find((c) => c.id === chapterId);
    if (sourceChap) sourceChapterName = sourceChap.name;
    const sourceAssigns = assignmentsByChapter?.[chapterId] || [];
    const sourceAsg = sourceAssigns.find((a) => a.id === assignmentId);
    if (sourceAsg) sourceAssignmentName = sourceAsg.name;
  }

  return (
    <div className="question-card">
      <div className="qhead">
        <h3>
          Question {activeQuestion.number}
          {isVirtual && (
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: "normal",
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-light)",
                padding: "2px 8px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                marginLeft: "8px",
              }}
            >
              {`(${sourceChapterName} > ${sourceAssignmentName})`}
            </span>
          )}
        </h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            justifyContent: "flex-end",
          }}
        >
          {showTags && (
            <TagInput
              questionTags={activeQuestion.tags || []}
              globalTags={tags}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
            />
          )}

          <div className="color-tray-wrapper">
            <div
              className="color-trigger-btn"
              style={{ backgroundColor: activeQuestion.color || "grey" }}
              onClick={() => setShowColorTray(!showColorTray)}
              title="Color Marker"
            />
            {showColorTray && (
              <div className="color-tray">
                <div
                  className="color-option"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    color: "var(--text-secondary)",
                  }}
                  onClick={() => {
                    handleUpdateColor(null);
                    setShowColorTray(false);
                  }}
                  title="Remove Color"
                >
                  ✕
                </div>
                {COLORS.map((c) => (
                  <div
                    key={c}
                    className="color-option"
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      handleUpdateColor(c);
                      setShowColorTray(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            className="btn-danger btn-sm"
            onClick={() => handleDeleteQuestion(activeQuestion.id)}
          >
            Delete Question
          </button>

          {!isVirtual && (
            <button
              className="btn-outline-primary btn-sm"
              onClick={openMoveUI}
              style={{ marginLeft: 8 }}
            >
              Move/Copy
            </button>
          )}
        </div>
      </div>

      {moveOpen && (
        <div className="modal-backdrop" onClick={() => setMoveOpen(false)}>
          {/* ... Your exact existing move modal code ... */}
          {/* Keep your existing Modal Code here to save space in the response */}
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {/* Same Move modal content as your original code */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h4 style={{ margin: 0 }}>
                {isCopyMode ? "Copy" : "Move"} Question
              </h4>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  className={`btn-outline-primary btn-sm ${
                    moveTab === "move" ? "active" : ""
                  }`}
                  onClick={() => setMoveTab("move")}
                >
                  {isCopyMode ? "Copy" : "Move"}
                </button>
                <button
                  className={`btn-outline-primary btn-sm ${
                    moveTab === "bulk" ? "active" : ""
                  }`}
                  onClick={() => setMoveTab("bulk")}
                >
                  Bulk {isCopyMode ? "Copy" : "Move"}
                </button>
              </div>
            </div>

            <p style={{ marginTop: 6, color: "#555" }}>
              {moveTab === "move"
                ? `Choose destination to ${
                    isCopyMode ? "copy" : "move"
                  } this question`
                : `Enter numbers to ${isCopyMode ? "copy" : "move"}`}
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
                className="toggle-container"
                style={{
                  width: "100%",
                  marginTop: 10,
                  marginBottom: 10,
                  padding: "8px 12px",
                }}
              >
                <span className="toggle-label" style={{ fontSize: "0.9rem" }}>
                  Copy instead of Move?
                </span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={isCopyMode}
                    onChange={(e) => setIsCopyMode(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
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
                  {chapters
                    .sort((a, b) =>
                      a.name.localeCompare(b.name, undefined, {
                        numeric: true,
                        sensitivity: "base",
                      }),
                    )
                    .map((c) => (
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
                  {(assignmentsByChapter[moveTargetChapter] || [])
                    .sort((a, b) =>
                      a.name.localeCompare(b.name, undefined, {
                        numeric: true,
                        sensitivity: "base",
                      }),
                    )
                    .map((a) => (
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
                {moveTab === "move" ? (
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button
                      className="btn-primary"
                      onClick={handleMoveQuestion}
                      disabled={moveLoading}
                    >
                      {moveLoading
                        ? isCopyMode
                          ? "Copying..."
                          : "Moving..."
                        : isCopyMode
                          ? "Copy"
                          : "Move"}
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
                      placeholder="(e.g. 19, 12, 7, 2-5)"
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
                      {bulkByNumbersLoading
                        ? isCopyMode
                          ? "Copying..."
                          : "Moving..."
                        : isCopyMode
                          ? "Copy"
                          : "Move"}
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
                ? isCopyMode
                  ? "The question will be duplicated to the destination. The original remains here."
                  : "The question will be moved to the destination and removed from here."
                : isCopyMode
                  ? "Matching questions will be duplicated to the destination."
                  : "Matching questions will be moved to the destination."}
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
