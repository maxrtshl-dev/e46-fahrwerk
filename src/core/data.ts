// Datenmodell von e46_data.json. Jeder Zahlenwert trägt Quelle und Belastbarkeit.

export type Unit = "mm" | "deg" | "N/mm" | "inch" | "-";
export type Confidence = "belegt" | "gerechnet" | "geschätzt" | "Annahme" | "gemessen";

export interface Val {
  value: number | null;
  unit: Unit;
  source: string;
  confidence: Confidence;
  note?: string;
}

export interface PointVal {
  y: Val;
  z: Val;
}

export interface WheelSpec {
  diameterInch: number;
  widthJ: number | null;
  et: number | null;
  spacer: number;
  tire: string;
  staticRadius: number;
}

export interface Preset {
  name: string;
  front: number | null;
  rear: number | null;
}

export interface E46Data {
  meta: Record<string, string>;
  limits: {
    minHeightFront: Val;
    minHeightRear: Val;
    perchRangeFrontMin: Val;
    perchRangeFrontMax: Val;
    perchRangeRearMin: Val;
    perchRangeRearMax: Val;
    minGroundClearance: Val;
    bumpStopHeightFront: Val;
  };
  vehicle: {
    trackFront: Val;
    trackRear: Val;
    stockHeightFront: Val;
    stockHeightRear: Val;
    currentHeightFront: Val;
    currentHeightRear: Val;
    springRateFront: Val;
    springSettleRear: Val;
    wheelbase: Val;
  };
  rearEquivalent: {
    note: string;
    lowerInner: PointVal;
    lowerOuter: PointVal;
    upperInner: PointVal;
    upperOuter: PointVal;
  };
  frontHardpoints: {
    note: string;
    lowerArmInner: PointVal;
    lowerArmOuter: PointVal;
    strutTop: PointVal;
    maxCamberOffsetAtTop: Val;
  };
  calibration: {
    rollCenterFrontStock: Val;
    rollCenterFrontGradient: Val;
    rollCenterFrontCheck: {
      loweringMm: number;
      expectedMin: number;
      expectedMax: number;
      source: string;
      confidence: Confidence;
    };
    rollCenterRearStock: Val;
    rollCenterRearGradientMin: Val;
    rollCenterRearGradientMax: Val;
    camberGainRearMin: Val;
    camberGainRearMax: Val;
  };
  factoryAlignment: {
    source: string;
    front: { camber: string; toeTotal: string; caster: string };
    rear: { camber: string; toeTotal: string };
  };
  presets: Preset[];
  wheels: {
    current: { name?: string; front: WheelSpec; rear: WheelSpec; note?: string };
  };
  fitment: {
    note: string;
    fenderLateralFront: Val;
    fenderLateralRear: Val;
    innerStrutFront: Val;
    innerPerchFront: Val;
    innerRear: Val;
    bumpTravelFront: Val;
    bumpTravelRear: Val;
  };
  measurementsTodo: string[];
}

/** Wert, der zwingend vorhanden sein muss – sonst klarer Fehler statt NaN. */
export function req(v: Val, name = "Wert"): number {
  if (v.value === null || !Number.isFinite(v.value)) {
    throw new Error(`${name} fehlt (${v.note ?? "keine Angabe"})`);
  }
  return v.value;
}

/** Geschätzte, gerechnete und angenommene Werte werden in der UI mit „≈“ markiert. */
export function isApprox(c: Confidence): boolean {
  return c !== "belegt" && c !== "gemessen";
}

/** Schwächste Belastbarkeit einer Menge von Eingangswerten – bestimmt die Anzeige des Ergebnisses. */
const RANK: Record<Confidence, number> = {
  gemessen: 4,
  belegt: 3,
  gerechnet: 2,
  "geschätzt": 1,
  Annahme: 0,
};
export function weakest(...cs: Confidence[]): Confidence {
  return cs.reduce((a, b) => (RANK[b] < RANK[a] ? b : a), "gemessen" as Confidence);
}

/**
 * Überschreibungen (z. B. Messwerte aus dem DataEditor) per Pfad, etwa
 * "vehicle.currentHeightRear" oder "frontHardpoints.strutTop.y".
 * Ein bestehender Messwert wird nur durch einen anderen Messwert ersetzt.
 */
export type Overrides = Record<string, Val>;

export function applyOverrides(data: E46Data, overrides: Overrides): E46Data {
  const out: E46Data = structuredClone(data);
  for (const [path, val] of Object.entries(overrides)) {
    const keys = path.split(".");
    const last = keys.pop();
    if (!last) continue;
    let node: Record<string, unknown> = out as unknown as Record<string, unknown>;
    for (const k of keys) {
      const next = node[k];
      if (typeof next !== "object" || next === null) {
        throw new Error(`Unbekannter Pfad: ${path}`);
      }
      node = next as Record<string, unknown>;
    }
    const current = node[last] as Val | undefined;
    if (current === undefined || typeof current !== "object" || !("confidence" in current)) {
      throw new Error(`Unbekannter Pfad: ${path}`);
    }
    if (current.confidence === "gemessen" && val.confidence !== "gemessen") continue;
    node[last] = { ...val };
  }
  return out;
}
