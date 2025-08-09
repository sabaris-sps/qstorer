// src/pages/Register.js
import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(null);
  const nav = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      nav("/");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="form-page center">
      <h2>Create account</h2>
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        placeholder="Password"
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
      />
      <div className="form-actions">
        {" "}
        {/* Add this class */}
        <button className="primary" onClick={handleRegister}>
          Register
        </button>
        <Link to="/login" className="ghost-btn">
          Login
        </Link>
      </div>
      {err && <div style={{ color: "var(--danger)", marginTop: 8 }}>{err}</div>}
    </div>
  );
}
