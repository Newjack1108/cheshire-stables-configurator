"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { MODULES } from "@/lib/modules";
import {
  rotatedSize,
  rotatePoint,
  rotateVec,
  overlaps,
} from "@/lib/geometry";
import {
  ModuleDef,
  PlacedUnit,
  Connection,
  ConnectorId,
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
  
  // Drag state
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const [draggingUnitUid, setDraggingUnitUid] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [snappedConnector, setSnappedConnector] = useState<{ uid: string; connId: ConnectorId } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

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

  // Find nearest available connector within snap distance
  function findNearestConnector(x: number, y: number): { uid: string; connId: ConnectorId; distance: number } | null {
    let nearest: { uid: string; connId: ConnectorId; distance: number } | null = null;
    const snapDistFt = SNAP_DISTANCE;

    for (const u of units) {
      const m = getModule(u.moduleId);
      for (const conn of m.connectors) {
        if (isUsed(u.uid, conn.id)) continue;
        
        const connWorld = connectorWorld(u, m, conn);
        const dx = connWorld.x - x;
        const dy = connWorld.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < snapDistFt && (!nearest || dist < nearest.distance)) {
          nearest = { uid: u.uid, connId: conn.id, distance: dist };
        }
      }
    }

    return nearest;
  }

  // Check if a module position is valid (no overlaps)
  function isValidPosition(moduleId: string, x: number, y: number, rot: Rotation): boolean {
    const m = getModule(moduleId);
    const testUnit: PlacedUnit = {
      uid: "test",
      moduleId,
      xFt: x,
      yFt: y,
      rot,
      selectedExtras: [],
    };
    const bNew = bbox(testUnit, m);

    // Check for overlaps with existing units
    for (const u of units) {
      const bExisting = bbox(u, getModule(u.moduleId));
      if (overlaps(bNew, bExisting)) {
        return false;
      }
    }

    return true;
  }

  function attach(moduleId: string, targetConn: ConnectorId, targetUnit?: PlacedUnit) {
    const sourceUnit = targetUnit || selected;
    if (!sourceUnit) return;

    const aMod = getModule(sourceUnit.moduleId);
    const aDef = aMod.connectors.find((c) => c.id === targetConn);
    if (!aDef) return alert("No connector");

    if (isUsed(sourceUnit.uid, targetConn))
      return alert("Connector already used");

    const aW = connectorWorld(sourceUnit, aMod, aDef);
    const newMod = getModule(moduleId);

    let best: {
      rot: Rotation;
      conn: ConnectorId;
      x: number;
      y: number;
      score: number;
    } | null = null;

    for (const rot of newMod.rotations) {
      for (const c of newMod.connectors) {
        const p = rotatePoint(
          c.x,
          c.y,
          newMod.widthFt,
          newMod.depthFt,
          rot
        );
        const v = rotateVec(c.nx, c.ny, rot);
        const dot = v.nx * aW.nx + v.ny * aW.ny;
        const score = -dot;
        const x = aW.x - p.x;
        const y = aW.y - p.y;
        if (!best || score < best.score) {
          best = { rot, conn: c.id, x, y, score };
        }
      }
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

    const bNew = bbox(newUnit, newMod);
    
    // Check for overlaps - be lenient since boxes attached via connectors should be positioned correctly
    for (const u of units) {
      const bExisting = bbox(u, getModule(u.moduleId));
      
      // Use a more lenient tolerance for boxes attached via connectors
      // Allow boxes that are touching or very close (within 0.5ft)
      const tolerance = 0.5;
      
      // Check if boxes actually overlap (not just touching)
      // Only flag if there's significant interior overlap
      const overlapX = Math.min(bNew.x + bNew.w, bExisting.x + bExisting.w) - Math.max(bNew.x, bExisting.x);
      const overlapY = Math.min(bNew.y + bNew.d, bExisting.y + bExisting.d) - Math.max(bNew.y, bExisting.y);
      
      // Only flag as overlap if there's meaningful interior overlap (more than tolerance)
      if (overlapX > tolerance && overlapY > tolerance) {
        return alert("Overlap");
      }
    }

    setUnits([...units, newUnit]);
    setConnections([
      ...connections,
      {
        aUid: sourceUnit.uid,
        aConn: targetConn,
        bUid: newUnit.uid,
        bConn: best.conn,
      },
    ]);
    setSelectedUid(newUnit.uid);
  }

  // Place module in free space (not connected)
  function placeModuleFree(moduleId: string, x: number, y: number): void {
    const m = getModule(moduleId);
    // Center the module on the mouse cursor for better UX
    const centeredX = x - m.widthFt / 2;
    const centeredY = y - m.depthFt / 2;
    
    // Check if position is valid
    if (!isValidPosition(moduleId, centeredX, centeredY, 0)) {
      return; // Don't place if invalid
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
        if (u.uid !== u2.uid && overlaps(b2, bbox(u, getModule(u.moduleId))))
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
      if (u.uid !== snapped.uid && overlaps(bSnap, bbox(u, getModule(u.moduleId))))
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

  // Drag handlers
  function handleDragStart(moduleId: string) {
    setDraggingModuleId(moduleId);
  }

  function handleButtonMouseDown(moduleId: string) {
    setDraggingModuleId(moduleId);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!draggingModuleId && !draggingUnitUid) return;
    
    const svg = e.currentTarget;
    const worldPos = screenToWorld(svg, e.clientX, e.clientY);
    setDragPosition(worldPos);

    if (draggingModuleId) {
      // Find nearest connector for snapping
      const nearest = findNearestConnector(worldPos.x, worldPos.y);
      setSnappedConnector(nearest ? { uid: nearest.uid, connId: nearest.connId } : null);
    } else if (draggingUnitUid) {
      // For repositioning, check for overlaps
      setSnappedConnector(null);
    }
  }

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (draggingModuleId) {
      const svg = e.currentTarget;
      const worldPos = screenToWorld(svg, e.clientX, e.clientY);
      
      // Check for nearest connector at release position
      const nearest = findNearestConnector(worldPos.x, worldPos.y);
      const releaseSnappedConnector = nearest ? { uid: nearest.uid, connId: nearest.connId } : null;
      
      if (releaseSnappedConnector) {
        // Attach to connector
        const targetUnit = units.find((u) => u.uid === releaseSnappedConnector.uid);
        if (targetUnit) {
          attach(draggingModuleId, releaseSnappedConnector.connId, targetUnit);
        }
      } else {
        // Place in free space if position is valid
        placeModuleFree(draggingModuleId, worldPos.x, worldPos.y);
      }
      
      setDraggingModuleId(null);
      setDragPosition(null);
      setSnappedConnector(null);
    } else if (draggingUnitUid && dragOffset) {
      // Reposition existing unit
      const svg = e.currentTarget;
      const worldPos = screenToWorld(svg, e.clientX, e.clientY);
      const newX = worldPos.x - dragOffset.x;
      const newY = worldPos.y - dragOffset.y;
      
      const unit = units.find((u) => u.uid === draggingUnitUid);
      if (unit) {
        const m = getModule(unit.moduleId);
        const newUnit: PlacedUnit = { ...unit, xFt: newX, yFt: newY };
        const bNew = bbox(newUnit, m);
        
        // Check for overlaps
        let hasOverlap = false;
        for (const u of units) {
          if (u.uid === draggingUnitUid) continue;
          const bExisting = bbox(u, getModule(u.moduleId));
          if (overlaps(bNew, bExisting)) {
            hasOverlap = true;
            break;
          }
        }
        
        if (!hasOverlap) {
          setUnits(units.map((u) => (u.uid === draggingUnitUid ? newUnit : u)));
        }
      }
      
      setDraggingUnitUid(null);
      setDragPosition(null);
      setDragOffset(null);
    }
  }

  function handleMouseLeave() {
    // Cancel drag if mouse leaves SVG
    setDraggingModuleId(null);
    setDraggingUnitUid(null);
    setDragPosition(null);
    setSnappedConnector(null);
    setDragOffset(null);
  }

  function handleUnitMouseDown(e: React.MouseEvent<SVGGElement>, unit: PlacedUnit) {
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement!;
    const worldPos = screenToWorld(svg, e.clientX, e.clientY);
    setDraggingUnitUid(unit.uid);
    setDragOffset({ x: worldPos.x - unit.xFt, y: worldPos.y - unit.yFt });
    setDragPosition(worldPos);
    setSelectedUid(unit.uid);
  }

  const totalCost = useMemo(() => {
    let cost = 0;
    for (const u of units) {
      const m = getModule(u.moduleId);
      cost += m.basePrice;
      const selectedExtras = u.selectedExtras || [];
      for (const extraId of selectedExtras) {
        const extra = m.extras.find((e) => e.id === extraId);
        if (extra) cost += extra.price;
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
  const svgRef = useRef<SVGSVGElement>(null);

  // Handle document-level mouse events for dragging from buttons
  useEffect(() => {
    if (!draggingModuleId && !draggingUnitUid) return;

    function handleDocumentMouseMove(e: MouseEvent) {
      if (!svgRef.current) return;
      
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      
      // Only process if mouse is over SVG
      if (e.clientX < rect.left || e.clientX > rect.right || 
          e.clientY < rect.top || e.clientY > rect.bottom) {
        return;
      }

      const worldPos = screenToWorld(svg, e.clientX, e.clientY);
      setDragPosition(worldPos);

      if (draggingModuleId) {
        const nearest = findNearestConnector(worldPos.x, worldPos.y);
        setSnappedConnector(nearest ? { uid: nearest.uid, connId: nearest.connId } : null);
      } else if (draggingUnitUid) {
        setSnappedConnector(null);
      }
    }

    function handleDocumentMouseUp(e: MouseEvent) {
      if (draggingModuleId && svgRef.current) {
        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        
        // Only process if mouse is over SVG
        if (e.clientX >= rect.left && e.clientX <= rect.right && 
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const worldPos = screenToWorld(svg, e.clientX, e.clientY);
          
          // Check for nearest connector at release position
          const nearest = findNearestConnector(worldPos.x, worldPos.y);
          const releaseSnappedConnector = nearest ? { uid: nearest.uid, connId: nearest.connId } : null;
          
          if (releaseSnappedConnector) {
            const targetUnit = units.find((u) => u.uid === releaseSnappedConnector.uid);
            if (targetUnit) {
              attach(draggingModuleId, releaseSnappedConnector.connId, targetUnit);
            }
          } else {
            // Place in free space if position is valid
            placeModuleFree(draggingModuleId, worldPos.x, worldPos.y);
          }
        }
        
        setDraggingModuleId(null);
        setDragPosition(null);
        setSnappedConnector(null);
      } else if (draggingUnitUid && dragOffset && svgRef.current) {
        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        
        if (e.clientX >= rect.left && e.clientX <= rect.right && 
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const worldPos = screenToWorld(svg, e.clientX, e.clientY);
          const newX = worldPos.x - dragOffset.x;
          const newY = worldPos.y - dragOffset.y;
          
          const unit = units.find((u) => u.uid === draggingUnitUid);
          if (unit) {
            const m = getModule(unit.moduleId);
            const newUnit: PlacedUnit = { ...unit, xFt: newX, yFt: newY };
            const bNew = bbox(newUnit, m);
            
            let hasOverlap = false;
            for (const u of units) {
              if (u.uid === draggingUnitUid) continue;
              const bExisting = bbox(u, getModule(u.moduleId));
              if (overlaps(bNew, bExisting)) {
                hasOverlap = true;
                break;
              }
            }
            
            if (!hasOverlap) {
              setUnits(units.map((u) => (u.uid === draggingUnitUid ? newUnit : u)));
            }
          }
        }
        
        setDraggingUnitUid(null);
        setDragPosition(null);
        setDragOffset(null);
      }
    }

    document.addEventListener("mousemove", handleDocumentMouseMove);
    document.addEventListener("mouseup", handleDocumentMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleDocumentMouseMove);
      document.removeEventListener("mouseup", handleDocumentMouseUp);
    };
  }, [draggingModuleId, draggingUnitUid, dragPosition, dragOffset, snappedConnector, units]);

  // Render drag preview
  function renderDragPreview() {
    if (!draggingModuleId || !dragPosition) return null;

    const m = getModule(draggingModuleId);
    let previewX = dragPosition.x;
    let previewY = dragPosition.y;
    let previewRot: Rotation = 0;

    // If not snapped to connector, center the preview on the mouse cursor
    if (!snappedConnector) {
      previewX = dragPosition.x - m.widthFt / 2;
      previewY = dragPosition.y - m.depthFt / 2;
    }

    // If snapped to connector, calculate position
    if (snappedConnector) {
      const targetUnit = units.find((u) => u.uid === snappedConnector.uid);
      if (targetUnit) {
        const targetMod = getModule(targetUnit.moduleId);
        const targetConn = targetMod.connectors.find((c) => c.id === snappedConnector.connId);
        if (targetConn) {
          const aW = connectorWorld(targetUnit, targetMod, targetConn);
          
          // Find best rotation and connector match
          let best: { rot: Rotation; conn: ConnectorId; x: number; y: number; score: number } | null = null;
          for (const rot of m.rotations) {
            for (const c of m.connectors) {
              const p = rotatePoint(c.x, c.y, m.widthFt, m.depthFt, rot);
              const v = rotateVec(c.nx, c.ny, rot);
              const dot = v.nx * aW.nx + v.ny * aW.ny;
              const score = -dot;
              const x = aW.x - p.x;
              const y = aW.y - p.y;
              if (!best || score < best.score) {
                best = { rot, conn: c.id, x, y, score };
              }
            }
          }
          if (best) {
            previewX = best.x;
            previewY = best.y;
            previewRot = best.rot;
          }
        }
      }
    }

    const { w, d } = rotatedSize(m.widthFt, m.depthFt, previewRot);

    // Check if position is valid
    // If snapped to connector, it's always valid (green)
    // Otherwise, check for overlaps
    const isValid = snappedConnector ? true : isValidPosition(draggingModuleId, previewX, previewY, previewRot);
    const previewColor = isValid ? KELLY_GREEN : "#cc0000"; // Green if valid, red if invalid

    return (
      <g
        transform={`translate(${previewX * FT_TO_PX}, ${previewY * FT_TO_PX})`}
        opacity={0.65}
      >
        {/* Main rectangle - green if valid, red if invalid, no outline */}
        <rect
          x={0}
          y={0}
          width={w * FT_TO_PX}
          height={d * FT_TO_PX}
          fill={previewColor}
        />
        
        {/* Render door and window indicators */}
        {m.frontFeatures.map((feature, idx) => {
          if (feature.type === "opening") {
            return (
              <g key={`preview-door-${idx}`}>
                {renderPreviewDoor(feature, m.widthFt, m.depthFt, previewRot)}
              </g>
            );
          }
          if (feature.type === "window") {
            return (
              <g key={`preview-window-${idx}`}>
                {renderPreviewWindow(feature, m.widthFt, m.depthFt, previewRot)}
              </g>
            );
          }
          return null;
        })}
      </g>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, padding: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 16px 0", fontSize: 24, fontWeight: 600 }}>
            Stable Configurator
          </h2>
          
          <div style={{ marginBottom: 20, padding: 16, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Total Cost</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#0066cc" }}>
              £{totalCost.toLocaleString()}
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
            Add Modules
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#666" }}>
              Standard Stables
            </div>
            <button
              onClick={() => attach("stable_6x12", "E")}
              onMouseDown={() => handleButtonMouseDown("stable_6x12")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "grab",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              + Add Stable 6x12
            </button>
            <button
              onClick={() => attach("stable_8x12", "E")}
              onMouseDown={() => handleButtonMouseDown("stable_8x12")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "grab",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              + Add Stable 8x12
            </button>
            <button
              onClick={() => attach("stable_10x12", "E")}
              onMouseDown={() => handleButtonMouseDown("stable_10x12")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "grab",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              + Add Stable 10x12
            </button>
            <button
              onClick={() => attach("stable_12x12", "E")}
              onMouseDown={() => handleButtonMouseDown("stable_12x12")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "grab",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              + Add Stable 12x12
            </button>
            <button
              onClick={() => attach("stable_14x12", "E")}
              onMouseDown={() => handleButtonMouseDown("stable_14x12")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "grab",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              + Add Stable 14x12
            </button>
            <button
              onClick={() => attach("stable_16x12", "E")}
              onMouseDown={() => handleButtonMouseDown("stable_16x12")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "grab",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              + Add Stable 16x12
            </button>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 8, color: "#666" }}>
              Other Modules
            </div>
            <button
              onClick={() => attach("shelter_12x12", "E")}
              onMouseDown={() => handleButtonMouseDown("shelter_12x12")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "grab",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              + Add Shelter
            </button>
            <button
              onClick={() => attach("corner_16x12", "E")}
              onMouseDown={() => handleButtonMouseDown("corner_16x12")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "grab",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              + Add Corner Stable
            </button>
            <button
              onClick={() => attach("tack_room_12x12", "E")}
              onMouseDown={() => handleButtonMouseDown("tack_room_12x12")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "grab",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              + Add Tack Room
            </button>
          </div>
        </div>

        {selected && selectedModule && (
          <div style={{ marginTop: 8 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
              Selected: {selectedModule.name}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              <button
                onClick={rotateSelected}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#666",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Rotate
              </button>
              <button
                onClick={() => deleteUnit(selected.uid)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#cc0000",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Delete
              </button>
            </div>

            <div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600 }}>
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
                        gap: 8,
                        padding: 8,
                        backgroundColor: isSelected ? "#e6f2ff" : "white",
                        border: `1px solid ${isSelected ? "#0066cc" : "#ddd"}`,
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleExtra(extra.id)}
                        style={{ cursor: "pointer" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {extra.name}
                        </div>
                        {extra.description && (
                          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                            {extra.description}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0066cc" }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Plan View
        </div>
        <svg
          ref={svgRef}
          width="100%"
          height="600"
          viewBox={`${(ext.minX - 15) * FT_TO_PX} ${(ext.minY - 15) * FT_TO_PX} ${(ext.maxX - ext.minX + 30) * FT_TO_PX} ${(ext.maxY - ext.minY + 30) * FT_TO_PX}`}
          style={{ border: "2px solid #ccc", borderRadius: 8, backgroundColor: "#fafafa", cursor: draggingModuleId || draggingUnitUid ? "grabbing" : "default" }}
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
                onMouseDown={(e) => handleUnitMouseDown(e, u)}
                style={{ cursor: draggingUnitUid === u.uid ? "grabbing" : "grab" }}
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
      </div>
    </div>
  );
}
