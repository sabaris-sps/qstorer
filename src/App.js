import React, { useEffect, useState, createContext } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import CreateChapter from "./pages/CreateChapter";
import CreateAssignment from "./pages/CreateAssignment";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TagManager from "./pages/TagManager"; // NEW IMPORT
import ReviewAssignment from "./pages/ReviewAssignment";
import { auth, db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import "./App.css";

export const AppContext = createContext();

export default function App() {
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [user, setUser] = useState(null);
  const [tags, setTags] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [reviewQuestions, setReviewQuestions] = useState([]);

  const navigate = useNavigate();

  const [invertImages, setInvertImages] = useState(() => {
    const saved = localStorage.getItem("invertImages");
    return saved === "true";
  });

  const [showTags, setShowTags] = useState(() => {
    const saved = localStorage.getItem("showTags");
    return saved !== "false"; // Default to true
  });

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileNavRef = React.useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (mobileNavRef.current && !mobileNavRef.current.contains(event.target)) {
        setIsMobileNavOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setSelectedChapter("");
      setSelectedAssignment("");
      if (u) {
        loadTags(u.uid);
        loadAliases(u.uid);
      } else {
        setTags([]);
        setAliases([]);
      }
    });
    return () => unsub();
  }, []);

  const loadTags = async (uid) => {
    try {
      const snap = await getDocs(collection(db, "users", uid, "tags"));
      const loadedTags = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTags(loadedTags);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  };

  const loadAliases = async (uid) => {
    if (!uid) return;
    try {
      const snap = await getDocs(collection(db, "users", uid, "aliases"));
      const arr = snap.docs.map(doc => ({ name: doc.id, command: doc.data().command }));
      setAliases(arr);
    } catch (error) {
      console.error("Failed to load aliases:", error);
    }
  };

  async function saveAlias(name, command) {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid, "aliases", name), { command });
      setAliases(prev => [...prev.filter(a => a.name !== name), { name, command }]);
    } catch (error) {
      console.error("Failed to save alias:", error);
    }
  }

  async function deleteAlias(name) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "aliases", name));
      setAliases(prev => prev.filter(a => a.name !== name));
    } catch (error) {
      console.error("Failed to delete alias:", error);
    }
  }

  useEffect(() => {
    localStorage.setItem("invertImages", invertImages);
    if (invertImages) {
      document.body.classList.add("invert-all-images");
    } else {
      document.body.classList.remove("invert-all-images");
    }
  }, [invertImages]);

  useEffect(() => {
    localStorage.setItem("showTags", showTags);
  }, [showTags]);

  async function reloadChapters() {
    if (!user) return;
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "chapters"));
      const chaps = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setChapters(chaps);
    } catch (error) {
      console.error("Failed to reload chapters:", error);
    }
  }

  useEffect(() => {
    if (user) {
      reloadChapters();
    }
  }, [user]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <AppContext.Provider
      value={{
        chapters,
        setChapters,
        reloadChapters,
        selectedChapter,
        setSelectedChapter,
        selectedAssignment,
        setSelectedAssignment,
        user,
        invertImages,
        setInvertImages,
        showTags,
        setShowTags,
        tags,
        setTags,
        loadTags,
        aliases,
        saveAlias,
        deleteAlias,
        reviewQuestions,
        setReviewQuestions,
      }}
    >
      <div className="app-root">
        <header className="topbar">
          <div className="brand">
            <Link to="/" className="brand-link">
              QStorer
            </Link>
          </div>
          <nav className="toplinks" style={{ alignItems: "center" }}>
            {!user ? (
              <>
                <Link to="/login" className="toplink">
                  Login
                </Link>
                <Link to="/register" className="toplink">
                  Register
                </Link>
              </>
            ) : (
              <>
                {/* Desktop Navigation */}
                <div className="desktop-nav" style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginRight: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <label
                        htmlFor="tags-toggle"
                        style={{
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          color: "var(--text-primary)",
                        }}
                      >
                        Show Tags
                      </label>
                      <label className="switch" style={{ margin: 0 }}>
                        <input
                          id="tags-toggle"
                          type="checkbox"
                          checked={showTags}
                          onChange={(e) => setShowTags(e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <label
                        htmlFor="invert-toggle"
                        style={{
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          color: "var(--text-primary)",
                        }}
                      >
                        Invert Images
                      </label>
                      <label className="switch" style={{ margin: 0 }}>
                        <input
                          id="invert-toggle"
                          type="checkbox"
                          checked={invertImages}
                          onChange={(e) => setInvertImages(e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <Link to="/tags" className="toplink">
                    Manage Tags
                  </Link>
                  <Link to="/create-chapter" className="toplink">
                    Create Chapter
                  </Link>
                  <Link to="/create-assignment" className="toplink">
                    Create Assignment
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="toplink"
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Logout
                  </button>
                </div>

                {/* Mobile Navigation Dropdown */}
                <div className="mobile-nav-container" ref={mobileNavRef}>
                  <button
                    className="toplink nav-toggle-btn"
                    onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                    style={{
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-light)",
                      cursor: "pointer",
                    }}
                  >
                    Navigate ▾
                  </button>
                  {isMobileNavOpen && (
                    <div className="mobile-dropdown">
                      <div className="mobile-dropdown-item toggle-item">
                        <span>Show Tags</span>
                        <label className="switch" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={showTags}
                            onChange={(e) => setShowTags(e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                      <div className="mobile-dropdown-item toggle-item">
                        <span>Invert Images</span>
                        <label className="switch" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={invertImages}
                            onChange={(e) => setInvertImages(e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                      <div className="dropdown-divider"></div>
                      <Link
                        to="/tags"
                        className="mobile-dropdown-item"
                        onClick={() => setIsMobileNavOpen(false)}
                      >
                        Manage Tags
                      </Link>
                      <Link
                        to="/create-chapter"
                        className="mobile-dropdown-item"
                        onClick={() => setIsMobileNavOpen(false)}
                      >
                        Create Chapter
                      </Link>
                      <Link
                        to="/create-assignment"
                        className="mobile-dropdown-item"
                        onClick={() => setIsMobileNavOpen(false)}
                      >
                        Create Assignment
                      </Link>
                      <div className="dropdown-divider"></div>
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsMobileNavOpen(false);
                        }}
                        className="mobile-dropdown-item danger"
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          width: "100%",
                          textAlign: "left",
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </nav>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create-chapter" element={<CreateChapter />} />
            <Route path="/create-assignment" element={<CreateAssignment />} />
            <Route path="/tags" element={<TagManager />} />
            <Route path="/review" element={<ReviewAssignment />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </main>
      </div>
    </AppContext.Provider>
  );
}
