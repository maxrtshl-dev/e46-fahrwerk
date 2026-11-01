import { ampel, checkFitment, outerShoulderTop, wheelGeometry, type FitmentInput } from "./fitment";
import { solveRearBand } from "./rearAxle";
import { parseTireSize, tireRadius } from "./tire";
import { HORN_WIDTH_DEFAULT } from "./thresholds";
import { data } from "./testdata";

const wf = data.wheels.current.front;
const front = wheelGeometry(parseTireSize(wf.tire), { widthJ: wf.widthJ!, et: wf.et!, spacer: wf.spacer, hornWidth: HORN_WIDTH_DEFAULT });
const base = (over: Partial<FitmentInput> = {}): FitmentInput => ({
  axle: "VA",
  wheel: front,
  load: { name: "statisch", height: 330, camberMin: -1.4, camberMax: -1.4 },
  fenderLateral: null,
  innerA: null,
  innerB: null,
  ...over,
});
const get = (id: string, f: FitmentInput) => checkFitment(f).find((c) => c.id === id)!;

describe("Freigang", () => {
  it("Ampel-Schwellen SPEC 7.5", () => {
    expect(ampel(11)).toBe("gruen");
    expect(ampel(10)).toBe("gelb");
    expect(ampel(3)).toBe("gelb");
    expect(ampel(2.9)).toBe("rot");
    expect(ampel(null)).toBe("unbekannt");
  });

  it("Styling 68 VA: Felgen- und Schulterlage", () => {
    // 7,5J = 190,5 mm, ET 41: außen 95,25 − 41 = 54,25; innen −136,25; Horn 6,5
    expect(front.rim.outer).toBeCloseTo(60.75, 6);
    expect(front.rim.inner).toBeCloseTo(-142.75, 6);
    expect(front.shoulder.outer - (95.25 - 41)).toBeCloseTo((225 - 190.5) / 2, 6);
    expect(front.tireRadius).toBeCloseTo(tireRadius(parseTireSize("225/45 R17")), 6);
  });

  it("Radlauf oben = Höhe − Reifenradius", () => {
    const c = get("oben", base());
    expect(c.value!).toBeCloseTo(330 - front.tireRadius, 6);
    expect(get("oben", base({ load: { name: "x", height: 318, camberMin: 0, camberMax: 0 } })).status).toBe("rot");
  });

  it("Reifen taucht ein: Kante seitlich frei = gelb, sonst rot", () => {
    const load = { name: "Puffer", height: 300, camberMin: -1.6, camberMax: -1.6 };
    expect(get("oben", base({ load })).status).toBe("rot"); // seitlich unbekannt
    expect(get("oben", base({ load, fenderLateral: 80 })).status).toBe("gelb");
    expect(get("oben", base({ load, fenderLateral: 50 })).status).toBe("rot");
  });

  it("negativer Sturz zieht die Schulter oben nach innen", () => {
    const a = outerShoulderTop(front, 0, 0).max;
    const b = outerShoulderTop(front, -1.5, -1.5).max;
    expect(a - b).toBeCloseTo(front.tireRadius * Math.sin((1.5 * Math.PI) / 180), 6);
  });

  it("ohne Messwert kein Freigang außen und innen", () => {
    const cs = checkFitment(base());
    expect(cs.find((c) => c.id === "aussen")!.status).toBe("unbekannt");
    expect(cs.find((c) => c.id === "federbein")!.value).toBeNull();
  });

  it("mit Messwerten: Luft = Messung − Kante", () => {
    const f = base({ fenderLateral: 80, innerA: 160, innerB: 165 });
    expect(get("aussen", f).value!).toBeCloseTo(80 - outerShoulderTop(front, -1.4, -1.4).max, 6);
    expect(get("federbein", f).value!).toBeCloseTo(160 - 142.75, 6);
    expect(get("teller", f).value!).toBeCloseTo(165 + front.shoulder.inner, 6);
  });

  it("HA: Sturzband → ungünstigster Fall außen", () => {
    const band = solveRearBand(data, 45);
    expect(band.camberDeg.min).toBeLessThan(band.camberDeg.max);
    const wr = data.wheels.current.rear;
    const rear = wheelGeometry(parseTireSize(wr.tire), { widthJ: wr.widthJ!, et: wr.et!, spacer: 0, hornWidth: HORN_WIDTH_DEFAULT });
    const f: FitmentInput = {
      axle: "HA",
      wheel: rear,
      load: { name: "s", height: 320, camberMin: band.camberDeg.min, camberMax: band.camberDeg.max },
      fenderLateral: 60,
      innerA: 170,
      innerB: null,
    };
    expect(get("aussen", f).value!).toBeCloseTo(60 - outerShoulderTop(rear, band.camberDeg.min, band.camberDeg.max).max, 6);
    expect(get("innen", f).value!).toBeCloseTo(170 - Math.max(-rear.rim.inner, -rear.shoulder.inner), 6);
  });
});

describe("HA-Bandmodell", () => {
  it("Serie: Sturz −1°30′, RZ 110 mm", () => {
    const b = solveRearBand(data, 0);
    expect(b.camberDeg.min).toBeCloseTo(-1.5, 6);
    expect(b.camberDeg.max).toBeCloseTo(-1.5, 6);
    expect(b.rollCenterHeight.min).toBeCloseTo(110, 6);
  });
  it("Tieferlegen 45 mm: Bänder aus den Annahmen", () => {
    const b = solveRearBand(data, 45);
    expect(b.camberDeg.min).toBeCloseTo(-1.5 - 0.03 * 45, 6);
    expect(b.camberDeg.max).toBeCloseTo(-1.5 - 0.015 * 45, 6);
    expect(b.rollCenterHeight.min).toBeCloseTo(110 - 1.5 * 45, 6);
    expect(b.rollCenterHeight.max).toBeCloseTo(110 - 45, 6);
  });
});
