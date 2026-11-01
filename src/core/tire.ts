// Reifen- und Felgengeometrie (SPEC 7.1).
// Lateral: positive Werte = Richtung Fahrzeugaußen, gemessen ab Radanlagefläche.

export const MM_PER_INCH = 25.4;

export interface TireSize {
  widthMm: number; // Nennbreite, z. B. 225
  aspect: number; // Querschnitt in %, z. B. 40
  rimInch: number; // z. B. 18
}

/** "225/40 R18" → { 225, 40, 18 } */
export function parseTireSize(text: string): TireSize {
  const m = /(\d{3})\s*\/\s*(\d{2})\s*Z?R\s*(\d{2})/i.exec(text);
  if (!m) throw new Error(`Reifengröße nicht lesbar: "${text}"`);
  return { widthMm: Number(m[1]), aspect: Number(m[2]), rimInch: Number(m[3]) };
}

/** Außendurchmesser unbelastet: Zoll·25,4 + 2·Breite·Querschnitt/100 */
export function tireDiameter(t: TireSize): number {
  return t.rimInch * MM_PER_INCH + (2 * t.widthMm * t.aspect) / 100;
}

export function tireRadius(t: TireSize): number {
  return tireDiameter(t) / 2;
}

export function sidewallHeight(t: TireSize): number {
  return (t.widthMm * t.aspect) / 100;
}

/** Default statischer Radius, wenn nichts gemessen ist: r − Einfederung des Reifens. */
export function defaultStaticRadius(t: TireSize, deflection: number): number {
  return tireRadius(t) - deflection;
}

/** Maulweite in mm (zwischen den Hörnern). */
export function rimWidthMm(widthJ: number): number {
  return widthJ * MM_PER_INCH;
}

export interface RimInput {
  widthJ: number;
  et: number; // Einpresstiefe mm
  spacer: number; // Spurplatte je Seite mm
  hornWidth: number; // Hornbreite je Seite mm (Parameter, typ. 6–7)
}

export interface LateralEdges {
  outer: number; // mm ab Radanlagefläche, + = außen
  inner: number;
}

/** Felgenkanten (Maulweite) relativ zur Radanlagefläche. */
export function rimEdges(r: RimInput): LateralEdges {
  const b = rimWidthMm(r.widthJ);
  return {
    outer: b / 2 - r.et + r.spacer,
    inner: -(b / 2 + r.et) + r.spacer,
  };
}

/** Felgenkanten inkl. Horn – das ist, was am Federbein anstößt. */
export function rimEdgesWithHorn(r: RimInput): LateralEdges {
  const e = rimEdges(r);
  return { outer: e.outer + r.hornWidth, inner: e.inner - r.hornWidth };
}

/**
 * Reifenschultern relativ zur Radanlagefläche.
 * Vereinfachung: Schulter steht je Seite um (Reifenbreite − Maulweite)/2 über
 * (negativ = Stretch). `bulgeOverride` ersetzt diesen Überstand, wenn bekannt.
 */
export function tireShoulders(t: TireSize, r: RimInput, bulgeOverride?: number): LateralEdges {
  const e = rimEdges(r);
  const bulge = bulgeOverride ?? (t.widthMm - rimWidthMm(r.widthJ)) / 2;
  return { outer: e.outer + bulge, inner: e.inner - bulge };
}
