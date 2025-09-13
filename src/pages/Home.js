import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../App";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";
import { deleteFromCloudinary, uploadToCloudinary } from "../cloudinary";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "react-photo-view/dist/react-photo-view.css";
import { PhotoProvider, PhotoView } from "react-photo-view";
import { FileUploader } from "react-drag-drop-files";

/* Toast component */
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type === "error" ? "error" : ""}`}>
      {toast.message}
    </div>
  );
}

export default function Home() {
  const {
    chapters,
    setChapters,
    selectedChapter,
    setSelectedChapter,
    selectedAssignment,
    setSelectedAssignment,
    user,
  } = useContext(AppContext);

  const [assignments, setAssignments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [mode, setMode] = useState("view");
  const [toast, setToast] = useState(null);

  // create-mode form
  const [newNoteText, setNewNoteText] = useState("");
  const [newFiles, setNewFiles] = useState([]);

  // view-mode edit fields
  const [noteEdit, setNoteEdit] = useState("");
  const [moreFiles, setMoreFiles] = useState([]);
  const [saveNoteBtn, setSaveNoteBtn] = useState(true);
  const [uploadImagesBtn, setUploadImagesBtn] = useState(true);

  //photo viewer
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);

  const nav = useNavigate();

  // Move-popup related state
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetChapter, setMoveTargetChapter] = useState("");
  const [moveTargetAssignment, setMoveTargetAssignment] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);
  const [assignmentsByChapter, setAssignmentsByChapter] = useState({});

  // require login
  useEffect(() => {
    if (!auth.currentUser) {
      nav("/login");
    } else {
      // load chapters for this user
      loadChaptersForUser();
    }
    // eslint-disable-next-line
  }, [auth.currentUser]);

  // load assignments when selectedChapter changes
  useEffect(() => {
    if (!selectedChapter || !user) {
      setAssignments([]);
      setSelectedAssignment("");
      setQuestions([]);
      return;
    }
    loadAssignments();
    // eslint-disable-next-line
  }, [selectedChapter, user]);

  // load questions when assignment changes
  useEffect(() => {
    if (!selectedAssignment || !selectedChapter || !user) {
      setQuestions([]);
      setActiveQuestionId(null);
      return;
    }
    loadQuestions();
    // eslint-disable-next-line
  }, [selectedAssignment]);

  // preload assignments map when chapters change (makes move popup snappier)
  useEffect(() => {
    if (chapters && chapters.length > 0 && user) {
      loadAssignmentsForAllChapters();
    }
    // eslint-disable-next-line
  }, [chapters, user]);

  function showToast(message, type = "success") {
    const id = uuidv4();
    setToast({ id, message, type });
    setTimeout(() => setToast(null), 2600);
  }

  // Load user's chapters
  async function loadChaptersForUser() {
    try {
      const uid = auth.currentUser.uid;
      const snap = await getDocs(collection(db, "users", uid, "chapters"));
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChapters(arr);
    } catch (e) {
      console.error(e);
      showToast("Failed to load chapters", "error");
    }
  }

  async function loadAssignments() {
    try {
      const uid = auth.currentUser.uid;
      const snap = await getDocs(
        collection(db, "users", uid, "chapters", selectedChapter, "assignments")
      );
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAssignments(arr);
      // reset assignment selection if removed
      if (!arr.find((a) => a.id === selectedAssignment))
        setSelectedAssignment("");
    } catch (e) {
      console.error(e);
    }
  }

  async function loadQuestions() {
    try {
      const uid = auth.currentUser.uid;
      const q = query(
        collection(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
          selectedAssignment,
          "questions"
        ),
        orderBy("number", "asc")
      );
      const snap = await getDocs(q);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setQuestions(arr);
      if (arr.length > 0) {
        setActiveQuestionId((prev) =>
          prev >= arr.length ? arr[0].id || null : prev
        );
      } else {
        setActiveQuestionId(null);
      }
      setMode("view");
      setNoteEdit("");
    } catch (e) {
      console.error(e);
    }
  }

  // create question (in create-mode)
  async function handleCreateQuestion(e) {
    e.preventDefault();
    if (!newNoteText.trim() && newFiles.length === 0) {
      showToast("Enter question note/image", "error");
      return;
    }
    if (!selectedChapter || !selectedAssignment) {
      showToast("Select chapter & assignment", "error");
      return;
    }

    try {
      const uid = auth.currentUser.uid;
      // determine next number
      const nextNum = questions.length + 1;

      // find chapter and assignment names for filename
      const chapDoc = (
        await getDocs(collection(db, "users", uid, "chapters"))
      ).docs.find((d) => d.id === selectedChapter);
      const chapName = chapDoc?.data()?.name || "chapter";
      const asgDoc = (
        await getDocs(
          collection(
            db,
            "users",
            uid,
            "chapters",
            selectedChapter,
            "assignments"
          )
        )
      ).docs.find((d) => d.id === selectedAssignment);
      const asgName = asgDoc?.data()?.name || "assignment";

      // upload images to cloudinary
      const uploaded = [];
      for (const f of newFiles) {
        const name = `${chapName}-${asgName}-${nextNum}-${Date.now()}`;
        const url = await uploadToCloudinary(f, name);
        uploaded.push(url);
      }

      const new_question = await addDoc(
        collection(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
          selectedAssignment,
          "questions"
        ),
        {
          number: nextNum,
          note: newNoteText,
          images: uploaded,
        }
      );

      showToast("Question created");
      setNewNoteText("");
      setNewFiles([]);
      await loadQuestions();
      setActiveQuestionId(new_question.id);
      setMode("view");
    } catch (err) {
      console.error(err);
      showToast("Create failed", "error");
    }
  }

  // select question
  function handleSelectQuestion(qid) {
    setActiveQuestionId(qid);
    const qdoc = questions.find((q) => q.id === qid);
    setNoteEdit(qdoc?.note || "");
    setMode("view");
  }

  // save edited note for active question
  async function handleSaveNote() {
    if (!activeQuestionId) return;
    try {
      setSaveNoteBtn(false);
      const uid = auth.currentUser.uid;
      const dref = doc(
        db,
        "users",
        uid,
        "chapters",
        selectedChapter,
        "assignments",
        selectedAssignment,
        "questions",
        activeQuestionId
      );
      await updateDoc(dref, { note: noteEdit });
      setSaveNoteBtn(true);
      showToast("Note saved");
      await loadQuestions();
    } catch (e) {
      console.error(e);
      showToast("Save failed", "error");
      setSaveNoteBtn(true);
    }
  }

  // upload more images to existing question (append)
  async function handleUploadMoreImages() {
    if (!activeQuestionId || !moreFiles.length) return;
    try {
      setUploadImagesBtn(false);
      const uid = auth.currentUser.uid;

      // fetch names
      const chapSnap = await getDocs(collection(db, "users", uid, "chapters"));
      const chapName =
        chapSnap.docs.find((d) => d.id === selectedChapter)?.data()?.name ||
        "chapter";
      const asgSnap = await getDocs(
        collection(db, "users", uid, "chapters", selectedChapter, "assignments")
      );
      const asgName =
        asgSnap.docs.find((d) => d.id === selectedAssignment)?.data()?.name ||
        "assignment";
      const qObj = questions.find((q) => q.id === activeQuestionId);
      const qNum = qObj?.number || 0;

      const urls = [];
      for (const f of moreFiles) {
        const name = `${chapName}-${asgName}-${qNum}-${Date.now()}`;
        const url = await uploadToCloudinary(f, name);
        urls.push(url);
      }

      const dref = doc(
        db,
        "users",
        uid,
        "chapters",
        selectedChapter,
        "assignments",
        selectedAssignment,
        "questions",
        activeQuestionId
      );
      await updateDoc(dref, { images: arrayUnion(...urls) });

      showToast("Images added");
      setUploadImagesBtn(true);
      setMoreFiles([]);
      await loadQuestions();
    } catch (e) {
      console.error(e);
      showToast("Upload failed", "error");
      setUploadImagesBtn(true);
    }
  }

  // delete a question and renumber remaining
  async function handleDeleteQuestion(qid) {
    if (!window.confirm("Delete this question?")) return;
    try {
      (activeQuestion.images || []).map(async (img_url, i) => {
        const public_id = img_url.split("/").pop().split(".")[0];
        await deleteFromCloudinary(public_id);
      });

      const uid = auth.currentUser.uid;
      await deleteDoc(
        doc(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
          selectedAssignment,
          "questions",
          qid
        )
      );

      // re-number remaining questions
      const qSnap = await getDocs(
        query(
          collection(
            db,
            "users",
            uid,
            "chapters",
            selectedChapter,
            "assignments",
            selectedAssignment,
            "questions"
          ),
          orderBy("number", "asc")
        )
      );
      const docs = qSnap.docs;
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        const correct = i + 1;
        if (d.data().number !== correct) {
          await updateDoc(d.ref, { number: correct });
        }
      }

      showToast("Question deleted");
      await loadQuestions();
    } catch (e) {
      console.error(e);
      showToast("Delete failed", "error");
    }
  }

  // delete assignment: delete all its questions then delete assignment doc
  async function handleDeleteAssignment(assignId) {
    if (!window.confirm("Delete this assignment and all its questions?"))
      return;
    try {
      const uid = auth.currentUser.uid;

      // delete questions
      const qSnap = await getDocs(
        collection(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
          assignId,
          "questions"
        )
      );
      for (const d of qSnap.docs) {
        await deleteDoc(d.ref);
      }

      // delete assignment doc
      await deleteDoc(
        doc(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
          assignId
        )
      );

      showToast("Assignment deleted");
      await loadAssignments();
      setSelectedAssignment("");
      setQuestions([]);
    } catch (e) {
      console.error(e);
      showToast("Delete failed", "error");
    }
  }

  // delete chapter: delete its assignments and questions then delete chapter
  async function handleDeleteChapter(chapId) {
    if (!window.confirm("Delete this chapter and all assignments/questions?"))
      return;
    try {
      const uid = auth.currentUser.uid;
      // list assignments
      const asSnap = await getDocs(
        collection(db, "users", uid, "chapters", chapId, "assignments")
      );
      for (const a of asSnap.docs) {
        // delete questions inside assignment
        const qSnap = await getDocs(
          collection(
            db,
            "users",
            uid,
            "chapters",
            chapId,
            "assignments",
            a.id,
            "questions"
          )
        );
        for (const q of qSnap.docs) {
          await deleteDoc(q.ref);
        }
        // delete assignment
        await deleteDoc(a.ref);
      }
      // delete chapter
      await deleteDoc(doc(db, "users", uid, "chapters", chapId));

      showToast("Chapter deleted");
      await loadChaptersForUser();
      setSelectedChapter("");
      setAssignments([]);
      setSelectedAssignment("");
      setQuestions([]);
    } catch (e) {
      console.error(e);
      showToast("Delete failed", "error");
    }
  }

  async function handleDeleteImage() {
    const index = photoIndex;
    if (!window.confirm(`Delete this image (image number: ${index + 1}?`))
      return;
    try {
      const img_url = activeQuestion.images[index];
      const public_id = img_url.split("/").pop().split(".")[0];
      await deleteFromCloudinary(public_id);

      const uid = auth.currentUser.uid;
      const dref = doc(
        db,
        "users",
        uid,
        "chapters",
        selectedChapter,
        "assignments",
        selectedAssignment,
        "questions",
        activeQuestionId
      );

      await updateDoc(dref, { images: arrayRemove(img_url) });
      await loadQuestions();
      setPhotoViewerVisible(false);
    } catch (error) {
      console.error("error deleting image", error);
    }
  }

  // expose reload when user logs in
  useEffect(() => {
    if (user) loadChaptersForUser();
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    setPhotoIndex(0);
  }, [activeQuestionId]);

  // activeQuestion object
  const activeQuestion = questions.find((q) => q.id === activeQuestionId);

  // --------------------- Move-popup helpers ---------------------
  // load assignments for all chapters and cache them
  async function loadAssignmentsForAllChapters() {
    try {
      if (!user) return {};
      const uid = auth.currentUser.uid;
      const map = {};
      for (const chap of chapters) {
        const snap = await getDocs(
          collection(db, "users", uid, "chapters", chap.id, "assignments")
        );
        map[chap.id] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      setAssignmentsByChapter(map);
      return map;
    } catch (e) {
      console.error("loadAssignmentsForAllChapters", e);
      showToast("Failed to load assignments", "error");
      return {};
    }
  }

  function openMoveUI() {
    if (!activeQuestion) {
      showToast("Select a question first", "error");
      return;
    }
    setMoveOpen(true);
    setMoveTargetChapter(selectedChapter || "");
    setMoveTargetAssignment(selectedAssignment || "");
    loadAssignmentsForAllChapters();
  }

  async function handleMoveQuestion() {
    if (!activeQuestionId || !activeQuestion) {
      showToast("No active question", "error");
      return;
    }
    if (!moveTargetChapter || !moveTargetAssignment) {
      showToast("Select destination chapter & assignment", "error");
      return;
    }
    if (
      moveTargetChapter === selectedChapter &&
      moveTargetAssignment === selectedAssignment
    ) {
      showToast("Question is already in the selected assignment", "error");
      return;
    }

    setMoveLoading(true);
    try {
      const uid = auth.currentUser.uid;

      // fresh src ref
      const srcRef = doc(
        db,
        "users",
        uid,
        "chapters",
        selectedChapter,
        "assignments",
        selectedAssignment,
        "questions",
        activeQuestionId
      );

      const srcData = activeQuestion; // using local state; you may fetch fresh if needed

      // determine next number in destination
      const destQSnap = await getDocs(
        query(
          collection(
            db,
            "users",
            uid,
            "chapters",
            moveTargetChapter,
            "assignments",
            moveTargetAssignment,
            "questions"
          ),
          orderBy("number", "asc")
        )
      );
      const destNextNum = destQSnap.size + 1;

      const newQuestionPayload = {
        ...((srcData && {
          note: srcData.note,
          images: srcData.images || [],
        }) || {
          note: "",
          images: [],
        }),
        number: destNextNum,
      };

      await addDoc(
        collection(
          db,
          "users",
          uid,
          "chapters",
          moveTargetChapter,
          "assignments",
          moveTargetAssignment,
          "questions"
        ),
        newQuestionPayload
      );

      // delete original
      await deleteDoc(srcRef);

      // re-number remaining in source
      const qSnap = await getDocs(
        query(
          collection(
            db,
            "users",
            uid,
            "chapters",
            selectedChapter,
            "assignments",
            selectedAssignment,
            "questions"
          ),
          orderBy("number", "asc")
        )
      );
      const docs = qSnap.docs;
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        const correct = i + 1;
        if (d.data().number !== correct) {
          await updateDoc(d.ref, { number: correct });
        }
      }

      showToast("Question moved");

      // refresh UI
      await loadAssignments();
      // if source assignment was being viewed, reload its questions
      if (selectedAssignment) await loadQuestions();

      // close popup and reset
      setMoveOpen(false);
      setMoveTargetAssignment("");
      setMoveTargetChapter("");
      setMoveLoading(false);
    } catch (e) {
      console.error("move failed", e);
      showToast("Move failed", "error");
      setMoveLoading(false);
    }
  }
  // --------------------- End move helpers ---------------------

  return (
    <div className="home-grid">
      {/* selection bar */}
      <div className="selection-bar">
        <div className="sel-item">
          <label>Chapter</label>
          <select
            value={selectedChapter || ""}
            onChange={(e) => setSelectedChapter(e.target.value)}
          >
            <option value="">Select Chapter</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sel-item">
          <label>Assignment</label>
          <select
            value={selectedAssignment || ""}
            onChange={(e) => setSelectedAssignment(e.target.value)}
          >
            <option value="">Select Assignment</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sel-actions">
          <button
            className="ghost-btn"
            onClick={() => {
              if (user) loadChaptersForUser();
              handleSelectQuestion(activeQuestionId);
            }}
          >
            Reload
          </button>
          {selectedChapter && (
            <button
              className="ghost-btn"
              onClick={() => handleDeleteChapter(selectedChapter)}
            >
              Delete Chapter
            </button>
          )}
          {selectedAssignment && (
            <button
              className="ghost-btn"
              onClick={() => handleDeleteAssignment(selectedAssignment)}
            >
              Delete Assignment
            </button>
          )}
        </div>
      </div>

      {/* left panel */}
      <aside className="left-panel">
        <div className="qp-header">Questions</div>
        <div className="q-grid">
          {questions.map((q) => (
            <button
              key={q.id}
              className={`num-btn ${q.id === activeQuestionId ? "active" : ""}`}
              onClick={() => handleSelectQuestion(q.id)}
            >
              {q.number}
            </button>
          ))}
          {selectedChapter && selectedAssignment && (
            <button
              className="num-btn plus"
              onClick={() => {
                setActiveQuestionId(null);
                setMode("create");
              }}
            >
              +
            </button>
          )}
        </div>
      </aside>

      {/* main panel */}
      <section className="main-panel">
        {!selectedChapter || !selectedAssignment ? (
          <div className="placeholder">
            Select a chapter & assignment to begin. Create chapters/assignments
            from top links.
          </div>
        ) : mode === "create" ? (
          <div className="form-page">
            <h2>Create Question</h2>
            <form onSubmit={handleCreateQuestion}>
              <label style={{ fontWeight: "bold" }}>Note</label>
              <textarea
                id="new-question-note"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
              />

              <FileUploader
                handleChange={(files) => setNewFiles([...files])}
                name="new-question-files"
                types={["JPG", "PNG", "GIF", "JPEG"]}
                maxSize={10}
                multiple
              />

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="primary" type="submit">
                  Add Question
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setMode("view")}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : questions.length === 0 ? (
          <div className="placeholder">
            No questions yet. Click + to add one.
          </div>
        ) : activeQuestion ? (
          <div className="question-card">
            <div className="qhead">
              <h3>Question {activeQuestion.number}</h3>
              <div>
                <button
                  className="ghost-btn"
                  onClick={() => handleDeleteQuestion(activeQuestion.id)}
                >
                  Delete Question
                </button>

                {/* MOVE BUTTON triggers popup */}
                <button
                  className="ghost-btn"
                  onClick={openMoveUI}
                  style={{ marginLeft: 8 }}
                >
                  Move
                </button>
              </div>
            </div>

            {/* Move POPUP (modal) */}
            {moveOpen && (
              <div
                className="modal-backdrop"
                onClick={() => setMoveOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1200,
                }}
              >
                <div
                  className="modal"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 520,
                    maxWidth: "92%",
                    background: "#fff",
                    borderRadius: 8,
                    padding: 18,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
                  }}
                >
                  <h4 style={{ margin: 0, marginBottom: 8 }}>Move Question</h4>
                  <p style={{ marginTop: 0, color: "#555" }}>
                    Choose destination chapter and assignment
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      alignItems: "center",
                    }}
                  >
                    <select
                      value={moveTargetChapter}
                      onChange={async (e) => {
                        const chapId = e.target.value;
                        setMoveTargetChapter(chapId);
                        setMoveTargetAssignment("");
                        if (!assignmentsByChapter[chapId]) {
                          const map = await loadAssignmentsForAllChapters();
                          if (map[chapId] && map[chapId].length > 0) {
                            setMoveTargetAssignment(map[chapId][0].id);
                          }
                        } else {
                          if (
                            assignmentsByChapter[chapId] &&
                            assignmentsByChapter[chapId].length > 0
                          ) {
                            setMoveTargetAssignment(
                              assignmentsByChapter[chapId][0].id
                            );
                          }
                        }
                        // let selectedChapData;
                        // for (const chap in chapters) {
                        //   if (chap.id === chapId) {
                        //     selectedChapData = chap
                        //     break
                        //   }
                        // }
                        // if selectedChapData
                      }}
                    >
                      <option value="">Select chapter</option>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={moveTargetAssignment}
                      onChange={(e) => setMoveTargetAssignment(e.target.value)}
                    >
                      <option value="">Select assignment</option>
                      {(assignmentsByChapter[moveTargetChapter] || []).map(
                        (a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        )
                      )}
                    </select>

                    <div
                      style={{ marginLeft: "auto", display: "flex", gap: 8 }}
                    >
                      <button
                        className="primary"
                        onClick={handleMoveQuestion}
                        disabled={moveLoading}
                      >
                        {moveLoading ? "Moving..." : "Move"}
                      </button>
                      <button
                        className="ghost-btn"
                        onClick={() => {
                          setMoveOpen(false);
                          setMoveTargetAssignment("");
                          setMoveTargetChapter("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {/* optional note */}
                  <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
                    The question's note and images will be copied to the
                    destination and removed from the current assignment. Numbers
                    in both assignments will be re-ordered.
                  </div>
                </div>
              </div>
            )}

            <PhotoProvider
              key={activeQuestion.id}
              index={photoIndex}
              visible={photoViewerVisible}
              onVisibleChange={setPhotoViewerVisible}
              onIndexChange={setPhotoIndex}
              toolbarRender={() => {
                return (
                  <>
                    <button
                      className="delete-img-btn"
                      onClick={handleDeleteImage}
                    >
                      Delete
                    </button>
                  </>
                );
              }}
            >
              <div className="foo">
                {(activeQuestion.images || []).map((img_url, index) => (
                  <PhotoView key={index} src={img_url}>
                    <img src={img_url} alt="" className="thumbnail" />
                  </PhotoView>
                ))}
              </div>
            </PhotoProvider>

            <div className="note-section">
              <label>Note</label>
              <textarea
                value={noteEdit}
                onChange={(e) => setNoteEdit(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {saveNoteBtn ? (
                  <button className="primary" onClick={handleSaveNote}>
                    Save Note
                  </button>
                ) : (
                  <button
                    className="primary"
                    style={{ cursor: "no-drop" }}
                    disabled
                  >
                    Loading...
                  </button>
                )}
              </div>
            </div>

            <div className="upload-more">
              <label style={{ fontWeight: "bold" }}>Upload More Images</label>

              <FileUploader
                handleChange={(files) => setMoreFiles([...files])}
                name="more-files"
                types={["JPG", "PNG", "GIF", "JPEG"]}
                maxSize={10}
                multiple
              />

              <div style={{ marginTop: 8 }}>
                {uploadImagesBtn ? (
                  <button
                    className="ghost-btn small"
                    onClick={handleUploadMoreImages}
                  >
                    Upload & Append
                  </button>
                ) : (
                  <button
                    className="ghost-btn small"
                    style={{ cursor: "no-drop" }}
                    disabled
                  >
                    Loading...
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="placeholder">Select a question number</div>
        )}
      </section>

      <Toast toast={toast} />
    </div>
  );
}
