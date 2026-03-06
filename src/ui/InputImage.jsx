import React, { useEffect, useRef } from "react";
import { FileUploader } from "react-drag-drop-files";

export default function ImageInput({ files, setFiles }) {
  // Refs for Drag and Drop tracking
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // --- Helper: Natural Sort Function ---
  const sortFilesByName = (fileList) => {
    return [...fileList].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  };

  // --- 1. Handle Window Paste Events ---
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData.items;
      const pastedFiles = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          const newFile = new File([blob], `pasted-${Date.now()}-${i}.png`, {
            type: blob.type,
          });
          pastedFiles.push(newFile);
        }
      }

      if (pastedFiles.length > 0) {
        // Add new files, THEN sort everything
        setFiles((prev) => sortFilesByName([...prev, ...pastedFiles]));
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [setFiles]);

  // --- 2. Handle Drag & Drop Uploads ---
  const handleUploadChange = (newlyAdded) => {
    // Add new files, THEN sort everything
    setFiles((prev) => sortFilesByName([...prev, ...newlyAdded]));
  };

  // --- 3. Remove File ---
  const handleRemove = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  // --- 4. Manual Reordering Logic ---
  const handleSort = () => {
    // Duplicate items
    let _files = [...files];

    // Remove the dragged item
    const draggedItemContent = _files.splice(dragItem.current, 1)[0];

    // Insert it at the new position
    _files.splice(dragOverItem.current, 0, draggedItemContent);

    // Update state
    dragItem.current = null;
    dragOverItem.current = null;
    setFiles(_files);
  };

  return (
    <div className="image-input-wrapper">
      <label style={{ fontWeight: "bold", display: "block", marginBottom: 8 }}>
        Attachments / Images
        <span
          style={{
            fontWeight: "normal",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            marginLeft: 8,
          }}
        >
          (Drag, Drop, or Ctrl+V to Paste)
        </span>
      </label>

      {/* Third-party Uploader */}
      <FileUploader
        handleChange={handleUploadChange}
        name="file-uploader"
        types={["JPG", "PNG", "GIF", "JPEG"]}
        maxSize={10}
        multiple
      />

      {/* --- Custom File List Preview (Sortable) --- */}
      {files?.length > 0 && (
        <div
          style={{
            marginTop: 15,
            background: "var(--bg-dark)",
            padding: 10,
            borderRadius: "var(--radius)",
            border: "1px solid var(--border-color)",
          }}
        >
          <p
            style={{
              fontSize: "0.9rem",
              marginBottom: 8,
              color: "var(--text-secondary)",
            }}
          >
            Selected Files ({files.length}) -
            <span style={{ fontSize: "0.8rem", marginLeft: 5 }}>
              Drag items to reorder
            </span>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {files.map((file, index) => (
              <div
                key={index}
                draggable
                onDragStart={(e) => {
                  dragItem.current = index;
                  e.target.style.opacity = "0.5"; // Visual feedback
                }}
                onDragEnter={(e) => {
                  dragOverItem.current = index;
                  // Optional: Add visual highlight to target here
                }}
                onDragEnd={(e) => {
                  e.target.style.opacity = "1"; // Reset opacity
                  handleSort();
                }}
                onDragOver={(e) => e.preventDefault()} // Necessary to allow dropping
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.85rem",
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 4,
                  cursor: "grab", // Show grab cursor
                  border: "1px solid transparent",
                  transition: "background 0.2s",
                }}
                className="draggable-item"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    maxWidth: "85%",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>☰</span>{" "}
                  {/* Drag Handle Icon */}
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--text-primary)",
                    }}
                  >
                    {file.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--danger)",
                    cursor: "pointer",
                    padding: 4,
                    lineHeight: 1,
                    fontSize: "1.2rem",
                  }}
                  title="Remove file"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
