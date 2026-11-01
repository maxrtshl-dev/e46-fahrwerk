// Karosserie E46 Coupé als Loft aus Querschnitten – nur Darstellung, keine Rechengrundlage.
// Koordinaten: Karosseriesystem in mm (x vorn ab Vorderachse, y links, z oben ab Fahrbahn in Serienlage).
// Die Stationen sind Proportionen eines E46 Coupés, skaliert auf Länge/Breite/Höhe aus den Daten.
// Das Oberflächenmodell (`BodyModel`) beantwortet „wo ist die Haut?“ – darauf setzen die Details auf.

import * as THREE from "three";

interface Station {
  x: number;
  zb: number; // Unterkante
  zt: number; // Oberkante Mitte (Haube, Dach, Deckel)
  belt: number; // Gürtellinie / Kotflügeloberkante
  hw: number; // max. halbe Breite als Anteil von Breite/2
  hwTop: number; // halbe Breite der Oberfläche (Haube bzw. Dach) als Anteil
}

/** Referenzmaße, auf die sich die Stationen beziehen. */
export const REF = { length: 4488, height: 1369, overhangFront: 790, wheelbase: 2725 };
const STATIONS: Station[] = [
  { x: 790, zb: 270, zt: 610, belt: 610, hw: 0.78, hwTop: 0.56 },
  { x: 760, zb: 215, zt: 680, belt: 680, hw: 0.9, hwTop: 0.66 },
  { x: 640, zb: 175, zt: 745, belt: 760, hw: 0.97, hwTop: 0.74 },
  { x: 330, zb: 175, zt: 800, belt: 820, hw: 0.995, hwTop: 0.78 },
  { x: 0, zb: 180, zt: 830, belt: 850, hw: 1.0, hwTop: 0.79 },
  { x: -420, zb: 180, zt: 895, belt: 885, hw: 1.0, hwTop: 0.8 },
  { x: -640, zb: 180, zt: 985, belt: 895, hw: 1.0, hwTop: 0.77 },
  { x: -1000, zb: 180, zt: 1235, belt: 905, hw: 1.0, hwTop: 0.7 },
  { x: -1320, zb: 180, zt: 1358, belt: 912, hw: 1.0, hwTop: 0.655 },
  { x: -1750, zb: 180, zt: 1369, belt: 920, hw: 1.0, hwTop: 0.65 },
  { x: -2150, zb: 180, zt: 1338, belt: 930, hw: 1.0, hwTop: 0.65 },
  { x: -2520, zb: 185, zt: 1190, belt: 945, hw: 1.0, hwTop: 0.68 },
  { x: -2880, zb: 200, zt: 1005, belt: 960, hw: 0.995, hwTop: 0.74 },
  { x: -3320, zb: 220, zt: 1000, belt: 965, hw: 0.985, hwTop: 0.76 },
  { x: -3600, zb: 270, zt: 975, belt: 960, hw: 0.95, hwTop: 0.72 },
  { x: -3698, zb: 340, zt: 905, belt: 905, hw: 0.84, hwTop: 0.62 },
];

const isGlass = (s: Station) => s.zt > s.belt + 40;

/** Halber Querschnitt (y ≥ 0) als Kontrollpunkte von unten Mitte bis oben Mitte. */
function halfSection(s: Station, halfWidth: number): THREE.Vector2[] {
  const hw = s.hw * halfWidth;
  const top = s.hwTop * halfWidth;
  const belt = Math.min(s.belt, s.zt - 8);
  const glass = isGlass(s);
  return [
    new THREE.Vector2(0, s.zb),
    new THREE.Vector2(hw - 70, s.zb),
    new THREE.Vector2(hw, s.zb + 0.42 * (belt - s.zb)),
    new THREE.Vector2(hw - 18, belt),
    glass ? new THREE.Vector2(hw - 85, belt + 30) : new THREE.Vector2((hw + top) / 2, (belt + s.zt) / 2 + 4),
    new THREE.Vector2(top, s.zt - (glass ? 45 : 12)),
    new THREE.Vector2(0, s.zt),
  ];
}

/** Catmull-Rom durch Kontrollpunkte, `seg` Punkte je Abschnitt. Kontrollpunkt k liegt auf Index k·seg. */
function spline2(pts: THREE.Vector2[], seg: number): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(new THREE.Vector2(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y)));
    }
  }
  out.push(pts[pts.length - 1]!.clone());
  return out;
}

/** Stationen entlang x mit Catmull-Rom verdichten. */
function densify(st: Station[], perSeg: number): Station[] {
  const keys: (keyof Station)[] = ["x", "zb", "zt", "belt", "hw", "hwTop"];
  const out: Station[] = [];
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[Math.max(0, i - 1)]!;
    const b = st[i]!;
    const c = st[i + 1]!;
    const d = st[Math.min(st.length - 1, i + 2)]!;
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg;
      const s = {} as Station;
      for (const key of keys) {
        const [p0, p1, p2, p3] = [a[key], b[key], c[key], d[key]];
        s[key] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
      }
      out.push(s);
    }
  }
  out.push({ ...st[st.length - 1]! });
  return out;
}

export interface BodyDims {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  overhangFront: number;
}

const SEG = 4; // Punkte je Querschnittsabschnitt
/** Index des Kontrollpunkts k in der Halbsektion. */
export const ctrl = (k: number) => k * SEG;

/** Oberflächenmodell: Stationen mit fertig abgetasteter Halbsektion (y ≥ 0). */
export class BodyModel {
  readonly stations: Station[];
  readonly halves: THREE.Vector2[][];
  readonly halfW: number;
  private readonly sx: number;
  private readonly sxF: number;
  readonly sz: number;

  constructor(readonly dims: BodyDims) {
    this.halfW = dims.width / 2;
    this.sx = (dims.length - dims.overhangFront - dims.wheelbase) / (REF.length - REF.overhangFront - REF.wheelbase);
    this.sxF = dims.overhangFront / REF.overhangFront;
    this.sz = dims.height / REF.height;
    this.stations = densify(STATIONS, 5).map((s) => ({
      ...s,
      x: this.mapX(s.x),
      zb: s.zb * this.sz,
      zt: s.zt * this.sz,
      belt: s.belt * this.sz,
    }));
    const raw = this.stations.map((s) => spline2(halfSection(s, this.halfW), SEG));
    // Catmull-Rom schießt an der breitesten Stelle über → Querrichtung auf die echte Breite skalieren
    const maxY = Math.max(...raw.flat().map((p) => p.x));
    const ky = this.halfW / maxY;
    this.halves = raw.map((h) => h.map((p) => new THREE.Vector2(p.x * ky, p.y)));
  }

  /** x aus Referenzkoordinaten (Überhang vorn, Radstand, Überhang hinten getrennt skaliert). */
  mapX(x: number): number {
    const wb = this.dims.wheelbase;
    if (x >= 0) return x * this.sxF;
    if (x >= -REF.wheelbase) return (x / REF.wheelbase) * wb;
    return -wb + (x + REF.wheelbase) * this.sx;
  }
  mapZ(z: number): number {
    return z * this.sz;
  }
  isGlass(i: number): boolean {
    return isGlass(this.stations[i]!);
  }

  /** Halbsektion an beliebiger Stelle x (lineare Interpolation zwischen Stationen). */
  halfAt(x: number): THREE.Vector2[] {
    const st = this.stations;
    if (x >= st[0]!.x) return this.halves[0]!;
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i]!.x;
      const b = st[i + 1]!.x;
      if (x <= a && x >= b) {
        const t = (a - x) / (a - b || 1);
        const h0 = this.halves[i]!;
        const h1 = this.halves[i + 1]!;
        return h0.map((p, j) => p.clone().lerp(h1[j]!, t));
      }
    }
    return this.halves[this.halves.length - 1]!;
  }

  /** Äußerste Lage der Haut (y ≥ 0) in Höhe z an Stelle x. */
  sideY(x: number, z: number): number {
    const h = this.halfAt(x);
    let best = 0;
    for (let i = 0; i < h.length - 1; i++) {
      const p = h[i]!;
      const q = h[i + 1]!;
      if ((z - p.y) * (z - q.y) <= 0 && p.y !== q.y) {
        const t = (z - p.y) / (q.y - p.y);
        best = Math.max(best, p.x + (q.x - p.x) * t);
      }
    }
    return best;
  }

  /** Höchste Lage der Haut bei Querlage y an Stelle x (Oberseite). */
  topZ(x: number, y: number): number {
    const h = this.halfAt(x);
    const ay = Math.abs(y);
    let best = -Infinity;
    for (let i = ctrl(3); i < h.length - 1; i++) {
      const p = h[i]!;
      const q = h[i + 1]!;
      if ((ay - p.x) * (ay - q.x) <= 0 && p.x !== q.x) {
        const t = (ay - p.x) / (q.x - p.x);
        best = Math.max(best, p.y + (q.y - p.y) * t);
      }
    }
    return Number.isFinite(best) ? best : h[h.length - 1]!.y;
  }

  private inside(i: number, y: number, z: number): boolean {
    // Punkt im geschlossenen Halbquerschnitt (Polygon inkl. Mittelachse)
    const h = this.halves[i]!;
    const ay = Math.abs(y);
    let c = false;
    for (let a = 0, b = h.length - 1; a < h.length; b = a++) {
      const p = h[a]!;
      const q = h[b]!;
      if (p.y > z !== q.y > z && ay < ((q.x - p.x) * (z - p.y)) / (q.y - p.y) + p.x) c = !c;
    }
    return c;
  }

  /** Lage der Haut in Längsrichtung für Punkte an Front (von vorn gesucht) oder Heck. */
  surfaceX(y: number, z: number, from: "front" | "rear"): number | null {
    const n = this.stations.length;
    const order = from === "front" ? [...Array(n).keys()] : [...Array(n).keys()].reverse();
    for (const i of order) if (this.inside(i, y, z)) return this.stations[i]!.x;
    return null;
  }
}

export interface BodyMesh {
  geometry: THREE.BufferGeometry;
  /** Kantenlinien (Schweller, Sicke, Dachmitte). */
  lines: THREE.Vector3[][];
  model: BodyModel;
}

export function buildE46Body(dims: BodyDims, colors: { paint: THREE.Color }): BodyMesh {
  const model = new BodyModel(dims);
  const rings: THREE.Vector3[][] = model.halves.map((half, i) => {
    const x = model.stations[i]!.x;
    // Ring: rechte Seite (−y) von oben nach unten, dann linke Seite von unten nach oben
    const right = half
      .slice(1)
      .reverse()
      .map((p) => new THREE.Vector3(x, -p.x, p.y));
    const left = half.map((p) => new THREE.Vector3(x, p.x, p.y));
    return [...right, ...left];
  });

  const n = rings[0]!.length;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const r of rings)
    for (const p of r) {
      pos.push(p.x, p.y, p.z);
      col.push(colors.paint.r, colors.paint.g, colors.paint.b);
    }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      const b = (i + 1) * n + j;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  // Stirn- und Heckfläche als Fächer um den Mittelpunkt
  for (const [ri, flip] of [
    [0, false],
    [rings.length - 1, true],
  ] as const) {
    const r = rings[ri]!;
    const c = r.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / r.length);
    const ci = pos.length / 3;
    pos.push(c.x, c.y, c.z);
    col.push(colors.paint.r, colors.paint.g, colors.paint.b);
    for (let j = 0; j < n - 1; j++) {
      const a = ri * n + j;
      if (flip) idx.push(ci, a, a + 1);
      else idx.push(ci, a + 1, a);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();

  const halfLen = ctrl(6) + 1;
  const leftIndex = (k: number) => halfLen - 1 + ctrl(k);
  const rightIndex = (k: number) => halfLen - 1 - ctrl(k);
  const lines: THREE.Vector3[][] = [];
  for (const k of [2, 3]) {
    lines.push(rings.map((r) => r[leftIndex(k)]!));
    lines.push(rings.map((r) => r[rightIndex(k)]!));
  }
  lines.push(rings.map((r) => r[leftIndex(6)]!)); // Dachmitte
  return { geometry, lines, model };
}

/**
 * Material mit ausgeschnittenen Radläufen: Fragmente innerhalb des Radlaufkreises
 * (um die Radmitte in Serienlage) werden im äußeren Bereich verworfen.
 */
export function archCutMaterial(params: {
  opacity: number;
  arches: { x: number; z: number; r: number }[];
  innerY: number;
}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: params.opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.25,
    metalness: 0.2,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uArch = { value: params.arches.map((a) => new THREE.Vector3(a.x, a.z, a.r)) };
    shader.uniforms.uInnerY = { value: params.innerY };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBody;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBody = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBody;\nuniform vec3 uArch[2];\nuniform float uInnerY;")
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        if (abs(vBody.y) > uInnerY) {
          for (int i = 0; i < 2; i++) {
            vec2 d = vec2(vBody.x - uArch[i].x, vBody.z - uArch[i].y);
            if (dot(d, d) < uArch[i].z * uArch[i].z) discard;
          }
        }`,
      );
  };
  return m;
}
