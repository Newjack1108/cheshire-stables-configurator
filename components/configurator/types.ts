export type Rotation = 0 | 90 | 180 | 270;

export type DoorLeaf = {
  widthFt: number;
  hinge: "left" | "right";
  swing: "out";
  leaf?: "left" | "right";
};

export type FrontFeature =
  | { type: "clad" | "panel"; fromX: number; toX: number | "W" }
  | { type: "opening"; fromX: number; toX: number; doors?: DoorLeaf[] }
  | { type: "window"; fromX: number; toX: number };

export type ConnectorId = "W" | "E" | "N" | "S";

export type ConnectorDef = {
  id: ConnectorId;
  x: number;
  y: number;
  nx: number;
  ny: number;
};

export type Extra = {
  id: string;
  name: string;
  price: number;
  description?: string;
};

export type ModuleDef = {
  id: string;
  name: string;
  kind: "stable" | "shelter" | "corner" | "tack_room";
  widthFt: number;
  depthFt: 12;
  rotations: Rotation[];
  basePrice: number;
  connectors: ConnectorDef[];
  frontFeatures: FrontFeature[];
  extras: Extra[];
};

export type PlacedUnit = {
  uid: string;
  moduleId: string;
  xFt: number;
  yFt: number;
  rot: Rotation;
  selectedExtras?: string[]; // Array of extra IDs
};

export type Connection = {
  aUid: string;
  aConn: ConnectorId;
  bUid: string;
  bConn: ConnectorId;
};
