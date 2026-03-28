import React, { useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

export default function NoteEditor({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
}) {
  const [activeTab, setActiveTab] = useState("preview");

  return (
    <div
      className={`note-editor ${disabled ? "disabled" : ""}`}
      style={{ opacity: disabled ? 0.7 : 1, pointerEvents: disabled ? "none" : "auto" }}
    >
      <div className="note-tabs">
        <button
          type="button"
          className={`note-tab ${activeTab === "write" ? "active" : ""}`}
          onClick={() => setActiveTab("write")}
          disabled={disabled}
        >
          Write
        </button>
        <button
          type="button"
          className={`note-tab ${activeTab === "preview" ? "active" : ""}`}
          onClick={() => setActiveTab("preview")}
          disabled={disabled}
        >
          Preview
        </button>
      </div>

      <div className="note-content">
        {activeTab === "write" ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.stopPropagation();
              }
            }}
            placeholder={placeholder}
            rows={rows}
            style={{ width: "100%", boxSizing: "border-box" }}
            disabled={disabled}
          />
        ) : (
          <div className="note-preview-area">
            <MarkdownRenderer content={value} />
          </div>
        )}
      </div>
    </div>
  );
}
