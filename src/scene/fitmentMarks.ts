// Fitment-Marken für die 3D-Ansicht: Lage von Radlaufkante, Lauffläche oben und
// Reifenschulter je linkem Rad – aus denselben Werten wie fitment.ts.
// Karosseriesystem (mm). Kante seitlich: Messwert, sonst Haut der Karosserie (geschätzt).

import * as THREE from "three";
import type { Computed } from "../app/compute";
import type { Setup } from "../app/store";
import { outerShoulderTop } from "../core/fitment";
import { VIS } from "./geometry";
import type { BodyModel } from "./e46Body";

export interface WheelMark {
  axle: "VA" | "HA";
  x: number;
  zc: number; // Radmitte Serienlage (Kreismittelpunkt Radlauf)
  archR: number;
  /** Lage der Kante seitlich (y, links). */
  lipY: number;
  lipMeasured: boolean;
  tireTop: THREE.Vector3;
  lipTop: THREE.Vector3;
  shoulderTop: THREE.Vector3;
  gapTop: number; // + = Luft
  /** Schulter → Kante seitlich, + = Schulter innerhalb (Tuck), − = steht über (Poke). */
  gapSide: number;
}

export function fitmentMarks(c: Computed, s: Setup, m: BodyModel): WheelMark[] {
  const d = c.d;
  const out: WheelMark[] = [];
  const wb = d.vehicle.wheelbase.value ?? 2725;
  const axle = c.axle ?? c.stockAxle;
  const ref = d.wheels.current;
  const defs = [
    {
      axle: "VA" as const,
      x: 0,
      zc: ref.front.staticRadius,
      archR: d.vehicle.stockHeightFront.value ?? 385,
      wc: axle?.left.wheelCenter,
      camber: axle?.left.camberBodyDeg ?? 0,
      etRef: ref.front.et ?? s.wheels.front.et,
      lateral: d.fitment.fenderLateralFront.value,
      fit: c.fitFront,
    },
    {
      axle: "HA" as const,
      x: -wb,
      zc: ref.rear.staticRadius,
      archR: d.vehicle.stockHeightRear.value ?? 365,
      wc: c.rear?.left.wheelCenter,
      camber: c.rear?.left.camberBodyDeg ?? 0,
      etRef: ref.rear.et ?? s.wheels.rear.et,
      lateral: d.fitment.fenderLateralRear.value,
      fit: c.fitRear,
    },
  ];
  for (const w of defs) {
    const geo = w.fit.wheel.geo;
    if (!w.wc || !geo) continue;
    const hubFaceY = w.wc.y + w.etRef; // Radanlagefläche, fest am Radträger
    const lipTopZ = w.zc + w.archR;
    const lipMeasured = w.lateral !== null;
    const lipY = lipMeasured ? hubFaceY + w.lateral! : m.sideY(w.x, lipTopZ - 20) - VIS.lipRadius;
    const r = geo.tireRadius;
    const sh = outerShoulderTop(geo, w.camber, w.camber).max;
    const tireTop = new THREE.Vector3(w.x, hubFaceY + (geo.shoulder.inner + geo.shoulder.outer) / 2, w.wc.z + r);
    out.push({
      axle: w.axle,
      x: w.x,
      zc: w.zc,
      archR: w.archR,
      lipY,
      lipMeasured,
      tireTop,
      lipTop: new THREE.Vector3(w.x, lipY, lipTopZ),
      shoulderTop: new THREE.Vector3(w.x, hubFaceY + sh, w.wc.z + r - 30),
      gapTop: lipTopZ - (w.wc.z + r),
      gapSide: lipY - (hubFaceY + sh),
    });
  }
  return out;
}
