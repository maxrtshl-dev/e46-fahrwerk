// Gewinde-Rechner: Federteller-Maß ↔ Fahrzeughöhe.
//
// Gleiche Last → gleiche Federlänge. Wird der Federteller um Δp verstellt, verschiebt sich
// der Federsitz gegenüber dem Rad um Δp, die Radmitte gegenüber der Karosserie um Δp / i,
// mit i = Übersetzung (Federweg je mm Radweg) im Arbeitspunkt.
//  - VA: Feder sitzt koaxial auf dem Federbein → i = Längenänderung Federbein je mm Radhub
//    (aus frontMcPherson).
//  - HA: Feder sitzt auf dem unteren Lenker → i = Hub des Federsitzes je mm Radhub (aus dem
//    Ersatzmodell); Lage auf dem Lenker ist eine Annahme → Band.
// Absolute Maße brauchen eine Referenz (gemessenes Federteller-Maß bei bekannter Höhe).

import type { E46Data } from "./data";
import { req } from "./data";
import { solveFront, type FrontGeometry, type FrontInput } from "./frontMcPherson";
import { solveTwoLink, type TwoLinkGeometry } from "./twoLink";

const H = 1; // mm, Schrittweite der numerischen Ableitung

const dist = (a: { y: number; z: number }, b: { y: number; z: number }) => Math.hypot(a.y - b.y, a.z - b.z);

/** Übersetzung VA: Einfederung des Federbeins je mm Radhub im Arbeitspunkt. */
export function frontSpringRatio(g: FrontGeometry, input: FrontInput): number {
  const L = (t: number) => {
    const r = solveFront(g, { ...input, travel: t });
    return dist(r.lowerArmOuter, r.strutTop);
  };
  return -(L(input.travel + H) - L(input.travel - H)) / (2 * H);
}

/** Übersetzung HA: Hub des Federsitzes auf dem unteren Lenker je mm Radhub. */
export function rearSpringRatio(g: TwoLinkGeometry, travel: number, onLink: number): number {
  const seat = (t: number) => {
    const r = solveTwoLink(g, { travel: t });
    return r.lowerInner.z + onLink * (r.lowerOuter.z - r.lowerInner.z);
  };
  return (seat(travel + H) - seat(travel - H)) / (2 * H);
}

export interface PerchResult {
  /** mm Höhe je mm Federteller (größer = empfindlicher). */
  heightPerPerch: { min: number; max: number };
  /** Höhenbereich, den der zulässige Verstellbereich abdeckt, mm. */
  heightSpan: { min: number; max: number };
  /** Benötigtes Federteller-Maß für die Zielhöhe; null ohne Referenz. */
  perch: { min: number; max: number } | null;
  range: { min: number; max: number };
  /** Ziel liegt (für das ganze Band) im zulässigen Verstellbereich. */
  inRange: boolean | null;
}

function result(
  ratios: number[],
  range: { min: number; max: number },
  ref: { perch: number | null; height: number | null },
  target: number,
): PerchResult {
  const hpp = ratios.map((i) => 1 / i);
  const span = hpp.map((k) => k * (range.max - range.min));
  let perch: PerchResult["perch"] = null;
  let inRange: boolean | null = null;
  if (ref.perch !== null && ref.height !== null) {
    const p = ratios.map((i) => ref.perch! + (target - ref.height!) * i);
    perch = { min: Math.min(...p), max: Math.max(...p) };
    inRange = perch.min >= range.min && perch.max <= range.max;
  }
  return {
    heightPerPerch: { min: Math.min(...hpp), max: Math.max(...hpp) },
    heightSpan: { min: Math.min(...span), max: Math.max(...span) },
    perch,
    range,
    inRange,
  };
}

export function perchFront(data: E46Data, g: FrontGeometry, input: FrontInput, targetHeight: number): PerchResult {
  const i = frontSpringRatio(g, input);
  const l = data.limits;
  const c = data.coilover;
  return result(
    [i],
    { min: req(l.perchRangeFrontMin), max: req(l.perchRangeFrontMax) },
    { perch: c.refPerchFront.value, height: c.refHeightFront.value },
    targetHeight,
  );
}

export function perchRear(data: E46Data, g: TwoLinkGeometry, travel: number, targetHeight: number): PerchResult {
  const c = data.coilover;
  const ratios = [req(c.rearSpringOnLinkMin), req(c.rearSpringOnLinkMax)].map((f) => rearSpringRatio(g, travel, f));
  const l = data.limits;
  return result(
    ratios,
    { min: req(l.perchRangeRearMin), max: req(l.perchRangeRearMax) },
    { perch: c.refPerchRear.value, height: c.refHeightRear.value },
    targetHeight,
  );
}
