// src/pages/QuestionView.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { uploadToImgBB } from "../imgbb";

export default function QuestionView() {
  const { chapterId, assignmentId, questionId } = useParams();
  const navigate = useNavigate();

  const [question, setQuestion] = useState(null);
  const [noteEdit, setNoteEdit] = useState("");
  const [newFiles, setNewFiles] = useState([]);

  useEffect(() => {
    loadQuestion();
  }, [chapterId, assignmentId, questionId]);

  async function loadQuestion() {
    const dref = doc(
      db,
      "chapters",
      chapterId,
      "assignments",
      assignmentId,
      "questions",
      questionId
    );
    const snap = await getDoc(dref);
    if (!snap.exists()) {
      setQuestion(null);
      return;
    }
    const data = { id: snap.id, ...snap.data() };
    setQuestion(data);
    setNoteEdit(data.note || "");
  }

  async function handleSaveNote() {
    const dref = doc(
      db,
      "chapters",
      chapterId,
      "assignments",
      assignmentId,
      "questions",
      questionId
    );
    await updateDoc(dref, { note: noteEdit });
    await loadQuestion();
  }

  async function handleUploadMore() {
    if (!newFiles.length) return;
    const urls = [];
    for (const f of newFiles) {
      const url = await uploadToImgBB(f);
      urls.push(url);
    }
    const dref = doc(
      db,
      "chapters",
      chapterId,
      "assignments",
      assignmentId,
      "questions",
      questionId
    );
    // Append images using arrayUnion (only works individually, so update for each)
    for (const u of urls) {
      await updateDoc(dref, { images: arrayUnion(u) });
    }
    setNewFiles([]);
    await loadQuestion();
  }

  if (!question) return <div className="placeholder">Loading question...</div>;

  return (
    <div className="form-page">
      <button className="link-btn ghost-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <h2>Q{question.number}</h2>
      <p className="qtext">{question.text}</p>

      <div className="image-list">
        {(question.images || []).map((img, i) => (
          <img key={i} src={img} alt={`img-${i}`} />
        ))}
      </div>

      <h3>Edit Note</h3>
      <textarea
        value={noteEdit}
        onChange={(e) => setNoteEdit(e.target.value)}
      />
      <button className="primary" onClick={handleSaveNote}>
        Save Note
      </button>

      <h3>Upload More Images</h3>
      <input
        type="file"
        multiple
        onChange={(e) => setNewFiles([...e.target.files])}
      />
      <button className="primary" onClick={handleUploadMore}>
        Upload & Append
      </button>
    </div>
  );
}
