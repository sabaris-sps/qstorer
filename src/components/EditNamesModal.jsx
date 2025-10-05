export default function EditNamesModal({
  editTab,
  selectedAssignment,
  setEditTab,
  showToast,
  chapterNameEdit,
  setChapterNameEdit,
  handleSaveChapterName,
  handleSaveAssignmentName,
  setShowEditNamesPopup,
  assignmentNameEdit,
  setAssignmentNameEdit,
}) {
  return (
    <div className="popup-overlay">
      <div className="popup-box">
        <h2>Edit Names</h2>
        <div className="tab-buttons">
          <button
            className={editTab === "chapter" ? "active-tab" : ""}
            onClick={() =>
              selectedAssignment
                ? setEditTab("chapter")
                : showToast("No chapter selected", "error")
            }
          >
            Edit Chapter Name
          </button>
          <button
            className={editTab === "assignment" ? "active-tab" : ""}
            onClick={() =>
              selectedAssignment
                ? setEditTab("assignment")
                : showToast("No assignment selected", "error")
            }
          >
            Edit Assignment Name
          </button>
        </div>

        {editTab === "chapter" ? (
          <div className="edit-form">
            <label>Chapter Name</label>
            <input
              type="text"
              value={chapterNameEdit}
              onChange={(e) => setChapterNameEdit(e.target.value)}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleSaveChapterName} className="ghost-btn">
                Save Chapter Name
              </button>
              <button
                className="ghost-btn"
                onClick={() => setShowEditNamesPopup(false)}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="edit-form">
            <label>Assignment Name</label>
            <input
              type="text"
              value={assignmentNameEdit}
              onChange={(e) => setAssignmentNameEdit(e.target.value)}
            />
            <div>
              <button className="ghost-btn" onClick={handleSaveAssignmentName}>
                Save Assignment Name
              </button>
              <button
                className="ghost-btn"
                onClick={() => setShowEditNamesPopup(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
