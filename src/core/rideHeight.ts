// Fahrzeughöhe ↔ Einfederweg (SPEC 7.2).
// Höhe = Radmitte senkrecht bis Radlaufkante. Die Radlaufkante ist karosseriefest,
// deshalb bestimmt die Höhe direkt die Lage der Radmitte im Karosseriesystem –
// unabhängig vom Reifen.

import { toRad } from "./units";

/** Tieferlegung Δ = h_Serie − h_neu (positiv = tiefer). */
export function lowering(stockHeight: number, newHeight: number): number {
  return stockHeight - newHeight;
}

/** Höhe aus Tieferlegung. */
export function heightFromLowering(stockHeight: number, lowering: number): number {
  return stockHeight - lowering;
}

/**
 * Hub des Rades relativ zur Karosserie, gemessen ab Serienlage (positiv = Rad
 * wandert nach oben). Setzt sich zusammen aus Tieferlegung, dynamischem
 * Ein-/Ausfedern und Wanken.
 */
export function wheelTravel(params: {
  lowering: number;
  bump?: number; // + = einfedern, − = ausfedern
  rollDeg?: number; // Wankwinkel der Karosserie
  track?: number; // Spurweite der Achse, nötig bei rollDeg ≠ 0
  outer?: boolean; // kurvenäußeres Rad federt beim Wanken ein
}): number {
  const { lowering, bump = 0, rollDeg = 0, track = 0, outer = true } = params;
  const rollTravel = (track / 2) * Math.tan(toRad(rollDeg));
  return lowering + bump + (outer ? rollTravel : -rollTravel);
}

/**
 * Sturz zur Fahrbahn aus Sturz zur Karosserie. Beim Wanken kippt die Karosserie
 * nach außen; das kurvenäußere Rad verliert dadurch negativen Sturz.
 */
export function camberToRoad(camberBodyDeg: number, rollDeg: number, outer: boolean): number {
  return camberBodyDeg + (outer ? rollDeg : -rollDeg);
}
