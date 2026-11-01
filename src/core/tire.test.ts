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
  it("Reifenschulter: Überstand bzw. Stretch (ETRTO: −40 % je Zoll über Messfelge)", () => {
    const rim = { widthJ: 8, et: 40, spacer: 0, hornWidth: 6.5 };
    const sh = tireShoulders(t, rim);
    // 225/40 R18: Messfelge 8J → Nennbreite gilt
    expect(sh.outer - rimEdges(rim).outer).toBeCloseTo((225 - 203.2) / 2, 6);
    const stretch = tireShoulders(parseTireSize("205/40 R18"), { ...rim, widthJ: 9.5 });
    expect(stretch.outer).toBeLessThan(rimEdges({ ...rim, widthJ: 9.5 }).outer);
  });
});

import { wheelLateralShift } from "./tire";

describe("Radlage", () => {
  it("ET und Spurplatte verschieben das Rad", () => {
    expect(wheelLateralShift(41, 41, 0)).toBe(0);
    expect(wheelLateralShift(41, 35, 0)).toBe(6);
    expect(wheelLateralShift(41, 41, 10)).toBe(10);
    expect(wheelLateralShift(50, 47, 5)).toBe(8);
  });
});

import { bmwHeightToCenter, measuringRimJ, sectionWidthOnRim } from "./tire";

describe("ETRTO-Faustregeln", () => {
  it("Messfelgen", () => {
    expect(measuringRimJ(parseTireSize("205/55 R16"))).toBe(6.5);
    expect(measuringRimJ(parseTireSize("225/45 R17"))).toBe(7.5);
    expect(measuringRimJ(parseTireSize("225/40 R18"))).toBe(8);
    expect(measuringRimJ(parseTireSize("245/40 R17"))).toBe(8.5);
    expect(measuringRimJ(parseTireSize("255/35 R18"))).toBe(9);
  });
  it("Querschnittsbreite auf schmalerer Felge", () => {
    expect(sectionWidthOnRim(parseTireSize("255/35 R18"), 8.5)).toBeCloseTo(255 - 0.4 * 12.7, 6);
    expect(sectionWidthOnRim(parseTireSize("225/45 R17"), 7.5)).toBe(225);
  });
  it("BMW-Höhe (Felgenhorn unten → Radlauf) auf Radmitte umrechnen", () => {
    expect(bmwHeightToCenter(604, 17)).toBeCloseTo(604 - 215.9 - 17.5, 6);
  });
});
