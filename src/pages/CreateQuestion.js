// src/pages/CreateQuestion.js
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { uploadToImgBB } from "../imgbb";

export default function CreateQuestion() {
  const { chapterId, assignmentId } = useParams();
  const navigate = useNavigate();

  const [questionText, setQuestionText] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [nextNumber, setNextNumber] = useState(1);

  useEffect(() => {
    (async () => {
      const q = query(
        collection(
          db,
          "chapters",
          chapterId,
          "assignments",
          assignmentId,
          "questions"
        ),
        orderBy("number", "asc")
      );
      const snap = await getDocs(q);
      setNextNumber(snap.size + 1);
    })();
  }, [chapterId, assignmentId]);

  async function handleCreate() {
    if (!questionText.trim()) return;
    const images = [];
    for (const f of files) {
      const url = await uploadToImgBB(f);
      images.push(url);
    }
    await addDoc(
      collection(
        db,
        "chapters",
        chapterId,
        "assignments",
        assignmentId,
        "questions"
      ),
      {
        number: nextNumber,
        text: questionText,
        note,
        images,
      }
    );
    navigate(-1);
  }

  return (
    <div className="form-page">
      <h2>Create Question</h2>
      <div>
        <strong>Chapter:</strong> {chapterId}
      </div>
      <div>
        <strong>Assignment:</strong> {assignmentId}
      </div>

      <textarea
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        placeholder="Question text"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />

      <input
        type="file"
        multiple
        onChange={(e) => setFiles([...e.target.files])}
      />
      <div className="hint">
        You can upload multiple images. They will be resized in the UI.
      </div>

      <button className="primary" onClick={handleCreate}>
        Add Question
      </button>
      <button className="link-btn ghost-btn" onClick={() => navigate(-1)}>
        Cancel
      </button>
    </div>
  );
}
