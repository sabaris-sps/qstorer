export default function Sidebar({
  questions,
  activeQuestionId,
  setActiveQuestionId,
  handleSelectQuestion,
  selectedChapter,
  selectedAssignment,
  setMode,
  onOpenFilter,
  canFilter,
  isFilterActive,
  isVirtual,
  isOpen,
}) {
  return (
    <aside className={`left-panel ${isOpen ? "open" : ""}`}>
      {/* Updated Header with Flexbox */}
      <div
        className="qp-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Questions</span>

        {/* Only show Gear if an assignment is selected */}
        {canFilter && (
          <button
            className="icon-btn"
            onClick={onOpenFilter}
            title="Filter Questions"
            style={{
              padding: 4,
              background: "transparent",
              color: isFilterActive
                ? "var(--primary)"
                : "var(--text-secondary)",
            }}
          >
            {/* Simple SVG Gear Icon */}
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
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        )}
      </div>

      <div className="q-grid">
        {questions.map((q) => (
          <button
            key={q.id}
            className={`num-btn ${q.id === activeQuestionId ? "active" : ""}`}
            onClick={() => handleSelectQuestion(q.id)}
          >
            {q.number}
            {q.color && (
              <span
                className="color-dot"
                style={{ backgroundColor: q.color }}
              />
            )}
          </button>
        ))}
        {selectedChapter && selectedAssignment && !isVirtual && (
          <button
            className="num-btn plus"
            onClick={() => {
              setActiveQuestionId(null);
              setMode("create");
            }}
          >
            +
          </button>
        )}
      </div>
    </aside>
  );
}
