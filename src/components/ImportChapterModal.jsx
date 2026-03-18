import React, { useState, useRef } from "react";

export default function ImportChapterModal({
  isOpen,
  onClose,
  onImport,
  showToast,
}) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [chapterNameEdit, setChapterNameEdit] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        // Basic validation
        if (data.type !== "qstorer_chapter_export" || !data.assignments) {
          throw new Error("Invalid chapter JSON format.");
        }
        setParsedData(data);
        setChapterNameEdit(data.chapterName || "Imported Chapter");
      } catch (err) {
        showToast("Invalid JSON file format.", "error");
        setFile(null);
        setParsedData(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    if (!chapterNameEdit.trim()) {
      showToast("Chapter name cannot be empty", "error");
      return;
    }

    setIsProcessing(true);
    // Pass the overridden name back with the data
    const finalData = { ...parsedData, chapterName: chapterNameEdit.trim() };
    await onImport(finalData);

    // Reset state and close
    setIsProcessing(false);
    setFile(null);
    setParsedData(null);
    setChapterNameEdit("");
    onClose();
  };

  const handleClose = () => {
    if (isProcessing) return;
    setFile(null);
    setParsedData(null);
    setChapterNameEdit("");
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h4>Import Chapter</h4>

        {!parsedData ? (
          <>
            <p style={{ marginBottom: 15, color: "var(--text-secondary)" }}>
              Select a previously exported Chapter JSON file.
            </p>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px dashed var(--border-color)",
                borderRadius: "var(--radius)",
                marginBottom: 20,
              }}
            />
          </>
        ) : (
          <>
            <div
              style={{
                marginBottom: 20,
                padding: 15,
                backgroundColor: "var(--bg-dark)",
                borderRadius: 6,
              }}
            >
              <p style={{ margin: "0 0 10px 0", color: "var(--success)" }}>
                ✓ File parsed successfully
              </p>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                Contains <strong>{parsedData.assignments.length}</strong>{" "}
                assignments.
              </p>
            </div>

            <label
              style={{
                display: "block",
                marginBottom: 8,
                color: "var(--text-secondary)",
              }}
            >
              Import As (Chapter Name)
            </label>
            <input
              type="text"
              value={chapterNameEdit}
              onChange={(e) => setChapterNameEdit(e.target.value)}
              style={{ width: "100%", marginBottom: 20 }}
            />
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn-outline-secondary"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!parsedData || isProcessing}
          >
            {isProcessing ? "Importing..." : "Confirm Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
