import { fmtDeg, fmtDegDec, fmtMm } from "./format";

describe("Anzeige nach Belastbarkeit", () => {
  it("Längen", () => {
    expect(fmtMm(-76.4, "geschätzt")).toBe("≈ −75 mm");
    expect(fmtMm(91.2, "geschätzt", true)).toBe("≈ +90 mm");
    expect(fmtMm(322, "gemessen")).toBe("322 mm");
    expect(fmtMm(null, "belegt")).toBe("–");
    expect(fmtMm(-1, "geschätzt")).toBe("≈ 0 mm");
  });
  it("Winkel im Werkstattformat", () => {
    expect(fmtDeg(-1.5, "geschätzt")).toBe("≈ −1°30′");
    expect(fmtDeg(-1.52, "geschätzt")).toBe("≈ −1°30′");
    expect(fmtDeg(-1.52, "gemessen")).toBe("−1°31′");
  });
  it("Dezimalgrad", () => {
    expect(fmtDegDec(7.8, "geschätzt")).toBe("≈ 8,0°");
    expect(fmtDegDec(-3.2, "belegt")).toBe("−3,2°");
  });
});
