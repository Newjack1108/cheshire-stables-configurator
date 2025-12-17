"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { MODULES } from "@/lib/modules";
import { getAllTemplates, getTemplate, saveTemplate, LayoutTemplate, deleteTemplate } from "@/lib/data/layoutTemplates";
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
  
  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(1); // 1.0 = 100%
  
  // Layout rotation state
  const [layoutRotation, setLayoutRotation] = useState(0); // 0, 90, 180, 270
  
  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  // Pre-built designs state
  const [preBuiltDesigns, setPreBuiltDesigns] = useState<any[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string>("");

  const selected = units.find((u) => u.uid === selectedUid);

  // Rotate entire layout
  function rotateLayout() {
    if (units.length === 0) return;
    
    // Calculate center point of all units (using their bounding boxes)
    let centerX = 0;
    let centerY = 0;
    let totalWeight = 0;
    for (const u of units) {
      const m = getModule(u.moduleId);
      const b = bbox(u, m);
      const weight = b.w * b.d; // Weight by area
      centerX += (b.x + b.w / 2) * weight;
      centerY += (b.y + b.d / 2) * weight;
      totalWeight += weight;
    }
    centerX /= totalWeight;
    centerY /= totalWeight;
    
    // Rotate 90 degrees clockwise
    const rotationRad = (90 * Math.PI) / 180;
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);
    
    const rotatedUnits = units.map((u) => {
      const m = getModule(u.moduleId);
      const b = bbox(u, m);
      const unitCenterX = b.x + b.w / 2;
      const unitCenterY = b.y + b.d / 2;
      
      // Translate to origin, rotate, translate back
      const dx = unitCenterX - centerX;
      const dy = unitCenterY - centerY;
      const newX = centerX + dx * cos - dy * sin;
      const newY = centerY + dx * sin + dy * cos;
      
      // Calculate new position (top-left corner)
      // Need to account for the fact that after rotation, width/height may swap
      const newUnitRot = ((u.rot + 90) % 360) as Rotation;
      const { w, d } = rotatedSize(m.widthFt, m.depthFt, newUnitRot);
      
      const newXFt = newX - w / 2;
      const newYFt = newY - d / 2;
      
      return {
        ...u,
        xFt: newXFt,
        yFt: newYFt,
        rot: newUnitRot as Rotation,
      };
    });
    
    setUnits(rotatedUnits);
    setLayoutRotation((layoutRotation + 90) % 360);
  }

  // Load template
  function loadTemplate(templateId: string) {
    const template = getTemplate(templateId);
    if (!template) {
      // Try loading from saved templates
      const savedTemplates = getAllTemplates();
      const savedTemplate = savedTemplates.find((t) => t.id === templateId);
      if (!savedTemplate) return;
      
      // Generate new UIDs for units and update connections
      const uidMap = new Map<string, string>();
      const newUnits = savedTemplate.units.map((u) => {
        const newUid = uid();
        uidMap.set(u.uid, newUid);
        return { ...u, uid: newUid };
      });
      
      const newConnections = savedTemplate.connections.map((c) => ({
        aUid: uidMap.get(c.aUid) || c.aUid,
        aConn: c.aConn,
        bUid: uidMap.get(c.bUid) || c.bUid,
        bConn: c.bConn,
      }));
      
      setUnits(newUnits);
      setConnections(newConnections);
      if (newUnits.length > 0) {
        setSelectedUid(newUnits[0].uid);
      }
      setSelectedTemplateId(templateId);
      return;
    }
    
    // Generate new UIDs for units and update connections
    const uidMap = new Map<string, string>();
    const newUnits = template.units.map((u) => {
      const newUid = uid();
      uidMap.set(u.uid, newUid);
      return { ...u, uid: newUid };
    });
    
    const newConnections = template.connections.map((c) => ({
      aUid: uidMap.get(c.aUid) || c.aUid,
      aConn: c.aConn,
      bUid: uidMap.get(c.bUid) || c.bUid,
      bConn: c.bConn,
    }));
    
    setUnits(newUnits);
    setConnections(newConnections);
    if (newUnits.length > 0) {
      setSelectedUid(newUnits[0].uid);
    }
    setSelectedTemplateId(templateId);
  }

  // Load pre-built design
  function loadDesign(designId: string) {
    const design = preBuiltDesigns.find((d) => d.id === designId);
    if (!design) return;
    
    // Generate new UIDs for units and update connections
    const uidMap = new Map<string, string>();
    const newUnits = design.units.map((u: PlacedUnit) => {
      const newUid = uid();
      uidMap.set(u.uid, newUid);
      return { ...u, uid: newUid };
    });
    
    const newConnections = design.connections.map((c: Connection) => ({
      aUid: uidMap.get(c.aUid) || c.aUid,
      aConn: c.aConn,
      bUid: uidMap.get(c.bUid) || c.bUid,
      bConn: c.bConn,
    }));
    
    setUnits(newUnits);
    setConnections(newConnections);
    if (newUnits.length > 0) {
      setSelectedUid(newUnits[0].uid);
    }
    setSelectedDesignId(designId);
  }

  // Load pre-built designs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("stable_configurator_designs");
      if (saved) {
        setPreBuiltDesigns(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

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
  // Checks if any connector of the dragged module (at position x, y, rot) is near any available connector
  // excludeUid: optional UID to exclude from search (useful when dragging existing unit)
  function findNearestConnector(
    moduleId: string,
    x: number,
    y: number,
    rot: Rotation,
    excludeUid?: string
  ): { uid: string; connId: ConnectorId; distance: number } | null {
    let nearest: { uid: string; connId: ConnectorId; distance: number } | null = null;
    const snapDistFt = SNAP_DISTANCE;
    
    const draggedMod = getModule(moduleId);
    
    // Get all connector positions for the dragged module at this position/rotation
    const draggedConnectors: Array<{ x: number; y: number; connId: ConnectorId }> = [];
    for (const conn of draggedMod.connectors) {
      const connWorld = connectorWorld(
        { uid: "temp", moduleId, xFt: x, yFt: y, rot, selectedExtras: [] },
        draggedMod,
        conn
      );
      draggedConnectors.push({ x: connWorld.x, y: connWorld.y, connId: conn.id });
    }

    // Check each dragged connector against all available connectors on other units
    for (const draggedConn of draggedConnectors) {
      for (const u of units) {
        // Skip the unit being dragged
        if (excludeUid && u.uid === excludeUid) continue;
        
        const m = getModule(u.moduleId);
        for (const conn of m.connectors) {
          if (isUsed(u.uid, conn.id)) continue;
          
          const connWorld = connectorWorld(u, m, conn);
          const dx = connWorld.x - draggedConn.x;
          const dy = connWorld.y - draggedConn.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Strict snap: must be within 2ft (no tolerance)
          if (dist < snapDistFt && (!nearest || dist < nearest.distance)) {
            nearest = { uid: u.uid, connId: conn.id, distance: dist };
          }
        }
      }
    }

    return nearest;
  }

  // Check if a module position is valid (no overlaps)
  // excludeUid: optional UID to exclude from overlap check (useful when dragging existing unit)
  // Check if two connectors can connect based on building types
  function canConnect(
    sourceConn: ConnectorId,
    sourceKind: "stable" | "shelter" | "corner" | "tack_room",
    targetConn: ConnectorId,
    targetKind: "stable" | "shelter" | "corner" | "tack_room"
  ): boolean {
    // Standard building to Standard building: LEFT connects to RIGHT
    if ((sourceKind === "stable" || sourceKind === "shelter" || sourceKind === "tack_room") &&
        (targetKind === "stable" || targetKind === "shelter" || targetKind === "tack_room")) {
      return (sourceConn === "LEFT" && targetConn === "RIGHT") ||
             (sourceConn === "RIGHT" && targetConn === "LEFT");
    }
    
    // Corner to Standard: DOOR_SIDE connectors connect to same-side standard connectors
    if (sourceKind === "corner" && 
        (targetKind === "stable" || targetKind === "shelter" || targetKind === "tack_room")) {
      if (sourceConn === "DOOR_SIDE_LEFT" && targetConn === "LEFT") return true;
      if (sourceConn === "DOOR_SIDE_RIGHT" && targetConn === "RIGHT") return true;
      // BACK can connect to either LEFT or RIGHT (will determine rotation based on front facing)
      if (sourceConn === "BACK" && (targetConn === "LEFT" || targetConn === "RIGHT")) return true;
    }
    
    // Standard to Corner: reverse of above
    if ((sourceKind === "stable" || sourceKind === "shelter" || sourceKind === "tack_room") &&
        targetKind === "corner") {
      if (sourceConn === "LEFT" && targetConn === "DOOR_SIDE_LEFT") return true;
      if (sourceConn === "RIGHT" && targetConn === "DOOR_SIDE_RIGHT") return true;
      if ((sourceConn === "LEFT" || sourceConn === "RIGHT") && targetConn === "BACK") return true;
    }
    
    return false;
  }

  // Calculate if front should face inward when connecting standard to corner
  function shouldFaceInward(
    standardUnit: PlacedUnit,
    standardMod: ModuleDef,
    cornerUnit: PlacedUnit,
    cornerMod: ModuleDef,
    standardConn: ConnectorId,
    cornerConn: ConnectorId
  ): { targetFrontFace: "N" | "E" | "S" | "W" } | null {
    if (standardMod.kind === "corner" || cornerMod.kind !== "corner") return null;
    
    // Calculate direction from standard's connector position to corner's center
    const standardConnWorld = connectorWorld(standardUnit, standardMod, 
      standardMod.connectors.find(c => c.id === standardConn)!);
    const cornerCenter = {
      x: cornerUnit.xFt + cornerMod.widthFt / 2,
      y: cornerUnit.yFt + cornerMod.depthFt / 2
    };
    
    const dx = cornerCenter.x - standardConnWorld.x;
    const dy = cornerCenter.y - standardConnWorld.y;
    
    // Determine which direction the front should face
    if (Math.abs(dx) > Math.abs(dy)) {
      return { targetFrontFace: dx > 0 ? "E" : "W" };
    } else {
      return { targetFrontFace: dy > 0 ? "S" : "N" };
    }
  }

  function isValidPosition(moduleId: string, x: number, y: number, rot: Rotation, excludeUid?: string): boolean {
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
      // Skip the unit being dragged (excludeUid)
      if (excludeUid && u.uid === excludeUid) continue;
      
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
    const newMod = getModule(moduleId);

    // Try all available connectors on the target unit, not just the one specified
    // This allows us to find the best compatible match
    let bestOverall: {
      rot: Rotation;
      conn: ConnectorId;
      targetConn: ConnectorId;
      x: number;
      y: number;
      score: number;
    } | null = null;

    for (const targetConnCandidate of aMod.connectors) {
      if (isUsed(sourceUnit.uid, targetConnCandidate.id)) continue;

      const aDef = targetConnCandidate;
      const aW = connectorWorld(sourceUnit, aMod, aDef);

      let best: {
        rot: Rotation;
        conn: ConnectorId;
        x: number;
        y: number;
        score: number;
      } | null = null;

      for (const rot of newMod.rotations) {
        for (const c of newMod.connectors) {
          // Check if these connectors can connect based on building types
          if (!canConnect(c.id, newMod.kind, targetConnCandidate.id, aMod.kind)) {
            continue;
          }
          
          const p = rotatePoint(
            c.x,
            c.y,
            newMod.widthFt,
            newMod.depthFt,
            rot
          );
          const v = rotateVec(c.nx, c.ny, rot);
          
          // Calculate position
          const x = aW.x - p.x;
          const y = aW.y - p.y;
          
          // Calculate score based on connector alignment
          // For standard-to-standard: connectors should be opposite (dot product < -0.7)
          // For corner-to-standard: connectors can be same direction (for DOOR_SIDE) or opposite (for BACK)
          const dot = v.nx * aW.nx + v.ny * aW.ny;
          
          let score = Math.abs(dot); // Lower is better (closer to -1 or 1 depending on connection type)
          
          // Standard-to-standard: prefer opposite directions (dot < -0.7)
          if ((newMod.kind === "stable" || newMod.kind === "shelter" || newMod.kind === "tack_room") &&
              (aMod.kind === "stable" || aMod.kind === "shelter" || aMod.kind === "tack_room")) {
            if (dot >= -0.7) continue; // Must be opposite
            score = -dot; // More negative dot = better score
          }
          // Corner-to-standard or Standard-to-corner
          else if (newMod.kind === "corner" || aMod.kind === "corner") {
            // DOOR_SIDE connectors should face same direction (dot > 0.7)
            if ((c.id === "DOOR_SIDE_LEFT" || c.id === "DOOR_SIDE_RIGHT") ||
                (targetConnCandidate.id === "DOOR_SIDE_LEFT" || targetConnCandidate.id === "DOOR_SIDE_RIGHT")) {
              if (dot < 0.7) continue; // Must be same direction
              score = 1 - dot; // Closer to 1 = better
            }
            // BACK connector can connect with opposite direction
            else if (c.id === "BACK" || targetConnCandidate.id === "BACK") {
              if (dot >= -0.7) continue; // Must be opposite
              score = -dot;
            }
          }
          
          // Calculate front face preference for standard buildings connecting to corners
          let frontFaceBonus = 0;
          if ((newMod.kind === "stable" || newMod.kind === "shelter" || newMod.kind === "tack_room") &&
              aMod.kind === "corner") {
            // Create a temporary unit to calculate front face direction
            const tempUnit: PlacedUnit = {
              uid: "temp",
              moduleId: newMod.id,
              xFt: x,
              yFt: y,
              rot,
              selectedExtras: []
            };
            const inward = shouldFaceInward(tempUnit, newMod, sourceUnit, aMod, c.id, targetConnCandidate.id);
            if (inward) {
              const currentFrontFace = getFrontFace(rot);
              if (currentFrontFace === inward.targetFrontFace) {
                frontFaceBonus = 0.2; // Bonus for facing inward
              }
            }
          }
          
          const totalScore = score - frontFaceBonus;
          
          if (!best || totalScore < best.score) {
            best = { rot, conn: c.id, x, y, score: totalScore };
          }
        }
      }

      // Keep track of the best match across all target connectors
      if (best && (!bestOverall || best.score < bestOverall.score)) {
        bestOverall = {
          ...best,
          targetConn: targetConnCandidate.id,
        };
      }
    }

    if (!bestOverall) return;
    const best = bestOverall;

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
        aConn: best.targetConn,
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

  // Connect existing unit to a connector
  function connectExistingUnit(unitUid: string, targetConn: ConnectorId, targetUnitUid: string): void {
    const unit = units.find((u) => u.uid === unitUid);
    const targetUnit = units.find((u) => u.uid === targetUnitUid);
    if (!unit || !targetUnit) return;

    const targetMod = getModule(targetUnit.moduleId);
    const targetConnDef = targetMod.connectors.find((c) => c.id === targetConn);
    if (!targetConnDef) return;

    if (isUsed(targetUnit.uid, targetConn)) return;

    const aW = connectorWorld(targetUnit, targetMod, targetConnDef);
    const unitMod = getModule(unit.moduleId);

    // Find best rotation and connector match
    let best: {
      rot: Rotation;
      conn: ConnectorId;
      x: number;
      y: number;
      score: number;
    } | null = null;

    for (const rot of unitMod.rotations) {
      for (const c of unitMod.connectors) {
        // Skip if this connector is already used (unless it's the same connection we're replacing)
        if (isUsed(unitUid, c.id)) {
          // Check if it's the connection we're about to replace
          const existingConn = connections.find(
            (conn) => (conn.aUid === unitUid && conn.aConn === c.id) || (conn.bUid === unitUid && conn.bConn === c.id)
          );
          // If it's connected to a different unit, skip it
          if (existingConn && existingConn.aUid !== targetUnitUid && existingConn.bUid !== targetUnitUid) {
            continue;
          }
        }
        
        // Check if these connectors can connect based on building types
        if (!canConnect(c.id, unitMod.kind, targetConn, targetMod.kind)) {
          continue;
        }
        
        const p = rotatePoint(c.x, c.y, unitMod.widthFt, unitMod.depthFt, rot);
        const v = rotateVec(c.nx, c.ny, rot);
        
        // Calculate position
        const x = aW.x - p.x;
        const y = aW.y - p.y;
        
        // Calculate score based on connector alignment
        const dot = v.nx * aW.nx + v.ny * aW.ny;
        
        let score = Math.abs(dot);
        
        // Standard-to-standard: prefer opposite directions (dot < -0.7)
        if ((unitMod.kind === "stable" || unitMod.kind === "shelter" || unitMod.kind === "tack_room") &&
            (targetMod.kind === "stable" || targetMod.kind === "shelter" || targetMod.kind === "tack_room")) {
          if (dot >= -0.7) continue; // Must be opposite
          score = -dot;
        }
        // Corner-to-standard or Standard-to-corner
        else if (unitMod.kind === "corner" || targetMod.kind === "corner") {
          // DOOR_SIDE connectors should face same direction (dot > 0.7)
          if ((c.id === "DOOR_SIDE_LEFT" || c.id === "DOOR_SIDE_RIGHT") ||
              (targetConn === "DOOR_SIDE_LEFT" || targetConn === "DOOR_SIDE_RIGHT")) {
            if (dot < 0.7) continue; // Must be same direction
            score = 1 - dot;
          }
          // BACK connector can connect with opposite direction
          else if (c.id === "BACK" || targetConn === "BACK") {
            if (dot >= -0.7) continue; // Must be opposite
            score = -dot;
          }
        }
        
        // Calculate front face preference for standard buildings connecting to corners
        let frontFaceBonus = 0;
        if ((unitMod.kind === "stable" || unitMod.kind === "shelter" || unitMod.kind === "tack_room") &&
            targetMod.kind === "corner") {
          const tempUnit: PlacedUnit = {
            uid: "temp",
            moduleId: unitMod.id,
            xFt: x,
            yFt: y,
            rot,
            selectedExtras: []
          };
          const inward = shouldFaceInward(tempUnit, unitMod, targetUnit, targetMod, c.id, targetConn);
          if (inward) {
            const currentFrontFace = getFrontFace(rot);
            if (currentFrontFace === inward.targetFrontFace) {
              frontFaceBonus = 0.2;
            }
          }
        }
        
        const totalScore = score - frontFaceBonus;
        
        if (!best || totalScore < best.score) {
          best = { rot, conn: c.id, x, y, score: totalScore };
        }
      }
    }

    if (!best) return;

    // Check if the new position is valid (excluding the unit being moved)
    if (!isValidPosition(unit.moduleId, best.x, best.y, best.rot, unitUid)) {
      return;
    }

    // Update the unit's position and rotation
    const updatedUnit: PlacedUnit = {
      ...unit,
      xFt: best.x,
      yFt: best.y,
      rot: best.rot,
    };

    // Remove any existing connections for this unit
    const filteredConnections = connections.filter(
      (c) => c.aUid !== unitUid && c.bUid !== unitUid
    );

    // Add new connection
    const newConnection: Connection = {
      aUid: targetUnit.uid,
      aConn: targetConn,
      bUid: unitUid,
      bConn: best.conn,
    };

    setUnits(units.map((u) => (u.uid === unitUid ? updatedUnit : u)));
    setConnections([...filteredConnections, newConnection]);
    setSelectedUid(unitUid);
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
      // Center the module on the mouse cursor for checking
      const m = getModule(draggingModuleId);
      const centeredX = worldPos.x - m.widthFt / 2;
      const centeredY = worldPos.y - m.depthFt / 2;
      const nearest = findNearestConnector(draggingModuleId, centeredX, centeredY, 0);
      setSnappedConnector(nearest ? { uid: nearest.uid, connId: nearest.connId } : null);
    } else if (draggingUnitUid && dragOffset) {
      // For repositioning existing unit, check for connectors
      // Use the unit's new position to find nearest connector (exclude the dragged unit)
      const unit = units.find((u) => u.uid === draggingUnitUid);
      if (unit) {
        const newX = worldPos.x - dragOffset.x;
        const newY = worldPos.y - dragOffset.y;
        const nearest = findNearestConnector(unit.moduleId, newX, newY, unit.rot, draggingUnitUid);
        setSnappedConnector(nearest ? { uid: nearest.uid, connId: nearest.connId } : null);
      }
    }
  }

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (draggingModuleId) {
      const svg = e.currentTarget;
      const worldPos = screenToWorld(svg, e.clientX, e.clientY);
      
      // Check for nearest connector at release position
      // Center the module on the mouse cursor for checking
      const m = getModule(draggingModuleId);
      const centeredX = worldPos.x - m.widthFt / 2;
      const centeredY = worldPos.y - m.depthFt / 2;
      const nearest = findNearestConnector(draggingModuleId, centeredX, centeredY, 0);
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
      
      if (snappedConnector) {
        // Connect to connector
        connectExistingUnit(draggingUnitUid, snappedConnector.connId, snappedConnector.uid);
      } else {
        // Place in free space
        const newX = worldPos.x - dragOffset.x;
        const newY = worldPos.y - dragOffset.y;
        
        const unit = units.find((u) => u.uid === draggingUnitUid);
        if (unit) {
          const m = getModule(unit.moduleId);
          
          // Check if position is valid (excluding the dragged unit)
          if (isValidPosition(unit.moduleId, newX, newY, unit.rot, draggingUnitUid)) {
            const newUnit: PlacedUnit = { ...unit, xFt: newX, yFt: newY };
            
            // Remove any existing connections when moving to free space
            const filteredConnections = connections.filter(
              (c) => c.aUid !== draggingUnitUid && c.bUid !== draggingUnitUid
            );
            
            setUnits(units.map((u) => (u.uid === draggingUnitUid ? newUnit : u)));
            setConnections(filteredConnections);
          }
        }
      }
      
      setDraggingUnitUid(null);
      setDragPosition(null);
      setDragOffset(null);
      setSnappedConnector(null);
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
        // Center the module on the mouse cursor for checking
        const m = getModule(draggingModuleId);
        const centeredX = worldPos.x - m.widthFt / 2;
        const centeredY = worldPos.y - m.depthFt / 2;
        const nearest = findNearestConnector(draggingModuleId, centeredX, centeredY, 0);
        setSnappedConnector(nearest ? { uid: nearest.uid, connId: nearest.connId } : null);
      } else if (draggingUnitUid && dragOffset) {
        // For repositioning existing unit, check for connectors
        const unit = units.find((u) => u.uid === draggingUnitUid);
        if (unit) {
          const newX = worldPos.x - dragOffset.x;
          const newY = worldPos.y - dragOffset.y;
          const nearest = findNearestConnector(unit.moduleId, newX, newY, unit.rot, draggingUnitUid);
          setSnappedConnector(nearest ? { uid: nearest.uid, connId: nearest.connId } : null);
        }
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
          // Center the module on the mouse cursor for checking
          const m = getModule(draggingModuleId);
          const centeredX = worldPos.x - m.widthFt / 2;
          const centeredY = worldPos.y - m.depthFt / 2;
          const nearest = findNearestConnector(draggingModuleId, centeredX, centeredY, 0);
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
          
          // Check for nearest connector at release position (exclude the dragged unit)
          const unit = units.find((u) => u.uid === draggingUnitUid);
          if (unit) {
            const newX = worldPos.x - dragOffset.x;
            const newY = worldPos.y - dragOffset.y;
            const nearest = findNearestConnector(unit.moduleId, newX, newY, unit.rot, draggingUnitUid);
            const releaseSnappedConnector = nearest ? { uid: nearest.uid, connId: nearest.connId } : null;
            
            if (releaseSnappedConnector) {
              // Connect to connector
              connectExistingUnit(draggingUnitUid, releaseSnappedConnector.connId, releaseSnappedConnector.uid);
            } else {
              // Place in free space
              const m = getModule(unit.moduleId);
              
              // Check if position is valid (excluding the dragged unit)
              if (isValidPosition(unit.moduleId, newX, newY, unit.rot, draggingUnitUid)) {
                const newUnit: PlacedUnit = { ...unit, xFt: newX, yFt: newY };
                
                // Remove any existing connections when moving to free space
                const filteredConnections = connections.filter(
                  (c) => c.aUid !== draggingUnitUid && c.bUid !== draggingUnitUid
                );
                
                setUnits(units.map((u) => (u.uid === draggingUnitUid ? newUnit : u)));
                setConnections(filteredConnections);
              }
            }
          }
        }
        
        setDraggingUnitUid(null);
        setDragPosition(null);
        setDragOffset(null);
        setSnappedConnector(null);
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
    if ((!draggingModuleId && !draggingUnitUid) || !dragPosition) return null;

    let m: ModuleDef;
    let previewX: number;
    let previewY: number;
    let previewRot: Rotation;
    let excludeUid: string | undefined;

    if (draggingModuleId) {
      // Dragging new module from button
      m = getModule(draggingModuleId);
      previewX = dragPosition.x;
      previewY = dragPosition.y;
      previewRot = 0;

      // If not snapped to connector, center the preview on the mouse cursor
      if (!snappedConnector) {
        previewX = dragPosition.x - m.widthFt / 2;
        previewY = dragPosition.y - m.depthFt / 2;
      }
    } else if (draggingUnitUid && dragOffset) {
      // Dragging existing unit
      const unit = units.find((u) => u.uid === draggingUnitUid);
      if (!unit) return null;
      
      m = getModule(unit.moduleId);
      previewRot = unit.rot;
      excludeUid = unit.uid;
      
      // Calculate preview position based on mouse position and drag offset
      previewX = dragPosition.x - dragOffset.x;
      previewY = dragPosition.y - dragOffset.y;
    } else {
      return null;
    }

    // If snapped to connector, calculate position using same logic as attach()
    if (snappedConnector) {
      const targetUnit = units.find((u) => u.uid === snappedConnector.uid);
      if (targetUnit) {
        const targetMod = getModule(targetUnit.moduleId);
        
        // Try all available connectors on the target unit, not just the one specified
        // This allows us to find the best compatible match (same logic as attach())
        let bestOverall: {
          rot: Rotation;
          conn: ConnectorId;
          x: number;
          y: number;
          score: number;
        } | null = null;

        for (const targetConnCandidate of targetMod.connectors) {
          // Skip if connector is already used
          if (isUsed(targetUnit.uid, targetConnCandidate.id)) continue;

          const aW = connectorWorld(targetUnit, targetMod, targetConnCandidate);
          
          // Find best rotation and connector match
          let best: { rot: Rotation; conn: ConnectorId; x: number; y: number; score: number } | null = null;
          for (const rot of m.rotations) {
            for (const c of m.connectors) {
              // Check if these connectors can connect based on building types
              if (!canConnect(c.id, m.kind, targetConnCandidate.id, targetMod.kind)) {
                continue;
              }
              
              const p = rotatePoint(c.x, c.y, m.widthFt, m.depthFt, rot);
              const v = rotateVec(c.nx, c.ny, rot);
              
              // Calculate position
              const x = aW.x - p.x;
              const y = aW.y - p.y;
              
              // Calculate score based on connector alignment
              const dot = v.nx * aW.nx + v.ny * aW.ny;
              
              let score = Math.abs(dot);
              
              // Standard-to-standard: prefer opposite directions (dot < -0.7)
              if ((m.kind === "stable" || m.kind === "shelter" || m.kind === "tack_room") &&
                  (targetMod.kind === "stable" || targetMod.kind === "shelter" || targetMod.kind === "tack_room")) {
                if (dot >= -0.7) continue; // Must be opposite
                score = -dot;
              }
              // Corner-to-standard or Standard-to-corner
              else if (m.kind === "corner" || targetMod.kind === "corner") {
                // DOOR_SIDE connectors should face same direction (dot > 0.7)
                if ((c.id === "DOOR_SIDE_LEFT" || c.id === "DOOR_SIDE_RIGHT") ||
                    (targetConnCandidate.id === "DOOR_SIDE_LEFT" || targetConnCandidate.id === "DOOR_SIDE_RIGHT")) {
                  if (dot < 0.7) continue; // Must be same direction
                  score = 1 - dot;
                }
                // BACK connector can connect with opposite direction
                else if (c.id === "BACK" || targetConnCandidate.id === "BACK") {
                  if (dot >= -0.7) continue; // Must be opposite
                  score = -dot;
                }
              }
              
              // Calculate front face preference for standard buildings connecting to corners
              let frontFaceBonus = 0;
              if ((m.kind === "stable" || m.kind === "shelter" || m.kind === "tack_room") &&
                  targetMod.kind === "corner") {
                const tempUnit: PlacedUnit = {
                  uid: "temp",
                  moduleId: m.id,
                  xFt: x,
                  yFt: y,
                  rot,
                  selectedExtras: []
                };
                const inward = shouldFaceInward(tempUnit, m, targetUnit, targetMod, c.id, targetConnCandidate.id);
                if (inward) {
                  const currentFrontFace = getFrontFace(rot);
                  if (currentFrontFace === inward.targetFrontFace) {
                    frontFaceBonus = 0.2;
                  }
                }
              }
              
              const totalScore = score - frontFaceBonus;
              
              if (!best || totalScore < best.score) {
                best = { rot, conn: c.id, x, y, score: totalScore };
              }
            }
          }
          
          // Keep track of the best match across all target connectors
          if (best && (!bestOverall || best.score < bestOverall.score)) {
            bestOverall = best;
          }
        }
        
        if (bestOverall) {
          previewX = bestOverall.x;
          previewY = bestOverall.y;
          previewRot = bestOverall.rot;
        }
      }
    }

    const { w, d } = rotatedSize(m.widthFt, m.depthFt, previewRot);

    // Check if position is valid
    // If snapped to connector, it's always valid (green)
    // Otherwise, check for overlaps (excluding the dragged unit if it's an existing unit)
    const isValid = snappedConnector ? true : isValidPosition(m.id, previewX, previewY, previewRot, excludeUid);
    const previewColor = isValid ? KELLY_GREEN : "#cc0000"; // Green if valid, red if invalid

    const frontFace = getFrontFace(previewRot);
    
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
        
        {/* Roof overhang at front - dotted line */}
        {(() => {
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
                  opacity={0.65}
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
                  opacity={0.65}
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
                  opacity={0.65}
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
                  opacity={0.65}
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
                  opacity={0.65}
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
                  opacity={0.65}
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
                  opacity={0.65}
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
                  opacity={0.65}
                />
              );
            }
            return null;
          }
        })()}
        
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

        {/* Pre-built Designs Selector */}
        {preBuiltDesigns.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ 
              margin: "0 0 12px 0", 
              fontSize: 18, 
              fontWeight: 600,
              color: "#1a1a1a",
              fontFamily: "Inter, sans-serif"
            }}>
              Pre-built Designs
            </h3>
            <select
              value={selectedDesignId}
              onChange={(e) => {
                if (e.target.value) {
                  loadDesign(e.target.value);
                }
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                fontFamily: "Inter, sans-serif",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                backgroundColor: "white",
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              <option value="">Select a design...</option>
              {preBuiltDesigns.map((design) => (
                <option key={design.id} value={design.id}>
                  {design.name} - {design.description || "No description"}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Template Selector */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ 
            margin: "0 0 12px 0", 
            fontSize: 18, 
            fontWeight: 600,
            color: "#1a1a1a",
            fontFamily: "Inter, sans-serif"
          }}>
            Layout Templates
          </h3>
          <select
            value={selectedTemplateId}
            onChange={(e) => {
              if (e.target.value) {
                loadTemplate(e.target.value);
              }
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              fontFamily: "Inter, sans-serif",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              backgroundColor: "white",
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            <option value="">Select a template...</option>
            {getAllTemplates().map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.description}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                const templateName = prompt("Enter template name:");
                if (!templateName) return;
                const templateDescription = prompt("Enter template description:") || "";
                const template: LayoutTemplate = {
                  id: `custom_${Date.now()}`,
                  name: templateName,
                  description: templateDescription,
                  units: units,
                  connections: connections,
                };
                saveTemplate(template);
                alert("Template saved!");
                setSelectedTemplateId(template.id);
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                backgroundColor: DARK_GREEN,
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
              }}
            >
              Save Current
            </button>
            {selectedTemplateId && selectedTemplateId.startsWith("custom_") && (
              <button
                onClick={() => {
                  if (confirm("Delete this template?")) {
                    deleteTemplate(selectedTemplateId);
                    setSelectedTemplateId("");
                    alert("Template deleted!");
                  }
                }}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                Delete
              </button>
            )}
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
              onClick={() => attach("stable_6x12", "RIGHT")}
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
              onClick={() => attach("stable_8x12", "RIGHT")}
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
              onClick={() => attach("stable_10x12", "RIGHT")}
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
              onClick={() => attach("stable_12x12", "RIGHT")}
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
              onClick={() => attach("stable_14x12", "RIGHT")}
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
              onClick={() => attach("stable_16x12", "RIGHT")}
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
              onClick={() => attach("shelter_12x12", "RIGHT")}
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
              onClick={() => attach("corner_16x12", "DOOR_SIDE_RIGHT")}
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
                handleButtonMouseDown("corner_16x12");
                e.currentTarget.style.backgroundColor = DARK_GREEN_ACTIVE;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = DARK_GREEN_HOVER;
              }}
            >
              + Add Corner Stable
            </button>
            <button
              onClick={() => attach("corner_rh_16x12", "DOOR_SIDE_RIGHT")}
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
              onClick={() => attach("tack_room_12x12", "RIGHT")}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <button
                onClick={rotateSelected}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#4a5568",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
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
                Rotate
              </button>
              <button
                onClick={() => deleteUnit(selected.uid)}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
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
                Delete
              </button>
            </div>

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
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 8,
            backgroundColor: "white",
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #e0e0e0",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
          }}>
            <button
              onClick={() => {
                const newZoom = Math.max(0.25, zoomLevel - 0.25);
                setZoomLevel(newZoom);
              }}
              disabled={zoomLevel <= 0.25}
              style={{
                padding: "6px 12px",
                backgroundColor: zoomLevel <= 0.25 ? "#e0e0e0" : DARK_GREEN,
                color: zoomLevel <= 0.25 ? "#999" : "white",
                border: "none",
                borderRadius: 6,
                cursor: zoomLevel <= 0.25 ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
              }}
            >
              −
            </button>
            <span style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: "#1a1a1a",
              fontFamily: "Inter, sans-serif",
              minWidth: "50px",
              textAlign: "center"
            }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => {
                const newZoom = Math.min(4, zoomLevel + 0.25);
                setZoomLevel(newZoom);
              }}
              disabled={zoomLevel >= 4}
              style={{
                padding: "6px 12px",
                backgroundColor: zoomLevel >= 4 ? "#e0e0e0" : DARK_GREEN,
                color: zoomLevel >= 4 ? "#999" : "white",
                border: "none",
                borderRadius: 6,
                cursor: zoomLevel >= 4 ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease",
              }}
            >
              +
            </button>
            <button
              onClick={() => setZoomLevel(1)}
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
                marginLeft: 4,
              }}
            >
              Reset
            </button>
            <button
              onClick={rotateLayout}
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
                marginLeft: 8,
              }}
              title="Rotate entire layout 90°"
            >
              ↻ Rotate Layout
            </button>
          </div>
        </div>
        <svg
          ref={svgRef}
          width="100%"
          height="600"
          viewBox={`${(ext.minX - 15) * FT_TO_PX / zoomLevel} ${(ext.minY - 15) * FT_TO_PX / zoomLevel} ${(ext.maxX - ext.minX + 30) * FT_TO_PX / zoomLevel} ${(ext.maxY - ext.minY + 30) * FT_TO_PX / zoomLevel}`}
          style={{ 
            border: "2px solid #d0d0d0", 
            borderRadius: 12, 
            backgroundColor: "#ffffff", 
            cursor: draggingModuleId || draggingUnitUid ? "grabbing" : "default",
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
            const isBeingDragged = draggingUnitUid === u.uid;
            
            // Hide unit being dragged (preview will show instead)
            if (isBeingDragged) return null;
            
            return (
              <g
                key={u.uid}
                transform={`translate(${u.xFt * FT_TO_PX}, ${u.yFt * FT_TO_PX})`}
                onClick={() => setSelectedUid(u.uid)}
                onMouseDown={(e) => handleUnitMouseDown(e, u)}
                style={{ cursor: "grab" }}
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
      </div>
    </div>
  );
}
