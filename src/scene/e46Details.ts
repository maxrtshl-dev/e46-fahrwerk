// Details E46 Coupé (Scheiben, Fugen, Leuchten, Nieren, Spiegel, Endrohre) – nur Darstellung.
// Formen in Referenzkoordinaten (x, z wie in e46Body.STATIONS; y in mm bei halber Breite 878,5),
// projiziert auf die Haut des Oberflächenmodells.

import * as THREE from "three";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import type { BodyModel } from "./e46Body";

export type DetailKind = "glass" | "black" | "chrome" | "lens" | "red" | "paint" | "white" | "smoke";

export interface DetailMesh {
  geometry: THREE.BufferGeometry;
  kind: DetailKind;
}
export interface DetailLine {
  points: THREE.Vector3[];
  kind: "seam" | "chrome" | "ring" | "trim";
}
export interface Details {
  meshes: DetailMesh[];
  lines: DetailLine[];
}

const REF_HALF = 878.5;
type P = [number, number];

/** Abstand über der Haut, damit nichts in der Karosserie verschwindet. */
const LIFT = 3;

function tessellated(points: P[]): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ShapeGeometry(shape, 8);
  return new TessellateModifier(45, 8).modify(g);
}

/** Abgerundetes Rechteck als Punktliste. */
function roundRect(cx: number, cy: number, w: number, h: number, r: number, n = 5): P[] {
  const pts: P[] = [];
  const corners: [number, number, number][] = [
    [cx + w / 2 - r, cy + h / 2 - r, 0],
    [cx - w / 2 + r, cy + h / 2 - r, Math.PI / 2],
    [cx - w / 2 + r, cy - h / 2 + r, Math.PI],
    [cx + w / 2 - r, cy - h / 2 + r, (3 * Math.PI) / 2],
  ];
  for (const [x, y, a0] of corners)
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    }
  return pts;
}

function circle(cx: number, cy: number, r: number, n = 32): P[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as P;
  });
}

export function buildE46Details(m: BodyModel): Details {
  const X = (x: number) => m.mapX(x);
  const Z = (z: number) => m.mapZ(z);
  const Y = (y: number) => (y / REF_HALF) * m.halfW;
  const meshes: DetailMesh[] = [];
  const lines: DetailLine[] = [];

  // ---- Seitenansicht (x, z) → y auf der Haut, beide Seiten
  const side = (poly: P[], kind: DetailKind, lift = LIFT, sides: number[] = [1, -1]) => {
    for (const s of sides) {
      const g = tessellated(poly.map(([x, z]) => [X(x), Z(z)]));
      const pos = g.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getY(i);
        pos.setXYZ(i, x, s * (m.sideY(x, z) + lift), z);
      }
      g.computeVertexNormals();
      meshes.push({ geometry: g, kind });
    }
  };
  const sideLine = (pts: P[], kind: DetailLine["kind"] = "seam", n = 12, sides: number[] = [1, -1]) => {
    const dense = densifyLine(pts, n);
    for (const s of sides)
      lines.push({ kind, points: dense.map(([x, z]) => new THREE.Vector3(X(x), s * (m.sideY(X(x), Z(z)) + LIFT), Z(z))) });
  };

  // Seitenscheibe mit Hofmeister-Knick, schwarzer Rahmen
  const dlo: P[] = [
    [-690, 912],
    [-760, 960],
    [-1050, 1190],
    [-1290, 1305],
    [-1420, 1328],
    [-1800, 1334],
    [-2060, 1315],
    [-2260, 1230],
    [-2410, 1090],
    [-2445, 1020],
    [-2410, 978],
    [-2330, 960],
    [-1600, 942],
    [-700, 916],
  ];
  side(dlo, "glass");
  sideLine([...dlo, dlo[0]!], "trim", 6);
  // Steg zwischen Tür- und Seitenscheibe
  side(
    [
      [-1950, 945],
      [-1985, 945],
      [-2017, 1325],
      [-1982, 1328],
    ],
    "black",
    LIFT + 1,
  );
  // Türfugen
  sideLine([
    [-690, 905],
    [-610, 860],
    [-560, 600],
    [-575, 300],
  ]);
  sideLine([
    [-1990, 935],
    [-1985, 600],
    [-1950, 300],
  ]);
  // Sicke über Kotflügel, Tür und Seitenwand – an den Radläufen unterbrochen
  sideLine([
    [600, 575],
    [300, 568],
  ]);
  sideLine([
    [-300, 570],
    [-1200, 575],
    [-2480, 590],
  ]);
  sideLine([
    [-2960, 595],
    [-3480, 610],
  ]);
  // M-Schweller: Oberkante und Kante unten
  sideLine([
    [-420, 300],
    [-2380, 305],
  ]);
  sideLine([
    [-420, 235],
    [-2380, 240],
  ]);
  // Türgriff
  side(roundRect(-1770, 832, 150, 26, 10), "chrome", LIFT + 2);
  // Seitenblinker (dunkel) im Kotflügel hinter dem Vorderrad
  side(roundRect(-460, 600, 75, 24, 11), "smoke", LIFT + 1);
  // Tankklappe rechts hinten
  sideLine([...roundRect(-3070, 850, 150, 120, 38), roundRect(-3070, 850, 150, 120, 38)[0]!], "seam", 3, [-1]);

  // ---- Oberseite (x, y) → z auf der Haut
  const top = (poly: P[], kind: DetailKind, lift = LIFT) => {
    const g = tessellated(poly.map(([x, y]) => [X(x), Y(y)]));
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setXYZ(i, x, y, m.topZ(x, y) + lift);
    }
    g.computeVertexNormals();
    meshes.push({ geometry: g, kind });
  };
  const topLine = (pts: P[], kind: DetailLine["kind"] = "seam") => {
    const dense = densifyLine(pts, 16);
    lines.push({ kind, points: dense.map(([x, y]) => new THREE.Vector3(X(x), Y(y), m.topZ(X(x), Y(y)) + LIFT)) });
  };
  // Frontscheibe und Heckscheibe
  top(
    [
      [-655, -640],
      [-655, 640],
      [-1290, 530],
      [-1290, -530],
    ],
    "glass",
  );
  top(
    [
      [-2190, -500],
      [-2190, 500],
      [-2840, 590],
      [-2840, -590],
    ],
    "glass",
  );
  // Schiebedach
  const roof: P[] = roundRect(-1690, 0, 600, 740, 60);
  top(roof, "glass", LIFT + 1);
  lines.push({ kind: "trim", points: densifyLine([...roof, roof[0]!], 4).map(([x, y]) => new THREE.Vector3(X(x), Y(y), m.topZ(X(x), Y(y)) + LIFT + 2)) });
  // Scheibenwischer
  topLine([[-690, -520], [-735, 80]], "trim");
  topLine([[-690, 60], [-735, 600]], "trim");
  // Spoilerlippe auf dem Kofferraumdeckel (schwarz)
  top(roundRect(-3625, 0, 45, 1180, 15), "black", LIFT + 4);
  // Haubenfugen (Haube reicht beim E46 bis zur Kotflügeloberkante)
  for (const s of [1, -1])
    topLine([
      [770, s * 560],
      [600, s * 660],
      [0, s * 690],
      [-560, s * 690],
    ]);
  topLine([
    [-560, -690],
    [-560, 690],
  ]);
  // Kofferraumdeckel
  for (const s of [1, -1])
    topLine([
      [-2880, s * 620],
      [-3600, s * 610],
    ]);
  topLine([
    [-2880, -620],
    [-2880, 620],
  ]);

  // ---- Front und Heck (y, z) → x auf der Haut
  const face = (poly: P[], kind: DetailKind, from: "front" | "rear", lift = LIFT) => {
    for (const s of [1, -1]) {
      const g = tessellated(poly.map(([y, z]) => [s * Y(y), Z(z)]));
      const pos = g.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getX(i);
        const z = pos.getY(i);
        const x = m.surfaceX(y, z, from) ?? m.stations[from === "front" ? 0 : m.stations.length - 1]!.x;
        pos.setXYZ(i, x + (from === "front" ? lift : -lift), y, z);
      }
      g.computeVertexNormals();
      meshes.push({ geometry: g, kind });
    }
  };
  const faceLine = (pts: P[], from: "front" | "rear", kind: DetailLine["kind"], closed = true) => {
    for (const s of [1, -1]) {
      const all = closed ? [...pts, pts[0]!] : pts;
      lines.push({
        kind,
        points: all.map(([y, z]) => {
          const yy = s * Y(y);
          const zz = Z(z);
          const x = m.surfaceX(yy, zz, from) ?? 0;
          return new THREE.Vector3(x + (from === "front" ? LIFT + 2 : -LIFT - 2), yy, zz);
        }),
      });
    }
  };

  // Nieren
  const kidney = (cy: number): P[] => [
    [40, cy - 55],
    [175, cy - 50],
    [190, cy - 20],
    [185, cy + 40],
    [165, cy + 62],
    [50, cy + 62],
    [30, cy + 40],
    [28, cy - 25],
  ];
  face(kidney(585), "black", "front");
  faceLine(kidney(585), "front", "chrome");
  // Scheinwerfer mit Doppelringen
  const lamp: P[] = [
    [235, 560],
    [600, 585],
    [690, 625],
    [700, 665],
    [640, 690],
    [270, 680],
    [225, 640],
  ];
  face(lamp, "lens", "front");
  faceLine(lamp, "front", "chrome");
  for (const [cy, r] of [
    [345, 52],
    [520, 50],
  ] as const)
    faceLine(circle(cy, 628, r), "front", "ring");
  // M-Stoßfänger: Kennzeichenfeld, großer Mitteleinlass mit Gitter, Nebel in Taschen
  face(roundRect(0, 470, 520, 110, 8), "white", "front", LIFT + 1);
  const intake: P[] = [
    [-380, 400],
    [380, 400],
    [400, 360],
    [370, 290],
    [-370, 290],
    [-400, 360],
  ];
  face(intake, "black", "front");
  for (let y = 30; y <= 360; y += 55)
    faceLine(
      [
        [y, 300],
        [y, 392],
      ],
      "front",
      "seam",
      false,
    );
  face(roundRect(570, 345, 210, 125, 45), "black", "front");
  face(circle(570, 345, 44), "lens", "front", LIFT + 2);
  faceLine(
    [
      [0, 530],
      [400, 528],
      [700, 515],
    ],
    "front",
    "seam",
    false,
  );

  // Rückleuchten Facelift: rot mit hellem Innenstreifen, Seitenteil und Deckel
  face(
    [
      [430, 800],
      [745, 790],
      [790, 850],
      [760, 900],
      [430, 905],
    ],
    "red",
    "rear",
  );
  face(
    [
      [450, 812],
      [640, 808],
      [640, 836],
      [450, 840],
    ],
    "white",
    "rear",
    LIFT + 1,
  );
  face(
    [
      [235, 832],
      [425, 832],
      [425, 900],
      [235, 900],
    ],
    "red",
    "rear",
  );
  face(
    [
      [300, 838],
      [420, 838],
      [420, 860],
      [300, 860],
    ],
    "white",
    "rear",
    LIFT + 1,
  );
  // Fuge Deckel/Seitenteil, Kennzeichenfeld im Deckel
  faceLine(
    [
      [0, 790],
      [425, 795],
    ],
    "rear",
    "seam",
    false,
  );
  face(roundRect(0, 705, 520, 112, 8), "white", "rear", LIFT + 1);
  faceLine(roundRect(0, 705, 600, 150, 25), "rear", "seam");
  // Stoßfänger: Fuge, Parksensoren, M-Diffusor
  faceLine(
    [
      [0, 615],
      [600, 610],
      [770, 595],
    ],
    "rear",
    "seam",
    false,
  );
  for (const y of [190, 480]) face(circle(y, 520, 13, 12), "black", "rear", LIFT + 1);
  face(roundRect(0, 370, 1150, 95, 30), "black", "rear");

  // ---- Doppelendrohr links (wie am Foto)
  for (const y of [375, 455]) {
    const yy = Y(y);
    const zz = Z(335);
    const x = m.surfaceX(yy, zz + 60, "rear") ?? m.stations[m.stations.length - 1]!.x;
    const g = new THREE.CylinderGeometry(38, 38, 160, 24, 1, true);
    g.rotateZ(Math.PI / 2);
    g.translate(x - 20, yy, zz);
    meshes.push({ geometry: g, kind: "chrome" });
  }

  // ---- Außenspiegel an der A-Säule
  for (const s of [1, -1]) {
    const x = X(-720);
    const z = Z(955);
    const y0 = m.sideY(x, z);
    const housing = new THREE.SphereGeometry(1, 24, 16);
    housing.scale(70, 105, 60);
    housing.translate(x - 10, s * (y0 + 115), z + 20);
    meshes.push({ geometry: housing, kind: "paint" });
    const glass = new THREE.CircleGeometry(1, 24);
    glass.scale(52, 88, 1);
    glass.rotateY(-Math.PI / 2);
    glass.rotateX(Math.PI / 2);
    glass.translate(x - 62, s * (y0 + 115), z + 20);
    meshes.push({ geometry: glass, kind: "glass" });
    const arm = new THREE.BoxGeometry(60, 70, 30);
    arm.translate(x, s * (y0 + 35), z - 10);
    meshes.push({ geometry: arm, kind: "black" });
  }

  return { meshes, lines };
}

/** Polylinie verdichten, damit sie der gewölbten Haut folgt. */
function densifyLine(pts: P[], perSeg: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i]!, pts[i + 1]!];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}
