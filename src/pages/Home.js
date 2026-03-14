import { useContext, useEffect, useState, useMemo } from "react";
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

  async function loadAssignments() {
    try {
      const uid = auth.currentUser.uid;
      const snap = await getDocs(
        collection(
          db,
          "users",
          uid,
          "chapters",
          selectedChapter,
          "assignments",
        ),
      );
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const sorted = arr.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
      setAssignments(sorted);

      if (!sorted.find((a) => a.id === selectedAssignment))
        setSelectedAssignment("");

      return sorted;
    } catch (e) {
      console.error(e);
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
          />
        ) : (
          <div className="placeholder">Select a question number</div>
        )}
      </section>

      <Toast toast={toast} />
    </div>
  );
}
