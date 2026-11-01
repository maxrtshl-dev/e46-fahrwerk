import { applyOverrides, isApprox, weakest } from "./data";
import { data } from "./testdata";

describe("Daten", () => {
  it("Messwert überschreibt Schätzung, aber nicht umgekehrt", () => {
    const m = applyOverrides(data, {
      "vehicle.currentHeightRear": { value: 352, unit: "mm", source: "Messung Max 2026-11-01", confidence: "gemessen" },
    });
    expect(m.vehicle.currentHeightRear.value).toBe(352);
    expect(data.vehicle.currentHeightRear.value).toBeNull(); // Original unverändert
    const back = applyOverrides(m, {
      "vehicle.currentHeightRear": { value: 340, unit: "mm", source: "Foto", confidence: "geschätzt" },
    });
    expect(back.vehicle.currentHeightRear.value).toBe(352);
  });
  it("Pfade auf Anlenkpunkte", () => {
    const m = applyOverrides(data, {
      "frontHardpoints.strutTop.y": { value: 515, unit: "mm", source: "Messung", confidence: "gemessen" },
    });
    expect(m.frontHardpoints.strutTop.y.value).toBe(515);
    expect(() => applyOverrides(data, { "vehicle.gibtsNicht": m.vehicle.trackFront })).toThrow();
  });
  it("Belastbarkeit", () => {
    expect(isApprox("belegt")).toBe(false);
    expect(isApprox("geschätzt")).toBe(true);
    expect(weakest("belegt", "geschätzt", "gerechnet")).toBe("geschätzt");
  });
});
