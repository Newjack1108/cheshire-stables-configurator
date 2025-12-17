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

export const MODULES: ModuleDef[] = [
  {
    id: "stable_12x12",
    name: "Stable 12x12",
    kind: "stable",
    widthFt: 12,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 3500,
    connectors: makeStraightConnectors(12, 12),
    frontFeatures: [
      { type: "clad", fromX: 0, toX: 1 },
      {
        type: "opening",
        fromX: 1,
        toX: 5,
        doors: [{ widthFt: 4, hinge: "right", swing: "out" }],
      },
      { type: "panel", fromX: 5, toX: "W" },
    ],
    extras: [
      { id: "window", name: "Window", price: 250, description: "Add a window to the stable" },
      { id: "partition", name: "Internal Partition", price: 450, description: "Divide the stable into two sections" },
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
    basePrice: 4100,
    connectors: makeStraightConnectors(14, 12),
    frontFeatures: [
      { type: "clad", fromX: 0, toX: 1 },
      {
        type: "opening",
        fromX: 1,
        toX: 5,
        doors: [{ widthFt: 4, hinge: "right", swing: "out" }],
      },
      { type: "panel", fromX: 5, toX: "W" },
    ],
    extras: [
      { id: "window", name: "Window", price: 250, description: "Add a window to the stable" },
      { id: "partition", name: "Internal Partition", price: 550, description: "Divide the stable into two sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
  {
    id: "shelter_12_double",
    name: "Shelter 12x12 (Double Doors)",
    kind: "shelter",
    widthFt: 12,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 3600,
    connectors: makeStraightConnectors(12, 12),
    frontFeatures: [
      {
        type: "opening",
        fromX: 2,
        toX: 10,
        doors: [
          { widthFt: 4, hinge: "left", swing: "out", leaf: "left" },
          { widthFt: 4, hinge: "right", swing: "out", leaf: "right" },
        ],
      },
    ],
    extras: [
      { id: "side_panels", name: "Side Panels", price: 400, description: "Add side panels for wind protection" },
      { id: "feed_trough", name: "Feed Trough", price: 180, description: "Wall-mounted feed trough" },
      { id: "water_point", name: "Water Point", price: 250, description: "Water connection point" },
    ],
  },
  {
    id: "corner_16x12",
    name: "Corner Stable 16x12",
    kind: "corner",
    widthFt: 16,
    depthFt: 12,
    rotations: [0, 90, 180, 270],
    basePrice: 5200,
    connectors: makeCornerConnectors(16, 12),
    frontFeatures: [{ type: "opening", fromX: 12, toX: 16 }],
    extras: [
      { id: "window", name: "Window", price: 250, description: "Add a window to the stable" },
      { id: "partition", name: "Internal Partition", price: 600, description: "Divide the stable into sections" },
      { id: "feed_store", name: "Feed Store", price: 300, description: "Add feed storage area" },
      { id: "hay_rack", name: "Hay Rack", price: 150, description: "Wall-mounted hay rack" },
      { id: "water_trough", name: "Water Trough", price: 200, description: "Automatic water trough" },
    ],
  },
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
      { type: "clad", fromX: 0, toX: 2 },
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
