// Geometrie-Helfer für die 3D-Szene. Alles in mm, Fahrzeugsystem ISO 8855.
import * as THREE from "three";

/** Darstellungsmaße der Karosserie – nur Optik, keine Fahrzeugdaten. */
export const VIS = {
  sill: 190, // Unterkante der Radausschnitte
  lipRadius: 9, // Bördelkante
  linerGap: 30, // Radhausschale liegt so viel weiter außen als die Kante (radial)
  linerDepth: 300, // Tiefe der Radhausschale nach innen
};

/** Radhausschale: Zylinderfläche um die Radmitte, von der Kante nach innen. */
export function archLiner(xc: number, zc: number, r: number, yOuter: number, side: 1 | -1, n = 36): THREE.BufferGeometry {
  const pts = archEdge(xc, zc, r, 0, n);
  const pos: number[] = [];
  const idx: number[] = [];
  const yIn = yOuter - VIS.linerDepth;
  pts.forEach((p) => {
    pos.push(p.x, side * yOuter, p.z, p.x, side * yIn, p.z);
  });
  for (let i = 0; i < n; i++) {
    const a = 2 * i;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Zylinder zwischen zwei Punkten: Position, Ausrichtung, Länge. */
export function between(a: THREE.Vector3, b: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const position = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return { position, quaternion, length };
}

/** Punkte der Radlaufkante (Kreisbogen) auf der Seitenwand y. */
export function archEdge(xc: number, zc: number, r: number, y: number, n = 40): THREE.Vector3[] {
  const dz = VIS.sill - zc;
  const a1 = Math.atan2(dz, Math.sqrt(Math.max(0, r * r - dz * dz)));
  const a2 = Math.PI - a1;
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a1 + ((a2 - a1) * i) / n;
    return v3(xc + r * Math.cos(a), y, zc + r * Math.sin(a));
  });
}

/** Schraubenfeder als Kurve um die lokale Y-Achse. */
export class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(
    private radius: number,
    private height: number,
    private turns: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(this.radius * Math.cos(a), this.height * t, this.radius * Math.sin(a));
  }
}

/**
 * Lage der Karosserie: Matrix vom Karosseriesystem ins Fahrbahnsystem.
 * gF/gR = Fahrbahnhöhe an VA/HA im Karosseriesystem, rollDeg aus der Fahrbahngeraden VA.
 */
export function bodyToRoad(gF: number, gR: number, wheelbase: number, rollRad: number): THREE.Matrix4 {
  const pitch = Math.atan2(gF - gR, wheelbase);
  const m = new THREE.Matrix4();
  m.multiply(new THREE.Matrix4().makeRotationY(pitch));
  m.multiply(new THREE.Matrix4().makeRotationX(-rollRad));
  m.multiply(new THREE.Matrix4().makeTranslation(0, 0, -gF));
  return m;
}
