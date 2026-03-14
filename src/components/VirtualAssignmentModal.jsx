import React, { useState, useEffect, useContext } from "react";
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
  const [commonAssignments, setCommonAssignments] = useState([]);
  const [commonTagQuery, setCommonTagQuery] = useState("");

  // Handles state
  const [handles, setHandles] = useState([
    { chapterId: "", assignmentId: "", numbers: "", colors: [] },
  ]);

  const isEditing = !!existingAssignment;

  const { tags } = useContext(AppContext);

  useEffect(() => {
    if (isOpen) {
      loadAssignmentsForAllChapters();

      // PRE-FILL STATE IF EDITING
      if (existingAssignment) {
        setNewAssignmentName(existingAssignment.name);
        setTargetChapterId(currentChapterId);

        const cfg = existingAssignment.config || {};
        setConfigMode(cfg.mode || "common");

        if (cfg.common) {
          setCommonNumbers(cfg.common.numbers || "");
          setCommonColors(cfg.common.colors || []);
          setCommonTagQuery(cfg.common.tagQuery || "");
          setCommonAssignments(cfg.common.assignments || []);
        }
        if (cfg.handles) {
          setHandles(
            cfg.handles.length > 0
              ? cfg.handles
              : [
                  {
                    chapterId: "",
                    assignmentId: "",
                    numbers: "",
                    colors: [],
                    tagQuery: "",
                  },
                ],
          );
        }
      } else {
        setNewAssignmentName("");
        setTargetChapterId("");
        setConfigMode("common");
        setCommonNumbers("");
        setCommonColors([]);
        setCommonTagQuery("");
        setCommonAssignments([]);
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

    // Check for duplicate names (only if creating OR changing name)
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
          ? commonAssignments.map((a) => ({
              ...a,
              numbers: commonNumbers,
              colors: commonColors,
              tagQuery: commonTagQuery,
            }))
          : handles;

      // 1. Fetch matching questions (Reads isolated to targeted assignments)
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

      // 2. Build the payload including the config state
      const configToSave = {
        mode: configMode,
        common: {
          numbers: commonNumbers,
          colors: commonColors,
          assignments: commonAssignments,
          tagQuery: commonTagQuery,
        },
        handles: handles,
      };

      const payload = {
        name: newAssignmentName.trim(),
        isVirtual: true,
        refs: collectedRefs,
        config: configToSave, // <-- Preserving conditions
      };

      // 3. Update or Add
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width: "500px", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4>{isEditing ? "Update Filtered View" : "Create Filtered View"}</h4>
        <div style={{ marginBottom: 8, display: "flex", gap: "5px" }}>
          <label style={{ alignSelf: "center" }}>View Name</label>
          <input
            type="text"
            className="form-control modal-input"
            value={newAssignmentName}
            onChange={(e) => setNewAssignmentName(e.target.value)}
            placeholder="Revision Questions"
          />
        </div>

        <div style={{ marginBottom: 8, display: "flex", gap: "5px" }}>
          <label style={{ alignSelf: "center" }}>Save Under Chapter</label>
          <select
            className="form-control"
            value={targetChapterId}
            onChange={(e) => setTargetChapterId(e.target.value)}
            disabled={isEditing}
            style={{ padding: "5px" }}
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
          {isEditing && (
            <small style={{ color: "#888" }}>
              Chapter cannot be changed while updating.
            </small>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
          <button
            className={`btn-sm ${configMode === "common" ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setConfigMode("common")}
          >
            Common Condition
          </button>
          <button
            className={`btn-sm ${configMode === "handles" ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setConfigMode("handles")}
          >
            Per Assignment (Handles)
          </button>
        </div>

        <hr />

        {configMode === "common" ? (
          <div>
            <div
              style={{
                marginBottom: 15,
                display: "flex",
                gap: "5px",
                alignContent: "center",
              }}
            >
              <label style={{ alignSelf: "center" }}>Common Numbers</label>
              <input
                type="text"
                placeholder="1-5, 10"
                className="form-control modal-input"
                value={commonNumbers}
                onChange={(e) => setCommonNumbers(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label>Common Colors</label>
              {renderColorPicker(commonColors, setCommonColors)}
            </div>

            <div style={{ marginBottom: 15 }}>
              <label>Common Tag Query</label>
              <input
                type="text"
                className="form-control modal-input"
                placeholder='("Algebra" or "Trig") and ("PnC" and "Calculus)'
                value={commonTagQuery}
                onChange={(e) => setCommonTagQuery(e.target.value)}
              />
            </div>

            <label>Include Assignments:</label>
            {commonAssignments.map((ca, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select
                  value={ca.chapterId}
                  onChange={(e) => {
                    const newAsg = [...commonAssignments];
                    newAsg[i].chapterId = e.target.value;
                    newAsg[i].assignmentId = "";
                    setCommonAssignments(newAsg);
                  }}
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
                  value={ca.assignmentId}
                  onChange={(e) => {
                    const newAsg = [...commonAssignments];
                    newAsg[i].assignmentId = e.target.value;
                    setCommonAssignments(newAsg);
                  }}
                >
                  <option value="">Asgn</option>
                  {(assignmentsByChapter[ca.chapterId] || [])
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
                    setCommonAssignments(
                      commonAssignments.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn-outline-primary btn-sm"
              onClick={() =>
                setCommonAssignments([
                  ...commonAssignments,
                  { chapterId: "", assignmentId: "" },
                ])
              }
            >
              + Add Assignment
            </button>
          </div>
        ) : (
          <div>
            <label>Handles:</label>
            {handles.map((h, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid #eee",
                  padding: 10,
                  marginBottom: 10,
                  borderRadius: 5,
                }}
              >
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select
                    value={h.chapterId}
                    onChange={(e) => {
                      const newH = [...handles];
                      newH[i].chapterId = e.target.value;
                      newH[i].assignmentId = "";
                      setHandles(newH);
                    }}
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
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="1-5, 10"
                  className="form-control modal-input"
                  style={{ marginRight: "2px" }}
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
                  value={h.tagQuery}
                  onChange={(e) => {
                    const newH = [...handles];
                    newH[i].tagQuery = e.target.value;
                    setHandles(newH);
                  }}
                />
                {renderColorPicker(h.colors, (newColors) => {
                  const newH = [...handles];
                  newH[i].colors = newColors;
                  setHandles(newH);
                })}
              </div>
            ))}
            <button
              className="btn-outline-primary btn-sm"
              onClick={() =>
                setHandles([
                  ...handles,
                  { chapterId: "", assignmentId: "", numbers: "", colors: [] },
                ])
              }
            >
              + Add Handle
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button className="btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-success"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : isEditing ? "Update View" : "Create View"}
          </button>
        </div>
      </div>
    </div>
  );
}
