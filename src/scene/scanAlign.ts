// Ausrichtung eines eigenen 3D-Scans (GLB) im Karosseriesystem.
// Scan-Apps liefern Meter, „oben“ = +Y, Drehung beliebig. Die App rechnet in mm,
// ISO 8855 (x vorn, y links, z oben), Ursprung Vorderachse / Fahrbahn in Serienlage.
//
//   M = T(dx, dy, dz) · Rz(yaw) · S(1000 · scale) · U      (U: Y-oben → Z-oben)

import * as THREE from "three";

export interface ScanAlign {
  upAxis: "y" | "z";
  yawDeg: number;
  scale: number; // Korrekturfaktor auf Meter → mm (1 = Scan maßhaltig, z. B. LiDAR)
  dx: number;
  dy: number;
  dz: number;
  opacity: number;
  hideWheels: boolean; // gescannte Räder ausblenden, berechnete zeigen
  hideBody: boolean; // Nachbau ausblenden
  visible: boolean;
}

export const defaultAlign: ScanAlign = {
  upAxis: "y",
  yawDeg: 0,
  scale: 1,
  dx: 0,
  dy: 0,
  dz: 0,
  opacity: 0.85,
  hideWheels: true,
  hideBody: true,
  visible: true,
};

/** Drehung + Maßstab ohne Verschiebung. */
export function baseMatrix(a: ScanAlign): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(a.yawDeg));
  m.multiply(new THREE.Matrix4().makeScale(1000 * a.scale, 1000 * a.scale, 1000 * a.scale));
  if (a.upAxis === "y") m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  return m;
}

export function alignMatrix(a: ScanAlign): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(a.dx, a.dy, a.dz).multiply(baseMatrix(a));
}

/** Punkte des Scans (Stichprobe) in Scan-Koordinaten. */
export function samplePoints(obj: THREE.Object3D, max = 20000): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  obj.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const total = meshes.reduce((n, m) => n + (m.geometry.getAttribute("position")?.count ?? 0), 0);
  const step = Math.max(1, Math.floor(total / max));
  const v = new THREE.Vector3();
  for (const m of meshes) {
    const pos = m.geometry.getAttribute("position");
    if (!pos) continue;
    for (let i = 0; i < pos.count; i += step) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
  }
  return pts;
}

/**
 * Längsachse per Hauptachsenanalyse in der Draufsicht → Gierwinkel, damit die Fahrzeuglänge
 * auf x liegt. Vorne/hinten bleibt offen (180° per Knopf).
 */
export function autoYaw(points: THREE.Vector3[], a: ScanAlign): number {
  const m = baseMatrix({ ...a, yawDeg: 0 });
  const p = points.map((q) => q.clone().applyMatrix4(m));
  const n = p.length || 1;
  const mx = p.reduce((s, q) => s + q.x, 0) / n;
  const my = p.reduce((s, q) => s + q.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const q of p) {
    sxx += (q.x - mx) ** 2;
    syy += (q.y - my) ** 2;
    sxy += (q.x - mx) * (q.y - my);
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy); // Richtung der größten Streuung
  return -THREE.MathUtils.radToDeg(angle);
}

/** Begrenzungsbox nach Drehung und Maßstab (ohne Verschiebung). */
export function alignedBox(points: THREE.Vector3[], a: ScanAlign): THREE.Box3 {
  const m = baseMatrix(a);
  return new THREE.Box3().setFromPoints(points.map((q) => q.clone().applyMatrix4(m)));
}

/**
 * Verschiebung so, dass der Scan mittig zwischen den Achsen und auf der Fahrbahn steht.
 * groundZ = Fahrbahn im Karosseriesystem bei der eingestellten Höhe.
 */
export function autoFit(points: THREE.Vector3[], a: ScanAlign, wheelbase: number, overhangFront: number, groundZ: number) {
  const b = alignedBox(points, a);
  return {
    dx: overhangFront - b.max.x, // Front des Scans auf die Fahrzeugfront
    dy: -(b.min.y + b.max.y) / 2,
    dz: groundZ - b.min.z,
    length: b.max.x - b.min.x,
    wheelbase,
  };
}

/** Maßstab so, dass die Scanlänge der Fahrzeuglänge entspricht (nur ohne LiDAR nötig). */
export function scaleToLength(points: THREE.Vector3[], a: ScanAlign, length: number): number {
  const b = alignedBox(points, { ...a, scale: 1 });
  const l = b.max.x - b.min.x;
  return l > 0 ? length / l : 1;
}
