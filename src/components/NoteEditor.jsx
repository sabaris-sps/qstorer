import React, { useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

export default function NoteEditor({ value, onChange, placeholder, rows = 4 }) {
  const [activeTab, setActiveTab] = useState("preview"); // Default to preview as requested

  return (
    <div className="note-editor">
      <div className="note-tabs">
        <button
          type="button"
          className={`note-tab ${activeTab === "write" ? "active" : ""}`}
          onClick={() => setActiveTab("write")}
        >
          Write
        </button>
        <button
          type="button"
          className={`note-tab ${activeTab === "preview" ? "active" : ""}`}
          onClick={() => setActiveTab("preview")}
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
