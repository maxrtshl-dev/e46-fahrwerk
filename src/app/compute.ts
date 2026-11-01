import { useMemo } from "react";
import type { Confidence, E46Data } from "../core/data";
import { req, weakest } from "../core/data";
import { solveFrontAxle, type AxleResult } from "../core/frontAxle";
import { frontGeometryFromData, solveFront, strutTopShiftForCamber, type FrontGeometry } from "../core/frontMcPherson";
import { checkFitment, wheelGeometry, worst, type Clearance, type LoadCase, type WheelGeometry } from "../core/fitment";
import { checkLegal, overall, type Ampel, type Check } from "../core/legal";
import { rearGeometryFromData, solveRear, solveRearBand, type Band, type RearResult } from "../core/rearAxle";
import { lowering, wheelTravel } from "../core/rideHeight";
import { rollAxis, type RollAxis } from "../core/rollAxis";
import { HORN_WIDTH_DEFAULT } from "../core/thresholds";
import { parseTireSize, type TireSize } from "../core/tire";
import type { TwoLinkResult } from "../core/twoLink";
import type { Setup, WheelSetup } from "./store";

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
  missing: string | null;
}

export interface RearComputed {
  lowering: number;
  travelOuter: number;
  static: TwoLinkResult;
  load: TwoLinkResult;
  stock: TwoLinkResult;
  bandStatic: RearResult;
  bandLoad: RearResult;
}

export interface Computed {
  d: E46Data;
  kinConfidence: Confidence;
  rearConfidence: Confidence;
  stockAxle: AxleResult | null;
  lowering: number;
  travel: number;
  strutShift: number;
  tire: TireSize | null;
  axle: AxleResult | null;
  /** Nur Höhe + Sturzkorrektur, ohne Federn/Wanken. */
  staticAxle: AxleResult | null;
  rear: RearComputed | null;
  rearError: string | null;
  rollAxis: { now: RollAxis; stock: RollAxis } | null;
  camberOffsetRear: number;
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
    return { tire: null, geo: null, error: msg(e) };
  }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const shift = (b: Band, o: number): Band => ({ min: b.min + o, max: b.max + o });

export function computeAll(d: E46Data, s: Setup): Computed {
  const hp = d.frontHardpoints;
  const kinConfidence = weakest(
    hp.lowerArmInner.y.confidence,
    hp.lowerArmInner.z.confidence,
    hp.lowerArmOuter.y.confidence,
    hp.lowerArmOuter.z.confidence,
    hp.strutTop.y.confidence,
    hp.strutTop.z.confidence,
    d.vehicle.trackFront.confidence,
    d.vehicle.stockHeightFront.confidence,
  );
  const re = d.rearEquivalent;
  const rearConfidence = weakest(
    ...[re.lowerInner, re.lowerOuter, re.upperInner, re.upperOuter].flatMap((p) => [p.y.confidence, p.z.confidence]),
    d.vehicle.trackRear.confidence,
    d.vehicle.stockHeightRear.confidence,
  );
  const stockFront = req(d.vehicle.stockHeightFront);
  const stockRear = req(d.vehicle.stockHeightRear);
  const trackRear = req(d.vehicle.trackRear);

  const low = lowering(stockFront, s.heightFront);
  const travel = low + s.bump;
  const wf = axleWheel(s.wheels.front);
  const wr = axleWheel(s.wheels.rear);
  const rStatF = s.wheels.front.staticRadius;

  let geometry: FrontGeometry | null = null;
  let stockAxle: AxleResult | null = null;
  let axle: AxleResult | null = null;
  let staticAxle: AxleResult | null = null;
  let strutShift = 0;
  let error: string | null = null;
  try {
    geometry = frontGeometryFromData(d);
    strutShift = strutTopShiftForCamber(geometry, s.camberCorrDeg);
    stockAxle = solveFrontAxle(geometry, { travel: 0, rollDeg: 0 });
    staticAxle = solveFrontAxle(geometry, { travel: low, rollDeg: 0, strutTopShiftInward: strutShift, staticRadius: rStatF });
    axle = solveFrontAxle(geometry, { travel, rollDeg: s.roll, strutTopShiftInward: strutShift, staticRadius: rStatF });
  } catch (e) {
    error = msg(e);
  }

  // ---- Freigang VA
  const dynamic = s.bump !== 0 || s.roll !== 0;
  const fit = d.fitment;
  const fitFront: AxleFitment = { axle: "VA", wheel: wf, cases: [], status: "unbekannt", missing: null };
  if (!wf.geo) fitFront.missing = `Reifen VA: ${wf.error}`;
  else if (!geometry || !staticAxle || !axle) fitFront.missing = error;
  else {
    const loads: LoadCase[] = [];
    const c0 = staticAxle.left.camberBodyDeg;
    loads.push({ name: "statisch", height: s.heightFront, camberMin: c0, camberMax: c0 });
    if (dynamic) {
      const side = axle.right.travel >= axle.left.travel ? axle.right : axle.left;
      const c = side.camberBodyDeg;
      loads.push({ name: s.roll !== 0 ? "Lastfall, kurvenaußen" : "Lastfall", height: stockFront - side.travel, camberMin: c, camberMax: c });
    }
    const bumpF = fit.bumpTravelFront.value;
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
        fenderLateral: fit.fenderLateralFront.value,
        innerA: fit.innerStrutFront.value,
        innerB: fit.innerPerchFront.value,
      }),
    }));
    fitFront.status = worst(fitFront.cases.flatMap((c) => c.checks));
  }

  // ---- HA: Ersatzmodell + Band + Freigang
  let rear: RearComputed | null = null;
  let rearError: string | null = null;
  const fitRear: AxleFitment = { axle: "HA", wheel: wr, cases: [], status: "unbekannt", missing: null };
  const off = s.camberOffsetRearDeg;
  if (s.heightRear === null) fitRear.missing = "Höhe HA eintragen";
  else if (!wr.geo) fitRear.missing = `Reifen HA: ${wr.error}`;
  if (s.heightRear !== null) {
    const lowR = lowering(stockRear, s.heightRear);
    const travelOuter = wheelTravel({ lowering: lowR, bump: s.bump, rollDeg: Math.abs(s.roll), track: trackRear, outer: true });
    try {
      const g = rearGeometryFromData(d);
      const opts = { camberOffsetDeg: off, staticRadius: s.wheels.rear.staticRadius };
      rear = {
        lowering: lowR,
        travelOuter,
        stock: solveRear(g, 0),
        static: solveRear(g, lowR, opts),
        load: solveRear(g, travelOuter, opts),
        bandStatic: solveRearBand(d, lowR),
        bandLoad: solveRearBand(d, travelOuter),
      };
    } catch (e) {
      rearError = msg(e);
    }
    if (wr.geo) {
      const loads: LoadCase[] = [];
      const b0 = shift(solveRearBand(d, lowR).camberDeg, off);
      loads.push({ name: "statisch", height: s.heightRear, camberMin: b0.min, camberMax: b0.max });
      if (dynamic) {
        const b = shift(solveRearBand(d, travelOuter).camberDeg, off);
        loads.push({ name: s.roll !== 0 ? "Lastfall, kurvenaußen" : "Lastfall", height: stockRear - travelOuter, camberMin: b.min, camberMax: b.max });
      }
      const bumpR = fit.bumpTravelRear.value;
      if (bumpR !== null) {
        const b = shift(solveRearBand(d, lowR + bumpR).camberDeg, off);
        loads.push({ name: "bis Puffer", height: s.heightRear - bumpR, camberMin: b.min, camberMax: b.max });
      }
      fitRear.cases = loads.map((load) => ({
        load,
        checks: checkFitment({
          axle: "HA",
          wheel: wr.geo!,
          load,
          fenderLateral: fit.fenderLateralRear.value,
          innerA: fit.innerRear.value,
          innerB: null,
        }),
      }));
      fitRear.status = worst(fitRear.cases.flatMap((c) => c.checks));
    }
  }

  // ---- Rollachse (statisch: nur Höhen)
  let ra: Computed["rollAxis"] = null;
  const wb = d.vehicle.wheelbase.value;
  if (wb && staticAxle?.rollCenterHeight != null && stockAxle?.rollCenterHeight != null && rear?.static.rollCenterHeight != null && rear.stock.rollCenterHeight != null) {
    ra = {
      now: rollAxis(staticAxle.rollCenterHeight, rear.static.rollCenterHeight, wb),
      stock: rollAxis(stockAxle.rollCenterHeight, rear.stock.rollCenterHeight, wb),
    };
  }

  const checks = checkLegal(d, { heightFront: s.heightFront, heightRear: s.heightRear });
  return {
    d,
    kinConfidence,
    rearConfidence,
    stockAxle,
    lowering: low,
    travel,
    strutShift,
    tire: wf.tire,
    axle,
    staticAxle,
    rear,
    rearError,
    rollAxis: ra,
    camberOffsetRear: off,
    error,
    checks,
    legal: overall(checks),
    fitFront,
    fitRear,
  };
}

export function useComputed(d: E46Data, s: Setup): Computed {
  return useMemo(
    () => computeAll(d, s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, s.heightFront, s.heightRear, s.bump, s.roll, s.camberCorrDeg, s.camberOffsetRearDeg, s.wheels],
  );
}
