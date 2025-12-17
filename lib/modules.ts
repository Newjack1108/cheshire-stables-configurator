import { ModuleDef } from "@/components/configurator/types";

const makeStraightConnectors = (w: number, d: number) => [
  { id: "W" as const, x: 0, y: d / 2, nx: -1, ny: 0 },
  { id: "E" as const, x: w, y: d / 2, nx: 1, ny: 0 },
];

const makeCornerConnectors = (w: number, d: number) => [
  ...makeStraightConnectors(w, d),
  { id: "N" as const, x: w / 2, y: 0, nx: 0, ny: -1 },
  { id: "S" as const, x: w / 2, y: d, nx: 0, ny: 1 },
];

// Corner stable connectors: S connector at 10ft from left (center of 12ft blank), W connector on left side (door side)
const makeCornerStableConnectors = (w: number, d: number) => [
  { id: "S" as const, x: 10, y: d, nx: 0, ny: 1 }, // 10ft from left, 6ft from right, bottom edge
  { id: "W" as const, x: 0, y: d / 2, nx: -1, ny: 0 }, // Left side, center of depth (door side)
];

// RH Corner stable connectors: S connector at 6ft from left (center of 12ft blank on left side), E connector on right side (door side)
const makeRHCornerStableConnectors = (w: number, d: number) => [
  { id: "S" as const, x: 6, y: d, nx: 0, ny: 1 }, // 6ft from left, 10ft from right, bottom edge
  { id: "E" as const, x: w, y: d / 2, nx: 1, ny: 0 }, // Right side, center of depth (door side)
];

// Standard stable layout: 1ft blank + 4ft door + Xft blank + 2ft window + 1ft blank
// For widths >= 12ft, includes window. For smaller widths, no window.
function makeStandardStableLayout(widthFt: number) {
  const features: any[] = [];
  
  // Always start with 1ft blank panel
  features.push({ type: "panel", fromX: 0, toX: 1 });
  
  // 4ft door (hinged on right, opens outward)
  features.push({
    type: "opening",
    fromX: 1,
    toX: 5,
    doors: [{ widthFt: 4, hinge: "right", swing: "out" }],
  });
  
  if (widthFt >= 12) {
    // Standard layout with window: 1ft + 4ft door + 4ft blank + 2ft window + 1ft = 12ft
    // For wider stables, add extra blank space before window
    const blankBeforeWindow = widthFt - 12; // Extra space for wider stables
    const windowStart = 5 + 4 + blankBeforeWindow; // 5 (end of door) + 4 (standard blank) + extra
    
    // Blank panel after door
    features.push({ type: "panel", fromX: 5, toX: windowStart });
    
    // 2ft window
    features.push({ type: "window", fromX: windowStart, toX: windowStart + 2 });
    
    // 1ft blank at end
    features.push({ type: "panel", fromX: windowStart + 2, toX: "W" });
  } else {
    // Smaller stables: no window, just blank panel to end
    features.push({ type: "panel", fromX: 5, toX: "W" });
  }
  
  return features;
}

export const MODULES: ModuleDef[] = [
  // Standard Stables (6ft - 16ft wide, all 12ft deep)
  {
    id: "stable_6x12",
    name: "Stable 6x12",
    kind: "stable",
    widthFt: 6,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 2800,
    connectors: makeStraightConnectors(6, 12),
    frontFeatures: makeStandardStableLayout(6),
    extras: [
      { id: "window", name: "Window", price: 250, description: "Add a window to the stable" },
      { id: "partition", name: "Internal Partition", price: 350, description: "Divide the stable into two sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
  {
    id: "stable_8x12",
    name: "Stable 8x12",
    kind: "stable",
    widthFt: 8,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 3200,
    connectors: makeStraightConnectors(8, 12),
    frontFeatures: makeStandardStableLayout(8),
    extras: [
      { id: "window", name: "Window", price: 250, description: "Add a window to the stable" },
      { id: "partition", name: "Internal Partition", price: 400, description: "Divide the stable into two sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
  {
    id: "stable_10x12",
    name: "Stable 10x12",
    kind: "stable",
    widthFt: 10,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 3600,
    connectors: makeStraightConnectors(10, 12),
    frontFeatures: makeStandardStableLayout(10),
    extras: [
      { id: "window", name: "Window", price: 250, description: "Add a window to the stable" },
      { id: "partition", name: "Internal Partition", price: 450, description: "Divide the stable into two sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
  {
    id: "stable_12x12",
    name: "Stable 12x12",
    kind: "stable",
    widthFt: 12,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 4000,
    connectors: makeStraightConnectors(12, 12),
    frontFeatures: makeStandardStableLayout(12),
    extras: [
      { id: "window", name: "Window", price: 250, description: "Add a window to the stable" },
      { id: "partition", name: "Internal Partition", price: 500, description: "Divide the stable into two sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
  {
    id: "stable_14x12",
    name: "Stable 14x12",
    kind: "stable",
    widthFt: 14,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 4400,
    connectors: makeStraightConnectors(14, 12),
    frontFeatures: makeStandardStableLayout(14),
    extras: [
      { id: "window", name: "Window", price: 250, description: "Add a window to the stable" },
      { id: "partition", name: "Internal Partition", price: 550, description: "Divide the stable into two sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
  {
    id: "stable_16x12",
    name: "Stable 16x12",
    kind: "stable",
    widthFt: 16,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 4800,
    connectors: makeStraightConnectors(16, 12),
    frontFeatures: makeStandardStableLayout(16),
    extras: [
      { id: "window", name: "Window", price: 250, description: "Add a window to the stable" },
      { id: "partition", name: "Internal Partition", price: 600, description: "Divide the stable into two sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
  // Shelter - 12ft wide with 8ft opening in center, can have double doors
  {
    id: "shelter_12x12",
    name: "Shelter 12x12",
    kind: "shelter",
    widthFt: 12,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 3600,
    connectors: makeStraightConnectors(12, 12),
    frontFeatures: [
      { type: "panel", fromX: 0, toX: 2 }, // 2ft blank on left
      {
        type: "opening",
        fromX: 2,
        toX: 10, // 8ft opening (2ft to 10ft)
        // No doors by default, but can be added as extra
      },
      { type: "panel", fromX: 10, toX: "W" }, // 2ft blank on right
    ],
    extras: [
      { id: "double_doors", name: "Double Doors", price: 450, description: "Add double doors to opening (4ft each, outward opening)" },
      { id: "side_panels", name: "Side Panels", price: 400, description: "Add side panels for wind protection" },
      { id: "feed_trough", name: "Feed Trough", price: 180, description: "Wall-mounted feed trough" },
      { id: "water_point", name: "Water Point", price: 250, description: "Water connection point" },
    ],
  },
  // Corner Stable - 16x12 (left-hand)
  // Layout: 4ft door on left (0-4), 12ft blank on right (4-16)
  // S connector at center of 12ft blank = 10ft from left (4 + 6), 6ft from right
  {
    id: "corner_16x12",
    name: "Corner Stable 16x12",
    kind: "corner",
    widthFt: 16,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 5200,
    connectors: makeCornerStableConnectors(16, 12),
    frontFeatures: [
      // 4ft door on left (0-4ft)
      {
        type: "opening",
        fromX: 0,
        toX: 4,
        doors: [{ widthFt: 4, hinge: "right", swing: "out" }],
      },
      // 12ft blank panel on right (4-16ft) - connector is at center of this = 10ft from left
      { type: "panel", fromX: 4, toX: "W" },
    ],
    extras: [
      { id: "partition", name: "Internal Partition", price: 600, description: "Divide the stable into sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
  // RH Corner Stable - 16x12 (right-hand)
  // Layout: 12ft blank on left (0-12), 4ft door on right (12-16)
  // S connector at center of 12ft blank = 6ft from left, 10ft from right
  {
    id: "corner_rh_16x12",
    name: "RH Corner Stable 16x12",
    kind: "corner",
    widthFt: 16,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 5200,
    connectors: makeRHCornerStableConnectors(16, 12),
    frontFeatures: [
      // 12ft blank panel on left (0-12ft) - connector is at center of this = 6ft from left
      { type: "panel", fromX: 0, toX: 12 },
      // 4ft door on right (12-16ft)
      {
        type: "opening",
        fromX: 12,
        toX: 16,
        doors: [{ widthFt: 4, hinge: "left", swing: "out" }],
      },
    ],
    extras: [
      { id: "partition", name: "Internal Partition", price: 600, description: "Divide the stable into sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
  // Tack Room
  {
    id: "tack_room_12x12",
    name: "Tack Room 12x12",
    kind: "tack_room",
    widthFt: 12,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 4200,
    connectors: makeStraightConnectors(12, 12),
    frontFeatures: [
      { type: "panel", fromX: 0, toX: 2 },
      {
        type: "opening",
        fromX: 2,
        toX: 6,
        doors: [{ widthFt: 4, hinge: "right", swing: "out" }],
      },
      { type: "panel", fromX: 6, toX: "W" },
    ],
    extras: [
      { id: "saddle_rack", name: "Saddle Rack", price: 120, description: "Wall-mounted saddle rack" },
      { id: "bridle_hooks", name: "Bridle Hooks", price: 80, description: "Set of bridle hooks" },
      { id: "shelving", name: "Shelving Unit", price: 350, description: "Wall-mounted shelving" },
      { id: "workbench", name: "Workbench", price: 450, description: "Workbench for tack maintenance" },
      { id: "window", name: "Window", price: 250, description: "Add a window" },
      { id: "lighting", name: "LED Lighting", price: 200, description: "Additional LED lighting" },
    ],
  },
];
