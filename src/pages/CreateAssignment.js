// src/pages/CreateAssignment.js
import React, { useContext, useState } from "react";
import { AppContext } from "../App";
import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function CreateAssignment() {
  const { chapters } = useContext(AppContext);
  const [chapterId, setChapterId] = useState("");
  const [name, setName] = useState("");
  const nav = useNavigate();

  async function handleCreate() {
    if (!chapterId || !name.trim()) return;
    const uid = auth.currentUser.uid;
    await addDoc(
      collection(db, "users", uid, "chapters", chapterId, "assignments"),
      { name }
    );
    setName("");
    nav("/");
  }

  return (
    <div className="form-page center">
      <h2>Create Assignment</h2>
      <select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
        <option value="">Select chapter</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <input
        value={name}
        type="text"
        onChange={(e) => setName(e.target.value)}
        placeholder="Assignment name"
      />
      <div style={{ marginTop: 10 }}>
        <button className="btn-primary" onClick={handleCreate}>
          {" "}
          {/* Main Action */}
          Create Assignment
        </button>
      </div>
    </div>
  );
}
