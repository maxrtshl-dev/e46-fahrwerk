import { formatDegMin, parseDegMin } from "./units";

describe("Grad/Minuten", () => {
  it("formatiert im Werkstattformat", () => {
    expect(formatDegMin(-1 / 3)).toBe("−0°20′");
    expect(formatDegMin(-1.5)).toBe("−1°30′");
    expect(formatDegMin(5 + 26 / 60)).toBe("5°26′");
    expect(formatDegMin(-0.001)).toBe("0°00′");
  });
  it("liest BMW-Sollwerte mit Toleranz", () => {
    const c = parseDegMin("-1°30' ±15'");
    expect(c.value).toBeCloseTo(-1.5, 6);
    expect(c.tolerance).toBeCloseTo(0.25, 6);
    expect(parseDegMin("−0°20′ ±20′").value).toBeCloseTo(-1 / 3, 6);
    expect(parseDegMin("5°26'").tolerance).toBeNull();
  });
  it("Rundlauf parse(format(x))", () => {
    for (const x of [-1.8333, -0.5, 0, 2.25]) {
      expect(parseDegMin(formatDegMin(x)).value).toBeCloseTo(Math.round(x * 60) / 60, 6);
    }
  });
});
