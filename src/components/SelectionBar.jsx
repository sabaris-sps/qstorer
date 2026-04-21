import React, { useState, useRef, useEffect } from "react";
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
  setIsSidebarOpen,
  isSidebarOpen,
}) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Dropdown state
  const [isChooseMenuOpen, setIsChooseMenuOpen] = useState(false); // Mobile 'Choose' dropdown
  const fileInputRef = useRef(null);
  const menuRef = useRef(null); // Ref for click-outside detection
  const chooseMenuRef = useRef(null); // Ref for mobile 'Choose' dropdown

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
      if (
        chooseMenuRef.current &&
        !chooseMenuRef.current.contains(event.target)
      ) {
        setIsChooseMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        const dataToExport = questions.map((q, idx) => ({
          number: idx + 1,
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
        showToast("Generating PDF... please wait.");
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

      <input
        type="file"
        accept=".json"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <div className="selection-bar">
        {/* Hamburger Menu for Mobile Sidebar */}
        <button
          className="hamburger-menu-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle Sidebar"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-primary)",
            cursor: "pointer",
            padding: "8px",
            display: "none", // Hidden by default, shown via CSS on mobile
            marginRight: "10px",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* Mobile 'Choose' Dropdown */}
        <div className="mobile-choose-container" ref={chooseMenuRef}>
          <button
            className="btn-outline-primary btn-sm mobile-choose-btn"
            onClick={() => setIsChooseMenuOpen(!isChooseMenuOpen)}
          >
            Choose ▾
          </button>
          {isChooseMenuOpen && (
            <div className="mobile-choose-dropdown">
              {/* ... existing mobile-choose-dropdown content ... */}
              <div className="mobile-choose-item">
                <label>Chapter</label>
                <select
                  value={selectedChapter || ""}
                  onChange={(e) => {
                    setSelectedChapter(e.target.value);
                  }}
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
              <div className="mobile-choose-item">
                <label>Assignment</label>
                <select
                  value={selectedAssignment || ""}
                  onChange={(e) => {
                    setSelectedAssignment(e.target.value);
                  }}
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
              <div className="dropdown-divider"></div>
              <div className="mobile-choose-actions">
                {!isVirtual && (
                  <button
                    className="btn-outline-primary btn-sm"
                    onClick={() => {
                      onCreateVirtual();
                      setIsChooseMenuOpen(false);
                    }}
                  >
                    New View
                  </button>
                )}
                {isVirtual && (
                  <button
                    className="btn-outline-primary btn-sm"
                    onClick={() => {
                      onEditVirtual();
                      setIsChooseMenuOpen(false);
                    }}
                  >
                    Update View
                  </button>
                )}
                <button
                  className="btn-outline-secondary btn-sm"
                  onClick={() => {
                    if (user) loadChaptersForUser();
                    handleSelectQuestion(activeQuestionId);
                    setIsChooseMenuOpen(false);
                  }}
                >
                  Reload
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Question Navigation Arrows (Mobile) */}
        {activeQuestionId && questions.length > 1 && (
          <div className="mobile-question-nav">
            <button
              className="nav-arrow"
              onClick={() => {
                const currentIndex = questions.findIndex(q => q.id === activeQuestionId);
                if (currentIndex > 0) {
                  handleSelectQuestion(questions[currentIndex - 1].id);
                }
              }}
              disabled={questions.findIndex(q => q.id === activeQuestionId) === 0}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              className="nav-arrow"
              onClick={() => {
                const currentIndex = questions.findIndex(q => q.id === activeQuestionId);
                if (currentIndex < questions.length - 1) {
                  handleSelectQuestion(questions[currentIndex + 1].id);
                }
              }}
              disabled={questions.findIndex(q => q.id === activeQuestionId) === questions.length - 1}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        )}

        {/* Desktop Selection Items */}
        <div className="desktop-selection-items">
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
            {/* Primary Quick Actions */}
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
          </div>
        </div>

        {/* More Options Dropdown (Always visible on selection bar) */}
        <div className="sel-actions-more">
          <div className="dropdown-container" ref={menuRef}>
            <button
              className="btn-outline-secondary btn-sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="More Actions"
              style={{ padding: "6px 10px", marginLeft: "10px" }}
            >
              {/* 3-dot Kebab Icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="1.5"></circle>
                <circle cx="12" cy="5" r="1.5"></circle>
                <circle cx="12" cy="19" r="1.5"></circle>
              </svg>
            </button>
            {/* ... dropdown-menu content same as before ... */}

            {isMenuOpen && (
              <div className="dropdown-menu">
                <button
                  className="dropdown-item"
                  onClick={() => {
                    handleExportClick();
                    setIsMenuOpen(false);
                  }}
                >
                  Export Assignment
                </button>

                {!isVirtual && selectedAssignment && (
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      fileInputRef.current?.click();
                      setIsMenuOpen(false);
                    }}
                    style={{ display: "flex", flexDirection: "column" }}
                  >
                    <p>Import JSON</p>
                    <p>(To current asgn)</p>
                  </button>
                )}
                <hr></hr>
                {selectedChapter && (
                  <button
                    className="dropdown-item"
                    onClick={onExportChapter}
                    title="Export Entire Chapter to JSON"
                  >
                    Export Chapter
                  </button>
                )}
                <button
                  className="dropdown-item"
                  onClick={onImportChapterClick}
                  title="Import Chapter JSON"
                >
                  Import Chapter
                </button>

                <hr></hr>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setEditTab("chapter");
                    setChapterNameEdit(
                      chapters.find((c) => c.id === selectedChapter)?.name ||
                        "",
                    );
                    setAssignmentNameEdit(
                      assignments.find((a) => a.id === selectedAssignment)
                        ?.name || "",
                    );
                    if (selectedChapter) setShowEditNamesPopup(true);
                    else showToast("No chapter selected", "error");
                    setIsMenuOpen(false);
                  }}
                >
                  Edit Names
                </button>

                {/* Divider before destructive actions */}
                {(selectedChapter || selectedAssignment) && (
                  <div className="dropdown-divider"></div>
                )}

                {selectedChapter && !isVirtual && (
                  <button
                    className="dropdown-item danger"
                    onClick={() => {
                      handleDeleteChapter(selectedChapter);
                      setIsMenuOpen(false);
                    }}
                  >
                    Delete Chapter
                  </button>
                )}
                {selectedAssignment && (
                  <button
                    className="dropdown-item danger"
                    onClick={() => {
                      handleDeleteAssignment(selectedAssignment);
                      setIsMenuOpen(false);
                    }}
                  >
                    {!isVirtual ? "Delete Assignment" : "Delete View"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
