import React, { useState } from "react"; // Added useState
import { exportQuestionsToPDF } from "../utils";
import ExportModal from "./ExportModal"; // Import the new modal

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
}) {
  const [showExportModal, setShowExportModal] = useState(false);

  // Helper to get current assignment name safely
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

  // Modal Confirm: Actually generate PDF
  const handleConfirmExport = async (fileName, options) => {
    try {
      // Pass the options (includeNotes) to the utility
      await exportQuestionsToPDF(questions, fileName, options);
      showToast("PDF Downloaded");
    } catch (error) {
      console.error("PDF Export failed:", error);
      showToast("Export failed", "error");
    }
  };

  return (
    <>
      {/* Render the Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultName={getCurrentAssignmentName()}
        onExport={handleConfirmExport}
      />

      <div className="selection-bar">
        <div className="sel-item">
          <label>Chap</label>
          <select
            value={selectedChapter || ""}
            onChange={(e) => setSelectedChapter(e.target.value)}
          >
            <option value="">Select Chapter</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sel-item">
          <label>Asgn</label>
          <select
            value={selectedAssignment || ""}
            onChange={(e) => setSelectedAssignment(e.target.value)}
          >
            <option value="">Select Assignment</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sel-actions">
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
            Export PDF
          </button>

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
          {selectedChapter && (
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
              Del Asgn
            </button>
          )}
        </div>
      </div>
    </>
  );
}
