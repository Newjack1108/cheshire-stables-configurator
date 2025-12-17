"use client";

import { useState } from "react";
import PricingManager from "./PricingManager";
import ModuleManager from "./ModuleManager";
import DesignManager from "./DesignManager";

interface AdminPanelProps {
  onLogout: () => void;
}

type Tab = "pricing" | "modules" | "designs";

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("pricing");

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f8f9fa",
      fontFamily: "Inter, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "1px solid #e0e0e0",
        padding: "20px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#1a1a1a",
          margin: 0,
        }}>
          Admin Dashboard
        </h1>
        <button
          onClick={onLogout}
          style={{
            padding: "10px 20px",
            backgroundColor: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#ef4444";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#dc2626";
          }}
        >
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "1px solid #e0e0e0",
        padding: "0 24px",
        display: "flex",
        gap: 8,
      }}>
        {(["pricing", "modules", "designs"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 24px",
              backgroundColor: activeTab === tab ? "#1a5d1a" : "transparent",
              color: activeTab === tab ? "white" : "#666",
              border: "none",
              borderBottom: activeTab === tab ? "3px solid #1a5d1a" : "3px solid transparent",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              transition: "all 0.2s ease",
              textTransform: "capitalize",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab) {
                e.currentTarget.style.backgroundColor = "#f5f5f5";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            {tab === "pricing" ? "Pricing" : tab === "modules" ? "Building Types" : "Pre-built Designs"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
        {activeTab === "pricing" && <PricingManager />}
        {activeTab === "modules" && <ModuleManager />}
        {activeTab === "designs" && <DesignManager />}
      </div>
    </div>
  );
}
