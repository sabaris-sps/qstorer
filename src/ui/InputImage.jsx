import React, { useEffect, useRef } from "react";
import { FileUploader } from "react-drag-drop-files";

export default function ImageInput({ files, setFiles, disabled = false }) {
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // --- Helper: Natural Sort ---
  const sortFilesByName = (fileList) => {
    return [...fileList].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  };

  // --- 1. Handle "Ctrl+V" (Desktop) ---
  useEffect(() => {
    if (disabled) return;
    const handlePaste = (e) => {
      // Only run this if we have clipboard data in the event (Desktop)
      if (e.clipboardData && e.clipboardData.items) {
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
          setFiles((prev) => sortFilesByName([...prev, ...pastedFiles]));
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [setFiles, disabled]);

  // --- 2. Handle "Paste Button" Click (Tablet/Mobile) ---
  const handleManualPaste = async () => {
    if (disabled) return;
    try {
      // Check if the browser supports reading from clipboard
      if (!navigator.clipboard || !navigator.clipboard.read) {
        alert(
          "Your browser does not support reading images from the clipboard.",
        );
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      const pastedFiles = [];

      for (const item of clipboardItems) {
        // Find image types (png, jpeg, etc.)
        const imageType = item.types.find((type) => type.startsWith("image/"));

        if (imageType) {
          const blob = await item.getType(imageType);
          // Create a file from the blob
          const newFile = new File([blob], `pasted-mobile-${Date.now()}.png`, {
            type: imageType,
          });
          pastedFiles.push(newFile);
        }
      }

      if (pastedFiles.length > 0) {
        setFiles((prev) => sortFilesByName([...prev, ...pastedFiles]));
      } else {
        alert("No image found in clipboard!");
      }
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
      alert("Please allow clipboard permissions to paste images.");
    }
  };

  // --- 3. Drag & Drop Handlers ---
  const handleUploadChange = (newlyAdded) => {
    if (disabled) return;
    setFiles((prev) => sortFilesByName([...prev, ...newlyAdded]));
  };

  const handleRemove = (indexToRemove) => {
    if (disabled) return;
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleSort = () => {
    if (disabled) return;
    let _files = [...files];
    const draggedItemContent = _files.splice(dragItem.current, 1)[0];
    _files.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setFiles(_files);
  };

  return (
    <div
      className="image-input-wrapper"
      style={{
        opacity: disabled ? 0.7 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          width: "100%",
          maxWidth: "508px",
          flexWrap: "wrap",
          gap: "8px"
        }}
      >
        <label style={{ fontWeight: "bold", display: "block", margin: 0 }}>
          Attachments
          <span
            className="attachment-hint"
            style={{
              fontWeight: "normal",
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              marginLeft: 8,
            }}
          >
            (Drag, Drop, or Paste)
          </span>
          <span
            className="attachment-hint-mobile"
            style={{
              fontWeight: "normal",
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              marginLeft: 8,
              display: "none"
            }}
          >
            (Paste)
          </span>
        </label>

        {/* MANUAL PASTE BUTTON FOR TABLETS */}
        <button
          type="button"
          onClick={handleManualPaste}
          className="btn-outline-primary btn-sm"
          style={{ padding: "4px 10px", fontSize: "0.8rem" }}
          disabled={disabled}
        >
          Paste Image
        </button>
      </div>

      <div className="drag-drop-zone">
        <FileUploader
          label="Upload, drop or paste a file"
          handleChange={handleUploadChange}
          name="file-uploader"
          types={["JPG", "PNG", "GIF", "JPEG"]}
          maxSize={10}
          multiple
          disabled={disabled}
        />
      </div>

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
                draggable={!disabled}
                onDragStart={(e) => {
                  if (disabled) return;
                  dragItem.current = index;
                  e.target.style.opacity = "0.5";
                }}
                onDragEnter={(e) => {
                  if (disabled) return;
                  dragOverItem.current = index;
                }}
                onDragEnd={(e) => {
                  if (disabled) return;
                  e.target.style.opacity = "1";
                  handleSort();
                }}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.85rem",
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 4,
                  cursor: disabled ? "default" : "grab",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    maxWidth: "85%",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>☰</span>
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
                  disabled={disabled}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--danger)",
                    cursor: disabled ? "default" : "pointer",
                    fontSize: "1.2rem",
                    padding: "0 5px",
                    opacity: disabled ? 0.5 : 1,
                  }}
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
