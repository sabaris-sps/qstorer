import React, { useState, useEffect } from "react";

const COLORS = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#b185db"];

export default function FilterModal({
  isOpen,
  onClose,
  currentFilter,
  onApply,
}) {
  const [textInput, setTextInput] = useState("");
  const [selectedColors, setSelectedColors] = useState([]);
  const [tagQuery, setTagQuery] = useState("");
  useEffect(() => {
    if (isOpen) {
      setTextInput(currentFilter.numberText || "");
      setSelectedColors(currentFilter.colors || []);
      setTagQuery(currentFilter.tagQuery || "");
    }
  }, [isOpen, currentFilter]);

  if (!isOpen) return null;

  const toggleColor = (color) => {
    if (selectedColors.includes(color)) {
      setSelectedColors(selectedColors.filter((c) => c !== color));
    } else {
      setSelectedColors([...selectedColors, color]);
    }
  };

  const handleApply = () => {
    onApply({ numberText: textInput, colors: selectedColors, tagQuery });
    onClose();
  };

  const handleClear = () => {
    onApply({ numberText: "", colors: [], tagQuery: "" });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h4>Filter Questions</h4>

        {/* --- NUMBERS --- */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              color: "var(--text-secondary)",
            }}
          >
            By Number Groups (e.g. 1-5, 10)
          </label>
          <input
            type="text"
            placeholder="Leave empty to show all"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        {/* --- TAG QUERY --- */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              marginBottom: 4,
              color: "var(--text-secondary)",
            }}
          >
            By Tags (Boolean Query)
          </label>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              marginBottom: "8px",
              marginTop: 0,
            }}
          >
            Use quotes around tags. Example:{" "}
            <b>("Algebra" or "Geometry") and "Hard"</b>
          </p>
          <input
            type="text"
            placeholder='e.g. ("tag1" or "tag2") and not "tag3"'
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            style={{ width: "100%", padding: "8px", fontFamily: "monospace" }}
          />
        </div>

        {/* --- COLORS --- */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              color: "var(--text-secondary)",
            }}
          >
            By Color Marker
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            {COLORS.map((c) => (
              <div
                key={c}
                onClick={() => toggleColor(c)}
                style={{
                  width: 30,
                  height: 30,
                  backgroundColor: c,
                  borderRadius: 4,
                  cursor: "pointer",
                  border: selectedColors.includes(c)
                    ? "2px solid white"
                    : "2px solid transparent",
                  opacity: selectedColors.includes(c) ? 1 : 0.4,
                  transform: selectedColors.includes(c)
                    ? "scale(1.1)"
                    : "scale(1)",
                  transition: "all 0.2s",
                }}
                title={
                  selectedColors.includes(c) ? "Selected" : "Click to filter"
                }
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn-outline-secondary" onClick={handleClear}>
            Clear Filter
          </button>
          <button className="btn-primary" onClick={handleApply}>
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
}
