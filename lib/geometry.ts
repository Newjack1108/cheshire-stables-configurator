import { Rotation } from "@/components/configurator/types";

export function rotatedSize(w: number, d: number, rot: Rotation) {
  return rot === 90 || rot === 270 ? { w: d, d: w } : { w, d };
}

export function rotatePoint(x: number, y: number, w: number, d: number, rot: Rotation) {
  switch (rot) {
    case 0:
      return { x, y };
    case 90:
      return { x: d - y, y: x };
    case 180:
      return { x: w - x, y: d - y };
    case 270:
      return { x: y, y: w - x };
  }
}

export function rotateVec(nx: number, ny: number, rot: Rotation) {
  switch (rot) {
    case 0:
      return { nx, ny };
    case 90:
      return { nx: -ny, ny: nx };
    case 180:
      return { nx: -nx, ny: -ny };
    case 270:
      return { nx: ny, ny: -nx };
  }
}

export function overlaps(a: any, b: any) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);
}
