// Einheiten und Werkstattformat (Grad/Minuten).
// Winkel intern immer Grad dezimal; Längen immer mm.

export const DEG = Math.PI / 180;

export const toRad = (deg: number): number => deg * DEG;
export const toDeg = (rad: number): number => rad / DEG;

/** −0.3333 → "−0°20′". Gerundet auf ganze Minuten, echtes Minuszeichen. */
export function formatDegMin(deg: number): string {
  const totalMin = Math.round(Math.abs(deg) * 60);
  const sign = deg < 0 && totalMin !== 0 ? "−" : "";
  const d = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${sign}${d}°${String(m).padStart(2, "0")}′`;
}

export interface DegMinValue {
  value: number; // Grad dezimal
  tolerance: number | null; // Grad dezimal, symmetrisch
}

/**
 * Liest Werkstattangaben wie "-1°30' ±15'", "0°14′ ±8′", "5°26'".
 * Akzeptiert ' und ′ sowie - und − als Minus.
 */
export function parseDegMin(text: string): DegMinValue {
  const norm = text.replace(/−/g, "-").replace(/′/g, "'").trim();
  const main = /^([+-]?)(\d+)°(?:\s*(\d+(?:\.\d+)?)')?/.exec(norm);
  if (!main) throw new Error(`Kein Winkel in Grad/Minuten: "${text}"`);
  const sign = main[1] === "-" ? -1 : 1;
  const value = sign * (Number(main[2]) + Number(main[3] ?? 0) / 60);

  let tolerance: number | null = null;
  const tol = /±\s*(?:(\d+)°)?\s*(?:(\d+(?:\.\d+)?)')?/.exec(norm);
  if (tol && (tol[1] !== undefined || tol[2] !== undefined)) {
    tolerance = Number(tol[1] ?? 0) + Number(tol[2] ?? 0) / 60;
  }
  return { value, tolerance };
}
