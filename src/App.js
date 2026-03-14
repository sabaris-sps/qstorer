import React, { useEffect, useState, createContext } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import CreateChapter from "./pages/CreateChapter";
import CreateAssignment from "./pages/CreateAssignment";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TagManager from "./pages/TagManager"; // NEW IMPORT
import { auth, db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import "./App.css";

export const AppContext = createContext();

export default function App() {
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [user, setUser] = useState(null);

  // NEW: Global Tags state
  const [tags, setTags] = useState([]);

  const navigate = useNavigate();

  const [invertImages, setInvertImages] = useState(() => {
    const saved = localStorage.getItem("invertImages");
    return saved === "true";
  });

  // NEW: Show/Hide Tags toggle
  const [showTags, setShowTags] = useState(() => {
    const saved = localStorage.getItem("showTags");
    return saved !== "false"; // Default to true
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setSelectedChapter("");
      setSelectedAssignment("");
      if (u) {
        loadTags(u.uid); // Load tags on login
      } else {
        setTags([]);
      }
    });
    return () => unsub();
  }, []);

  // NEW: Load global tags
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

  useEffect(() => {
    localStorage.setItem("invertImages", invertImages);
    if (invertImages) {
      document.body.classList.add("invert-all-images");
    } else {
      document.body.classList.remove("invert-all-images");
    }
  }, [invertImages]);

  // NEW: Sync showTags with local storage
  useEffect(() => {
    localStorage.setItem("showTags", showTags);
  }, [showTags]);

  async function reloadChapters() {}

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
        showTags, // Pass to context
        tags, // Pass to context
        setTags, // Pass to context
        loadTags, // Pass to context
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
              </>
            )}
          </nav>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create-chapter" element={<CreateChapter />} />
            <Route path="/create-assignment" element={<CreateAssignment />} />
            <Route path="/tags" element={<TagManager />} /> {/* NEW ROUTE */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </main>
      </div>
    </AppContext.Provider>
  );
}
