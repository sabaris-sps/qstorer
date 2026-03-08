import React, { useState, useEffect } from "react";

export default function ExportModal({
  isOpen,
  onClose,
  defaultName,
  onExport,
}) {
  const [fileName, setFileName] = useState("");
  const [includeNotes, setIncludeNotes] = useState(true); // Default to true

  useEffect(() => {
    if (isOpen) {
      setFileName(defaultName || "assignment-export");
      setIncludeNotes(true); // Reset to default on open
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!fileName.trim()) {
      alert("Please enter a file name");
      return;
    }
    // Pass both name and options
    onExport(fileName, { includeNotes });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h4>Export PDF</h4>

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
          style={{ width: "100%", marginBottom: 20 }}
        />

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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleConfirm}>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
