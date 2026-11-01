import { req } from "./data";
import { frontGeometryFromData, solveFront, strutTopShiftForCamber } from "./frontMcPherson";
import { data } from "./testdata";

const g = frontGeometryFromData(data);
const cal = data.calibration;
// SPEC 7.3: Abweichung > 10 mm = Test schlägt fehl
const TOL = 10;

describe("VA McPherson – Kalibrierung", () => {
  const stock = solveFront(g, { travel: 0 });

  it("Serienlage reproduziert die Eingangsgeometrie", () => {
    expect(stock.lowerArmOuter.y).toBeCloseTo(g.lowerArmOuter.y, 3);
    expect(stock.lowerArmOuter.z).toBeCloseTo(g.lowerArmOuter.z, 3);
    expect(stock.wheelCenter.z).toBeCloseTo(g.wheelCenter.z, 3);
    expect(stock.groundZ).toBeCloseTo(0, 3);
    expect(stock.camberBodyDeg).toBeCloseTo(-1 / 3, 6);
  });

  it("Rollzentrum Serie ≈ +91 mm", () => {
    expect(Math.abs(stock.rollCenterHeight! - req(cal.rollCenterFrontStock))).toBeLessThanOrEqual(TOL);
  });

  it("Rollzentrum bei 45 mm tiefer im Band −27…−23 mm (±10)", () => {
    const c = cal.rollCenterFrontCheck;
    const rc = solveFront(g, { travel: c.loweringMm }).rollCenterHeight!;
    expect(rc).toBeGreaterThanOrEqual(c.expectedMin - TOL);
    expect(rc).toBeLessThanOrEqual(c.expectedMax + TOL);
  });

  it("Gradient ≈ 2,6 mm RZ je mm Tieferlegung", () => {
    const a = solveFront(g, { travel: 0 }).rollCenterHeight!;
    const b = solveFront(g, { travel: 30 }).rollCenterHeight!;
    expect((a - b) / 30).toBeGreaterThan(req(cal.rollCenterFrontGradient) - 0.5);
    expect((a - b) / 30).toBeLessThan(req(cal.rollCenterFrontGradient) + 0.5);
  });
});

describe("VA McPherson – Verhalten", () => {
  it("Tieferlegen: Sturz wird negativer, Querlenker kippt nach außen-oben", () => {
    const s = solveFront(g, { travel: 0 });
    const k = solveFront(g, { travel: 63 }); // 385 → 322
    expect(k.camberBodyDeg).toBeLessThan(s.camberBodyDeg);
    expect(k.lowerArmAngleDeg).toBeGreaterThan(s.lowerArmAngleDeg);
    expect(k.wheelCenter.z - s.wheelCenter.z).toBeCloseTo(63, 3);
    expect(k.rollCenterHeight!).toBeLessThan(s.rollCenterHeight!);
  });

  it("Rollzentrum fällt monoton mit dem Radhub", () => {
    let prev = Infinity;
    for (let tr = -40; tr <= 100; tr += 10) {
      const rc = solveFront(g, { travel: tr }).rollCenterHeight!;
      expect(rc).toBeLessThan(prev);
      prev = rc;
    }
  });

  it("Domversatz nach innen = negativer Sturz in Größe des Versatzwinkels", () => {
    const max = req(data.frontHardpoints.maxCamberOffsetAtTop);
    const shift = strutTopShiftForCamber(g, max);
    const a = solveFront(g, { travel: 0 });
    const b = solveFront(g, { travel: 0, strutTopShiftInward: shift });
    expect(b.camberBodyDeg - a.camberBodyDeg).toBeCloseTo(-max, 1);
  });

  it("größerer Reifen hebt das Rollzentrum über Fahrbahn an (Karosserie fest)", () => {
    const a = solveFront(g, { travel: 0, staticRadius: 305 });
    const b = solveFront(g, { travel: 0, staticRadius: 315 });
    expect(b.rollCenterHeight!).toBeGreaterThan(a.rollCenterHeight!);
  });

  it("Spuränderung wird nicht erfunden", () => {
    expect(solveFront(g, { travel: 40 }).toeChangeDeg).toBeNull();
  });

  it("außerhalb des Modellbereichs: klarer Fehler", () => {
    expect(() => solveFront(g, { travel: 5000 })).toThrow();
  });
});
