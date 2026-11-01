// Geometrie-Helfer für die 3D-Szene. Alles in mm, Fahrzeugsystem ISO 8855.
import * as THREE from "three";

/** Darstellungsmaße der Karosserie – nur Optik, keine Fahrzeugdaten. */
export const VIS = {
  overhangFront: 790,
  overhangRear: 860,
  sill: 190,
  belt: 930,
  roof: 1370,
  cabinFrontX: -480, // Fuß A-Säule ab Vorderachse
  roofFrontX: -1150,
  roofRearX: -2150,
  cabinRearX: -2700,
  fenderOverTrack: 125, // halbe Breite über halbe Spurweite
};

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Zylinder zwischen zwei Punkten: Position, Ausrichtung, Länge. */
export function between(a: THREE.Vector3, b: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const position = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return { position, quaternion, length };
}

/** Seitenprofil der Karosserie (x, z) mit Radausschnitten als Kreisbogen um die Radmitte in Serienlage. */
export function bodyProfile(p: {
  wheelbase: number;
  centerZFront: number;
  centerZRear: number;
  archFront: number; // Radius = Serienhöhe VA
  archRear: number;
}): THREE.Shape {
  const { wheelbase, centerZFront, centerZRear, archFront, archRear } = p;
  const xF = VIS.overhangFront;
  const xR = -wheelbase - VIS.overhangRear;
  const s = new THREE.Shape();
  s.moveTo(xF, VIS.sill + 120);
  s.lineTo(xF - 60, VIS.sill);
  const arch = (xc: number, zc: number, r: number) => {
    const dz = VIS.sill - zc;
    const dx = Math.sqrt(Math.max(0, r * r - dz * dz));
    s.lineTo(xc + dx, VIS.sill);
    const a1 = Math.atan2(dz, dx);
    const a2 = Math.PI - a1;
    s.absarc(xc, zc, r, a1, a2, false);
  };
  arch(0, centerZFront, archFront);
  arch(-wheelbase, centerZRear, archRear);
  s.lineTo(xR + 40, VIS.sill);
  s.lineTo(xR, VIS.sill + 160);
  s.lineTo(xR + 30, VIS.belt - 80);
  s.lineTo(xR + 120, VIS.belt);
  s.lineTo(xF - 260, VIS.belt - 140);
  s.lineTo(xF, VIS.sill + 340);
  s.closePath();
  return s;
}

export function cabinProfile(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(VIS.cabinFrontX, VIS.belt - 20);
  s.lineTo(VIS.roofFrontX, VIS.roof);
  s.lineTo(VIS.roofRearX, VIS.roof - 15);
  s.lineTo(VIS.cabinRearX, VIS.belt - 20);
  s.closePath();
  return s;
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
