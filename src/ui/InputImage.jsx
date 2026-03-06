import React, { useEffect } from "react";
import { FileUploader } from "react-drag-drop-files";

export default function ImageInput({ files, setFiles }) {
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData.items;
      const pastedFiles = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          // Timestamp ensures unique sorting for Bulk Mode
          const newFile = new File([blob], `pasted-${Date.now()}-${i}.png`, {
            type: blob.type,
          });
          pastedFiles.push(newFile);
        }
      }

      if (pastedFiles.length > 0) {
        setFiles((prev) => [...prev, ...pastedFiles]);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [setFiles]);

  // --- 2. Remove File Helper ---
  const handleRemove = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
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
        handleChange={(newlyAdded) =>
          setFiles((prev) => [...prev, ...newlyAdded])
        }
        name="file-uploader"
        types={["JPG", "PNG", "GIF", "JPEG"]}
        maxSize={10}
        multiple
      />

      {/* --- 3. Custom File List Preview --- */}
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
            Selected Files ({files.length}):
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {files.map((file, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.85rem",
                  padding: "6px 10px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 4,
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "85%",
                    color: "var(--text-primary)",
                  }}
                >
                  {file.name}
                </span>
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
                    fontSize: "1.1rem",
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
