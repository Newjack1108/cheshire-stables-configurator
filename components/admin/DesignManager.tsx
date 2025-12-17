"use client";

import { useState, useEffect } from "react";
import { PlacedUnit, Connection } from "@/components/configurator/types";

interface PreBuiltDesign {
  id: string;
  name: string;
  description: string;
  units: PlacedUnit[];
  connections: Connection[];
  totalCost?: number;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function DesignManager() {
  const [designs, setDesigns] = useState<PreBuiltDesign[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDesign, setEditingDesign] = useState<PreBuiltDesign | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("stable_configurator_designs");
    if (saved) {
      try {
        setDesigns(JSON.parse(saved));
      } catch {
        // Use default
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("stable_configurator_designs", JSON.stringify(designs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleNewDesign = () => {
    const newDesign: PreBuiltDesign = {
      id: `design_${Date.now()}`,
      name: "New Design",
      description: "",
      units: [],
      connections: [],
    };
    setEditingDesign(newDesign);
    setEditingId(newDesign.id);
  };

  const handleEditDesign = (design: PreBuiltDesign) => {
    setEditingDesign({ ...design });
    setEditingId(design.id);
  };

  const handleDeleteDesign = (id: string) => {
    if (confirm("Delete this design?")) {
      setDesigns(designs.filter((d) => d.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditingDesign(null);
      }
    }
  };

  const handleSaveDesign = () => {
    if (!editingDesign) return;
    const index = designs.findIndex((d) => d.id === editingDesign.id);
    if (index >= 0) {
      const updated = [...designs];
      updated[index] = editingDesign;
      setDesigns(updated);
    } else {
      setDesigns([...designs, editingDesign]);
    }
    setEditingId(null);
    setEditingDesign(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingDesign(null);
  };

  if (editingId && editingDesign) {
    return (
      <div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1a1a1a",
            margin: 0,
          }}>
            {editingDesign.id.startsWith("design_") ? "New Design" : "Edit Design"}
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleCancelEdit}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDesign}
              style={{
                padding: "10px 20px",
                backgroundColor: "#1a5d1a",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Save Design
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 8,
              color: "#1a1a1a",
            }}>
              Design Name
            </label>
            <input
              type="text"
              value={editingDesign.name}
              onChange={(e) => setEditingDesign({ ...editingDesign, name: e.target.value })}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: 14,
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                fontFamily: "Inter, sans-serif",
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 8,
              color: "#1a1a1a",
            }}>
              Description
            </label>
            <textarea
              value={editingDesign.description}
              onChange={(e) => setEditingDesign({ ...editingDesign, description: e.target.value })}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: 14,
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                fontFamily: "Inter, sans-serif",
                minHeight: "80px",
              }}
            />
          </div>
          <div style={{
            padding: "16px",
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
            fontSize: 13,
            color: "#666",
          }}>
            <strong>Note:</strong> To add units and connections to this design, create the layout in the configurator and use "Save as Template", then copy the JSON structure here. Full design builder coming soon.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
      }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#1a1a1a",
          margin: 0,
        }}>
          Pre-built Designs
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleNewDesign}
            style={{
              padding: "10px 20px",
              backgroundColor: "#1a5d1a",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              transition: "all 0.2s ease",
            }}
          >
            + New Design
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "10px 20px",
              backgroundColor: saved ? "#10b981" : "#4a5568",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              transition: "all 0.2s ease",
            }}
          >
            {saved ? "✓ Saved" : "Save All"}
          </button>
        </div>
      </div>

      {designs.length === 0 ? (
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: "40px",
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        }}>
          <p style={{
            fontSize: 16,
            color: "#666",
            margin: 0,
          }}>
            No pre-built designs yet. Click "New Design" to create one.
          </p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}>
          {designs.map((design) => (
            <div key={design.id} style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            }}>
              <div style={{
                fontSize: 18,
                fontWeight: 600,
                marginBottom: 8,
                color: "#1a1a1a",
              }}>
                {design.name}
              </div>
              <div style={{
                fontSize: 13,
                color: "#666",
                marginBottom: 16,
              }}>
                {design.description || "No description"}
              </div>
              <div style={{
                fontSize: 13,
                color: "#666",
                marginBottom: 16,
              }}>
                {design.units.length} units • {design.connections.length} connections
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleEditDesign(design)}
                  style={{
                    flex: 1,
                    padding: "8px 16px",
                    backgroundColor: "#4a5568",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteDesign(design.id)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
