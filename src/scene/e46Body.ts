// Karosserie E46 Coupé als Loft aus Querschnitten – nur Darstellung, keine Rechengrundlage.
// Koordinaten: Karosseriesystem in mm (x vorn ab Vorderachse, y links, z oben ab Fahrbahn in Serienlage).
// Die Stationen sind Proportionen eines E46 Coupés, skaliert auf Länge/Breite/Höhe aus den Daten.

import * as THREE from "three";

interface Station {
  x: number; // relativ: 0 = Vorderachse, Längen in mm bezogen auf 4488/2725
  zb: number; // Unterkante
  zt: number; // Oberkante Mitte (Haube, Dach, Deckel)
  belt: number; // Gürtellinie / Kotflügeloberkante
  hw: number; // max. halbe Breite als Anteil von Breite/2
  hwTop: number; // halbe Breite der Oberfläche (Haube bzw. Dach) als Anteil
}

// Stationen von vorn nach hinten. x in mm für Referenzlänge 4488, Radstand 2725, Überhang vorn 790.
const REF = { length: 4488, height: 1369, overhangFront: 790 };
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
        s[key] =
          0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
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

export interface BodyMesh {
  geometry: THREE.BufferGeometry;
  /** Kantenlinien (Gürtellinie, Fensterlinie, Schweller, Dachmitte) je Seite. */
  lines: THREE.Vector3[][];
}

const SEG = 4; // Punkte je Querschnittsabschnitt

export function buildE46Body(dims: BodyDims, colors: { paint: THREE.Color; glass: THREE.Color }): BodyMesh {
  const halfW = dims.width / 2;
  const sx = (dims.length - dims.overhangFront - dims.wheelbase) / (REF.length - REF.overhangFront - 2725);
  const sxF = dims.overhangFront / REF.overhangFront;
  const sz = dims.height / REF.height;
  // x-Skalierung getrennt: Überhang vorn, Radstand, Überhang hinten
  const mapX = (x: number) => {
    if (x >= 0) return x * sxF;
    if (x >= -2725) return (x / 2725) * dims.wheelbase;
    return -dims.wheelbase + (x + 2725) * sx;
  };
  const stations = densify(STATIONS, 5).map((s) => ({
    ...s,
    x: mapX(s.x),
    zb: s.zb * sz,
    zt: s.zt * sz,
    belt: s.belt * sz,
  }));

  const rings: THREE.Vector3[][] = [];
  const glassRing: boolean[] = [];
  const ringColors: THREE.Color[][] = [];
  for (const s of stations) {
    const half = spline2(halfSection(s, halfW), SEG);
    const glass = isGlass(s);
    const beltZ = Math.min(s.belt, s.zt - 8);
    // Ring: rechte Seite (−y) von oben nach unten, dann linke Seite von unten nach oben
    const right = half
      .slice(1)
      .reverse()
      .map((p) => new THREE.Vector3(s.x, -p.x, p.y));
    const left = half.map((p) => new THREE.Vector3(s.x, p.x, p.y));
    const ring = [...right, ...left];
    rings.push(ring);
    glassRing.push(glass);
    ringColors.push(ring.map((p) => (glass && p.z > beltZ + 22 ? colors.glass : colors.paint)));
  }

  // Catmull-Rom schießt an der breitesten Stelle über → Querrichtung auf die echte Breite skalieren
  const maxY = Math.max(...rings.flat().map((p) => Math.abs(p.y)));
  const ky = halfW / maxY;
  for (const p of rings.flat()) p.y *= ky;

  const n = rings[0]!.length;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  rings.forEach((r, i) =>
    r.forEach((p, j) => {
      pos.push(p.x, p.y, p.z);
      const c = ringColors[i]![j]!;
      col.push(c.r, c.g, c.b);
    }),
  );
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

  // Kantenlinien: Kontrollpunkt k der Halbsektion liegt auf Index k·SEG
  const halfLen = 6 * SEG + 1;
  const leftIndex = (k: number) => halfLen - 1 + k * SEG; // linke Hälfte beginnt bei halfLen−1 (Mitte unten)
  const rightIndex = (k: number) => halfLen - 1 - k * SEG;
  const lines: THREE.Vector3[][] = [];
  for (const k of [2, 3]) {
    lines.push(rings.map((r) => r[leftIndex(k)]!));
    lines.push(rings.map((r) => r[rightIndex(k)]!));
  }
  // Fensterlinie nur über die Glasfläche
  const glassRings = rings.filter((_, i) => glassRing[i]);
  if (glassRings.length > 1) {
    lines.push(glassRings.map((r) => r[leftIndex(5)]!));
    lines.push(glassRings.map((r) => r[rightIndex(5)]!));
  }
  lines.push(rings.map((r) => r[leftIndex(6)]!)); // Dachmitte
  return { geometry, lines };
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
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vBody;\nuniform vec3 uArch[2];\nuniform float uInnerY;",
      )
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
