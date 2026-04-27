import React, { useState, useEffect } from "react";

export default function ExportModal({
  isOpen,
  onClose,
  defaultName,
  onExport,
}) {
  const [fileName, setFileName] = useState("");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  const [format, setFormat] = useState("pdf"); // NEW: Track format

  useEffect(() => {
    if (isOpen) {
      setFileName(defaultName || "assignment-export");
      setIncludeNotes(true);
      setIncludeTags(true);
      setFormat("pdf"); // Reset to default
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!fileName.trim()) {
      alert("Please enter a file name");
      return;
    }
    // Pass both name and options (including format)
    onExport(fileName, { includeNotes, includeTags, format });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h4>Export Assignment</h4>

        <label
          style={{
            display: "block",
            marginBottom: 8,
            color: "var(--text-secondary)",
          }}
        >
          File Name
        </label>
        <input
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="Enter file name..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
          }}
          style={{ width: "100%", marginBottom: 20, padding: "10px" }}
        />

        {/* Format Selector */}
        <div style={{ marginBottom: 20, display: "flex", gap: "15px" }}>
          <label
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "large",
            }}
          >
            <input
              type="radio"
              value="pdf"
              checked={format === "pdf"}
              onChange={(e) => setFormat(e.target.value)}
            />
            PDF Document
          </label>
          <label
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "large",
            }}
          >
            <input
              type="radio"
              value="json"
              checked={format === "json"}
              onChange={(e) => setFormat(e.target.value)}
            />
            JSON Data
          </label>
        </div>

        {/* Toggle Switch for Notes */}
        <div className="toggle-container" style={{ marginBottom: 20 }}>
          <span className="toggle-label">Include Notes?</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        {/* Toggle Switch for Tags */}
        <div className="toggle-container" style={{ marginBottom: 20 }}>
          <span className="toggle-label">Include Tags?</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={includeTags}
              onChange={(e) => setIncludeTags(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleConfirm}>
            Export File
          </button>
        </div>
      </div>
    </div>
  );
}
