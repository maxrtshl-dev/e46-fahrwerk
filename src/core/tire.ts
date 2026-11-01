// Reifen- und Felgengeometrie (SPEC 7.1).
// Lateral: positive Werte = Richtung Fahrzeugaußen, gemessen ab Radanlagefläche.

export const MM_PER_INCH = 25.4;

/** Hornhöhe J-Kontur (ETRTO), mm – Norm, keine Fahrzeugangabe. */
export const RIM_FLANGE_HEIGHT_J = 17.5;

/**
 * Messfelge nach ETRTO-Faustregel (Breite in Zoll, auf 0,5" gerundet):
 * ≈ 0,80 × Nennbreite ab Querschnitt 55, 0,85 bei 45–50, 0,89 bis 40.
 * Trifft 205/55→6,5, 225/45→7,5, 225/40→8, 245/40→8,5, 255/35→9.
 */
export function measuringRimJ(t: TireSize): number {
  const k = t.aspect >= 55 ? 0.8 : t.aspect >= 45 ? 0.85 : 0.89;
  return Math.round(((t.widthMm * k) / MM_PER_INCH) * 2) / 2;
}

/**
 * Querschnittsbreite auf der tatsächlichen Felge: Nennbreite gilt auf der Messfelge,
 * je Zoll Felgenbreite ändert sie sich um ≈ 40 % (ETRTO-Faustregel).
 */
export function sectionWidthOnRim(t: TireSize, widthJ: number): number {
  return t.widthMm + 0.4 * (widthJ - measuringRimJ(t)) * MM_PER_INCH;
}

/**
 * BMW misst die Fahrzeughöhe vom Felgenhorn unten bis zur Radlaufkante.
 * Umrechnung auf „Radmitte → Radlaufkante“ (SPEC 4).
 */
export function bmwHeightToCenter(bmwMm: number, rimInch: number): number {
  return bmwMm - (rimInch * MM_PER_INCH) / 2 - RIM_FLANGE_HEIGHT_J;
}

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
 * Reifenflanken (größte Breite) relativ zur Radanlagefläche – konservativ für den Freigang.
 * Überstand je Seite = (Querschnittsbreite auf dieser Felge − Maulweite)/2, negativ = Stretch.
 * `bulgeOverride` ersetzt den Überstand, wenn gemessen.
 */
export function tireShoulders(t: TireSize, r: RimInput, bulgeOverride?: number): LateralEdges {
  const e = rimEdges(r);
  const bulge = bulgeOverride ?? (sectionWidthOnRim(t, r.widthJ) - rimWidthMm(r.widthJ)) / 2;
  return { outer: e.outer + bulge, inner: e.inner - bulge };
}

/**
 * Seitliche Verschiebung der Felgenmitte gegenüber dem Referenzrad, + = nach außen.
 * Weniger ET oder Spurplatte schieben das Rad nach außen.
 */
export function wheelLateralShift(etRef: number, et: number, spacer: number): number {
  return etRef - et + spacer;
}
