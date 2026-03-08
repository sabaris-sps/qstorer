import React, { useState, useEffect } from "react";

// Matches the colors in QuestionCard.jsx
const COLORS = [
  "#ef476f", // Red/Pink
  "#ffd166", // Yellow/Gold
  "#06d6a0", // Green
  "#118ab2", // Blue
  "#b185db", // Purple
];

export default function FilterModal({
  isOpen,
  onClose,
  currentFilter,
  onApply,
}) {
  const [textInput, setTextInput] = useState("");
  const [selectedColors, setSelectedColors] = useState([]);

  // Load current filter into local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTextInput(currentFilter.numberText || "");
      setSelectedColors(currentFilter.colors || []);
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
    onApply({ numberText: textInput, colors: selectedColors });
    onClose();
  };

  const handleClear = () => {
    onApply({ numberText: "", colors: [] });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h4>Filter Questions</h4>

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
          <small
            style={{
              color: "var(--text-secondary)",
              marginTop: 6,
              display: "block",
            }}
          >
            {selectedColors.length === 0
              ? "Showing all colors (no filter applied)"
              : "Showing questions containing ANY of the selected colors"}
          </small>
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
