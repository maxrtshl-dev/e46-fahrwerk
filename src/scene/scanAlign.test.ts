import * as THREE from "three";
import { alignMatrix, autoFit, autoYaw, defaultAlign, scaleToLength } from "./scanAlign";

/** Quader 4,488 × 1,757 × 1,369 m, Y oben, Länge entlang Scan-Z, um 30° verdreht, irgendwo im Raum. */
function fakeScan(yawDeg: number) {
  const pts: THREE.Vector3[] = [];
  const r = THREE.MathUtils.degToRad(yawDeg);
  for (let i = 0; i < 2000; i++) {
    const L = (Math.random() - 0.5) * 4.488;
    const W = (Math.random() - 0.5) * 1.757;
    const H = Math.random() * 1.369;
    // Scan: Y oben; Länge in der Bodenebene unter Winkel r
    pts.push(new THREE.Vector3(L * Math.cos(r) - W * Math.sin(r) + 3, H + 0.2, L * Math.sin(r) + W * Math.cos(r) - 7));
  }
  return pts;
}

describe("Scan ausrichten", () => {
  it("Y-oben → Z-oben, Meter → mm", () => {
    const p = new THREE.Vector3(0, 1, 0).applyMatrix4(alignMatrix(defaultAlign));
    expect(p.z).toBeCloseTo(1000, 6);
    expect(Math.abs(p.x) + Math.abs(p.y)).toBeCloseTo(0, 6);
  });

  it("Längsachse wird gefunden, Scan steht danach längs auf x, mittig und auf der Fahrbahn", () => {
    const pts = fakeScan(30);
    const yaw = autoYaw(pts, defaultAlign);
    const a = { ...defaultAlign, yawDeg: yaw };
    const fit = autoFit(pts, a, 2725, 790, 12);
    expect(fit.length).toBeGreaterThan(4400);
    expect(fit.length).toBeLessThan(4600);
    const m = alignMatrix({ ...a, ...fit });
    const box = new THREE.Box3().setFromPoints(pts.map((q) => q.clone().applyMatrix4(m)));
    expect(box.max.x).toBeCloseTo(790, 0);
    expect((box.min.y + box.max.y) / 2).toBeCloseTo(0, 0);
    expect(box.min.z).toBeCloseTo(12, 0);
    expect(box.max.y - box.min.y).toBeLessThan(1900);
  });

  it("Maßstab auf Fahrzeuglänge, falls der Scan nicht maßhaltig ist", () => {
    const pts = fakeScan(0).map((q) => q.multiplyScalar(0.9));
    const a = { ...defaultAlign, yawDeg: autoYaw(pts, defaultAlign) };
    const s = scaleToLength(pts, a, 4488);
    expect(s).toBeGreaterThan(1.08);
    expect(s).toBeLessThan(1.14);
  });
});
