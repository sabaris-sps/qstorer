import React, { useState, useEffect } from "react";

export default function ExportModal({
  isOpen,
  onClose,
  defaultName,
  onExport,
}) {
  const [fileName, setFileName] = useState("");

  // Update local state when the modal opens or default name changes
  useEffect(() => {
    if (isOpen) {
      setFileName(defaultName || "assignment-export");
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!fileName.trim()) {
      alert("Please enter a file name");
      return;
    }
    onExport(fileName);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h4>Export PDF</h4>
        <p style={{ marginBottom: 12, color: "var(--text-secondary)" }}>
          Enter a name for your PDF file:
        </p>

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
