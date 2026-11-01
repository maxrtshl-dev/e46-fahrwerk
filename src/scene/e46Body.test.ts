import * as THREE from "three";
import { buildE46Body } from "./e46Body";
import { styling68Star } from "./styling68";

const dims = { length: 4488, width: 1757, height: 1369, wheelbase: 2725, overhangFront: 790 };

describe("Karosserie E46 Coupé (Darstellung)", () => {
  const body = buildE46Body(dims, { paint: new THREE.Color("#888"), glass: new THREE.Color("#222") });
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
  it("Kantenlinien vorhanden, Fensterlinie nur über Glas", () => {
    expect(body.lines.length).toBe(7);
    const window = body.lines[4]!;
    expect(Math.min(...window.map((p) => p.z))).toBeGreaterThan(850);
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
