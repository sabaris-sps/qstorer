import React, { useState, useRef } from "react";
import { exportQuestionsToPDF } from "../utils";
import ExportModal from "./ExportModal";

export default function SelectionBar({
  selectedChapter,
  setSelectedChapter,
  setSelectedAssignment,
  selectedAssignment,
  assignments,
  chapters,
  loadChaptersForUser,
  setEditTab,
  user,
  handleSelectQuestion,
  setChapterNameEdit,
  setAssignmentNameEdit,
  activeQuestionId,
  setShowEditNamesPopup,
  showToast,
  handleDeleteAssignment,
  handleDeleteChapter,
  questions,
  isVirtual,
  onCreateVirtual,
  onEditVirtual,
  onImportJSON,
  onExportChapter,
  onImportChapterClick,
}) {
  const [showExportModal, setShowExportModal] = useState(false);
  const fileInputRef = useRef(null); // NEW: Reference for the hidden file input

  const getCurrentAssignmentName = () => {
    const assignment = assignments.find((a) => a.id === selectedAssignment);
    return assignment ? assignment.name : "questions";
  };

  const handleExportClick = () => {
    if (!questions || questions.length === 0) {
      showToast("No questions to export", "error");
      return;
    }
    setShowExportModal(true);
  };

  const handleConfirmExport = async (fileName, options) => {
    try {
      if (options.format === "json") {
        // --- JSON EXPORT LOGIC ---
        const dataToExport = questions.map((q, idx) => ({
          number: idx + 1, // Serial order
          note: options.includeNotes ? q.note || "" : "",
          images: q.images || [],
          color: q.color || null,
        }));

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileName}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showToast("JSON Downloaded");
      } else {
        // --- PDF EXPORT LOGIC ---
        await exportQuestionsToPDF(questions, fileName, options);
        showToast("PDF Downloaded");
      }
    } catch (error) {
      console.error("Export failed:", error);
      showToast("Export failed", "error");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImportJSON(file);
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultName={getCurrentAssignmentName()}
        onExport={handleConfirmExport}
      />

      {/* Hidden file input for importing JSON */}
      <input
        type="file"
        accept=".json"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <div className="selection-bar">
        {/* ... KEEP EXISTING CHAPTER/ASSIGNMENT DROPDOWNS HERE ... */}
        <div className="sel-item">
          <label>Chap</label>
          <select
            value={selectedChapter || ""}
            onChange={(e) => setSelectedChapter(e.target.value)}
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

          <button
            className="btn-outline-secondary btn-sm"
            onClick={onImportChapterClick}
            title="Import Chapter JSON"
          >
            Import
          </button>
          {selectedChapter && (
            <button
              className="btn-outline-secondary btn-sm"
              onClick={onExportChapter}
              title="Export Entire Chapter to JSON"
            >
              Export
            </button>
          )}
        </div>

        <div className="sel-item">
          <label>Asgn</label>
          <select
            value={selectedAssignment || ""}
            onChange={(e) => setSelectedAssignment(e.target.value)}
          >
            <option value="">Select Assignment</option>
            {assignments
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

        <div className="sel-actions">
          {!isVirtual && (
            <button
              className="btn-outline-primary btn-sm"
              onClick={onCreateVirtual}
              title="Create a filtered cross-assignment view"
            >
              New View
            </button>
          )}
          {isVirtual && (
            <button
              className="btn-outline-primary btn-sm"
              onClick={onEditVirtual}
              style={{ marginLeft: 8 }}
            >
              Update View
            </button>
          )}
          <button
            className="btn-outline-secondary btn-sm"
            onClick={() => {
              if (user) loadChaptersForUser();
              handleSelectQuestion(activeQuestionId);
            }}
          >
            Reload
          </button>

          {/* Updated Export Button */}
          <button
            className="btn-outline-secondary btn-sm"
            onClick={handleExportClick}
            style={{ marginLeft: "10px" }}
          >
            Export
          </button>

          {/* NEW: Import JSON Button (Only show if not in a virtual view and an assignment is selected) */}
          {!isVirtual && selectedAssignment && (
            <button
              className="btn-outline-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </button>
          )}

          <button
            className="btn-outline-secondary btn-sm"
            onClick={() => {
              setEditTab("chapter");
              setChapterNameEdit(
                chapters.find((c) => c.id === selectedChapter)?.name || "",
              );
              setAssignmentNameEdit(
                assignments.find((a) => a.id === selectedAssignment)?.name ||
                  "",
              );
              if (selectedChapter) setShowEditNamesPopup(true);
              else showToast("No chapter selected", "error");
            }}
          >
            Edit Names
          </button>
          {selectedChapter && !isVirtual && (
            <button
              className="btn-danger btn-sm"
              onClick={() => handleDeleteChapter(selectedChapter)}
            >
              Del Chap
            </button>
          )}
          {selectedAssignment && (
            <button
              className="btn-danger btn-sm"
              onClick={() => handleDeleteAssignment(selectedAssignment)}
            >
              {!isVirtual ? "Del Asgn" : "Del View"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
