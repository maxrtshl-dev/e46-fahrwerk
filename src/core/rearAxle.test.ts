import { req } from "./data";
import { rearGeometryFromData, solveRear, solveRearBand } from "./rearAxle";
import { data } from "./testdata";

const g = rearGeometryFromData(data);
const cal = data.calibration;

describe("HA-Ersatzmodell – Kalibrierung auf die Annahmebänder", () => {
  const s = solveRear(g, 0);
  it("Serie: Sturz −1°30′, RZ ≈ 110 mm (±10)", () => {
    expect(s.camberBodyDeg).toBeCloseTo(-1.5, 6);
    expect(Math.abs(s.rollCenterHeight! - req(cal.rollCenterRearStock))).toBeLessThanOrEqual(10);
  });
  it("Sturzzunahme im Band", () => {
    const gain = (s.camberBodyDeg - solveRear(g, 40).camberBodyDeg) / 40;
    expect(gain).toBeGreaterThanOrEqual(req(cal.camberGainRearMin));
    expect(gain).toBeLessThanOrEqual(req(cal.camberGainRearMax));
  });
  it("RZ-Gradient im Band", () => {
    const grad = (s.rollCenterHeight! - solveRear(g, 40).rollCenterHeight!) / 40;
    expect(grad).toBeGreaterThanOrEqual(req(cal.rollCenterRearGradientMin));
    expect(grad).toBeLessThanOrEqual(req(cal.rollCenterRearGradientMax));
  });
  it("Modell liegt im Band des Bandmodells", () => {
    for (const t of [20, 45, 60]) {
      const m = solveRear(g, t);
      const b = solveRearBand(data, t);
      expect(m.camberBodyDeg).toBeGreaterThanOrEqual(b.camberDeg.min - 0.05);
      expect(m.camberBodyDeg).toBeLessThanOrEqual(b.camberDeg.max + 0.05);
      expect(m.rollCenterHeight!).toBeGreaterThanOrEqual(b.rollCenterHeight.min - 5);
      expect(m.rollCenterHeight!).toBeLessThanOrEqual(b.rollCenterHeight.max + 5);
    }
  });
  it("Exzenter verschiebt den Sturz 1:1", () => {
    expect(solveRear(g, 30, { camberOffsetDeg: 0.5 }).camberBodyDeg - solveRear(g, 30).camberBodyDeg).toBeCloseTo(0.5, 9);
  });
  it("Modellbereich deckt −80…+110 mm Hub ab", () => {
    expect(() => solveRear(g, -80)).not.toThrow();
    expect(() => solveRear(g, 110)).not.toThrow();
    expect(() => solveRear(g, 2000)).toThrow();
  });
});
