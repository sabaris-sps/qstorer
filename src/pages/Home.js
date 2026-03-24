import { useContext, useEffect, useState, useMemo, useRef } from "react";
import { AppContext } from "../App";
import {
  collection,
  getDocs,
  getDoc,
  query,
  orderBy,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { deleteFromCloudinary, uploadToCloudinary } from "../cloudinary";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "react-photo-view/dist/react-photo-view.css";
import Sidebar from "../components/Sidebar";
import EditNamesModal from "../components/EditNamesModal";
import CreateQuestion from "../components/CreateQuestion";
import QuestionCard from "../components/QuestionCard";
import SelectionBar from "../components/SelectionBar";
import { sanitizePublicId, parseNumberList, evaluateTagQuery } from "../utils";
import FilterModal from "../components/FilterModal";
import VirtualAssignmentModal from "../components/VirtualAssignmentModal";
import ImportChapterModal from "../components/ImportChapterModal";
import CommandCenter from "../components/CommandCenter";
import { exportQuestionsToPDF } from "../utils";

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
    tags,
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

  // NEW: Copy Mode State
  const [isCopyMode, setIsCopyMode] = useState(false);

  // Tabs + bulk input
  const [moveTab, setMoveTab] = useState("move"); // "move" or "bulk"
  const [bulkNumbersInput, setBulkNumbersInput] = useState(""); // e.g. "4,5,7"
  const [bulkByNumbersLoading, setBulkByNumbersLoading] = useState(false);

  // Edit chapter, assignment name
  const [showEditNamesPopup, setShowEditNamesPopup] = useState(false);
  const [editTab, setEditTab] = useState("chapter");
  const [chapterNameEdit, setChapterNameEdit] = useState("");
  const [assignmentNameEdit, setAssignmentNameEdit] = useState("");

  // Filter State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterConfig, setFilterConfig] = useState({
    numberText: "",
    colors: [],
    tagQuery: "",
  });

  // Virtual View Modal
  const [showVirtualModal, setShowVirtualModal] = useState(false);
  const [virtualModalEditData, setVirtualModalData] = useState(null);

  const [showImportChapterModal, setShowImportChapterModal] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const commandFileInputRef = useRef(null);

  const {
    showTags,
    setShowTags,
    invertImages,
    setInvertImages,
    reloadChapters,
    setTags,
    aliases,
    saveAlias,
    deleteAlias,
  } = useContext(AppContext);

  // ==========================================
  // TAG LOGIC (Moved from QuestionCard)
  // ==========================================
  const handleAddTag = async (tagName) => {
    if (!activeQuestion) return showToast("Select a question first", "error");
    try {
      const uid = auth.currentUser.uid;
      const { chapterId, assignmentId, questionId } =
        activeQuestion.originalPath;
      const questionRef = doc(
        db,
        "users",
        uid,
        "chapters",
        chapterId,
        "assignments",
        assignmentId,
        "questions",
        questionId,
      );

      let existingTag = tags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase(),
      );
      let tagIdToUse;

      const COLORS = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#b185db"];

      if (existingTag) {
        tagIdToUse = existingTag.id;
        if ((activeQuestion.tags || []).includes(tagIdToUse)) return;
        await updateDoc(doc(db, "users", uid, "tags", tagIdToUse), {
          count: increment(1),
        });
        setTags((prev) =>
          prev.map((t) =>
            t.id === tagIdToUse ? { ...t, count: (t.count || 0) + 1 } : t,
          ),
        );
      } else {
        const newTagRef = doc(collection(db, "users", uid, "tags"));
        tagIdToUse = newTagRef.id;
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        const newTagObj = { name: tagName, color: randomColor, count: 1 };
        await setDoc(newTagRef, newTagObj);
        setTags((prev) => [...prev, { id: tagIdToUse, ...newTagObj }]);
      }

      await updateDoc(questionRef, { tags: arrayUnion(tagIdToUse) });
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === activeQuestion.id
            ? { ...q, tags: [...(q.tags || []), tagIdToUse] }
            : q,
        ),
      );
      showToast(`Tag "${tagName}" added`);
    } catch (error) {
      console.error("Failed to add tag:", error);
      showToast("Failed to add tag", "error");
    }
  };

  const handleRemoveTag = async (tagId) => {
    if (!activeQuestion) return;
    try {
      const uid = auth.currentUser.uid;
      const { chapterId, assignmentId, questionId } =
        activeQuestion.originalPath;
      const questionRef = doc(
        db,
        "users",
        uid,
        "chapters",
        chapterId,
        "assignments",
        assignmentId,
        "questions",
        questionId,
      );

      await updateDoc(questionRef, { tags: arrayRemove(tagId) });
      await updateDoc(doc(db, "users", uid, "tags", tagId), {
        count: increment(-1),
      });

      setTags((prev) =>
        prev.map((t) =>
          t.id === tagId ? { ...t, count: Math.max(0, (t.count || 0) - 1) } : t,
        ),
      );
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === activeQuestion.id
            ? { ...q, tags: (q.tags || []).filter((id) => id !== tagId) }
            : q,
        ),
      );
      showToast("Tag removed");
    } catch (error) {
      console.error("Failed to remove tag:", error);
      showToast("Failed to remove tag", "error");
    }
  };

  // CommandCenter Handlers
  const commandHandlers = {
    handleCreateChapter: async (name) => {
      if (!name.trim()) return;
      const uid = auth.currentUser.uid;
      await addDoc(collection(db, "users", uid, "chapters"), {
        name: name.trim(),
      });
      showToast(`Chapter "${name}" created`);
      await loadChaptersForUser();
      if (reloadChapters) reloadChapters();
    },
    handleCreateAssignment: async (name, chapterName) => {
      if (!name.trim()) return;
      let targetChapterId = selectedChapter;
      if (chapterName) {
        const found = chapters.find(
          (c) => c.name.toLowerCase() === chapterName.toLowerCase(),
        );
        if (found) targetChapterId = found.id;
        else return showToast(`Chapter "${chapterName}" not found`, "error");
      }
      if (!targetChapterId) return showToast("Select a chapter first", "error");

      const uid = auth.currentUser.uid;
      await addDoc(
        collection(
          db,
          "users",
          uid,
          "chapters",
          targetChapterId,
          "assignments",
        ),
        { name: name.trim() },
      );
      showToast(`Assignment "${name}" created`);
      if (targetChapterId === selectedChapter) await loadAssignments();
    },
    handleExportAssignment: async (format, fileName) => {
      if (!questions.length)
        return showToast("No questions to export", "error");
      const name =
        fileName ||
        assignments.find((a) => a.id === selectedAssignment)?.name ||
        "questions";

      if (format === "json") {
        const dataToExport = questions.map((q, idx) => ({
          number: idx + 1,
          note: q.note || "",
          images: q.images || [],
          color: q.color || null,
          tags: q.tags || [],
        }));
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("JSON Downloaded");
      } else {
        showToast("Generating PDF...");
        await exportQuestionsToPDF(questions, name, { includeNotes: true });
        showToast("PDF Downloaded");
      }
    },
    handleGoTo: async (chapName, asgName) => {
      // Best match for Chapter
      const chap = chapters
        .map((c) => ({
          ...c,
          score: c.name.toLowerCase().includes(chapName.toLowerCase())
            ? c.name.length
            : 0,
        }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)[0];

      if (!chap) return showToast(`Chapter "${chapName}" not found`, "error");

      setSelectedChapter(chap.id);

      if (asgName) {
        const uid = auth.currentUser.uid;
        const snap = await getDocs(
          collection(db, "users", uid, "chapters", chap.id, "assignments"),
        );
        const asgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Best match for Assignment
        const asg = asgs
          .map((a) => ({
            ...a,
            score: a.name.toLowerCase().includes(asgName.toLowerCase())
              ? a.name.length
              : 0,
          }))
          .filter((a) => a.score > 0)
          .sort((a, b) => b.score - a.score)[0];

        if (asg) {
          // IMPORTANT: Manually trigger load with the specific assignment to prevent it being cleared
          await loadAssignments(chap.id, asg.id);
          setSelectedAssignment(asg.id);
        } else {
          showToast(
            `Assignment "${asgName}" not found in ${chap.name}. Only Chapter opened.`,
            "warning",
          );
        }
      }
      setShowCommandCenter(false);
    },
    handleReload: () => {
      loadChaptersForUser();
      if (selectedChapter) loadAssignments();
      if (selectedAssignment) loadQuestions();
      showToast("Reloaded");
    },
    handleCreateView: () => {
      setVirtualModalData(null);
      setShowVirtualModal(true);
      setShowCommandCenter(false);
    },
    handleUpdateView: () => {
      const currentAsg = assignments.find((a) => a.id === selectedAssignment);
      if (!currentAsg?.isVirtual)
        return showToast("Current assignment is not a virtual view", "error");
      setVirtualModalData(currentAsg);
      setShowVirtualModal(true);
      setShowCommandCenter(false);
    },
    handleOpenAddQuestion: () => {
      if (!selectedChapter || !selectedAssignment)
        return showToast("Select chapter/assignment first", "error");
      setActiveQuestionId(null);
      setMode("create");
      setShowCommandCenter(false);
    },
    handleToggleBulkAdd: () => {
      // Toggle bulk is usually a switch in CreateQuestion, but we can set a flag
      showToast("Bulk add mode is available in the + screen", "info");
      commandHandlers.handleOpenAddQuestion();
    },
    handleToggleShowTags: () => {
      setShowTags(!showTags);
      showToast(`Tags ${!showTags ? "shown" : "hidden"}`);
    },
    handleToggleInvert: () => {
      setInvertImages(!invertImages);
      showToast(`Images ${!invertImages ? "inverted" : "restored"}`);
    },
    handleEditNames: () => {
      if (!selectedChapter) return showToast("Select a chapter", "error");
      setEditTab("chapter");
      setChapterNameEdit(
        chapters.find((c) => c.id === selectedChapter)?.name || "",
      );
      setAssignmentNameEdit(
        assignments.find((a) => a.id === selectedAssignment)?.name || "",
      );
      setShowEditNamesPopup(true);
      setShowCommandCenter(false);
    },
    handleSwapQuestions: async (num1, num2) => {
      if (isCurrentlyVirtual)
        return showToast("Cannot swap in virtual view", "error");
      const q1 = questions.find((q) => q.number === num1);
      const q2 = questions.find((q) => q.number === num2);
      if (!q1 || !q2) return showToast("Question not found", "error");

      try {
        const uid = auth.currentUser.uid;
        const batch = writeBatch(db);
        const ref1 = doc(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
          selectedAssignment,
          "questions",
          q1.id,
        );
        const ref2 = doc(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
          selectedAssignment,
          "questions",
          q2.id,
        );

        batch.update(ref1, { number: num2 });
        batch.update(ref2, { number: num1 });
        await batch.commit();
        showToast(`Swapped #${num1} and #${num2}`);
        await loadQuestions();
      } catch (e) {
        showToast("Swap failed", "error");
      }
    },
    handleJumpTo: (num) => {
      const q = questions.find((q) => q.number === num);
      if (q) {
        handleSelectQuestion(q.id);
        setTimeout(() => {
          const el = document.getElementById(`q-btn-${q.id}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      } else {
        showToast(`Question #${num} not found`, "error");
      }
    },
    handleShowStats: () => {
      const totalQ = questions.length;
      const colorCounts = questions.reduce((acc, q) => {
        const c = q.color || "none";
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});

      let msg = `Stats for current assignment: Total: ${totalQ} questions. `;
      msg += Object.entries(colorCounts)
        .map(([c, count]) => `${c}: ${count}`)
        .join(", ");
      return msg;
    },
    handleSaveAdvancedView: async (viewName, refs, config) => {
      try {
        const uid = auth.currentUser.uid;
        await addDoc(
          collection(
            db,
            "users",
            uid,
            "chapters",
            selectedChapter,
            "assignments",
          ),
          {
            name: viewName,
            isVirtual: true,
            refs,
            config,
          },
        );
        showToast(`Virtual view "${viewName}" created`);
        await loadAssignments();
      } catch (e) {
        showToast("Failed to create view", "error");
      }
    },
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandCenter((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

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
      setChapters(
        arr.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
      );
    } catch (e) {
      console.error(e);
      showToast("Failed to load chapters", "error");
    }
  }

  async function loadAssignments(
    freshChapterId = null,
    keepAssignmentId = null,
  ) {
    try {
      const uid = auth.currentUser.uid;
      const targetChapId = freshChapterId || selectedChapter;
      if (!targetChapId) return [];

      const snap = await getDocs(
        collection(db, "users", uid, "chapters", targetChapId, "assignments"),
      );
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const sorted = arr.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
      setAssignments(sorted);

      const effectiveAsgId = keepAssignmentId || selectedAssignment;
      if (!sorted.find((a) => a.id === effectiveAsgId)) {
        setSelectedAssignment("");
      }

      return sorted;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async function loadQuestions(freshAssignments = null) {
    try {
      const uid = auth.currentUser.uid;

      const sourceAssignments = freshAssignments || assignments;
      const currentAsg = sourceAssignments.find(
        (a) => a.id === selectedAssignment,
      );

      if (currentAsg?.isVirtual) {
        // Fetch all referenced documents parallelly
        const refs = currentAsg.refs || [];
        const promises = refs.map(async (ref, index) => {
          const dSnap = await getDoc(
            doc(
              db,
              "users",
              uid,
              "chapters",
              ref.chapterId,
              "assignments",
              ref.assignmentId,
              "questions",
              ref.questionId,
            ),
          );
          if (dSnap.exists()) {
            return {
              ...dSnap.data(),
              id: dSnap.id,
              number: index + 1,
              originalPath: ref,
            };
          }
          return null;
        });

        const arr = (await Promise.all(promises)).filter(Boolean);
        setQuestions(arr);
        if (arr.length > 0) {
          setActiveQuestionId((prev) =>
            prev && arr.find((q) => q.id === prev) ? prev : arr[0].id,
          );
        } else {
          setActiveQuestionId(null);
        }
      } else {
        // Normal fetch
        const q = query(
          collection(
            db,
            "users",
            uid,
            "chapters",
            selectedChapter,
            "assignments",
            selectedAssignment,
            "questions",
          ),
          orderBy("number", "asc"),
        );
        const snap = await getDocs(q);
        const arr = snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
          originalPath: {
            chapterId: selectedChapter,
            assignmentId: selectedAssignment,
            questionId: d.id,
          },
        }));
        setQuestions(arr);
        if (arr.length > 0)
          setActiveQuestionId((prev) =>
            prev && arr.find((q) => q.id === prev) ? prev : arr[0].id,
          );
        else setActiveQuestionId(null);
      }
      setMode("view");
      setNoteEdit("");
    } catch (e) {
      console.error(e);
    }
  }

  // create question (Modified for Bulk Mode)
  async function handleCreateQuestion(e, bulkFiles = null, isBulk = false) {
    e.preventDefault();
    const currentAsg = assignments.find((a) => a.id === selectedAssignment);
    if (currentAsg?.isVirtual)
      return showToast("Cannot create directly in a virtual view", "error");

    // 1. Validation
    if (!isBulk && !newNoteText.trim() && newFiles.length === 0) {
      showToast("Enter question note/image", "error");
      return;
    }
    if (!selectedChapter || !selectedAssignment) {
      showToast("Select chapter & assignment", "error");
      return;
    }

    try {
      const uid = auth.currentUser.uid;

      // 2. Fetch Chapter/Assignment Names (Do this once for both modes)
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
            "assignments",
          ),
        )
      ).docs.find((d) => d.id === selectedAssignment);
      const asgName = asgDoc?.data()?.name || "assignment";

      // 3. Collection Reference
      const questionsCollectionRef = collection(
        db,
        "users",
        uid,
        "chapters",
        selectedChapter,
        "assignments",
        selectedAssignment,
        "questions",
      );

      // =========================================================
      // OPTION A: BULK MODE (One Question Per Image)
      // =========================================================
      if (isBulk && bulkFiles && bulkFiles.length > 0) {
        showToast(`Uploading ${bulkFiles.length} questions...`);

        // Calculate the starting number based on current count
        let startNum = questions.length + 1;

        // Process all files in parallel
        const uploadPromises = bulkFiles.map(async (file, index) => {
          const currentNum = startNum + index;
          const name = `${chapName}-${asgName}-${currentNum}-${Date.now()}`;

          // Upload to Cloudinary
          const url = await uploadToCloudinary(file, sanitizePublicId(name));

          // Create the document
          return addDoc(questionsCollectionRef, {
            number: currentNum,
            note: "", // Empty note for bulk uploads
            images: [url], // Single image per question
          });
        });

        // Wait for all uploads and DB creates to finish
        const newDocs = await Promise.all(uploadPromises);

        showToast(`${bulkFiles.length} questions created!`);

        // Update active ID to the first created question
        if (newDocs.length > 0) {
          setActiveQuestionId(newDocs[0].id);
        }
      }
      // =========================================================
      // OPTION B: STANDARD MODE (Existing Logic)
      // =========================================================
      else {
        const nextNum = questions.length + 1;

        // upload images to cloudinary
        const uploaded = [];
        for (const f of newFiles) {
          const name = `${chapName}-${asgName}-${nextNum}-${Date.now()}`;
          const url = await uploadToCloudinary(f, sanitizePublicId(name));
          uploaded.push(url);
        }

        const new_question = await addDoc(questionsCollectionRef, {
          number: nextNum,
          note: newNoteText,
          images: uploaded,
        });

        showToast("Question created");
        setActiveQuestionId(new_question.id);
      }

      // 4. Cleanup (Common)
      setNewNoteText("");
      setNewFiles([]);
      setMode("view");
      await loadQuestions();
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
      const q = questions.find((qu) => qu.id === activeQuestionId);
      const { chapterId, assignmentId, questionId } = q.originalPath;

      const dref = doc(
        db,
        "users",
        uid,
        "chapters",
        chapterId,
        "assignments",
        assignmentId,
        "questions",
        questionId,
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
      const qObj = questions.find((q) => q.id === activeQuestionId);
      const { chapterId, assignmentId, questionId } = qObj.originalPath;

      const chapName =
        chapters.find((c) => c.id === chapterId)?.name || "chapter";
      const asgName = "assignment";
      const qNum = qObj?.number || 0;

      const urls = [];
      for (const f of moreFiles) {
        const name = `${chapName}-${asgName}-${qNum}-${Date.now()}`;
        const url = await uploadToCloudinary(f, sanitizePublicId(name));
        urls.push(url);
      }

      const dref = doc(
        db,
        "users",
        uid,
        "chapters",
        chapterId,
        "assignments",
        assignmentId,
        "questions",
        questionId,
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
    if (
      !window.confirm(
        "Delete this question? (If this is a filtered view, it deletes the ORIGINAL question everywhere!)",
      )
    )
      return;
    try {
      const q = questions.find((qu) => qu.id === qid);
      const { chapterId, assignmentId, questionId } = q.originalPath;

      (q.images || []).map(async (img_url) => {
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
          chapterId,
          "assignments",
          assignmentId,
          "questions",
          questionId,
        ),
      );

      // Re-number original collection
      const qSnap = await getDocs(
        query(
          collection(
            db,
            "users",
            uid,
            "chapters",
            chapterId,
            "assignments",
            assignmentId,
            "questions",
          ),
          orderBy("number", "asc"),
        ),
      );
      const docs = qSnap.docs;
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        const correct = i + 1;
        if (d.data().number !== correct) {
          await updateDoc(d.ref, { number: correct });
        }
      }

      // If we are currently IN a virtual assignment, remove the dead ref to clean it up
      const currentAsg = assignments.find((a) => a.id === selectedAssignment);
      if (currentAsg?.isVirtual) {
        const newRefs = (currentAsg.refs || []).filter(
          (r) => r.questionId !== questionId,
        );
        await updateDoc(
          doc(
            db,
            "users",
            uid,
            "chapters",
            selectedChapter,
            "assignments",
            selectedAssignment,
          ),
          { refs: newRefs },
        );

        //Load fresh data to instantly update sidebar
        const freshAsgs = await loadAssignments();
        await loadQuestions(freshAsgs);
      } else {
        await loadQuestions();
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
    const asg = assignments.find((a) => a.id === assignId);
    if (asg?.isVirtual) {
      if (
        !window.confirm(
          "Delete this filtered view? (Original questions will NOT be deleted)",
        )
      )
        return;
      try {
        await deleteDoc(
          doc(
            db,
            "users",
            auth.currentUser.uid,
            "chapters",
            selectedChapter,
            "assignments",
            assignId,
          ),
        );
        showToast("Filtered View deleted");
        await loadAssignments();
        setSelectedAssignment("");
        setQuestions([]);
      } catch (e) {
        showToast("Delete failed", "error");
      }
    } else {
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
            "questions",
          ),
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
            assignId,
          ),
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
  }

  // delete chapter: delete its assignments and questions then delete chapter
  async function handleDeleteChapter(chapId) {
    if (!window.confirm("Delete this chapter and all assignments/questions?"))
      return;
    try {
      const uid = auth.currentUser.uid;
      // list assignments
      const asSnap = await getDocs(
        collection(db, "users", uid, "chapters", chapId, "assignments"),
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
            "questions",
          ),
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
    if (!window.confirm(`Delete this image (number: ${index + 1})?`)) return;
    try {
      const img_url = activeQuestion.images[index];
      const public_id = img_url.split("/").pop().split(".")[0];
      await deleteFromCloudinary(public_id);

      const uid = auth.currentUser.uid;
      const q = questions.find((qu) => qu.id === activeQuestionId);
      const { chapterId, assignmentId, questionId } = q.originalPath;

      const dref = doc(
        db,
        "users",
        uid,
        "chapters",
        chapterId,
        "assignments",
        assignmentId,
        "questions",
        questionId,
      );
      await updateDoc(dref, { images: arrayRemove(img_url) });

      await loadQuestions();
      setPhotoViewerVisible(false);
    } catch (error) {
      console.error("error deleting", error);
    }
  }

  async function handleUpdateColor(colorHex) {
    if (!activeQuestionId) return;

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === activeQuestionId ? { ...q, color: colorHex } : q,
      ),
    );

    try {
      const uid = auth.currentUser.uid;
      const q = questions.find((qu) => qu.id === activeQuestionId);
      const { chapterId, assignmentId, questionId } = q.originalPath;

      const dref = doc(
        db,
        "users",
        uid,
        "chapters",
        chapterId,
        "assignments",
        assignmentId,
        "questions",
        questionId,
      );
      await updateDoc(dref, { color: colorHex });
    } catch (e) {
      showToast("Failed to save color", "error");
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
          collection(db, "users", uid, "chapters", chap.id, "assignments"),
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

      // src ref
      const srcRef = doc(
        db,
        "users",
        uid,
        "chapters",
        selectedChapter,
        "assignments",
        selectedAssignment,
        "questions",
        activeQuestionId,
      );

      const srcData = activeQuestion;

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
            "questions",
          ),
          orderBy("number", "asc"),
        ),
      );
      const destNextNum = destQSnap.size + 1;

      const newQuestionPayload = {
        ...((srcData && {
          note: srcData.note,
          images: srcData.images || [],
          color: srcData.color || null, // preserve color if exists
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
          "questions",
        ),
        newQuestionPayload,
      );

      // === ONLY DELETE FROM SOURCE IF NOT IN COPY MODE ===
      if (!isCopyMode) {
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
              "questions",
            ),
            orderBy("number", "asc"),
          ),
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
      } else {
        showToast("Question copied");
      }

      // refresh UI
      await loadAssignments();
      // if source assignment was being viewed, reload its questions
      if (selectedAssignment) await loadQuestions();

      // close popup and reset
      setMoveOpen(false);
      setMoveTargetAssignment("");
      setMoveTargetChapter("");
      setMoveLoading(false);
      setIsCopyMode(false); // Reset copy mode
    } catch (e) {
      console.error("move/copy failed", e);
      showToast("Action failed", "error");
      setMoveLoading(false);
    }
  }

  // --------------------- BULK MOVE HELPERS ---------------------
  async function handleBulkMoveByNumbers() {
    // parse input
    const nums = parseNumberList(bulkNumbersInput);
    if (!nums.length) {
      showToast("Enter question numbers (comma separated)", "error");
      return;
    }
    if (!moveTargetChapter || !moveTargetAssignment) {
      showToast("Select destination chapter & assignment", "error");
      return;
    }
    // prevent same-destination
    if (
      moveTargetChapter === selectedChapter &&
      moveTargetAssignment === selectedAssignment
    ) {
      showToast("Destination is same as source", "error");
      return;
    }

    setBulkByNumbersLoading(true);
    try {
      const uid = auth.currentUser.uid;

      // Map requested numbers -> question objects
      const matched = nums
        .map((n) => questions.find((q) => q.number === n))
        .filter(Boolean); // remove not-found

      const missing = nums.filter((n) => !matched.find((m) => m.number === n));
      if (missing.length > 0) {
        showToast(
          `Question number(s) not found: ${missing.join(", ")}`,
          "error",
        );
        setBulkByNumbersLoading(false);
        return;
      }

      // Determine current destination next number
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
            "questions",
          ),
          orderBy("number", "asc"),
        ),
      );
      let destNextNum = destQSnap.size + 1;

      // Add matched questions to destination in ascending order
      for (const qObj of matched) {
        const payload = {
          note: qObj.note ?? "",
          images: qObj.images ?? [],
          color: qObj.color || null,
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
            "questions",
          ),
          payload,
        );
        destNextNum++;
      }

      // === ONLY DELETE FROM SOURCE IF NOT IN COPY MODE ===
      if (!isCopyMode) {
        // Delete originals by id
        for (const qObj of matched) {
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
              qObj.id,
            ),
          );
        }

        // Re-number remaining in source
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
              "questions",
            ),
            orderBy("number", "asc"),
          ),
        );
        for (let i = 0; i < qSnap.docs.length; i++) {
          const d = qSnap.docs[i];
          const correct = i + 1;
          if (d.data().number !== correct) {
            await updateDoc(d.ref, { number: correct });
          }
        }
        showToast(`${matched.length} question(s) moved`);
      } else {
        showToast(`${matched.length} question(s) copied`);
      }

      // refresh UI
      await loadAssignments();
      await loadQuestions();

      // reset UI
      setBulkNumbersInput("");
      setMoveTab("move");
      setMoveOpen(false);
      setIsCopyMode(false);
    } catch (err) {
      console.error("bulk move/copy by numbers failed", err);
      showToast("Bulk action failed", "error");
    } finally {
      setBulkByNumbersLoading(false);
    }
  }

  // --------------------- End move helpers ---------------------

  // Edit chapter, assignment name
  async function handleSaveChapterName() {
    const uid = auth.currentUser.uid;
    const dref = doc(db, "users", uid, "chapters", selectedChapter);
    await updateDoc(dref, { name: chapterNameEdit });
    showToast("Chapter name updated");
    setShowEditNamesPopup(false);
    await loadChaptersForUser(); // refresh chapter names
  }

  async function handleSaveAssignmentName() {
    const uid = auth.currentUser.uid;
    const dref = doc(
      db,
      "users",
      uid,
      "chapters",
      selectedChapter,
      "assignments",
      selectedAssignment,
    );
    await updateDoc(dref, { name: assignmentNameEdit });
    showToast("Assignment name updated");
    setShowEditNamesPopup(false);
    await loadAssignments(); // refresh assignment names
  }

  // -----------------------------------------------------------
  // FILTER LOGIC
  // -----------------------------------------------------------
  const visibleQuestions = useMemo(() => {
    // If no filters are active, return original list
    if (
      !filterConfig.numberText &&
      filterConfig.colors.length === 0 &&
      !filterConfig.tagQuery
    ) {
      return questions;
    }

    const targetNumbers = parseNumberList(filterConfig.numberText);
    const hasNumberFilter = targetNumbers.length > 0;
    const hasColorFilter = filterConfig.colors.length > 0;

    return questions.filter((q) => {
      const numberMatches = hasNumberFilter
        ? targetNumbers.includes(q.number)
        : true;
      const colorMatches = hasColorFilter
        ? filterConfig.colors.includes(q.color)
        : true;

      let tagMatches = true;
      if (filterConfig.tagQuery) {
        const questionTagNames = (q.tags || [])
          .map((tagId) => tags.find((t) => t.id === tagId)?.name)
          .filter(Boolean);

        tagMatches = evaluateTagQuery(filterConfig.tagQuery, questionTagNames);
      }

      return numberMatches && colorMatches && tagMatches;
    });
  }, [questions, filterConfig, tags]);

  useEffect(() => {
    function handleKeyDown(e) {
      // Prevent navigation if user is typing in any input/textarea
      const target = e.target;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // 1. Handle Question Navigation (Arrow Left/Right)
      if (!e.altKey && e.key === "ArrowRight") {
        e.preventDefault();

        // Find index inside the FILTERED list
        const currentIndex = visibleQuestions.findIndex(
          (q) => q.id === activeQuestionId,
        );

        if (currentIndex !== -1 && currentIndex < visibleQuestions.length - 1) {
          const nextQ = visibleQuestions[currentIndex + 1];
          handleSelectQuestion(nextQ.id);
        }
      } else if (!e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();

        // Find index inside the FILTERED list
        const currentIndex = visibleQuestions.findIndex(
          (q) => q.id === activeQuestionId,
        );

        if (currentIndex > 0) {
          const prevQ = visibleQuestions[currentIndex - 1];
          handleSelectQuestion(prevQ.id);
        }
      }

      // 2. Handle Image Navigation (Alt + Arrow Left/Right)
      if (activeQuestion?.images?.length > 0) {
        if (e.altKey && e.key === "ArrowRight") {
          e.preventDefault();
          setPhotoIndex((prev) =>
            Math.min(prev + 1, activeQuestion.images.length - 1),
          );
        } else if (e.altKey && e.key === "ArrowLeft") {
          e.preventDefault();
          setPhotoIndex((prev) => Math.max(prev - 1, 0));
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photoViewerVisible, activeQuestion, activeQuestionId, visibleQuestions]);

  const currentAsgObj = assignments.find((a) => a.id === selectedAssignment);
  const isCurrentlyVirtual = currentAsgObj?.isVirtual || false;

  // --- Handle JSON Import ---
  const handleImportJSON = async (file) => {
    if (!selectedChapter || !selectedAssignment) {
      showToast("Select a chapter & assignment to import into", "error");
      return;
    }

    const currentAsg = assignments.find((a) => a.id === selectedAssignment);
    if (currentAsg?.isVirtual) {
      showToast("Cannot import directly into a virtual view", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data))
          throw new Error("File must contain an array of questions.");

        showToast(`Importing ${data.length} questions...`);
        const uid = auth.currentUser.uid;
        const questionsCollectionRef = collection(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
          selectedAssignment,
          "questions",
        );

        // Get the current max number so we don't overwrite existing questions
        const qSnap = await getDocs(
          query(questionsCollectionRef, orderBy("number", "asc")),
        );
        let nextStartNum = qSnap.size + 1;

        // Process all uploads in parallel for speed
        const promises = data.map((qData, index) => {
          return addDoc(questionsCollectionRef, {
            number: nextStartNum + index, // Add sequentially to existing count
            note: qData.note || "",
            images: qData.images || [],
            color: qData.color || null,
          });
        });

        await Promise.all(promises);

        showToast(`Successfully imported ${data.length} questions!`);
        await loadQuestions(); // Refresh UI to show the imported items
      } catch (err) {
        console.error("Import error:", err);
        showToast("Invalid JSON file or format", "error");
      }
    };
    reader.readAsText(file);
  };

  // --- CHAPTER EXPORT LOGIC ---
  const handleExportChapter = async () => {
    if (!selectedChapter) {
      showToast("Select a chapter to export", "error");
      return;
    }

    showToast("Compiling chapter data... this may take a moment.");
    try {
      const uid = auth.currentUser.uid;
      const chapDoc = chapters.find((c) => c.id === selectedChapter);

      const asgSnap = await getDocs(
        collection(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
        ),
      );

      const assignmentsData = [];

      // Loop through assignments
      for (const aDoc of asgSnap.docs) {
        const asgData = aDoc.data();

        // Skip virtual views to avoid complexity/broken refs on import
        if (asgData.isVirtual) continue;

        // Fetch questions for this assignment
        const qSnap = await getDocs(
          query(
            collection(
              db,
              "users",
              uid,
              "chapters",
              selectedChapter,
              "assignments",
              aDoc.id,
              "questions",
            ),
            orderBy("number", "asc"),
          ),
        );

        const questionsData = qSnap.docs.map((q) => {
          const data = q.data();
          return {
            number: data.number,
            note: data.note || "",
            images: data.images || [],
            color: data.color || null,
            tags: data.tags || [],
          };
        });

        assignmentsData.push({
          name: asgData.name,
          questions: questionsData,
        });
      }

      const exportObj = {
        type: "qstorer_chapter_export",
        chapterName: chapDoc.name,
        assignments: assignmentsData,
      };

      // Generate Download
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizePublicId(chapDoc.name)}-full-chapter.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast("Chapter exported successfully!");
    } catch (error) {
      console.error("Chapter export failed:", error);
      showToast("Failed to export chapter", "error");
    }
  };

  // --- CHAPTER IMPORT LOGIC ---
  const handleImportChapterConfirm = async (parsedData) => {
    try {
      const uid = auth.currentUser.uid;

      // 1. Create the new Chapter Document
      const newChapRef = await addDoc(
        collection(db, "users", uid, "chapters"),
        {
          name: parsedData.chapterName,
        },
      );

      // 2. Loop through assignments and create them
      for (const asg of parsedData.assignments) {
        const newAsgRef = await addDoc(
          collection(
            db,
            "users",
            uid,
            "chapters",
            newChapRef.id,
            "assignments",
          ),
          {
            name: asg.name,
            isVirtual: false, // Ensures imported assignments act as native standard lists
          },
        );

        // 3. Batch create questions (doing it sequentially to guarantee integrity)
        const questionsCollectionRef = collection(
          db,
          "users",
          uid,
          "chapters",
          newChapRef.id,
          "assignments",
          newAsgRef.id,
          "questions",
        );

        // We Promise.all the questions within each assignment for speed
        const qPromises = asg.questions.map((qData) => {
          return addDoc(questionsCollectionRef, {
            number: qData.number,
            note: qData.note || "",
            images: qData.images || [],
            color: qData.color || null,
            tags: qData.tags || [],
          });
        });

        await Promise.all(qPromises);
      }

      showToast(`Chapter '${parsedData.chapterName}' imported successfully!`);

      // Reload UI and select the newly imported chapter
      await loadChaptersForUser();
      setSelectedChapter(newChapRef.id);
      setSelectedAssignment("");
      setQuestions([]);
    } catch (error) {
      console.error("Chapter import failed:", error);
      showToast("Failed to import chapter data", "error");
    }
  };

  return (
    <div className="home-grid">
      {/* modal for editing chapter, assignment name */}
      {showEditNamesPopup && (
        <EditNamesModal
          editTab={editTab}
          selectedAssignment={selectedAssignment}
          setEditTab={setEditTab}
          showToast={showToast}
          chapterNameEdit={chapterNameEdit}
          setChapterNameEdit={setChapterNameEdit}
          handleSaveChapterName={handleSaveChapterName}
          handleSaveAssignmentName={handleSaveAssignmentName}
          setShowEditNamesPopup={setShowEditNamesPopup}
          assignmentNameEdit={assignmentNameEdit}
          setAssignmentNameEdit={setAssignmentNameEdit}
        />
      )}

      {/* NEW: Filter Modal */}
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        currentFilter={filterConfig}
        onApply={setFilterConfig}
      />

      <VirtualAssignmentModal
        isOpen={showVirtualModal}
        onClose={() => {
          setShowVirtualModal(false);
          setVirtualModalData(null);
        }}
        chapters={chapters}
        assignmentsByChapter={assignmentsByChapter}
        loadAssignmentsForAllChapters={loadAssignmentsForAllChapters}
        showToast={showToast}
        onSuccess={async () => {
          const freshAsgs = await loadAssignments();
          if (selectedAssignment) {
            await loadQuestions(freshAsgs);
          }
        }}
        existingAssignment={virtualModalEditData}
        currentChapterId={selectedChapter}
      />

      <ImportChapterModal
        isOpen={showImportChapterModal}
        onClose={() => setShowImportChapterModal(false)}
        onImport={handleImportChapterConfirm}
        showToast={showToast}
      />

      <Sidebar
        questions={visibleQuestions}
        activeQuestionId={activeQuestionId}
        setActiveQuestionId={setActiveQuestionId}
        handleSelectQuestion={handleSelectQuestion}
        selectedChapter={selectedChapter}
        selectedAssignment={selectedAssignment}
        setMode={setMode}
        onOpenFilter={() => setShowFilterModal(true)}
        canFilter={!!selectedAssignment}
        isFilterActive={
          filterConfig.numberText || filterConfig.colors.length > 0
        }
        isVirtual={isCurrentlyVirtual}
      />

      {/* main panel */}
      <section className="main-panel">
        <SelectionBar
          selectedChapter={selectedChapter}
          setSelectedChapter={setSelectedChapter}
          setSelectedAssignment={setSelectedAssignment}
          selectedAssignment={selectedAssignment}
          assignments={assignments}
          chapters={chapters}
          loadChaptersForUser={loadChaptersForUser}
          setEditTab={setEditTab}
          user={user}
          handleSelectQuestion={handleSelectQuestion}
          setChapterNameEdit={setChapterNameEdit}
          setAssignmentNameEdit={setAssignmentNameEdit}
          activeQuestionId={activeQuestionId}
          setShowEditNamesPopup={setShowEditNamesPopup}
          showToast={showToast}
          handleDeleteAssignment={handleDeleteAssignment}
          handleDeleteChapter={handleDeleteChapter}
          questions={visibleQuestions}
          isVirtual={isCurrentlyVirtual}
          onCreateVirtual={() => {
            setVirtualModalData(null);
            setShowVirtualModal(true);
          }}
          onEditVirtual={() => {
            setVirtualModalData(currentAsgObj);
            setShowVirtualModal(true);
          }}
          onImportJSON={handleImportJSON}
          onExportChapter={handleExportChapter}
          onImportChapterClick={() => setShowImportChapterModal(true)}
        />

        {!selectedChapter || !selectedAssignment ? (
          <div className="placeholder">
            Select a chapter & assignment to begin. Create chapters/assignments
            from top links.
          </div>
        ) : mode === "create" ? (
          <CreateQuestion
            handleCreateQuestion={handleCreateQuestion}
            newNoteText={newNoteText}
            setNewNoteText={setNewNoteText}
            newFiles={newFiles}
            setNewFiles={setNewFiles}
            setMode={setMode}
          />
        ) : questions.length === 0 ? (
          <div className="placeholder">
            No questions yet. Click + to add one.
          </div>
        ) : activeQuestion ? (
          <QuestionCard
            activeQuestion={activeQuestion}
            handleDeleteQuestion={handleDeleteQuestion}
            moveOpen={moveOpen}
            setMoveOpen={setMoveOpen}
            moveTab={moveTab}
            setMoveTab={setMoveTab}
            moveTargetChapter={moveTargetChapter}
            setMoveTargetChapter={setMoveTargetChapter}
            setMoveTargetAssignment={setMoveTargetAssignment}
            assignmentsByChapter={assignmentsByChapter}
            loadAssignmentsForAllChapters={loadAssignmentsForAllChapters}
            chapters={chapters}
            moveTargetAssignment={moveTargetAssignment}
            handleMoveQuestion={handleMoveQuestion}
            moveLoading={moveLoading}
            bulkNumbersInput={bulkNumbersInput}
            handleBulkMoveByNumbers={handleBulkMoveByNumbers}
            setBulkNumbersInput={setBulkNumbersInput}
            bulkByNumbersLoading={bulkByNumbersLoading}
            photoIndex={photoIndex}
            setPhotoIndex={setPhotoIndex}
            photoViewerVisible={photoViewerVisible}
            setPhotoViewerVisible={setPhotoViewerVisible}
            handleDeleteImage={handleDeleteImage}
            noteEdit={noteEdit}
            setNoteEdit={setNoteEdit}
            saveNoteBtn={saveNoteBtn}
            moreFiles={moreFiles}
            setMoreFiles={setMoreFiles}
            handleUploadMoreImages={handleUploadMoreImages}
            uploadImagesBtn={uploadImagesBtn}
            handleSaveNote={handleSaveNote}
            showToast={showToast}
            selectedChapter={selectedChapter}
            selectedAssignment={selectedAssignment}
            handleUpdateColor={handleUpdateColor}
            isCopyMode={isCopyMode}
            setIsCopyMode={setIsCopyMode}
            isVirtual={isCurrentlyVirtual}
            setQuestions={setQuestions}
            handleAddTag={handleAddTag}
            handleRemoveTag={handleRemoveTag}
          />
        ) : (
          <div className="placeholder">Select a question number</div>
        )}
      </section>

      <Toast toast={toast} />

      <input
        type="file"
        accept=".json"
        style={{ display: "none" }}
        ref={commandFileInputRef}
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) handleImportJSON(file);
          if (commandFileInputRef.current)
            commandFileInputRef.current.value = "";
        }}
      />

      <CommandCenter
        isOpen={showCommandCenter}
        onClose={() => setShowCommandCenter(false)}
        activeQuestion={activeQuestion}
        visibleQuestions={visibleQuestions}
        showToast={showToast}
        currentToast={toast}
        assignmentsByChapter={assignmentsByChapter}
        aliases={aliases}
        saveAlias={saveAlias}
        deleteAlias={deleteAlias}
        {...commandHandlers}
        handleImportJSON={() => commandFileInputRef.current?.click()}
        handleImportChapter={() => setShowImportChapterModal(true)}
        handleDeleteAssignment={() =>
          handleDeleteAssignment(selectedAssignment)
        }
        handleDeleteChapter={() => handleDeleteChapter(selectedChapter)}
        handleUpdateColor={handleUpdateColor}
        handleAddTag={handleAddTag}
        handleRemoveTag={handleRemoveTag}
        handleSaveNote={handleSaveNote}
        handleUploadMore={handleUploadMoreImages}
      />
    </div>
  );
}
