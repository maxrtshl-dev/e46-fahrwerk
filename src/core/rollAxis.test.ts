import { rollAxis } from "./rollAxis";

describe("Rollachse", () => {
  it("Neigung und Zwischenhöhe", () => {
    const a = rollAxis(91, 110, 2725);
    expect(a.inclinationDeg).toBeCloseTo((Math.atan(19 / 2725) * 180) / Math.PI, 9);
    expect(a.heightAt(0)).toBe(91);
    expect(a.heightAt(2725)).toBe(110);
    expect(a.heightAt(1362.5)).toBeCloseTo(100.5, 9);
  });
  it("VA tiefer als HA: Achse steigt nach hinten", () => {
    expect(rollAxis(-75, 50, 2725).inclinationDeg).toBeGreaterThan(0);
  });
});
