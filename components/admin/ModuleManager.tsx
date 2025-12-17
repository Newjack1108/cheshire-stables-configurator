"use client";

import { MODULES } from "@/lib/modules";

export default function ModuleManager() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#1a1a1a",
          margin: 0,
          marginBottom: 8,
        }}>
          Building Types Management
        </h2>
        <p style={{
          fontSize: 14,
          color: "#666",
          margin: 0,
        }}>
          Module definitions are currently managed in code. Full editing capabilities coming soon.
        </p>
      </div>

      <div style={{
        backgroundColor: "white",
        borderRadius: 12,
        padding: 24,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
      }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 16,
          color: "#1a1a1a",
        }}>
          Available Building Types
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {MODULES.map((module) => (
            <div key={module.id} style={{
              padding: 16,
              border: "1px solid #e0e0e0",
              borderRadius: 8,
            }}>
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 8,
                color: "#1a1a1a",
              }}>
                {module.name}
              </div>
              <div style={{
                fontSize: 13,
                color: "#666",
                marginBottom: 12,
              }}>
                {module.kind} • {module.widthFt}ft × {module.depthFt}ft
              </div>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#1a5d1a",
                marginBottom: 8,
              }}>
                Base Price: £{module.basePrice.toLocaleString()}
              </div>
              <div style={{
                fontSize: 13,
                color: "#666",
              }}>
                <strong>Connectors:</strong> {module.connectors.map((c) => c.id).join(", ")}
              </div>
              <div style={{
                fontSize: 13,
                color: "#666",
                marginTop: 8,
              }}>
                <strong>Extras:</strong> {module.extras.length} available
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
