import { useMemo } from "react";
import type { Confidence } from "../core/data";
import { req, weakest } from "../core/data";
import { solveFrontAxle, type AxleResult } from "../core/frontAxle";
import { frontGeometryFromData, solveFront, strutTopShiftForCamber } from "../core/frontMcPherson";
import { checkFitment, wheelGeometry, worst, type Clearance, type LoadCase, type WheelGeometry } from "../core/fitment";
import { checkLegal, overall, type Ampel, type Check } from "../core/legal";
import { solveRearBand, type RearResult } from "../core/rearAxle";
import { lowering, wheelTravel } from "../core/rideHeight";
import { HORN_WIDTH_DEFAULT } from "../core/thresholds";
import { parseTireSize, type TireSize } from "../core/tire";
import { data, measure, type Setup, type WheelSetup } from "./store";

export const geometry = frontGeometryFromData(data);
const hp = data.frontHardpoints;
const stockFront = req(data.vehicle.stockHeightFront);
const stockRear = req(data.vehicle.stockHeightRear);
const trackRear = req(data.vehicle.trackRear);

/** Belastbarkeit der VA-Kinematik = schwächster Eingangswert. */
export const kinConfidence: Confidence = weakest(
  hp.lowerArmInner.y.confidence,
  hp.lowerArmInner.z.confidence,
  hp.lowerArmOuter.y.confidence,
  hp.lowerArmOuter.z.confidence,
  hp.strutTop.y.confidence,
  hp.strutTop.z.confidence,
  data.vehicle.trackFront.confidence,
  data.vehicle.stockHeightFront.confidence,
);

export const stockAxle = solveFrontAxle(geometry, { travel: 0, rollDeg: 0 });

export interface AxleWheel {
  tire: TireSize | null;
  geo: WheelGeometry | null;
  error: string | null;
}

export interface AxleFitment {
  axle: "VA" | "HA";
  wheel: AxleWheel;
  cases: { load: LoadCase; checks: Clearance[] }[];
  status: Ampel;
  missing: string | null; // warum nichts berechnet wurde
}

export interface Computed {
  lowering: number;
  travel: number;
  strutShift: number;
  tire: TireSize | null;
  axle: AxleResult | null;
  /** Nur Höhe + Sturzkorrektur, ohne Federn/Wanken. */
  staticAxle: AxleResult | null;
  rear: { lowering: number; static: RearResult; load: RearResult } | null;
  error: string | null;
  checks: Check[];
  legal: Ampel;
  fitFront: AxleFitment;
  fitRear: AxleFitment;
}

function axleWheel(w: WheelSetup): AxleWheel {
  try {
    const tire = parseTireSize(w.tire);
    const geo = wheelGeometry(tire, { widthJ: w.widthJ, et: w.et, spacer: w.spacer, hornWidth: HORN_WIDTH_DEFAULT });
    return { tire, geo, error: null };
  } catch (e) {
    return { tire: null, geo: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export function useComputed(s: Setup): Computed {
  return useMemo(() => {
    const low = lowering(stockFront, s.heightFront);
    const travel = low + s.bump;
    const strutShift = strutTopShiftForCamber(geometry, s.camberCorrDeg);
    const wf = axleWheel(s.wheels.front);
    const wr = axleWheel(s.wheels.rear);
    const rStatF = s.wheels.front.staticRadius;

    let axle: AxleResult | null = null;
    let staticAxle: AxleResult | null = null;
    let error: string | null = null;
    try {
      staticAxle = solveFrontAxle(geometry, { travel: low, rollDeg: 0, strutTopShiftInward: strutShift, staticRadius: rStatF });
      axle = solveFrontAxle(geometry, { travel, rollDeg: s.roll, strutTopShiftInward: strutShift, staticRadius: rStatF });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    // ---- Freigang VA
    const dynamic = s.bump !== 0 || s.roll !== 0;
    const fitFront: AxleFitment = { axle: "VA", wheel: wf, cases: [], status: "unbekannt", missing: null };
    if (!wf.geo) fitFront.missing = `Reifen VA: ${wf.error}`;
    else if (!staticAxle || !axle) fitFront.missing = error;
    else {
      const loads: LoadCase[] = [];
      const c0 = staticAxle.left.camberBodyDeg;
      loads.push({ name: "statisch", height: s.heightFront, camberMin: c0, camberMax: c0 });
      if (dynamic) {
        const side = axle.right.travel >= axle.left.travel ? axle.right : axle.left;
        const c = side.camberBodyDeg;
        loads.push({ name: s.roll !== 0 ? "Lastfall, kurvenaußen" : "Lastfall", height: stockFront - side.travel, camberMin: c, camberMax: c });
      }
      const bumpF = measure(s, "bumpTravelFront");
      if (bumpF !== null) {
        try {
          const c = solveFront(geometry, { travel: low + bumpF, strutTopShiftInward: strutShift, staticRadius: rStatF }).camberBodyDeg;
          loads.push({ name: "bis Puffer", height: s.heightFront - bumpF, camberMin: c, camberMax: c });
        } catch {
          /* außerhalb des Modells */
        }
      }
      fitFront.cases = loads.map((load) => ({
        load,
        checks: checkFitment({
          axle: "VA",
          wheel: wf.geo!,
          load,
          fenderLateral: measure(s, "fenderLateralFront"),
          innerA: measure(s, "innerStrutFront"),
          innerB: measure(s, "innerPerchFront"),
        }),
      }));
      fitFront.status = worst(fitFront.cases.flatMap((c) => c.checks));
    }

    // ---- HA: Bandmodell + Freigang
    let rear: Computed["rear"] = null;
    const fitRear: AxleFitment = { axle: "HA", wheel: wr, cases: [], status: "unbekannt", missing: null };
    if (s.heightRear === null) fitRear.missing = "Höhe HA eintragen";
    else if (!wr.geo) fitRear.missing = `Reifen HA: ${wr.error}`;
    if (s.heightRear !== null) {
      const lowR = lowering(stockRear, s.heightRear);
      const travelOuter = wheelTravel({ lowering: lowR, bump: s.bump, rollDeg: Math.abs(s.roll), track: trackRear, outer: true });
      rear = { lowering: lowR, static: solveRearBand(data, lowR), load: solveRearBand(data, travelOuter) };
      if (wr.geo) {
        const loads: LoadCase[] = [];
        const b0 = rear.static.camberDeg;
        loads.push({ name: "statisch", height: s.heightRear, camberMin: b0.min, camberMax: b0.max });
        if (dynamic) {
          const b = rear.load.camberDeg;
          loads.push({
            name: s.roll !== 0 ? "Lastfall, kurvenaußen" : "Lastfall",
            height: stockRear - travelOuter,
            camberMin: b.min,
            camberMax: b.max,
          });
        }
        const bumpR = measure(s, "bumpTravelRear");
        if (bumpR !== null) {
          const b = solveRearBand(data, lowR + bumpR).camberDeg;
          loads.push({ name: "bis Puffer", height: s.heightRear - bumpR, camberMin: b.min, camberMax: b.max });
        }
        fitRear.cases = loads.map((load) => ({
          load,
          checks: checkFitment({
            axle: "HA",
            wheel: wr.geo!,
            load,
            fenderLateral: measure(s, "fenderLateralRear"),
            innerA: measure(s, "innerRear"),
            innerB: null,
          }),
        }));
        fitRear.status = worst(fitRear.cases.flatMap((c) => c.checks));
      }
    }

    const checks = checkLegal(data, { heightFront: s.heightFront, heightRear: s.heightRear });
    return {
      lowering: low,
      travel,
      strutShift,
      tire: wf.tire,
      axle,
      staticAxle,
      rear,
      error,
      checks,
      legal: overall(checks),
      fitFront,
      fitRear,
    };
  }, [s.heightFront, s.heightRear, s.bump, s.roll, s.camberCorrDeg, s.wheels, s.measured]);
}
