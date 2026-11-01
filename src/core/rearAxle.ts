// Hinterachse, Bandmodell (SPEC 7.4) – gilt bis zum Ersatzmodell mit Lenkerpunkten (M5).
// Alle Kalibrierwerte der HA sind Annahmen, deshalb ist jedes Ergebnis ein Band.

import type { E46Data, PointVal } from "./data";
import { req } from "./data";
import { wheelPlaneY } from "./frontMcPherson";
import { solveTwoLink, type TwoLinkGeometry, type TwoLinkResult } from "./twoLink";
import { parseDegMin } from "./units";

export interface Band {
  min: number;
  max: number;
}

export interface RearResult {
  /** Sturz zur Karosserie, Grad. min = negativster Wert. */
  camberDeg: Band;
  /** Rollzentrumshöhe über Fahrbahn, mm. */
  rollCenterHeight: Band;
}

/** travel = Radhub ab Serienlage, + = Rad nach oben (Tieferlegung + Einfedern). */
export function solveRearBand(data: E46Data, travel: number): RearResult {
  const c = data.calibration;
  const stockCamber = parseDegMin(data.factoryAlignment.rear.camber).value;
  const gMin = req(c.camberGainRearMin);
  const gMax = req(c.camberGainRearMax);
  const rc0 = req(c.rollCenterRearStock);
  const rMin = req(c.rollCenterRearGradientMin);
  const rMax = req(c.rollCenterRearGradientMax);

  const cam = [stockCamber - gMin * travel, stockCamber - gMax * travel];
  const rc = [rc0 - rMin * travel, rc0 - rMax * travel];
  return {
    camberDeg: { min: Math.min(...cam), max: Math.max(...cam) },
    rollCenterHeight: { min: Math.min(...rc), max: Math.max(...rc) },
  };
}

// ---- Ersatzmodell (Doppellenker in der Frontansicht)

export function rearGeometryFromData(data: E46Data): TwoLinkGeometry {
  const e = data.rearEquivalent;
  const p = (v: PointVal, n: string) => ({ y: req(v.y, `${n} y`), z: req(v.z, `${n} z`) });
  const r = data.wheels.current.rear.staticRadius;
  return {
    lowerInner: p(e.lowerInner, "HA unten innen"),
    lowerOuter: p(e.lowerOuter, "HA unten außen"),
    upperInner: p(e.upperInner, "HA oben innen"),
    upperOuter: p(e.upperOuter, "HA oben außen"),
    wheelCenter: { y: wheelPlaneY(data, "rear"), z: r },
    stockCamberDeg: parseDegMin(data.factoryAlignment.rear.camber).value,
    referenceStaticRadius: r,
  };
}

export function solveRear(
  g: TwoLinkGeometry,
  travel: number,
  opts: { camberOffsetDeg?: number; staticRadius?: number } = {},
): TwoLinkResult {
  return solveTwoLink(g, { travel, ...opts });
}
