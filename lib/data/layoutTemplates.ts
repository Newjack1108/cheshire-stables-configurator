import { PlacedUnit, Connection } from "@/components/configurator/types";

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  units: PlacedUnit[];
  connections: Connection[];
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export const DEFAULT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "single_stable",
    name: "Single Stable",
    description: "A single 12x12 stable unit",
    units: [
      { uid: uid(), moduleId: "stable_12x12", xFt: 0, yFt: 0, rot: 0, selectedExtras: [] },
    ],
    connections: [],
  },
  {
    id: "l_shaped_corner",
    name: "L-Shaped Corner",
    description: "Corner stable with two additional stables forming an L-shape",
    units: [
      { uid: "corner1", moduleId: "corner_lh_16x12", xFt: 0, yFt: 0, rot: 0, selectedExtras: [] },
      { uid: "stable1", moduleId: "stable_12x12", xFt: 16, yFt: 0, rot: 0, selectedExtras: [] },
      { uid: "stable2", moduleId: "stable_12x12", xFt: 0, yFt: 12, rot: 0, selectedExtras: [] },
    ],
    connections: [
      { aUid: "corner1", aConn: "W", bUid: "stable1", bConn: "W" },
      { aUid: "corner1", aConn: "S", bUid: "stable2", bConn: "W" },
    ],
  },
  {
    id: "straight_row",
    name: "Straight Row",
    description: "Three stables in a straight line",
    units: [
      { uid: "row1", moduleId: "stable_12x12", xFt: 0, yFt: 0, rot: 0, selectedExtras: [] },
      { uid: "row2", moduleId: "stable_12x12", xFt: 12, yFt: 0, rot: 0, selectedExtras: [] },
      { uid: "row3", moduleId: "stable_12x12", xFt: 24, yFt: 0, rot: 0, selectedExtras: [] },
    ],
    connections: [
      { aUid: "row1", aConn: "E", bUid: "row2", bConn: "W" },
      { aUid: "row2", aConn: "E", bUid: "row3", bConn: "W" },
    ],
  },
  {
    id: "u_shaped",
    name: "U-Shaped Layout",
    description: "Three stables forming a U-shape with a tack room in the center",
    units: [
      { uid: "u1", moduleId: "stable_12x12", xFt: 0, yFt: 0, rot: 0, selectedExtras: [] },
      { uid: "tack1", moduleId: "tack_room_12x12", xFt: 12, yFt: 0, rot: 0, selectedExtras: [] },
      { uid: "u2", moduleId: "stable_12x12", xFt: 24, yFt: 0, rot: 0, selectedExtras: [] },
      { uid: "u3", moduleId: "stable_12x12", xFt: 12, yFt: 12, rot: 180, selectedExtras: [] },
    ],
    connections: [
      { aUid: "u1", aConn: "E", bUid: "tack1", bConn: "W" },
      { aUid: "tack1", aConn: "E", bUid: "u2", bConn: "W" },
      { aUid: "tack1", aConn: "S", bUid: "u3", bConn: "N" },
    ],
  },
];

// Helper function to get template by ID
export function getTemplate(id: string): LayoutTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.id === id);
}

// Helper function to get all templates
export function getAllTemplates(): LayoutTemplate[] {
  // Load user-saved templates from localStorage
  const savedTemplates = loadSavedTemplates();
  return [...DEFAULT_TEMPLATES, ...savedTemplates];
}

// Load user-saved templates from localStorage
export function loadSavedTemplates(): LayoutTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("stable_configurator_templates");
    if (!saved) return [];
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

// Save template to localStorage
export function saveTemplate(template: LayoutTemplate): void {
  if (typeof window === "undefined") return;
  try {
    const saved = loadSavedTemplates();
    // Check if template with same ID exists, replace it
    const index = saved.findIndex((t) => t.id === template.id);
    if (index >= 0) {
      saved[index] = template;
    } else {
      saved.push(template);
    }
    localStorage.setItem("stable_configurator_templates", JSON.stringify(saved));
  } catch (error) {
    console.error("Failed to save template:", error);
  }
}

// Delete template from localStorage
export function deleteTemplate(templateId: string): void {
  if (typeof window === "undefined") return;
  try {
    const saved = loadSavedTemplates();
    const filtered = saved.filter((t) => t.id !== templateId);
    localStorage.setItem("stable_configurator_templates", JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to delete template:", error);
  }
}

