import * as THREE from "three";
import { buildE46Body } from "./e46Body";
import { styling68Star } from "./styling68";

const dims = { length: 4488, width: 1757, height: 1369, wheelbase: 2725, overhangFront: 790 };

describe("Karosserie E46 Coupé (Darstellung)", () => {
  const body = buildE46Body(dims, { paint: new THREE.Color("#888") });
  body.geometry.computeBoundingBox();
  const bb = body.geometry.boundingBox!;
  it("Außenmaße aus den Daten", () => {
    expect(bb.max.x - bb.min.x).toBeCloseTo(dims.length, 0);
    expect(bb.max.x).toBeCloseTo(dims.overhangFront, 0);
    expect(bb.max.y - bb.min.y).toBeLessThanOrEqual(dims.width + 1);
    expect(bb.max.y - bb.min.y).toBeGreaterThan(dims.width - 20);
    expect(bb.max.z).toBeLessThanOrEqual(dims.height + 8);
    expect(bb.max.z).toBeGreaterThan(dims.height - 15);
  });
  it("Oberflächenmodell: Haut seitlich, oben, vorn, hinten", () => {
    const m = body.model;
    expect(m.sideY(-1500, 600)).toBeGreaterThan(dims.width / 2 - 25);
    expect(m.sideY(-1500, 600)).toBeLessThanOrEqual(dims.width / 2 + 0.5);
    expect(m.topZ(-1750, 0)).toBeGreaterThan(dims.height - 15);
    const xf = m.surfaceX(0, 500, "front")!;
    expect(xf).toBeGreaterThan(700);
    const xr = m.surfaceX(0, 600, "rear")!;
    expect(xr).toBeLessThan(-3600);
  });
});

import { buildE46Details } from "./e46Details";

describe("Details E46 (Darstellung)", () => {
  const body = buildE46Body(dims, { paint: new THREE.Color("#888") });
  const det = buildE46Details(body.model);
  it("Seitenscheiben liegen auf der Haut, beidseitig", () => {
    const glass = det.meshes.filter((d) => d.kind === "glass");
    expect(glass.length).toBeGreaterThanOrEqual(4);
    const g = glass[0]!.geometry;
    g.computeBoundingBox();
    expect(g.boundingBox!.min.z).toBeGreaterThan(850);
    expect(g.boundingBox!.max.y).toBeLessThan(dims.width / 2 + 10);
  });
  it("Front- und Heckteile vorhanden", () => {
    expect(det.meshes.some((d) => d.kind === "red")).toBe(true);
    expect(det.lines.filter((l) => l.kind === "ring").length).toBe(4);
  });
});

describe("Felge Styling 68 (Darstellung)", () => {
  it("Stern liegt zwischen Radanlagefläche und Felgenhorn", () => {
    const g = styling68Star({ rimR: 215.9, hubFace: 41, lip: 95.25 });
    g.computeBoundingBox();
    const bb = g.computeBoundingBox() ?? g.boundingBox!;
    expect(g.boundingBox!.min.y).toBeGreaterThan(41 - 25);
    expect(g.boundingBox!.max.y).toBeLessThan(95.25 + 5);
    expect(g.boundingBox!.max.x).toBeLessThan(215.9);
    void bb;
  });
});
