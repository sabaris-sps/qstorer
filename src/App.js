// src/App.jsx
import React, { useEffect, useState, createContext } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import CreateChapter from "./pages/CreateChapter";
import CreateAssignment from "./pages/CreateAssignment";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import "./App.css";

export const AppContext = createContext();

export default function App() {
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Initialize from localStorage (defaults to false)
  const [invertImages, setInvertImages] = useState(() => {
    const saved = localStorage.getItem("invertImages");
    return saved === "true";
  });

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setSelectedChapter("");
      setSelectedAssignment("");
    });
    return () => unsub();
  }, []);

  // Sync invertImages with localStorage and update body class
  useEffect(() => {
    localStorage.setItem("invertImages", invertImages);
    if (invertImages) {
      document.body.classList.add("invert-all-images");
    } else {
      document.body.classList.remove("invert-all-images");
    }
  }, [invertImages]);

  async function reloadChapters() {
    // Chapters are loaded in Home and other pages (using user context)
  }

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
        invertImages, // Exported in case you need it in other components later
        setInvertImages,
      }}
    >
      <div className="app-root">
        <header className="topbar">
          <div className="brand">
            <Link to="/" className="brand-link">
              QStorer
            </Link>
          </div>
          {/* Added align-items: center so the toggle sits perfectly centered */}
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
                    gap: "8px",
                    marginRight: "12px",
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
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </main>
      </div>
    </AppContext.Provider>
  );
}
