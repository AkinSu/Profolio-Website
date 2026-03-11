"use client";

import { useState } from "react";

interface AdminLoginProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onClose: () => void;
}

export function AdminLogin({ onLogin, onClose }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const success = await onLogin(username, password);
    setLoading(false);

    if (!success) {
      // One wrong attempt → close and redirect to visitor page
      setError(true);
      setTimeout(() => {
        onClose();
      }, 800);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fffef5",
          borderRadius: 12,
          padding: "32px 28px",
          width: 320,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          fontFamily: "'Caveat', cursive",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#2d2a26",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Admin Login
        </h2>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#b91c1c",
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 16,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            Wrong credentials — redirecting...
          </div>
        )}

        <label style={{ fontSize: 18, color: "#4a4540", display: "block", marginBottom: 4 }}>
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          disabled={loading || error}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: 18,
            border: "2px solid #d4c9a8",
            borderRadius: 8,
            background: "#faf8f0",
            color: "#2d2a26",
            marginBottom: 14,
            fontFamily: "inherit",
            outline: "none",
          }}
        />

        <label style={{ fontSize: 18, color: "#4a4540", display: "block", marginBottom: 4 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading || error}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: 18,
            border: "2px solid #d4c9a8",
            borderRadius: 8,
            background: "#faf8f0",
            color: "#2d2a26",
            marginBottom: 20,
            fontFamily: "inherit",
            outline: "none",
          }}
        />

        <button
          type="submit"
          disabled={loading || error || !username || !password}
          style={{
            width: "100%",
            padding: "10px 0",
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "inherit",
            background: loading || error ? "#ccc" : "#4a4540",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: loading || error ? "default" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
