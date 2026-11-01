// Anzeige nur so genau, wie die Eingangsdaten es hergeben (SPEC 1, 11).

import type { Confidence } from "./data";
import { isApprox } from "./data";
import { formatDegMin } from "./units";

/** Rasterweite für Längen je Belastbarkeit, mm. */
const MM_STEP: Record<Confidence, number> = {
  gemessen: 1,
  belegt: 1,
  gerechnet: 1,
  "geschätzt": 5,
  Annahme: 10,
};

/** Rasterweite für Winkel je Belastbarkeit, Minuten. */
const MIN_STEP: Record<Confidence, number> = {
  gemessen: 1,
  belegt: 1,
  gerechnet: 1,
  "geschätzt": 5,
  Annahme: 10,
};

const roundTo = (v: number, step: number) => Math.round(v / step) * step;
const prefix = (c: Confidence) => (isApprox(c) ? "≈ " : "");
const minus = (s: string) => s.replace(/^-/, "−");

export function fmtMm(v: number | null, c: Confidence, signed = false): string {
  if (v === null || !Number.isFinite(v)) return "–";
  const r = roundTo(v, MM_STEP[c]) || 0;
  const s = signed && r > 0 ? `+${r}` : String(r);
  return `${prefix(c)}${minus(s)} mm`;
}

export function fmtDeg(v: number | null, c: Confidence): string {
  if (v === null || !Number.isFinite(v)) return "–";
  const step = MIN_STEP[c] / 60;
  return `${prefix(c)}${formatDegMin(roundTo(v, step))}`;
}

/** Dezimalgrad, für Winkel ohne Werkstattbezug (Querlenker). */
export function fmtDegDec(v: number | null, c: Confidence): string {
  if (v === null || !Number.isFinite(v)) return "–";
  const step = isApprox(c) ? 0.5 : 0.1;
  const r = roundTo(v, step) || 0;
  return `${prefix(c)}${minus(r.toFixed(1).replace(".", ","))}°`;
}
