"use client";

import { useState, useEffect } from "react";
import AdminPanel from "@/components/admin/AdminPanel";

const ADMIN_PASSWORD = "admin123"; // Simple password - can be changed

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if already authenticated
    const auth = localStorage.getItem("stable_configurator_admin_auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("stable_configurator_admin_auth", "true");
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Incorrect password");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("stable_configurator_admin_auth");
    setIsAuthenticated(false);
    setPassword("");
  };

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8f9fa",
        fontFamily: "Inter, sans-serif",
      }}>
        <div style={{
          backgroundColor: "white",
          padding: "40px",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          width: "100%",
          maxWidth: "400px",
        }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 24,
            color: "#1a1a1a",
            textAlign: "center",
          }}>
            Admin Login
          </h1>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
                color: "#1a1a1a",
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: 14,
                  border: "1px solid #e0e0e0",
                  borderRadius: 8,
                  fontFamily: "Inter, sans-serif",
                }}
                autoFocus
              />
              {error && (
                <div style={{
                  color: "#dc2626",
                  fontSize: 12,
                  marginTop: 8,
                }}>
                  {error}
                </div>
              )}
            </div>
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#1a5d1a",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#2d5a27";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#1a5d1a";
              }}
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminPanel onLogout={handleLogout} />;
}
