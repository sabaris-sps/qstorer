// src/App.js
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

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setSelectedChapter("");
      setSelectedAssignment("");
    });
    return () => unsub();
  }, []);

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
      }}
    >
      <div className="app-root">
        <header className="topbar">
          <div className="brand">
            <Link to="/" className="brand-link">
              QStorer
            </Link>
          </div>
          <nav className="toplinks">
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
