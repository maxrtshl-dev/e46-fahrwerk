import { computeAll } from "./compute";
import { applyOverrides } from "../core/data";
import { data } from "../core/testdata";
import { initialSetup, type Setup } from "./store";

const K: Setup = { ...initialSetup, heightFront: 322, heightRear: 320 };

describe("Gesamtrechnung", () => {
  it("K-Setup: alle Teile rechnen, Rollachse vorhanden", () => {
    const c = computeAll(data, K);
    expect(c.error).toBeNull();
    expect(c.rearError).toBeNull();
    expect(c.staticAxle!.rollCenterHeight!).toBeLessThan(0);
    expect(c.rear!.static.rollCenterHeight!).toBeGreaterThan(c.staticAxle!.rollCenterHeight!);
    expect(c.rollAxis!.now.inclinationDeg).toBeGreaterThan(c.rollAxis!.stock.inclinationDeg);
    expect(c.fitFront.cases).toHaveLength(1);
    expect(c.rearConfidence).toBe("Annahme");
  });

  it("Messwert ersetzt Schätzung in der Rechnung", () => {
    const d = applyOverrides(data, {
      "fitment.fenderLateralFront": { value: 80, unit: "mm", source: "Messung", confidence: "gemessen" },
      "fitment.bumpTravelFront": { value: 30, unit: "mm", source: "Messung", confidence: "gemessen" },
    });
    const c = computeAll(d, K);
    expect(c.fitFront.cases.map((x) => x.load.name)).toContain("bis Puffer");
    expect(c.fitFront.cases[0]!.checks.find((x) => x.id === "aussen")!.value).not.toBeNull();
  });

  it("Exzenter HA verschiebt Modell und Band", () => {
    const a = computeAll(data, K);
    const b = computeAll(data, { ...K, camberOffsetRearDeg: -0.5 });
    expect(b.rear!.static.camberBodyDeg - a.rear!.static.camberBodyDeg).toBeCloseTo(-0.5, 9);
    expect(b.fitRear.cases[0]!.load.camberMax - a.fitRear.cases[0]!.load.camberMax).toBeCloseTo(-0.5, 9);
  });

  it("außerhalb des Modells: Fehlermeldung statt Absturz", () => {
    const c = computeAll(data, { ...K, bump: 900 });
    expect(c.error).not.toBeNull();
    expect(c.axle).toBeNull();
  });

  it("HA je Seite: Wanken nach rechts drückt rechts ein", () => {
    const c = computeAll(data, { ...K, roll: 2 });
    expect(c.rear!.right.groundZ).toBeGreaterThan(c.rear!.left.groundZ);
    expect(c.rear!.right.groundZ).toBeCloseTo(c.rear!.load.groundZ, 6);
    const n = computeAll(data, K);
    expect(n.rear!.left.groundZ).toBeCloseTo(n.rear!.right.groundZ, 9);
  });
});
