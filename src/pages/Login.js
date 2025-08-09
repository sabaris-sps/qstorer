// src/pages/Login.js
import React, { useContext, useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { AppContext } from "../App";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(null);
  const { user } = useContext(AppContext);
  const nav = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      nav("/");
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    if (user) {
      nav("/");
    }
  }, [nav, user]);

  return (
    <div className="form-page center">
      <h2>Login</h2>
      <input
        placeholder="Email"
        value={email}
        type="email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        placeholder="Password"
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
      />
      <div className="form-actions">
        <button className="primary" onClick={handleLogin}>
          Login
        </button>
        <Link to="/register" className="ghost-btn">
          Register
        </Link>
      </div>
      {err && <div style={{ color: "var(--danger)", marginTop: 8 }}>{err}</div>}
    </div>
  );
}
