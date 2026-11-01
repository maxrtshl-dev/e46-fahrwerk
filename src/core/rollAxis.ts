// Rollachse: Gerade durch die Rollzentren VA und HA in der Seitenansicht.

import { toDeg } from "./units";

export interface RollAxis {
  front: number; // RZ-Höhe VA über Fahrbahn, mm
  rear: number; // RZ-Höhe HA über Fahrbahn, mm
  /** Neigung, + = steigt nach hinten an. */
  inclinationDeg: number;
  /** Höhe der Rollachse an einer Stelle x hinter der Vorderachse. */
  heightAt: (xBehindFront: number) => number;
}

export function rollAxis(rcFront: number, rcRear: number, wheelbase: number): RollAxis {
  return {
    front: rcFront,
    rear: rcRear,
    inclinationDeg: toDeg(Math.atan2(rcRear - rcFront, wheelbase)),
    heightAt: (x) => rcFront + ((rcRear - rcFront) * x) / wheelbase,
  };
}
