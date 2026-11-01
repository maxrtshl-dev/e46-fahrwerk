import { solveFrontAxle } from "./frontAxle";
import { frontGeometryFromData, solveFront } from "./frontMcPherson";
import { data } from "./testdata";

const g = frontGeometryFromData(data);

describe("VA ganze Achse", () => {
  it("ohne Wanken: Rollzentrum mittig, gleich dem Einzelrad-Modell", () => {
    for (const travel of [0, 20, 63]) {
      const a = solveFrontAxle(g, { travel, rollDeg: 0 });
      expect(a.rollCenter!.y).toBeCloseTo(0, 6);
      expect(a.rollCenterHeight!).toBeCloseTo(solveFront(g, { travel }).rollCenterHeight!, 6);
      expect(a.left.camberBodyDeg).toBeCloseTo(a.right.camberBodyDeg, 9);
    }
  });

  it("Spurweitenänderung = doppelte Halbspuränderung", () => {
    const a = solveFrontAxle(g, { travel: 40, rollDeg: 0 });
    expect(a.trackChange).toBeCloseTo(2 * solveFront(g, { travel: 40 }).halfTrackChange, 6);
  });

  it("Wanken: kurvenäußeres Rad federt ein und verliert negativen Sturz zur Fahrbahn", () => {
    const a = solveFrontAxle(g, { travel: 40, rollDeg: 2 });
    expect(a.right.outer).toBe(true);
    expect(a.right.travel).toBeGreaterThan(a.left.travel);
    expect(a.right.camberRoadDeg).toBeGreaterThan(a.right.camberBodyDeg);
    expect(a.left.camberRoadDeg).toBeLessThan(a.left.camberBodyDeg);
    expect(a.rollCenter).not.toBeNull();
    expect(Math.abs(a.rollCenter!.y)).toBeGreaterThan(1); // RZ wandert seitlich aus
  });

  it("Wanken ist spiegelsymmetrisch", () => {
    const p = solveFrontAxle(g, { travel: 40, rollDeg: 2 });
    const n = solveFrontAxle(g, { travel: 40, rollDeg: -2 });
    expect(n.rollCenter!.y).toBeCloseTo(-p.rollCenter!.y, 6);
    expect(n.rollCenterHeight!).toBeCloseTo(p.rollCenterHeight!, 6);
    expect(n.left.camberRoadDeg).toBeCloseTo(p.right.camberRoadDeg, 6);
  });
});
