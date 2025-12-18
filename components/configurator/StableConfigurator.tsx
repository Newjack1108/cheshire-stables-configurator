"use client";

import React, { useMemo, useState, useRef } from "react";
import { MODULES } from "@/lib/modules";
import {
  rotatedSize,
  rotatePoint,
  rotateVec,
} from "@/lib/geometry";
import {
  ModuleDef,
  PlacedUnit,
  Connection,
  ConnectorId,
  ConnectorDef,
  Rotation,
  FrontFeature,
} from "./types";

const FT_TO_PX = 20;
const STROKE = 2;
const WALL_THICKNESS = 0.3;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function getModule(id: string) {
  const m = MODULES.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown module ${id}`);
  return m;
}

function bbox(u: PlacedUnit, m: ModuleDef) {
  const { w, d } = rotatedSize(m.widthFt, m.depthFt, u.rot);
  return { x: u.xFt, y: u.yFt, w, d };
}

function connectorWorld(
  u: PlacedUnit,
  m: ModuleDef,
  c: { x: number; y: number; nx: number; ny: number }
) {
  const p = rotatePoint(c.x, c.y, m.widthFt, m.depthFt, u.rot);
  const v = rotateVec(c.nx, c.ny, u.rot);
  return { x: u.xFt + p.x, y: u.yFt + p.y, nx: v.nx, ny: v.ny };
}

function nextRotation(rots: Rotation[], r: Rotation): Rotation {
  const i = rots.indexOf(r);
  return rots[(i + 1) % rots.length];
}

// Get the front face direction based on rotation
function getFrontFace(rot: Rotation): "N" | "E" | "S" | "W" {
  switch (rot) {
    case 0:
      return "S";
    case 90:
      return "W";
    case 180:
      return "N";
    case 270:
      return "E";
  }
}

// Get which wall a connector is on based on its normal vector
// Returns the direction the wall faces (the wall normal points outward from the wall)
function getConnectorWallDirection(connNx: number, connNy: number, rot: Rotation): "N" | "E" | "S" | "W" {
  // Rotate the connector normal vector
  const rotated = rotateVec(connNx, connNy, rot);
  
  // Determine which wall this connector is on based on the rotated normal
  // Normal pointing up (ny > 0) = bottom wall (S)
  // Normal pointing down (ny < 0) = top wall (N)
  // Normal pointing right (nx > 0) = right wall (E)
  // Normal pointing left (nx < 0) = left wall (W)
  if (Math.abs(rotated.ny) > Math.abs(rotated.nx)) {
    return rotated.ny > 0 ? "S" : "N";
  } else {
    return rotated.nx > 0 ? "E" : "W";
  }
}

// Transform front feature coordinates to world coordinates
function transformFrontFeature(
  feature: FrontFeature,
  widthFt: number,
  depthFt: number,
  rot: Rotation
): FrontFeature {
  const width = rot === 90 || rot === 270 ? depthFt : widthFt;
  const depth = rot === 90 || rot === 270 ? widthFt : depthFt;

  if (feature.type === "opening" || feature.type === "clad" || feature.type === "panel") {
    const toX = feature.toX === "W" ? width : feature.toX;
    
    // For rotation, we need to map the front face
    // Front face is always the "S" edge in 0 rotation
    // We'll render features on the appropriate edge based on rotation
    return {
      ...feature,
      fromX: feature.fromX,
      toX: toX,
    };
  }
  return feature;
}

// Render door opening and door leaf
function renderDoor(
  feature: FrontFeature,
  widthFt: number,
  depthFt: number,
  rot: Rotation,
  isSelected: boolean
) {
  if (feature.type !== "opening" || !feature.doors) return null;

  const { w, d } = rotatedSize(widthFt, depthFt, rot);
  const frontFace = getFrontFace(rot);
  
  // Transform coordinates based on rotation
  // frontFeatures are defined with fromX/toX along the width dimension (0 to widthFt)
  // When rotated, we need to map these to the appropriate edge:
  // At 0°: front is bottom (S), fromX goes left to right along width ✓
  // At 90°: front is left (W), fromX maps along depth (bottom to top)
  // At 180°: front is top (N), fromX maps along width (right to left, reversed)
  // At 270°: front is right (E), fromX maps along depth (top to bottom, reversed)
  
  let openingStart: number;
  let openingEnd: number;
  
  // Map the fromX coordinate to the correct position on the front edge
  if (frontFace === "S") {
    // Bottom edge - left to right along width
    openingStart = feature.fromX;
    openingEnd = feature.toX;
  } else if (frontFace === "N") {
    // Top edge - right to left along width (reversed)
    openingStart = widthFt - feature.toX;
    openingEnd = widthFt - feature.fromX;
  } else if (frontFace === "W") {
    // Left edge - bottom to top along depth
    // Use fromX directly (it's a position along the front face)
    openingStart = feature.fromX;
    openingEnd = feature.toX;
  } else {
    // Right edge - top to bottom along depth (reversed)
    openingStart = depthFt - feature.toX;
    openingEnd = depthFt - feature.fromX;
  }

  const elements: React.ReactElement[] = [];

  // Draw opening gap indicators (small lines showing where wall is broken)
  const gapIndicatorLength = 4;
  if (frontFace === "S" || frontFace === "N") {
    // Horizontal edge (bottom or top)
    const y = frontFace === "S" ? d * FT_TO_PX : 0;
    const yOffset = frontFace === "S" ? -gapIndicatorLength : gapIndicatorLength;
    
    elements.push(
      <line
        key="opening-left"
        x1={openingStart * FT_TO_PX}
        y1={y}
        x2={openingStart * FT_TO_PX}
        y2={y + yOffset}
        stroke="#666"
        strokeWidth={STROKE}
      />,
      <line
        key="opening-right"
        x1={openingEnd * FT_TO_PX}
        y1={y}
        x2={openingEnd * FT_TO_PX}
        y2={y + yOffset}
        stroke="#666"
        strokeWidth={STROKE}
      />
    );
  } else {
    // Vertical edge (left or right)
    const x = frontFace === "E" ? w * FT_TO_PX : 0;
    const xOffset = frontFace === "E" ? gapIndicatorLength : -gapIndicatorLength;
    
    elements.push(
      <line
        key="opening-top"
        x1={x}
        y1={openingStart * FT_TO_PX}
        x2={x + xOffset}
        y2={openingStart * FT_TO_PX}
        stroke="#666"
        strokeWidth={STROKE}
      />,
      <line
        key="opening-bottom"
        x1={x}
        y1={openingEnd * FT_TO_PX}
        x2={x + xOffset}
        y2={openingEnd * FT_TO_PX}
        stroke="#666"
        strokeWidth={STROKE}
      />
    );
  }

  // Door arcs removed - just show the opening indicators

  return <g>{elements}</g>;
}

// Render window
function renderWindow(
  feature: FrontFeature,
  widthFt: number,
  depthFt: number,
  rot: Rotation,
  isSelected: boolean
) {
  if (feature.type !== "window") return null;

  const { w, d } = rotatedSize(widthFt, depthFt, rot);
  const frontFace = getFrontFace(rot);
  
  let windowStart: number;
  let windowEnd: number;
  
  // Map window coordinates based on rotation
  if (frontFace === "S") {
    windowStart = feature.fromX;
    windowEnd = feature.toX;
  } else if (frontFace === "N") {
    windowStart = widthFt - feature.toX;
    windowEnd = widthFt - feature.fromX;
  } else if (frontFace === "W") {
    windowStart = feature.fromX;
    windowEnd = feature.toX;
  } else {
    windowStart = depthFt - feature.toX;
    windowEnd = depthFt - feature.fromX;
  }

  const elements: React.ReactElement[] = [];
  const windowWidth = windowEnd - windowStart;

  if (frontFace === "S" || frontFace === "N") {
    // Horizontal edge
    const y = frontFace === "S" ? d * FT_TO_PX : 0;
    const yOffset = frontFace === "S" ? -WALL_THICKNESS * FT_TO_PX : WALL_THICKNESS * FT_TO_PX;
    
    // Window frame (rectangle with cross)
    elements.push(
      <rect
        key="window-frame"
        x={windowStart * FT_TO_PX}
        y={frontFace === "S" ? y - WALL_THICKNESS * FT_TO_PX : y}
        width={windowWidth * FT_TO_PX}
        height={WALL_THICKNESS * FT_TO_PX}
        fill={isSelected ? "#b3d9ff" : "#e6f3ff"}
        stroke={isSelected ? "#0066cc" : "#4da6ff"}
        strokeWidth={1}
      />,
      // Window cross (X pattern)
      <line
        key="window-cross-1"
        x1={windowStart * FT_TO_PX}
        y1={frontFace === "S" ? y - WALL_THICKNESS * FT_TO_PX : y}
        x2={(windowStart + windowWidth) * FT_TO_PX}
        y2={frontFace === "S" ? y : y + WALL_THICKNESS * FT_TO_PX}
        stroke={isSelected ? "#0066cc" : "#4da6ff"}
        strokeWidth={1}
      />,
      <line
        key="window-cross-2"
        x1={windowStart * FT_TO_PX}
        y1={frontFace === "S" ? y : y + WALL_THICKNESS * FT_TO_PX}
        x2={(windowStart + windowWidth) * FT_TO_PX}
        y2={frontFace === "S" ? y - WALL_THICKNESS * FT_TO_PX : y}
        stroke={isSelected ? "#0066cc" : "#4da6ff"}
        strokeWidth={1}
      />
    );
  } else {
    // Vertical edge
    const x = frontFace === "E" ? w * FT_TO_PX : 0;
    const xOffset = frontFace === "E" ? WALL_THICKNESS * FT_TO_PX : -WALL_THICKNESS * FT_TO_PX;
    
    elements.push(
      <rect
        key="window-frame"
        x={frontFace === "E" ? x : x - WALL_THICKNESS * FT_TO_PX}
        y={windowStart * FT_TO_PX}
        width={WALL_THICKNESS * FT_TO_PX}
        height={windowWidth * FT_TO_PX}
        fill={isSelected ? "#b3d9ff" : "#e6f3ff"}
        stroke={isSelected ? "#0066cc" : "#4da6ff"}
        strokeWidth={1}
      />,
      <line
        key="window-cross-1"
        x1={frontFace === "E" ? x : x - WALL_THICKNESS * FT_TO_PX}
        y1={windowStart * FT_TO_PX}
        x2={frontFace === "E" ? x + WALL_THICKNESS * FT_TO_PX : x}
        y2={(windowStart + windowWidth) * FT_TO_PX}
        stroke={isSelected ? "#0066cc" : "#4da6ff"}
        strokeWidth={1}
      />,
      <line
        key="window-cross-2"
        x1={frontFace === "E" ? x : x - WALL_THICKNESS * FT_TO_PX}
        y1={(windowStart + windowWidth) * FT_TO_PX}
        x2={frontFace === "E" ? x + WALL_THICKNESS * FT_TO_PX : x}
        y2={windowStart * FT_TO_PX}
        stroke={isSelected ? "#0066cc" : "#4da6ff"}
        strokeWidth={1}
      />
    );
  }

  return <g>{elements}</g>;
}

// Render preview door opening (simplified for preview)
function renderPreviewDoor(
  feature: FrontFeature,
  widthFt: number,
  depthFt: number,
  rot: Rotation
) {
  if (feature.type !== "opening") return null;

  const { w, d } = rotatedSize(widthFt, depthFt, rot);
  const frontFace = getFrontFace(rot);
  
  let openingStart: number;
  let openingEnd: number;
  
  if (frontFace === "S") {
    openingStart = feature.fromX;
    openingEnd = feature.toX;
  } else if (frontFace === "N") {
    openingStart = widthFt - feature.toX;
    openingEnd = widthFt - feature.fromX;
  } else if (frontFace === "W") {
    openingStart = feature.fromX;
    openingEnd = feature.toX;
  } else {
    openingStart = depthFt - feature.toX;
    openingEnd = depthFt - feature.fromX;
  }

  const gapIndicatorLength = 4;
  if (frontFace === "S" || frontFace === "N") {
    const y = frontFace === "S" ? d * FT_TO_PX : 0;
    const yOffset = frontFace === "S" ? -gapIndicatorLength : gapIndicatorLength;
    
    return (
      <g>
        <line
          x1={openingStart * FT_TO_PX}
          y1={y}
          x2={openingStart * FT_TO_PX}
          y2={y + yOffset}
          stroke="#333"
          strokeWidth={STROKE}
        />
        <line
          x1={openingEnd * FT_TO_PX}
          y1={y}
          x2={openingEnd * FT_TO_PX}
          y2={y + yOffset}
          stroke="#333"
          strokeWidth={STROKE}
        />
      </g>
    );
  } else {
    const x = frontFace === "E" ? w * FT_TO_PX : 0;
    const xOffset = frontFace === "E" ? gapIndicatorLength : -gapIndicatorLength;
    
    return (
      <g>
        <line
          x1={x}
          y1={openingStart * FT_TO_PX}
          x2={x + xOffset}
          y2={openingStart * FT_TO_PX}
          stroke="#333"
          strokeWidth={STROKE}
        />
        <line
          x1={x}
          y1={openingEnd * FT_TO_PX}
          x2={x + xOffset}
          y2={openingEnd * FT_TO_PX}
          stroke="#333"
          strokeWidth={STROKE}
        />
      </g>
    );
  }
}

// Render preview window (simplified for preview)
function renderPreviewWindow(
  feature: FrontFeature,
  widthFt: number,
  depthFt: number,
  rot: Rotation
) {
  if (feature.type !== "window") return null;

  const { w, d } = rotatedSize(widthFt, depthFt, rot);
  const frontFace = getFrontFace(rot);
  
  let windowStart: number;
  let windowEnd: number;
  
  if (frontFace === "S") {
    windowStart = feature.fromX;
    windowEnd = feature.toX;
  } else if (frontFace === "N") {
    windowStart = widthFt - feature.toX;
    windowEnd = widthFt - feature.fromX;
  } else if (frontFace === "W") {
    windowStart = feature.fromX;
    windowEnd = feature.toX;
  } else {
    windowStart = depthFt - feature.toX;
    windowEnd = depthFt - feature.fromX;
  }

  const windowWidth = windowEnd - windowStart;

  if (frontFace === "S" || frontFace === "N") {
    const y = frontFace === "S" ? d * FT_TO_PX : 0;
    
    return (
      <rect
        x={windowStart * FT_TO_PX}
        y={frontFace === "S" ? y - WALL_THICKNESS * FT_TO_PX : y}
        width={windowWidth * FT_TO_PX}
        height={WALL_THICKNESS * FT_TO_PX}
        fill="#ffffff"
        opacity={0.8}
      />
    );
  } else {
    const x = frontFace === "E" ? w * FT_TO_PX : 0;
    
    return (
      <rect
        x={frontFace === "E" ? x : x - WALL_THICKNESS * FT_TO_PX}
        y={windowStart * FT_TO_PX}
        width={WALL_THICKNESS * FT_TO_PX}
        height={windowWidth * FT_TO_PX}
        fill="#ffffff"
        opacity={0.8}
      />
    );
  }
}

const KELLY_GREEN = "#4CBB17";
const SNAP_DISTANCE = 2; // feet

export default function StableConfigurator() {
  const [units, setUnits] = useState<PlacedUnit[]>([
    { uid: uid(), moduleId: "stable_12x12", xFt: 0, yFt: 0, rot: 0, selectedExtras: [] }, // Start with standard 12x12 stable
  ]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>(units[0].uid);
  
  // Simple drag state
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [snappedConnector, setSnappedConnector] = useState<{ uid: string; connId: ConnectorId } | null>(null);

  const selected = units.find((u) => u.uid === selectedUid);

  function isUsed(uid: string, conn: ConnectorId) {
    return connections.some(
      (c) =>
        (c.aUid === uid && c.aConn === conn) ||
        (c.bUid === uid && c.bConn === conn)
    );
  }

  // Convert SVG screen coordinates to world (feet) coordinates
  function screenToWorld(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: svgPt.x / FT_TO_PX, y: svgPt.y / FT_TO_PX };
  }

  // Simple function to check if two connectors can connect
  function canConnect(sourceConn: ConnectorId, targetConn: ConnectorId): boolean {
    return (
      (sourceConn === "W" && targetConn === "E") ||
      (sourceConn === "E" && targetConn === "W") ||
      (sourceConn === "N" && targetConn === "S") ||
      (sourceConn === "S" && targetConn === "N")
    );
  }

  // Simple overlap check
  function hasOverlap(box1: { x: number; y: number; w: number; d: number }, box2: { x: number; y: number; w: number; d: number }): boolean {
    const tolerance = 0.5; // Allow boxes to touch
    return !(
      box1.x + box1.w <= box2.x + tolerance ||
      box2.x + box2.w <= box1.x + tolerance ||
      box1.y + box1.d <= box2.y + tolerance ||
      box2.y + box2.d <= box1.y + tolerance
    );
  }

  // Find nearest connector for drag-and-drop
  function findNearestConnector(
    moduleId: string,
    x: number,
    y: number,
    rot: Rotation
  ): { uid: string; connId: ConnectorId; distance: number } | null {
    const draggedMod = getModule(moduleId);
    let nearest: { uid: string; connId: ConnectorId; distance: number } | null = null;
    const snapDistFt = 3; // 3ft snap distance
    
    // Get dragged module's connector positions
    for (const draggedConn of draggedMod.connectors) {
      const draggedConnWorld = connectorWorld(
        { uid: "temp", moduleId, xFt: x, yFt: y, rot, selectedExtras: [] },
        draggedMod,
        draggedConn
      );
      
      // Check against all units
      for (const u of units) {
        const m = getModule(u.moduleId);
        for (const conn of m.connectors) {
          if (isUsed(u.uid, conn.id)) continue;
          if (!canConnect(draggedConn.id, conn.id)) continue;
          
          const connWorld = connectorWorld(u, m, conn);
          const dx = draggedConnWorld.x - connWorld.x;
          const dy = draggedConnWorld.y - connWorld.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < snapDistFt && (!nearest || dist < nearest.distance)) {
            nearest = { uid: u.uid, connId: conn.id, distance: dist };
          }
        }
      }
    }
    
    return nearest;
  }

  // Simple attach function - finds best available connector and attaches new module
  function attach(moduleId: string, targetConn: ConnectorId, targetUnit?: PlacedUnit) {
    const sourceUnit = targetUnit || selected;
    if (!sourceUnit) return;

    const sourceMod = getModule(sourceUnit.moduleId);
    const newMod = getModule(moduleId);

    // Find first available connector on source unit
    let targetConnDef = sourceMod.connectors.find(c => c.id === targetConn && !isUsed(sourceUnit.uid, c.id));
    if (!targetConnDef) {
      // Try any available connector
      targetConnDef = sourceMod.connectors.find(c => !isUsed(sourceUnit.uid, c.id));
      if (!targetConnDef) return;
    }

    const targetWorld = connectorWorld(sourceUnit, sourceMod, targetConnDef);

    // Try all rotations and connectors of new module
    let best: { rot: Rotation; conn: ConnectorId; x: number; y: number } | null = null;

    for (const rot of newMod.rotations) {
      for (const newConn of newMod.connectors) {
        if (!canConnect(newConn.id, targetConnDef.id)) continue;

        const p = rotatePoint(newConn.x, newConn.y, newMod.widthFt, newMod.depthFt, rot);
        const v = rotateVec(newConn.nx, newConn.ny, rot);

        // Align connector points
        let x = targetWorld.x - p.x;
        let y = targetWorld.y - p.y;

        // Offset to prevent overlap
        const { w, d } = rotatedSize(newMod.widthFt, newMod.depthFt, rot);
        if (Math.abs(v.nx) > Math.abs(v.ny)) {
          x += v.nx * w;
        } else {
          y += v.ny * d;
        }

        // Check for overlap
        const testUnit: PlacedUnit = { uid: "test", moduleId, xFt: x, yFt: y, rot, selectedExtras: [] };
        const bNew = bbox(testUnit, newMod);
        let overlaps = false;
        for (const u of units) {
          const bExisting = bbox(u, getModule(u.moduleId));
          if (hasOverlap(bNew, bExisting)) {
            overlaps = true;
            break;
          }
        }
        
        if (overlaps) continue;

        if (!hasOverlap) {
          best = { rot, conn: newConn.id, x, y };
          break; // Use first valid match
        }
      }
      if (best) break;
    }

    if (!best) return;

    const newUnit: PlacedUnit = {
      uid: uid(),
      moduleId,
      xFt: best.x,
      yFt: best.y,
      rot: best.rot,
      selectedExtras: [],
    };

    setUnits([...units, newUnit]);
    setConnections([
      ...connections,
      {
        aUid: sourceUnit.uid,
        aConn: targetConnDef.id,
        bUid: newUnit.uid,
        bConn: best.conn,
      },
    ]);
    setSelectedUid(newUnit.uid);
  }

  // Place module in free space
  function placeModuleFree(moduleId: string, x: number, y: number): void {
    const m = getModule(moduleId);
    const centeredX = x - m.widthFt / 2;
    const centeredY = y - m.depthFt / 2;

    const testUnit: PlacedUnit = { uid: "test", moduleId, xFt: centeredX, yFt: centeredY, rot: 0, selectedExtras: [] };
    const bNew = bbox(testUnit, m);
    for (const u of units) {
      const bExisting = bbox(u, getModule(u.moduleId));
      if (hasOverlap(bNew, bExisting)) {
        return; // Don't place if overlaps
      }
    }

    const newUnit: PlacedUnit = {
      uid: uid(),
      moduleId,
      xFt: centeredX,
      yFt: centeredY,
      rot: 0,
      selectedExtras: [],
    };

    setUnits([...units, newUnit]);
    setSelectedUid(newUnit.uid);
  }

  function rotateSelected() {
    if (!selected) return;
    const m = getModule(selected.moduleId);

    const myCons = connections.filter(
      (c) => c.aUid === selected.uid || c.bUid === selected.uid
    );
    if (myCons.length > 1)
      return alert("Rotation locked (multiple connections)");

    const next = nextRotation(m.rotations, selected.rot);

    if (myCons.length === 0) {
      const u2 = { ...selected, rot: next };
      const b2 = bbox(u2, m);
      for (const u of units) {
        if (u.uid !== u2.uid && hasOverlap(b2, bbox(u, getModule(u.moduleId))))
          return alert("Overlap");
      }
      setUnits(units.map((u) => (u.uid === u2.uid ? u2 : u)));
      return;
    }

    const conn = myCons[0];
    const otherUid = conn.aUid === selected.uid ? conn.bUid : conn.aUid;
    const myConnId = conn.aUid === selected.uid ? conn.aConn : conn.bConn;
    const otherConnId = conn.aUid === selected.uid ? conn.bConn : conn.aConn;

    const other = units.find((u) => u.uid === otherUid)!;
    const otherMod = getModule(other.moduleId);

    const myDef = m.connectors.find((c) => c.id === myConnId)!;
    const otherDef = otherMod.connectors.find((c) => c.id === otherConnId)!;

    const otherW = connectorWorld(other, otherMod, otherDef);
    const myLocal = rotatePoint(
      myDef.x,
      myDef.y,
      m.widthFt,
      m.depthFt,
      next
    );

    const snapped: PlacedUnit = {
      ...selected,
      rot: next,
      xFt: otherW.x - myLocal.x,
      yFt: otherW.y - myLocal.y,
    };

    const bSnap = bbox(snapped, m);
    for (const u of units) {
      if (u.uid !== snapped.uid && hasOverlap(bSnap, bbox(u, getModule(u.moduleId))))
        return alert("Overlap");
    }

    setUnits(units.map((u) => (u.uid === snapped.uid ? snapped : u)));
  }

  function toggleExtra(extraId: string) {
    if (!selected) return;
    const currentExtras = selected.selectedExtras || [];
    const newExtras = currentExtras.includes(extraId)
      ? currentExtras.filter((id) => id !== extraId)
      : [...currentExtras, extraId];
    
    setUnits(
      units.map((u) =>
        u.uid === selected.uid ? { ...u, selectedExtras: newExtras } : u
      )
    );
  }

  function deleteUnit(uid: string) {
    if (units.length === 1) {
      alert("Cannot delete the last unit");
      return;
    }
    setUnits(units.filter((u) => u.uid !== uid));
    setConnections(
      connections.filter((c) => c.aUid !== uid && c.bUid !== uid)
    );
    if (selectedUid === uid) {
      const remaining = units.find((u) => u.uid !== uid);
      if (remaining) setSelectedUid(remaining.uid);
    }
  }

  // Simple drag handlers - only for dragging new modules from buttons
  function handleButtonMouseDown(moduleId: string) {
    setDraggingModuleId(moduleId);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!draggingModuleId) return;
    
    const svg = e.currentTarget;
    const worldPos = screenToWorld(svg, e.clientX, e.clientY);
    setDragPosition(worldPos);

    // Find nearest connector for snapping
    const m = getModule(draggingModuleId);
    const centeredX = worldPos.x - m.widthFt / 2;
    const centeredY = worldPos.y - m.depthFt / 2;
    
    let bestNearest: { uid: string; connId: ConnectorId; distance: number } | null = null;
    for (const rot of m.rotations) {
      const nearest = findNearestConnector(draggingModuleId, centeredX, centeredY, rot);
      if (nearest && (!bestNearest || nearest.distance < bestNearest.distance)) {
        bestNearest = nearest;
      }
    }
    
    setSnappedConnector(bestNearest ? { uid: bestNearest.uid, connId: bestNearest.connId } : null);
  }

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!draggingModuleId) return;
    
    const svg = e.currentTarget;
    const worldPos = screenToWorld(svg, e.clientX, e.clientY);
    
    // Check for nearest connector at release position
    const m = getModule(draggingModuleId);
    const centeredX = worldPos.x - m.widthFt / 2;
    const centeredY = worldPos.y - m.depthFt / 2;
    
    let bestNearest: { uid: string; connId: ConnectorId; distance: number } | null = null;
    for (const rot of m.rotations) {
      const nearest = findNearestConnector(draggingModuleId, centeredX, centeredY, rot);
      if (nearest && (!bestNearest || nearest.distance < bestNearest.distance)) {
        bestNearest = nearest;
      }
    }
    
    if (bestNearest) {
      // Attach to connector
      const targetUnit = units.find((u) => u.uid === bestNearest!.uid);
      if (targetUnit) {
        attach(draggingModuleId, bestNearest.connId, targetUnit);
      }
    } else {
      // Place in free space
      placeModuleFree(draggingModuleId, worldPos.x, worldPos.y);
    }
    
    setDraggingModuleId(null);
    setDragPosition(null);
    setSnappedConnector(null);
  }

  function handleMouseLeave() {
    // Cancel drag if mouse leaves SVG
    setDraggingModuleId(null);
    setDragPosition(null);
    setSnappedConnector(null);
  }

  const totalCost = useMemo(() => {
    // Load pricing from localStorage if available
    let pricing: any = null;
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("stable_configurator_pricing");
        if (saved) pricing = JSON.parse(saved);
      } catch {
        // Use module defaults
      }
    }
    
    let cost = 0;
    for (const u of units) {
      const m = getModule(u.moduleId);
      // Use pricing from localStorage if available, otherwise use module basePrice
      if (pricing?.modules?.[u.moduleId] !== undefined) {
        cost += pricing.modules[u.moduleId];
      } else {
        cost += m.basePrice;
      }
      
      const selectedExtras = u.selectedExtras || [];
      for (const extraId of selectedExtras) {
        // Use pricing from localStorage if available, otherwise use module extra price
        if (pricing?.extras?.[extraId] !== undefined) {
          cost += pricing.extras[extraId];
        } else {
          const extra = m.extras.find((e) => e.id === extraId);
          if (extra) cost += extra.price;
        }
      }
    }
    return cost;
  }, [units]);

  const ext = useMemo(() => {
    if (units.length === 0) {
      return { minX: 0, minY: 0, maxX: 12, maxY: 12 };
    }
    
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    
    for (const u of units) {
      const b = bbox(u, getModule(u.moduleId));
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.d);
    }
    
    return { minX, minY, maxX, maxY };
  }, [units]);

  const selectedModule = selected ? getModule(selected.moduleId) : null;


  // Simple drag preview
  function renderDragPreview() {
    if (!draggingModuleId || !dragPosition) return null;

    const m = getModule(draggingModuleId);
    let previewX = dragPosition.x - m.widthFt / 2;
    let previewY = dragPosition.y - m.depthFt / 2;
    let previewRot: Rotation = 0;

    // If snapped to connector, calculate position
    if (snappedConnector) {
      const targetUnit = units.find((u) => u.uid === snappedConnector.uid);
      if (targetUnit) {
        const targetMod = getModule(targetUnit.moduleId);
        const targetConnDef = targetMod.connectors.find(c => c.id === snappedConnector.connId);
        if (targetConnDef) {
          const targetWorld = connectorWorld(targetUnit, targetMod, targetConnDef);
          
          // Try to find matching connector and rotation
          for (const rot of m.rotations) {
            for (const newConn of m.connectors) {
              if (!canConnect(newConn.id, snappedConnector.connId)) continue;
              
              const p = rotatePoint(newConn.x, newConn.y, m.widthFt, m.depthFt, rot);
              const v = rotateVec(newConn.nx, newConn.ny, rot);
              
              let x = targetWorld.x - p.x;
              let y = targetWorld.y - p.y;
              
              const { w, d } = rotatedSize(m.widthFt, m.depthFt, rot);
              if (Math.abs(v.nx) > Math.abs(v.ny)) {
                x += v.nx * w;
              } else {
                y += v.ny * d;
              }
              
              previewX = x;
              previewY = y;
              previewRot = rot;
              break;
            }
            if (previewX !== dragPosition.x - m.widthFt / 2) break;
          }
        }
      }
    }

    const { w, d } = rotatedSize(m.widthFt, m.depthFt, previewRot);
    const bPreview = { x: previewX, y: previewY, w, d };
    let isValid = snappedConnector ? true : true;
    if (!snappedConnector) {
      for (const u of units) {
        if (hasOverlap(bPreview, bbox(u, getModule(u.moduleId)))) {
          isValid = false;
          break;
        }
      }
    }
    const previewColor = isValid ? KELLY_GREEN : "#cc0000";

    return (
      <g
        transform={`translate(${previewX * FT_TO_PX}, ${previewY * FT_TO_PX})`}
        opacity={0.65}
      >
        <rect
          x={0}
          y={0}
          width={w * FT_TO_PX}
          height={d * FT_TO_PX}
          fill={previewColor}
          stroke={previewColor}
          strokeWidth={2}
        />
      </g>
    );
  }

  const DARK_GREEN = "#1a5d1a";
  const DARK_GREEN_HOVER = "#2d5a27";
  const DARK_GREEN_ACTIVE = "#0f3d0f";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24, padding: 24, minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Logo and Header */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 12, 
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: "2px solid #e0e0e0"
          }}>
            <div style={{
              width: 56,
              height: 56,
              backgroundColor: DARK_GREEN,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 24,
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 2px 8px rgba(26, 93, 26, 0.2)"
            }}>
              SC
            </div>
      <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: 28, 
                fontWeight: 700, 
                color: "#1a1a1a",
                fontFamily: "Inter, sans-serif",
                letterSpacing: "-0.5px"
              }}>
                Stable Configurator
              </h1>
              <p style={{ 
                margin: "4px 0 0 0", 
                fontSize: 14, 
                color: "#666",
                fontFamily: "Inter, sans-serif"
              }}>
                Design your stable layout
              </p>
            </div>
          </div>
          
          <div style={{ 
            marginBottom: 24, 
            padding: 20, 
            backgroundColor: "white", 
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#666", fontFamily: "Inter, sans-serif" }}>Total Cost</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: DARK_GREEN, fontFamily: "Inter, sans-serif" }}>
              £{totalCost.toLocaleString()}
            </div>
          </div>
        </div>


        <div>
          <h3 style={{ 
            margin: "0 0 16px 0", 
            fontSize: 18, 
            fontWeight: 600,
            color: "#1a1a1a",
            fontFamily: "Inter, sans-serif"
          }}>
            Add Modules
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 600, 
              marginBottom: 10, 
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontFamily: "Inter, sans-serif"
            }}>
              Standard Stables
            </div>
            <button
              onClick={() => attach("stable_6x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("stable_6x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add Stable 6x12
            </button>
            <button
              onClick={() => attach("stable_8x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("stable_8x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add Stable 8x12
            </button>
            <button
              onClick={() => attach("stable_10x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("stable_10x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add Stable 10x12
            </button>
            <button
              onClick={() => attach("stable_12x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("stable_12x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add Stable 12x12
            </button>
            <button
              onClick={() => attach("stable_14x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("stable_14x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add Stable 14x12
            </button>
            <button
              onClick={() => attach("stable_16x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("stable_16x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add Stable 16x12
            </button>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 600, 
              marginTop: 16, 
              marginBottom: 10, 
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontFamily: "Inter, sans-serif"
            }}>
              Other Modules
            </div>
            <button
              onClick={() => attach("shelter_12x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("shelter_12x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add Shelter
            </button>
            <button
              onClick={() => attach("corner_lh_16x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("corner_lh_16x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add LH Corner Stable
            </button>
            <button
              onClick={() => attach("corner_rh_16x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("corner_rh_16x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add RH Corner Stable
            </button>
            <button
              onClick={() => attach("tack_room_12x12", "E")}
              style={{
                padding: "14px 20px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "grab",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(26, 93, 26, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(26, 93, 26, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 93, 26, 0.2)";
              }}
              onMouseDown={(e) => {
                handleButtonMouseDown("tack_room_12x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add Tack Room
            </button>
        </div>
      </div>

        {selected && selectedModule && (
          <div style={{ 
            marginTop: 8,
            padding: 20,
            backgroundColor: "white",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            border: "1px solid #e0e0e0"
          }}>
            <h3 style={{ 
              margin: "0 0 16px 0", 
              fontSize: 18, 
              fontWeight: 600,
              color: "#1a1a1a",
              fontFamily: "Inter, sans-serif"
            }}>
              Selected: {selectedModule.name}
            </h3>

            <div>
              <h4 style={{ 
                margin: "0 0 12px 0", 
                fontSize: 16, 
                fontWeight: 600,
                color: "#1a1a1a",
                fontFamily: "Inter, sans-serif"
              }}>
                Extras
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedModule.extras.map((extra) => {
                  const isSelected = (selected.selectedExtras || []).includes(extra.id);
                  return (
                    <label
                      key={extra.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        backgroundColor: isSelected ? "#e8f5e9" : "white",
                        border: `2px solid ${isSelected ? DARK_GREEN : "#e0e0e0"}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        fontFamily: "Inter, sans-serif",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#c0c0c0";
                          e.currentTarget.style.backgroundColor = "#f5f5f5";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#e0e0e0";
                          e.currentTarget.style.backgroundColor = "white";
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleExtra(extra.id)}
                        style={{ cursor: "pointer" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", fontFamily: "Inter, sans-serif" }}>
                          {extra.name}
                        </div>
                        {extra.description && (
                          <div style={{ fontSize: 12, color: "#666", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
                            {extra.description}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: DARK_GREEN, fontFamily: "Inter, sans-serif" }}>
                        +£{extra.price}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ 
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12
        }}>
          <div style={{ 
            fontSize: 22, 
            fontWeight: 700, 
            color: "#1a1a1a",
            fontFamily: "Inter, sans-serif",
            letterSpacing: "-0.3px"
          }}>
            Plan View
          </div>
          {/* Zoom Controls */}
        </div>
        <svg
          width="100%"
          height="600"
          viewBox={`${(ext.minX - 15) * FT_TO_PX} ${(ext.minY - 15) * FT_TO_PX} ${(ext.maxX - ext.minX + 30) * FT_TO_PX} ${(ext.maxY - ext.minY + 30) * FT_TO_PX}`}
          style={{ 
            border: "2px solid #d0d0d0", 
            borderRadius: 12, 
            backgroundColor: "#ffffff", 
            cursor: draggingModuleId ? "grabbing" : "default",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)"
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid */}
          <defs>
            <pattern
              id="grid"
              width={FT_TO_PX}
              height={FT_TO_PX}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${FT_TO_PX} 0 L 0 0 0 ${FT_TO_PX}`}
                fill="none"
                stroke="#e0e0e0"
                strokeWidth={0.5}
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Drag preview */}
          {renderDragPreview()}

          {/* Highlight snapped connector */}
          {snappedConnector && (() => {
            const targetUnit = units.find((u) => u.uid === snappedConnector.uid);
            if (!targetUnit) return null;
            const targetMod = getModule(targetUnit.moduleId);
            const targetConn = targetMod.connectors.find((c) => c.id === snappedConnector.connId);
            if (!targetConn) return null;
            const connWorld = connectorWorld(targetUnit, targetMod, targetConn);
            const connX = connWorld.x * FT_TO_PX;
            const connY = connWorld.y * FT_TO_PX;
            
            return (
              <circle
                cx={connX}
                cy={connY}
                r={8}
                fill="#4CBB17"
                stroke="white"
                strokeWidth={2}
                opacity={0.8}
              />
            );
          })()}

        {units.map((u) => {
          const m = getModule(u.moduleId);
          const { w, d } = rotatedSize(m.widthFt, m.depthFt, u.rot);
            const isSelected = u.uid === selectedUid;
          return (
            <g
              key={u.uid}
              transform={`translate(${u.xFt * FT_TO_PX}, ${u.yFt * FT_TO_PX})`}
              onClick={() => setSelectedUid(u.uid)}
              style={{ cursor: "pointer" }}
            >
                {/* Main rectangle */}
              <rect
                x={0}
                y={0}
                width={w * FT_TO_PX}
                height={d * FT_TO_PX}
                  fill={isSelected ? "#e6f2ff" : "#ffffff"}
                  stroke={isSelected ? "#0066cc" : "#333"}
                  strokeWidth={isSelected ? 3 : STROKE}
                />
                
                {/* Walls */}
                <rect
                  x={0}
                  y={0}
                  width={w * FT_TO_PX}
                  height={WALL_THICKNESS * FT_TO_PX}
                  fill="#999"
                />
                <rect
                  x={0}
                  y={d * FT_TO_PX - WALL_THICKNESS * FT_TO_PX}
                  width={w * FT_TO_PX}
                  height={WALL_THICKNESS * FT_TO_PX}
                  fill="#999"
                />
                <rect
                  x={0}
                  y={0}
                  width={WALL_THICKNESS * FT_TO_PX}
                  height={d * FT_TO_PX}
                  fill="#999"
                />
                <rect
                  x={w * FT_TO_PX - WALL_THICKNESS * FT_TO_PX}
                  y={0}
                  width={WALL_THICKNESS * FT_TO_PX}
                  height={d * FT_TO_PX}
                  fill="#999"
                />

                {/* Roof overhang at front - dotted line */}
                {(() => {
                  const frontFace = getFrontFace(u.rot);
                  // For corner stables, only show 1ft overhang on door side
                  // For other modules, show full 3ft overhang
                  const isCorner = m.kind === "corner";
                  const overhangFt = isCorner ? 1 : 3;
                  const overhangPx = overhangFt * FT_TO_PX;
                  
                  if (isCorner) {
                    // Find door opening in frontFeatures
                    const doorFeature = m.frontFeatures.find((f) => f.type === "opening");
                    if (!doorFeature) return null;
                    
                    // Map door position to front face based on rotation (same logic as renderDoor)
                    let doorStart: number;
                    let doorEnd: number;
                    
                    if (frontFace === "S") {
                      // Bottom edge - left to right along width
                      doorStart = doorFeature.fromX;
                      doorEnd = doorFeature.toX;
                    } else if (frontFace === "N") {
                      // Top edge - right to left along width (reversed)
                      doorStart = m.widthFt - doorFeature.toX;
                      doorEnd = m.widthFt - doorFeature.fromX;
                    } else if (frontFace === "W") {
                      // Left edge - bottom to top along depth
                      doorStart = doorFeature.fromX;
                      doorEnd = doorFeature.toX;
                    } else {
                      // Right edge - top to bottom along depth (reversed)
                      doorStart = m.depthFt - doorFeature.toX;
                      doorEnd = m.depthFt - doorFeature.fromX;
                    }
                    
                    // Only show overhang for first 1ft from door edge
                    const overhangStart = doorStart;
                    const overhangEnd = Math.min(doorStart + 1, doorEnd);
                    
                    if (frontFace === "S") {
                      // Front is bottom edge - overhang extends downward
                      const startX = overhangStart * FT_TO_PX;
                      const endX = overhangEnd * FT_TO_PX;
                      const y = d * FT_TO_PX + overhangPx;
                      return (
                        <line
                          x1={startX}
                          y1={y}
                          x2={endX}
                          y2={y}
                          stroke="#666"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                      );
                    } else if (frontFace === "N") {
                      // Front is top edge - overhang extends upward
                      const startX = overhangStart * FT_TO_PX;
                      const endX = overhangEnd * FT_TO_PX;
                      const y = -overhangPx;
                      return (
                        <line
                          x1={startX}
                          y1={y}
                          x2={endX}
                          y2={y}
                          stroke="#666"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                      );
                    } else if (frontFace === "W") {
                      // Front is left edge - overhang extends leftward
                      const startY = overhangStart * FT_TO_PX;
                      const endY = overhangEnd * FT_TO_PX;
                      const x = -overhangPx;
                      return (
                        <line
                          x1={x}
                          y1={startY}
                          x2={x}
                          y2={endY}
                          stroke="#666"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                      );
                    } else if (frontFace === "E") {
                      // Front is right edge - overhang extends rightward
                      const startY = overhangStart * FT_TO_PX;
                      const endY = overhangEnd * FT_TO_PX;
                      const x = w * FT_TO_PX + overhangPx;
                      return (
                        <line
                          x1={x}
                          y1={startY}
                          x2={x}
                          y2={endY}
                          stroke="#666"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                      );
                    }
                    return null;
                  } else {
                    // Regular modules: full 3ft overhang
                    if (frontFace === "S") {
                      // Front is bottom edge - overhang extends downward
                      return (
                        <line
                          x1={0}
                          y1={d * FT_TO_PX + overhangPx}
                          x2={w * FT_TO_PX}
                          y2={d * FT_TO_PX + overhangPx}
                          stroke="#666"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                      );
                    } else if (frontFace === "N") {
                      // Front is top edge - overhang extends upward
                      return (
                        <line
                          x1={0}
                          y1={-overhangPx}
                          x2={w * FT_TO_PX}
                          y2={-overhangPx}
                          stroke="#666"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                      );
                    } else if (frontFace === "W") {
                      // Front is left edge - overhang extends leftward
                      return (
                        <line
                          x1={-overhangPx}
                          y1={0}
                          x2={-overhangPx}
                          y2={d * FT_TO_PX}
                          stroke="#666"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                      );
                    } else if (frontFace === "E") {
                      // Front is right edge - overhang extends rightward
                      return (
                        <line
                          x1={w * FT_TO_PX + overhangPx}
                          y1={0}
                          x2={w * FT_TO_PX + overhangPx}
                          y2={d * FT_TO_PX}
                          stroke="#666"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                      );
                    }
                    return null;
                  }
                })()}

                {/* Render doors, windows, and openings */}
                {m.frontFeatures.map((feature, idx) => {
                  // Handle shelter with double doors extra
                  if (feature.type === "opening") {
                    // Check if this is a shelter with double doors extra selected
                    const hasDoubleDoors = 
                      m.kind === "shelter" && 
                      (u.selectedExtras || []).includes("double_doors");
                    
                    // If shelter has double doors extra, render doors
                    const featureWithDoors = hasDoubleDoors && !feature.doors
                      ? {
                          ...feature,
                          doors: [
                            { widthFt: 4, hinge: "left" as const, swing: "out" as const, leaf: "left" as const },
                            { widthFt: 4, hinge: "right" as const, swing: "out" as const, leaf: "right" as const },
                          ],
                        }
                      : feature;
                    
                    return (
                      <g key={idx}>
                        {renderDoor(featureWithDoors, m.widthFt, m.depthFt, u.rot, isSelected)}
                      </g>
                    );
                  }
                  if (feature.type === "window") {
                    return (
                      <g key={idx}>
                        {renderWindow(feature, m.widthFt, m.depthFt, u.rot, isSelected)}
                      </g>
                    );
                  }
                  return null;
                })}

                {/* Label */}
                <text
                  x={w * FT_TO_PX / 2}
                  y={d * FT_TO_PX / 2}
                  fontSize={12}
                  textAnchor="middle"
                  fill={isSelected ? "#0066cc" : "#333"}
                  fontWeight={isSelected ? 600 : 400}
                >
                {m.name}
              </text>
                
                {/* Dimensions */}
                <text
                  x={w * FT_TO_PX / 2}
                  y={d * FT_TO_PX / 2 + 14}
                  fontSize={10}
                  textAnchor="middle"
                  fill="#666"
                >
                  {m.widthFt}×{m.depthFt}ft
                </text>

                {/* Render connectors - show all for selected box, or unused ones for others */}
                {m.connectors.map((conn) => {
                  const isUsedConn = isUsed(u.uid, conn.id);
                  // Show all connectors for selected box, or unused connectors for others
                  if (!isSelected && isUsedConn) return null;
                  
                  const connWorld = connectorWorld(u, m, conn);
                  const connX = (connWorld.x - u.xFt) * FT_TO_PX;
                  const connY = (connWorld.y - u.yFt) * FT_TO_PX;
                  
                  return (
                    <g key={conn.id}>
                      {/* Connector point */}
                      <circle
                        cx={connX}
                        cy={connY}
                        r={isSelected ? 6 : 4}
                        fill={isUsedConn ? "#999" : isSelected ? "#0066cc" : "#666"}
                        stroke="white"
                        strokeWidth={1}
                        style={{ cursor: isSelected && !isUsedConn ? "pointer" : "default" }}
                      />
                      {/* Connector direction indicator */}
                      {isSelected && !isUsedConn && (
                        <line
                          x1={connX}
                          y1={connY}
                          x2={connX + connWorld.nx * 8}
                          y2={connY + connWorld.ny * 8}
                          stroke="#0066cc"
                          strokeWidth={2}
                          strokeLinecap="round"
                        />
                      )}
                      {/* Connector label */}
                      {isSelected && (
                        <text
                          x={connX + connWorld.nx * 12}
                          y={connY + connWorld.ny * 12}
                          fontSize={10}
                          fill="#0066cc"
                          fontWeight={600}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {conn.id}
                        </text>
                      )}
                    </g>
                  );
                })}
            </g>
          );
        })}
      </svg>
        {/* Delete and Rotate buttons at bottom of plan view */}
        {selected && (
          <div style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginTop: 12,
            padding: "8px 0"
          }}>
            <button
              onClick={rotateSelected}
              style={{
                padding: "6px 12px",
                backgroundColor: "#4a5568",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#5a6578";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#4a5568";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Rotate Box
            </button>
            <button
              onClick={() => deleteUnit(selected.uid)}
              style={{
                padding: "6px 12px",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
                boxShadow: "0 1px 3px rgba(220, 38, 38, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#ef4444";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#dc2626";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Delete Box
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
