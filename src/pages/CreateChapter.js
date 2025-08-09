import React, { useContext, useState } from "react";
import { AppContext } from "../App";
import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function CreateChapter() {
  const { reloadChapters } = useContext(AppContext);
  const [name, setName] = useState("");
  const nav = useNavigate();

  async function handleCreate() {
    if (!name.trim()) return;
    const uid = auth.currentUser.uid;
    await addDoc(collection(db, "users", uid, "chapters"), { name });
    setName("");
    if (reloadChapters) reloadChapters();
    nav("/");
  }

  return (
    <div className="form-page center">
      <h2>Create Chapter</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Chapter name"
      />
      <div style={{ marginTop: 10 }}>
        <button className="primary" onClick={handleCreate}>
          Create Chapter
        </button>
      </div>
    </div>
  );
}
