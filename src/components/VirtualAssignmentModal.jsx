import React, { useState, useEffect, useContext, useRef } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { parseNumberList, evaluateTagQuery } from "../utils";
import { AppContext } from "../App";

const COLORS = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#b185db", "none"];

// --- Helper: Generate a consistent pastel/tint based on a string ---
const getChapterTint = (chapterId) => {
  if (!chapterId) return "var(--bg-dark)";
  let hash = 0;
  for (let i = 0; i < chapterId.length; i++) {
    hash = chapterId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  // 15% opacity tint over the dark background keeps text readable
  return `hsla(${hue}, 70%, 60%, 0.15)`;
};

export default function VirtualAssignmentModal({
  isOpen,
  onClose,
  chapters,
  assignmentsByChapter,
  loadAssignmentsForAllChapters,
  showToast,
  onSuccess,
  existingAssignment,
  currentChapterId,
}) {
  const [configMode, setConfigMode] = useState("common");
  const [targetChapterId, setTargetChapterId] = useState("");
  const [newAssignmentName, setNewAssignmentName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Common condition state
  const [commonNumbers, setCommonNumbers] = useState("");
  const [commonColors, setCommonColors] = useState([]);
  const [commonTagQuery, setCommonTagQuery] = useState("");

  // Unified Handles state
  const [handles, setHandles] = useState([
    { chapterId: "", assignmentId: "", numbers: "", colors: [], tagQuery: "" },
  ]);

  // Bulk add state
  const [bulkChapterId, setBulkChapterId] = useState("");

  const isEditing = !!existingAssignment;
  const { tags } = useContext(AppContext);

  // --- Drag and Drop Refs & Handlers ---
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleSortHandles = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    let _handles = [...handles];
    const draggedItemContent = _handles.splice(dragItem.current, 1)[0];
    _handles.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setHandles(_handles);
  };

  // --- Bulk Add & Clear Handlers ---
  const handleAddFullChapter = () => {
    if (!bulkChapterId) return;

    const assignmentsInChapter = assignmentsByChapter[bulkChapterId] || [];
    const validAssignments = assignmentsInChapter
      .filter((a) => !a.isVirtual)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

    if (validAssignments.length === 0) {
      return showToast(
        "No standard assignments found in this chapter.",
        "error",
      );
    }

    const newHandles = validAssignments.map((a) => ({
      chapterId: bulkChapterId,
      assignmentId: a.id,
      numbers: "",
      colors: [],
      tagQuery: "",
    }));

    // If the only handle is an empty default one, replace it. Otherwise, append.
    if (
      handles.length === 1 &&
      !handles[0].chapterId &&
      !handles[0].assignmentId
    ) {
      setHandles(newHandles);
    } else {
      setHandles([...handles, ...newHandles]);
    }

    setBulkChapterId("");
    showToast(`Added ${newHandles.length} assignments from the chapter.`);
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all assignments from this view?",
      )
    ) {
      setHandles([
        {
          chapterId: "",
          assignmentId: "",
          numbers: "",
          colors: [],
          tagQuery: "",
        },
      ]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAssignmentsForAllChapters();

      if (existingAssignment) {
        setNewAssignmentName(existingAssignment.name);
        setTargetChapterId(currentChapterId);

        const cfg = existingAssignment.config || {};
        const savedMode = cfg.mode || "common";
        setConfigMode(savedMode);

        if (cfg.common) {
          setCommonNumbers(cfg.common.numbers || "");
          setCommonColors(cfg.common.colors || []);
          setCommonTagQuery(cfg.common.tagQuery || "");
        }

        let initialHandles = [];
        if (savedMode === "handles" && cfg.handles && cfg.handles.length > 0) {
          initialHandles = cfg.handles;
        } else if (savedMode === "common") {
          if (
            cfg.common &&
            cfg.common.assignments &&
            cfg.common.assignments.length > 0
          ) {
            initialHandles = cfg.common.assignments.map((a) => ({
              chapterId: a.chapterId || "",
              assignmentId: a.assignmentId || "",
              numbers: "",
              colors: [],
              tagQuery: "",
            }));
          } else if (cfg.handles && cfg.handles.length > 0) {
            initialHandles = cfg.handles;
          } else {
            initialHandles = [
              {
                chapterId: "",
                assignmentId: "",
                numbers: "",
                colors: [],
                tagQuery: "",
              },
            ];
          }
        } else {
          initialHandles = [
            {
              chapterId: "",
              assignmentId: "",
              numbers: "",
              colors: [],
              tagQuery: "",
            },
          ];
        }
        setHandles(initialHandles);
      } else {
        setNewAssignmentName("");
        setTargetChapterId("");
        setConfigMode("common");
        setCommonNumbers("");
        setCommonColors([]);
        setCommonTagQuery("");
        setHandles([
          {
            chapterId: "",
            assignmentId: "",
            numbers: "",
            colors: [],
            tagQuery: "",
          },
        ]);
        setBulkChapterId("");
      }
    }
  }, [isOpen, existingAssignment, currentChapterId]);

  if (!isOpen) return null;

  const toggleColor = (colors, setColors, color) => {
    if (colors.includes(color)) setColors(colors.filter((c) => c !== color));
    else setColors([...colors, color]);
  };

  const handleSave = async () => {
    if (!newAssignmentName.trim() || !targetChapterId) {
      return showToast("Please provide a name and target chapter.", "error");
    }

    const existingAssignments = assignmentsByChapter[targetChapterId] || [];
    const nameExists = existingAssignments.some(
      (a) =>
        a.name.toLowerCase() === newAssignmentName.trim().toLowerCase() &&
        a.id !== existingAssignment?.id,
    );
    if (nameExists) {
      return showToast(
        "An assignment with this name already exists in the selected chapter.",
        "error",
      );
    }

    setIsSaving(true);
    try {
      let collectedRefs = [];
      const targets =
        configMode === "common"
          ? handles.map((h) => ({
              ...h,
              numbers: commonNumbers,
              colors: commonColors,
              tagQuery: commonTagQuery,
            }))
          : handles;

      for (const target of targets) {
        if (!target.chapterId || !target.assignmentId) continue;

        const qSnap = await getDocs(
          collection(
            db,
            "users",
            auth.currentUser.uid,
            "chapters",
            target.chapterId,
            "assignments",
            target.assignmentId,
            "questions",
          ),
        );

        const targetNums = parseNumberList(target.numbers);

        qSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();

          const numMatches =
            targetNums.length === 0 || targetNums.includes(data.number);
          const cColor = data.color || "none";
          const colorMatches =
            target.colors.length === 0 || target.colors.includes(cColor);

          let tagMatches = true;
          if (target.tagQuery) {
            const questionTagNames = (data.tags || [])
              .map((tagId) => tags.find((t) => t.id === tagId)?.name)
              .filter(Boolean);
            tagMatches = evaluateTagQuery(target.tagQuery, questionTagNames);
          }

          if (numMatches && colorMatches && tagMatches) {
            collectedRefs.push({
              chapterId: target.chapterId,
              assignmentId: target.assignmentId,
              questionId: docSnap.id,
            });
          }
        });
      }

      if (collectedRefs.length === 0) {
        setIsSaving(false);
        return showToast(
          "No questions match these filters. Try adjusting them.",
          "error",
        );
      }

      const configToSave = {
        mode: configMode,
        common: {
          numbers: commonNumbers,
          colors: commonColors,
          tagQuery: commonTagQuery,
          assignments: handles.map((h) => ({
            chapterId: h.chapterId,
            assignmentId: h.assignmentId,
          })),
        },
        handles: handles,
      };

      const payload = {
        name: newAssignmentName.trim(),
        isVirtual: true,
        refs: collectedRefs,
        config: configToSave,
      };

      if (isEditing) {
        await updateDoc(
          doc(
            db,
            "users",
            auth.currentUser.uid,
            "chapters",
            targetChapterId,
            "assignments",
            existingAssignment.id,
          ),
          payload,
        );
        showToast(
          `Updated View! Now showing ${collectedRefs.length} questions.`,
        );
      } else {
        await addDoc(
          collection(
            db,
            "users",
            auth.currentUser.uid,
            "chapters",
            targetChapterId,
            "assignments",
          ),
          payload,
        );
        showToast(
          `Created Filtered View with ${collectedRefs.length} questions!`,
        );
      }

      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      showToast("Failed to save view", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const renderColorPicker = (selectedColors, setColors) => (
    <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
      {COLORS.map((c) => (
        <div
          key={c}
          onClick={() => toggleColor(selectedColors, setColors, c)}
          style={{
            width: 30,
            height: 30,
            backgroundColor: c === "none" ? "transparent" : c,
            border: selectedColors.includes(c)
              ? "2px solid #555"
              : "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            opacity: selectedColors.includes(c) ? 1 : 0.4,
          }}
          title={c === "none" ? "No Color" : c}
        >
          {c === "none" && "None"}
        </div>
      ))}
    </div>
  );

  const renderListControls = () => (
    <div
      style={{
        display: "flex",
        gap: "8px",
        marginTop: "15px",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <button
        className="btn-outline-primary btn-sm"
        onClick={() =>
          setHandles([
            ...handles,
            {
              chapterId: "",
              assignmentId: "",
              numbers: "",
              colors: [],
              tagQuery: "",
            },
          ])
        }
      >
        {configMode === "common" ? "+ Add Assignment" : "+ Add Handle"}
      </button>

      <div
        style={{
          borderLeft: "1px solid var(--border-color)",
          height: "20px",
          margin: "0 5px",
        }}
      ></div>

      <select
        value={bulkChapterId}
        onChange={(e) => setBulkChapterId(e.target.value)}
        className="form-control"
        style={{ width: "auto", padding: "4px 8px" }}
      >
        <option value="">Select Chapter...</option>
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

      <button
        className="btn-outline-secondary btn-sm"
        onClick={handleAddFullChapter}
        disabled={!bulkChapterId}
      >
        + Add Full Chapter
      </button>

      {handles.length > 1 && (
        <button
          className="btn-outline-secondary btn-sm"
          onClick={handleClearAll}
          style={{
            marginLeft: "auto",
            color: "var(--danger)",
            borderColor: "var(--danger)",
          }}
        >
          Clear All
        </button>
      )}
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width: "550px", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4>{isEditing ? "Update Filtered View" : "Create Filtered View"}</h4>
        <div style={{ marginBottom: 8, display: "flex", gap: "5px" }}>
          <label style={{ alignSelf: "center", minWidth: "140px" }}>
            View Name
          </label>
          <input
            type="text"
            className="form-control modal-input"
            value={newAssignmentName}
            onChange={(e) => setNewAssignmentName(e.target.value)}
            placeholder="Revision Questions"
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ marginBottom: 15, display: "flex", gap: "5px" }}>
          <label style={{ alignSelf: "center", minWidth: "140px" }}>
            Save Under Chapter
          </label>
          <select
            className="form-control"
            value={targetChapterId}
            onChange={(e) => setTargetChapterId(e.target.value)}
            disabled={isEditing}
            style={{ padding: "5px", flex: 1 }}
          >
            <option value="">Select Chapter</option>
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
        </div>
        {isEditing && (
          <div
            style={{
              marginTop: "-10px",
              marginBottom: "15px",
              textAlign: "right",
            }}
          >
            <small style={{ color: "var(--text-secondary)" }}>
              Chapter cannot be changed while updating.
            </small>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
          <button
            className={`btn-sm ${configMode === "common" ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setConfigMode("common")}
            style={{ flex: 1 }}
          >
            Common Condition
          </button>
          <button
            className={`btn-sm ${configMode === "handles" ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setConfigMode("handles")}
            style={{ flex: 1 }}
          >
            Per Assignment (Handles)
          </button>
        </div>

        <hr style={{ borderColor: "var(--border-color)", margin: "15px 0" }} />

        {configMode === "common" ? (
          <div>
            <div style={{ marginBottom: 15, display: "flex", gap: "5px" }}>
              <label style={{ alignSelf: "center", minWidth: "140px" }}>
                Common Numbers
              </label>
              <input
                type="text"
                placeholder="1-5, 10"
                className="form-control modal-input"
                value={commonNumbers}
                onChange={(e) => setCommonNumbers(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>

            <div style={{ marginBottom: 15, display: "flex", gap: "5px" }}>
              <label style={{ alignSelf: "center", minWidth: "140px" }}>
                Common Tag Query
              </label>
              <input
                type="text"
                className="form-control modal-input"
                placeholder='("Algebra" or "Trig") and ("PnC" or "Calculus")'
                value={commonTagQuery}
                onChange={(e) => setCommonTagQuery(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Common Colors
              </label>
              {renderColorPicker(commonColors, setCommonColors)}
            </div>

            <label style={{ fontWeight: 600, color: "var(--primary)" }}>
              Include Assignments ({handles.length}):
            </label>
            <div style={{ marginTop: "10px" }}>
              {handles.map((h, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    dragItem.current = i;
                    e.currentTarget.style.opacity = "0.5";
                  }}
                  onDragEnter={() => (dragOverItem.current = i)}
                  onDragEnd={(e) => {
                    e.currentTarget.style.opacity = "1";
                    handleSortHandles();
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 6,
                    alignItems: "center",
                    cursor: "grab",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    backgroundColor: getChapterTint(h.chapterId), // Subtle tint application!
                    border: "1px solid var(--border-color)",
                    transition: "transform 0.1s",
                  }}
                >
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      cursor: "grab",
                      userSelect: "none",
                    }}
                  >
                    ☰
                  </span>
                  <select
                    value={h.chapterId}
                    onChange={(e) => {
                      const newH = [...handles];
                      newH[i].chapterId = e.target.value;
                      newH[i].assignmentId = "";
                      setHandles(newH);
                    }}
                    style={{ flex: 1, padding: "4px" }}
                  >
                    <option value="">Chap</option>
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
                    value={h.assignmentId}
                    onChange={(e) => {
                      const newH = [...handles];
                      newH[i].assignmentId = e.target.value;
                      setHandles(newH);
                    }}
                    style={{ flex: 1, padding: "4px" }}
                  >
                    <option value="">Asgn</option>
                    {(assignmentsByChapter[h.chapterId] || [])
                      .sort((a, b) =>
                        a.name.localeCompare(b.name, undefined, {
                          numeric: true,
                          sensitivity: "base",
                        }),
                      )
                      .filter((a) => !a.isVirtual)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() =>
                      setHandles(handles.filter((_, idx) => idx !== i))
                    }
                    style={{ padding: "4px 8px" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {renderListControls()}
          </div>
        ) : (
          <div>
            <label style={{ fontWeight: 600, color: "var(--primary)" }}>
              Assignment Handles ({handles.length}):
            </label>
            <div style={{ marginTop: "10px" }}>
              {handles.map((h, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    dragItem.current = i;
                    e.currentTarget.style.opacity = "0.5";
                  }}
                  onDragEnter={() => (dragOverItem.current = i)}
                  onDragEnd={(e) => {
                    e.currentTarget.style.opacity = "1";
                    handleSortHandles();
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    border: "1px solid var(--border-color)",
                    backgroundColor: getChapterTint(h.chapterId), // Subtle tint application!
                    padding: "8px 10px",
                    marginBottom: "8px",
                    borderRadius: "6px",
                    cursor: "grab",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 8,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        cursor: "grab",
                        userSelect: "none",
                      }}
                    >
                      ☰
                    </span>
                    <select
                      value={h.chapterId}
                      onChange={(e) => {
                        const newH = [...handles];
                        newH[i].chapterId = e.target.value;
                        newH[i].assignmentId = "";
                        setHandles(newH);
                      }}
                      style={{ flex: 1, padding: "4px" }}
                    >
                      <option value="">Chap</option>
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
                      value={h.assignmentId}
                      onChange={(e) => {
                        const newH = [...handles];
                        newH[i].assignmentId = e.target.value;
                        setHandles(newH);
                      }}
                      style={{ flex: 1, padding: "4px" }}
                    >
                      <option value="">Asgn</option>
                      {(assignmentsByChapter[h.chapterId] || [])
                        .sort((a, b) =>
                          a.name.localeCompare(b.name, undefined, {
                            numeric: true,
                            sensitivity: "base",
                          }),
                        )
                        .filter((a) => !a.isVirtual)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() =>
                        setHandles(handles.filter((_, idx) => idx !== i))
                      }
                      style={{ padding: "4px 8px" }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="1-5, 10"
                      className="form-control modal-input"
                      style={{ flex: 0.4, padding: "4px 8px" }}
                      value={h.numbers}
                      onChange={(e) => {
                        const newH = [...handles];
                        newH[i].numbers = e.target.value;
                        setHandles(newH);
                      }}
                    />
                    <input
                      type="text"
                      placeholder='"Math" and "Hard"'
                      className="form-control modal-input"
                      style={{ flex: 0.6, padding: "4px 8px" }}
                      value={h.tagQuery}
                      onChange={(e) => {
                        const newH = [...handles];
                        newH[i].tagQuery = e.target.value;
                        setHandles(newH);
                      }}
                    />
                  </div>
                  <div style={{ marginTop: "4px" }}>
                    {renderColorPicker(h.colors, (newColors) => {
                      const newH = [...handles];
                      newH[i].colors = newColors;
                      setHandles(newH);
                    })}
                  </div>
                </div>
              ))}
            </div>

            {renderListControls()}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 25,
            paddingTop: 15,
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <button className="btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-success"
            onClick={handleSave}
            disabled={isSaving}
            style={{ padding: "8px 20px" }}
          >
            {isSaving ? "Saving..." : isEditing ? "Update View" : "Create View"}
          </button>
        </div>
      </div>
    </div>
  );
}
