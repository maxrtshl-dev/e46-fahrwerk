import { camberToRoad, heightFromLowering, lowering, wheelTravel } from "./rideHeight";

describe("Fahrzeughöhe", () => {
  it("Tieferlegung", () => {
    expect(lowering(385, 322)).toBe(63);
    expect(heightFromLowering(385, 63)).toBe(322);
  });
  it("Radhub aus Tieferlegung, Einfedern und Wanken", () => {
    expect(wheelTravel({ lowering: 63, bump: 20 })).toBe(83);
    const outer = wheelTravel({ lowering: 0, rollDeg: 2, track: 1480, outer: true });
    const inner = wheelTravel({ lowering: 0, rollDeg: 2, track: 1480, outer: false });
    expect(outer).toBeCloseTo(740 * Math.tan((2 * Math.PI) / 180), 6);
    expect(inner).toBeCloseTo(-outer, 6);
  });
  it("Sturz zur Fahrbahn beim Wanken", () => {
    expect(camberToRoad(-1.5, 2, true)).toBeCloseTo(0.5, 6);
    expect(camberToRoad(-1.5, 2, false)).toBeCloseTo(-3.5, 6);
  });
});
