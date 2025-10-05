export default function Sidebar({
  questions,
  activeQuestionId,
  setActiveQuestionId,
  handleSelectQuestion,
  selectedChapter,
  selectedAssignment,
  setMode,
}) {
  return (
    <aside className="left-panel">
      <div className="qp-header">Questions</div>
      <div className="q-grid">
        {questions.map((q) => (
          <button
            key={q.id}
            className={`num-btn ${q.id === activeQuestionId ? "active" : ""}`}
            onClick={() => handleSelectQuestion(q.id)}
          >
            {q.number}
          </button>
        ))}
        {selectedChapter && selectedAssignment && (
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
