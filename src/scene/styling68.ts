// Felgensterne, nach außen gewölbt. Nur Darstellung.
//  - Styling 68 (17"): 5 Doppelspeichen – je zwei parallele Arme mit schmaler Rille,
//    sichelförmig geschwungen, am Horn verbreitert (nach Fotos von Max, 2026-11-02).
//  - Styling 193 (18"): 7 schlanke, auseinanderlaufende Paare (nach Foto vermutet).
// Lokales System: Felgenachse = +Y (nach außen), Fläche in X/Z.

import * as THREE from "three";
import type { WheelStyle } from "../core/data";

export interface StarParams {
  rimR: number; // Radius Felgenhorn innen (Sitz), mm
  hubFace: number; // axiale Lage der Radanlagefläche ab Felgenmitte (= ET), mm
  lip: number; // axiale Lage des äußeren Felgenhorns (= Maulweite/2), mm
}

const DEPTH = 18; // Speichenstärke

interface Design {
  pairs: number;
  spread: number; // halber Winkel zwischen den beiden Speichen am Horn
  wOuter: number; // halbe Speichenbreite am Horn (Winkel)
  wHub: number; // halbe Breite des Paars an der Nabe (Winkel)
  split: number; // Gabelung als Anteil des Wegs Nabe → Horn
  dish: number; // Exponent der Wölbung (größer = tiefer)
}

const DESIGNS: Record<WheelStyle, Design> = {
  styling68: { pairs: 5, spread: 0.17, wOuter: 0.055, wHub: 0.2, split: 0.42, dish: 1.35 },
  styling193: { pairs: 7, spread: 0.095, wOuter: 0.033, wHub: 0.125, split: 0.28, dish: 1.6 },
};

/** Umriss eines Speichenpaars in Polarkoordinaten, Mitte bei Winkel 0. */
function pairShape(rHub: number, rSplit: number, rOuter: number, d: Design): THREE.Shape {
  const pt = (r: number, a: number) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  const { spread, wOuter, wHub } = d;
  const s = new THREE.Shape();
  const a = pt(rHub, -wHub);
  s.moveTo(a.x, a.y);
  const p1 = pt(rOuter, -spread - wOuter);
  const p2 = pt(rOuter, -spread + wOuter);
  const crotch = pt(rSplit, 0);
  const p3 = pt(rOuter, spread - wOuter);
  const p4 = pt(rOuter, spread + wOuter);
  const b = pt(rHub, wHub);
  const mid = (r: number, ang: number) => pt(r, ang);
  s.quadraticCurveTo(mid((rHub + rOuter) / 2, -spread * 0.9 - wOuter * 1.6).x, mid((rHub + rOuter) / 2, -spread * 0.9 - wOuter * 1.6).y, p1.x, p1.y);
  s.lineTo(p2.x, p2.y);
  s.quadraticCurveTo(mid((rSplit + rOuter) / 2, -spread * 0.45).x, mid((rSplit + rOuter) / 2, -spread * 0.45).y, crotch.x, crotch.y);
  s.quadraticCurveTo(mid((rSplit + rOuter) / 2, spread * 0.45).x, mid((rSplit + rOuter) / 2, spread * 0.45).y, p3.x, p3.y);
  s.lineTo(p4.x, p4.y);
  s.quadraticCurveTo(mid((rHub + rOuter) / 2, spread * 0.9 + wOuter * 1.6).x, mid((rHub + rOuter) / 2, spread * 0.9 + wOuter * 1.6).y, b.x, b.y);
  s.lineTo(a.x, a.y);
  return s;
}

/**
 * Ein Arm einer Styling-68-Doppelspeiche. Mittellinie schwingt sichelförmig aus,
 * Armbreite wächst von der Nabe zum Horn und weitet sich dort auf. side = ±1 (Arm links/rechts).
 * Maße in mm, aus dem Foto über 17"-Felge und Lochkreis 120 abgenommen.
 */
function curvedArm(theta0: number, side: 1 | -1, rHub: number, rOuter: number): THREE.Shape {
  const N = 28;
  const SWEEP = 0.2; // rad, Ausschwingen der Speiche bis zum Horn
  const width = (t: number) => (t < 0.82 ? 24 + 6 * (t / 0.82) : 30 + 20 * ((t - 0.82) / 0.18)); // je Arm
  const gap = (t: number) => (t < 0.1 ? 1 + 20 * t : 3 + 2 * t); // Rille zwischen den Armen
  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = rHub + t * (rOuter - rHub);
    const centre = theta0 + SWEEP * Math.pow(t, 1.6);
    const w = width(t);
    const mid = centre + (side * (gap(t) / 2 + w / 2)) / r;
    const a1 = mid + w / 2 / r;
    const a2 = mid - w / 2 / r;
    left.push(new THREE.Vector2(r * Math.cos(a1), r * Math.sin(a1)));
    right.push(new THREE.Vector2(r * Math.cos(a2), r * Math.sin(a2)));
  }
  const shape = new THREE.Shape([...left, ...right.reverse()]);
  return shape;
}

/** Speichenstern als eine Geometrie, gewölbt: innen auf der Radanlagefläche, außen am Horn. */
export function wheelStar(style: WheelStyle, p: StarParams): THREE.BufferGeometry {
  const d = DESIGNS[style];
  const rHub = 78;
  const rOuter = p.rimR - 6;
  const rSplit = rHub + d.split * (rOuter - rHub);
  const parts: THREE.BufferGeometry[] = [];
  const extrude = { depth: DEPTH, bevelEnabled: true, bevelThickness: 3, bevelSize: 2.5, bevelSegments: 2, curveSegments: 10 };
  for (let i = 0; i < d.pairs && style === "styling68"; i++) {
    for (const side of [1, -1] as const) parts.push(new THREE.ExtrudeGeometry(curvedArm((i / d.pairs) * Math.PI * 2, side, rHub - 8, rOuter), extrude));
  }
  for (let i = 0; i < d.pairs && style !== "styling68"; i++) {
    const g = new THREE.ExtrudeGeometry(pairShape(rHub, rSplit, rOuter, d), {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: 3,
      bevelSize: 3,
      bevelSegments: 2,
      curveSegments: 10,
    });
    g.rotateZ((i / d.pairs) * Math.PI * 2);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  // Wölbung: axiale Lage abhängig vom Radius (Z ist hier noch die Extrusionsrichtung)
  const pos = merged.getAttribute("position") as THREE.BufferAttribute;
  const front = p.lip - 4; // Speichenoberfläche am Horn
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, y);
    const t = Math.min(1, Math.max(0, (r - rHub) / (rOuter - rHub)));
    const face = p.hubFace + 14 + (front - p.hubFace - 14) * Math.pow(t, d.dish);
    pos.setZ(i, face - DEPTH + z);
  }
  merged.computeVertexNormals();
  merged.rotateX(-Math.PI / 2); // Z → Y (Felgenachse)
  return merged;
}

/** Rückwärtskompatibel: Stern Styling 68. */
export const styling68Star = (p: StarParams) => wheelStar("styling68", p);

/** Nabe mit fünf Radschrauben auf Lochkreis 120 mm und Nabendeckel. */
export function styling68Hub(p: StarParams): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const hub = new THREE.CylinderGeometry(72, 76, 26, 40);
  hub.translate(0, p.hubFace + 13, 0);
  parts.push(hub);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 10;
    const bolt = new THREE.CylinderGeometry(9, 9, 14, 6);
    bolt.translate(60 * Math.cos(a), p.hubFace + 32, 60 * Math.sin(a));
    parts.push(bolt);
  }
  const cap = new THREE.CylinderGeometry(30, 34, 10, 32);
  cap.translate(0, p.hubFace + 31, 0);
  parts.push(cap);
  return mergeGeometries(parts);
}

/** Einfaches Zusammenführen (alle Teile indiziert oder alle nicht indiziert). */
function mergeGeometries(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const plain = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  const pos: number[] = [];
  for (const g of plain) {
    const a = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) pos.push(a.getX(i), a.getY(i), a.getZ(i));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}
