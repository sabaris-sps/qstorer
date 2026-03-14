import React, { useState, useRef, useEffect } from "react";

export default function TagInput({
  questionTags,
  globalTags,
  onAddTag,
  onRemoveTag,
}) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);

  // Close suggestions if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Map the tag IDs stored on the question to the full tag objects
  const activeTags = (questionTags || [])
    .map((tagId) => globalTags.find((t) => t.id === tagId))
    .filter(Boolean); // Filter out any tags that might have been deleted globally

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    if (val.trim()) {
      // Filter global tags that match the input AND aren't already added to this question
      const filtered = globalTags.filter(
        (t) =>
          t.name.toLowerCase().includes(val.toLowerCase()) &&
          !(questionTags || []).includes(t.id),
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      // If there's an exact match in suggestions, use it. Otherwise, create new.
      const exactMatch = suggestions.find(
        (s) => s.name.toLowerCase() === inputValue.trim().toLowerCase(),
      );

      if (exactMatch) {
        onAddTag(exactMatch.name);
      } else {
        onAddTag(inputValue.trim()); // Will trigger creation of a new tag
      }
      setInputValue("");
      setSuggestions([]);
    } else if (e.key === "Backspace" && !inputValue && activeTags.length > 0) {
      // Remove last tag if backspace is pressed on empty input
      onRemoveTag(activeTags[activeTags.length - 1].id);
    }
  };

  const handleSuggestionClick = (tagName) => {
    onAddTag(tagName);
    setInputValue("");
    setSuggestions([]);
    setIsFocused(true); // Keep focus to add more
  };

  return (
    <div
      className="tag-input-container"
      ref={wrapperRef}
      style={{
        border: isFocused
          ? "1px solid var(--primary)"
          : "1px solid var(--border-color)",
        padding: "4px 8px",
        borderRadius: "var(--radius)",
        backgroundColor: "var(--bg-dark)",
        minHeight: "34px",
        marginRight: "10px",
        flex: 1, // Take up available space next to buttons
        maxWidth: "400px", // Don't let it get too huge on big screens
      }}
      onClick={() => setIsFocused(true)}
    >
      {/* Render selected Tag Pills */}
      {activeTags.map((tag) => (
        <span
          key={tag.id}
          className="tag-pill"
          style={{ backgroundColor: tag.color || "#118ab2" }}
        >
          {tag.name}
          <span
            className="remove-tag"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTag(tag.id);
            }}
          >
            ✕
          </span>
        </span>
      ))}

      {/* The actual text input */}
      <input
        type="text"
        className="tag-input-field"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        placeholder={activeTags.length === 0 ? "Add tags (Enter)..." : ""}
      />

      {/* Auto-complete Dropdown */}
      {isFocused && inputValue.trim() && (
        <div className="tag-suggestions">
          {suggestions.length > 0 ? (
            suggestions.map((s) => (
              <div
                key={s.id}
                className="tag-suggestion-item"
                onClick={() => handleSuggestionClick(s.name)}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    backgroundColor: s.color,
                    borderRadius: "50%",
                    marginRight: "8px",
                  }}
                ></span>
                {s.name}
              </div>
            ))
          ) : (
            <div
              className="tag-suggestion-item"
              onClick={() => handleSuggestionClick(inputValue.trim())}
            >
              Create new tag: <b>"{inputValue.trim()}"</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
