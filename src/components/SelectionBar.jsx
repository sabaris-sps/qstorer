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
}) {
  return (
    <>
      <div className="selection-bar">
        <div className="sel-item">
          <label>Chapter</label>
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
          <label>Assignment</label>
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
            className="ghost-btn"
            onClick={() => {
              if (user) loadChaptersForUser();
              handleSelectQuestion(activeQuestionId);
            }}
          >
            Reload
          </button>

          <button
            className="ghost-btn"
            onClick={() => {
              setEditTab("chapter");
              setChapterNameEdit(
                chapters.find((c) => c.id === selectedChapter)?.name || ""
              );
              setAssignmentNameEdit(
                assignments.find((a) => a.id === selectedAssignment)?.name || ""
              );
              if (selectedChapter) setShowEditNamesPopup(true);
              else showToast("No chapter selected", "error");
            }}
          >
            Edit Names
          </button>
          {selectedChapter && (
            <button
              className="ghost-btn"
              onClick={() => handleDeleteChapter(selectedChapter)}
            >
              Delete Chapter
            </button>
          )}
          {selectedAssignment && (
            <button
              className="ghost-btn"
              onClick={() => handleDeleteAssignment(selectedAssignment)}
            >
              Delete Assignment
            </button>
          )}
        </div>
      </div>
    </>
  );
}
