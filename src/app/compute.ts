import { useMemo } from "react";
import type { Confidence } from "../core/data";
import { req, weakest } from "../core/data";
import { solveFrontAxle, type AxleResult } from "../core/frontAxle";
import { frontGeometryFromData, strutTopShiftForCamber } from "../core/frontMcPherson";
import { checkLegal, overall, type Check, type Ampel } from "../core/legal";
import { lowering } from "../core/rideHeight";
import { parseTireSize, type TireSize } from "../core/tire";
import { data, type Setup } from "./store";

export const geometry = frontGeometryFromData(data);
const hp = data.frontHardpoints;

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

export interface Computed {
  lowering: number;
  travel: number;
  strutShift: number;
  tire: TireSize | null;
  axle: AxleResult | null;
  /** Nur Höhe + Sturzkorrektur, ohne Federn/Wanken. */
  staticAxle: AxleResult | null;
  error: string | null;
  checks: Check[];
  legal: Ampel;
}

export function useComputed(s: Setup): Computed {
  return useMemo(() => {
    const low = lowering(req(data.vehicle.stockHeightFront), s.heightFront);
    const travel = low + s.bump;
    const strutShift = strutTopShiftForCamber(geometry, s.camberCorrDeg);
    let tire: TireSize | null = null;
    try {
      tire = parseTireSize(s.tire);
    } catch {
      tire = null;
    }
    let axle: AxleResult | null = null;
    let staticAxle: AxleResult | null = null;
    let error: string | null = null;
    try {
      staticAxle = solveFrontAxle(geometry, {
        travel: low,
        rollDeg: 0,
        strutTopShiftInward: strutShift,
        staticRadius: s.staticRadius,
      });
      axle = solveFrontAxle(geometry, {
        travel,
        rollDeg: s.roll,
        strutTopShiftInward: strutShift,
        staticRadius: s.staticRadius,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const checks = checkLegal(data, { heightFront: s.heightFront, heightRear: s.heightRear });
    return { lowering: low, travel, strutShift, tire, axle, staticAxle, error, checks, legal: overall(checks) };
  }, [s.heightFront, s.heightRear, s.bump, s.roll, s.camberCorrDeg, s.tire, s.staticRadius]);
}
