import { parseTireSize, rimEdges, tireDiameter, tireRadius, tireShoulders } from "./tire";

describe("Reifen", () => {
  const t = parseTireSize("225/40 R18");
  it("225/40 R18: D = 637,2 mm, r = 318,6 mm", () => {
    expect(tireDiameter(t)).toBeCloseTo(637.2, 6);
    expect(tireRadius(t)).toBeCloseTo(318.6, 6);
  });
  it("Felgenkanten relativ zur Radanlagefläche", () => {
    const e = rimEdges({ widthJ: 8, et: 40, spacer: 0, hornWidth: 6.5 });
    expect(e.outer).toBeCloseTo(101.6 - 40, 6);
    expect(e.inner).toBeCloseTo(-(101.6 + 40), 6);
    const s = rimEdges({ widthJ: 8, et: 40, spacer: 10, hornWidth: 6.5 });
    expect(s.outer - e.outer).toBeCloseTo(10, 6);
    expect(s.inner - e.inner).toBeCloseTo(10, 6);
  });
  it("Reifenschulter: Überstand bzw. Stretch", () => {
    const rim = { widthJ: 8, et: 40, spacer: 0, hornWidth: 6.5 };
    const sh = tireShoulders(t, rim);
    expect(sh.outer - rimEdges(rim).outer).toBeCloseTo((225 - 203.2) / 2, 6);
    const stretch = tireShoulders(parseTireSize("215/40 R18"), { ...rim, widthJ: 9 });
    expect(stretch.outer).toBeLessThan(rimEdges({ ...rim, widthJ: 9 }).outer);
  });
});
