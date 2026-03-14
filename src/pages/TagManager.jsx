import React, { useContext, useState } from "react";
import { AppContext } from "../App";
import { auth, db } from "../firebase";
import {
  doc,
  deleteDoc,
  updateDoc,
  collectionGroup,
  getDocs,
  writeBatch,
} from "firebase/firestore";

const PRESET_COLORS = [
  "#ef476f",
  "#ffd166",
  "#06d6a0",
  "#118ab2",
  "#b185db",
  "#ff9f1c",
  "#e71d36",
  "#2ec4b6",
  "#8338ec",
  "#3a86ff",
];

export default function TagManager() {
  const { tags, loadTags } = useContext(AppContext);
  const [editingTag, setEditingTag] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEdit = (tag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || "#118ab2");
  };

  const handleSave = async (tagId) => {
    if (!editName.trim()) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;
      const tagRef = doc(db, "users", uid, "tags", tagId);
      await updateDoc(tagRef, { name: editName, color: editColor });

      await loadTags(uid);
      setEditingTag(null);
    } catch (error) {
      console.error("Failed to update tag", error);
    }
    setLoading(false);
  };

  const handleDelete = async (tagId) => {
    if (
      !window.confirm(
        "Delete this tag globally? This will remove it from all questions.",
      )
    )
      return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;

      // 1. Delete the tag document itself
      await deleteDoc(doc(db, "users", uid, "tags", tagId));

      // 2. Remove this tag from all questions that have it using a Batch and CollectionGroup
      const questionsQuery = collectionGroup(db, "questions");
      const qSnap = await getDocs(questionsQuery);

      const batch = writeBatch(db);
      let batchCount = 0;

      qSnap.docs.forEach((d) => {
        const qData = d.data();
        if (qData.tags && qData.tags.includes(tagId)) {
          // Remove the tagId from the array locally
          const updatedTags = qData.tags.filter((id) => id !== tagId);
          batch.update(d.ref, { tags: updatedTags });
          batchCount++;
        }
      });

      if (batchCount > 0) {
        await batch.commit();
      }

      await loadTags(uid);
    } catch (error) {
      console.error("Failed to delete tag", error);
    }
    setLoading(false);
  };

  return (
    <div className="form-page center" style={{ maxWidth: "600px" }}>
      <h2>Manage Tags</h2>
      <p
        style={{
          color: "var(--text-secondary)",
          marginBottom: "20px",
          textAlign: "center",
        }}
      >
        View and manage all tags used across your questions.
      </p>

      {tags.length === 0 ? (
        <div className="placeholder">
          No tags created yet. Add them directly from your questions!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {tags.map((tag) => (
            <div
              key={tag.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                backgroundColor: "var(--bg-dark)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius)",
              }}
            >
              {editingTag === tag.id ? (
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flex: 1,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    style={{
                      margin: 0,
                      padding: 0,
                      height: "30px",
                      width: "30px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ margin: 0, padding: "6px 10px", width: "200px" }}
                  />
                </div>
              ) : (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <span
                    style={{
                      backgroundColor: tag.color || "#118ab2",
                      color: "#000",
                      padding: "4px 10px",
                      borderRadius: "5px",
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                    }}
                  >
                    {tag.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    (<b>{tag.count || 0}</b> question
                    {(tag.count || 0) > 1 ? "s" : ""})
                  </span>
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", marginLeft: "15px" }}>
                {editingTag === tag.id ? (
                  <>
                    <button
                      className="btn-success btn-sm"
                      onClick={() => handleSave(tag.id)}
                      disabled={loading}
                    >
                      Save
                    </button>
                    <button
                      className="btn-outline-secondary btn-sm"
                      onClick={() => setEditingTag(null)}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn-outline-primary btn-sm"
                      onClick={() => handleEdit(tag)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => handleDelete(tag.id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
