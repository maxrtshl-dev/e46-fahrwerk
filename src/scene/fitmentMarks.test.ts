import { computeAll } from "../app/compute";
import { initialSetup } from "../app/store";
import { applyOverrides } from "../core/data";
import { data } from "../core/testdata";
import { bodyDims } from "./Car";
import { BodyModel } from "./e46Body";
import { fitmentMarks } from "./fitmentMarks";

const K = { ...initialSetup, heightFront: 322, heightRear: 320 };
const model = new BodyModel(bodyDims(data));
const check = (c: ReturnType<typeof computeAll>, axle: "fitFront" | "fitRear", id: string) =>
  c[axle].cases[0]!.checks.find((x) => x.id === id)!.value;

describe("Fitment-Marken = Radhaus-Rechnung", () => {
  it("Spalt oben identisch mit fitment.ts (VA und HA)", () => {
    const c = computeAll(data, K);
    const [va, ha] = fitmentMarks(c, K, model);
    expect(va!.gapTop).toBeCloseTo(check(c, "fitFront", "oben")!, 6);
    expect(ha!.gapTop).toBeCloseTo(check(c, "fitRear", "oben")!, 6);
  });

  it("gemessene Kante: Schulter ↔ Kante identisch mit fitment.ts", () => {
    const d = applyOverrides(data, {
      "fitment.fenderLateralFront": { value: 82, unit: "mm", source: "Messung", confidence: "gemessen" },
      "fitment.fenderLateralRear": { value: 76, unit: "mm", source: "Messung", confidence: "gemessen" },
    });
    const c = computeAll(d, K);
    const [va, ha] = fitmentMarks(c, K, model);
    expect(va!.lipMeasured).toBe(true);
    expect(va!.gapSide).toBeCloseTo(check(c, "fitFront", "aussen")!, 6);
    // HA: fitment.ts rechnet mit dem ungünstigsten Sturz des Bands, die Marke mit dem Modellsturz
    expect(Math.abs(ha!.gapSide - check(c, "fitRear", "aussen")!)).toBeLessThan(5);
  });

  it("ohne Messung: Kante auf der Karosserie, als geschätzt markiert", () => {
    const c = computeAll(data, K);
    const [va] = fitmentMarks(c, K, model);
    expect(va!.lipMeasured).toBe(false);
    expect(va!.lipY).toBeLessThanOrEqual(model.halfW);
    expect(va!.lipY).toBeGreaterThan(c.axle!.left.wheelCenter.y);
  });
});
