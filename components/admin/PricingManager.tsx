"use client";

import { useState, useEffect } from "react";
import { MODULES } from "@/lib/modules";

type PricingData = {
  modules: Record<string, number>;
  extras: Record<string, number>;
};

const defaultPricing: PricingData = {
  modules: {
    stable_6x12: 2800,
    stable_8x12: 3200,
    stable_10x12: 3600,
    stable_12x12: 4000,
    stable_14x12: 4400,
    stable_16x12: 4800,
    shelter_12x12: 3600,
    corner_16x12: 5200,
    corner_rh_16x12: 5200,
    tack_room_12x12: 4200,
  },
  extras: {
    window: 250,
    partition: 350,
    feed_store: 300,
    hay_rack: 150,
    water_trough: 200,
    double_doors: 450,
    side_panels: 400,
    feed_trough: 180,
    water_point: 250,
    saddle_rack: 120,
    bridle_hooks: 80,
    shelving: 350,
    workbench: 450,
    lighting: 200,
  },
};

export default function PricingManager() {
  const [pricing, setPricing] = useState<PricingData>(defaultPricing);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem("stable_configurator_pricing");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PricingData;
        setPricing(parsed);
      } catch {
        // Use default
        setPricing(defaultPricing);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("stable_configurator_pricing", JSON.stringify(pricing));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateModulePrice = (moduleId: string, price: number) => {
    setPricing({
      ...pricing,
      modules: {
        ...pricing.modules,
        [moduleId]: price,
      },
    });
  };

  const updateExtraPrice = (extraId: string, price: number) => {
    setPricing({
      ...pricing,
      extras: {
        ...pricing.extras,
        [extraId]: price,
      },
    });
  };

  // Get all unique extras from modules
  const allExtras = new Set<string>();
  MODULES.forEach((m) => {
    m.extras.forEach((e) => allExtras.add(e.id));
  });

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
          Pricing Management
        </h2>
        <button
          onClick={handleSave}
          style={{
            padding: "10px 20px",
            backgroundColor: saved ? "#10b981" : "#1a5d1a",
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
          {saved ? "✓ Saved" : "Save Changes"}
        </button>
      </div>

      {/* Module Prices */}
      <div style={{
        backgroundColor: "white",
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
      }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 16,
          color: "#1a1a1a",
        }}>
          Module Base Prices
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
          {MODULES.map((module) => (
            <div key={module.id} style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 12,
              border: "1px solid #e0e0e0",
              borderRadius: 8,
            }}>
              <label style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#666",
              }}>
                {module.name}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#666" }}>£</span>
                <input
                  type="number"
                  value={pricing.modules[module.id] || module.basePrice}
                  onChange={(e) => updateModulePrice(module.id, parseFloat(e.target.value) || 0)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    fontSize: 14,
                    border: "1px solid #e0e0e0",
                    borderRadius: 6,
                    fontFamily: "Inter, sans-serif",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Extra Prices */}
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
          Extra Prices
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
          {Array.from(allExtras).map((extraId) => {
            const extra = MODULES.flatMap((m) => m.extras).find((e) => e.id === extraId);
            if (!extra) return null;
            return (
              <div key={extraId} style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 12,
                border: "1px solid #e0e0e0",
                borderRadius: 8,
              }}>
                <label style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#666",
                }}>
                  {extra.name}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, color: "#666" }}>£</span>
                  <input
                    type="number"
                    value={pricing.extras[extraId] || extra.price}
                    onChange={(e) => updateExtraPrice(extraId, parseFloat(e.target.value) || 0)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      fontSize: 14,
                      border: "1px solid #e0e0e0",
                      borderRadius: 6,
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
