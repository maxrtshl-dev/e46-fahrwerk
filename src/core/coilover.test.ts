import { applyOverrides, type Val } from "./data";
import { frontSpringRatio, perchFront, perchRear, rearSpringRatio } from "./coilover";
import { frontGeometryFromData } from "./frontMcPherson";
import { rearGeometryFromData } from "./rearAxle";
import { data } from "./testdata";

const gF = frontGeometryFromData(data);
const gR = rearGeometryFromData(data);
const m = (value: number): Val => ({ value, unit: "mm", source: "Messung", confidence: "gemessen" });

describe("Gewinde-Rechner", () => {
  it("VA: Federbein-Übersetzung knapp unter 1 (Federbein geneigt, Radmitte außerhalb)", () => {
    const i = frontSpringRatio(gF, { travel: 49 });
    expect(i).toBeGreaterThan(0.85);
    expect(i).toBeLessThan(1.0);
  });

  it("HA: Feder auf dem Lenker → Übersetzung ≈ Lage auf dem Lenker × Lenkerhub", () => {
    const a = rearSpringRatio(gR, 17, 0.55);
    const b = rearSpringRatio(gR, 17, 0.7);
    expect(a).toBeGreaterThan(0.4);
    expect(b).toBeLessThan(0.85);
    expect(b).toBeGreaterThan(a);
  });

  it("ohne Referenz: nur Empfindlichkeit und Höhenbereich, kein absolutes Maß", () => {
    const r = perchFront(data, gF, { travel: 49 }, 322);
    expect(r.perch).toBeNull();
    expect(r.inRange).toBeNull();
    expect(r.heightSpan.min).toBeGreaterThan(30); // 35 mm Verstellbereich, i < 1
  });

  it("mit Referenz: Maß für die Zielhöhe und Prüfung gegen das Gutachten", () => {
    const d = applyOverrides(data, { "coilover.refPerchFront": m(215), "coilover.refHeightFront": m(340) });
    const r = perchFront(d, gF, { travel: 49 }, 322);
    const i = frontSpringRatio(gF, { travel: 49 });
    expect(r.perch!.min).toBeCloseTo(215 - 18 * i, 6);
    expect(r.inRange).toBe(true);
    const tief = perchFront(d, gF, { travel: 49 }, 300);
    expect(tief.inRange).toBe(false); // unter 195 mm
  });

  it("HA mit Referenz: Band aus der Federlage", () => {
    const d = applyOverrides(data, { "coilover.refPerchRear": m(35), "coilover.refHeightRear": m(330) });
    const r = perchRear(d, gR, 17, 320);
    expect(r.perch!.max).toBeLessThan(35);
    expect(r.perch!.min).toBeLessThan(r.perch!.max);
  });
});
