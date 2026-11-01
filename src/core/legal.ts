// Grenzwerte aus dem Teilegutachten DTS 14-TAAS-0183/1K (SPEC 7.6).
// Ersetzt keine Abnahme – liefert nur eine Ampel gegen die eingetragenen Grenzen.

import type { E46Data } from "./data";
import { req } from "./data";
import { LEGAL_MARGIN_WARN } from "./thresholds";

export type Ampel = "gruen" | "gelb" | "rot" | "unbekannt";

export interface Check {
  id: string;
  label: string;
  status: Ampel;
  /** Reserve zur Grenze in mm (positiv = Luft), wenn berechenbar. */
  margin: number | null;
  text: string;
}

function minCheck(id: string, label: string, value: number | null, min: number): Check {
  if (value === null) {
    return { id, label, status: "unbekannt", margin: null, text: `${label}: kein Wert – messen (Grenze ${min} mm)` };
  }
  const margin = value - min;
  const status: Ampel = margin < 0 ? "rot" : margin < LEGAL_MARGIN_WARN ? "gelb" : "gruen";
  const text =
    margin < 0
      ? `${label} ${value} mm liegt ${-margin} mm unter der Grenze ${min} mm`
      : `${label} ${value} mm, ${margin} mm über der Grenze ${min} mm`;
  return { id, label, status, margin, text };
}

function rangeCheck(id: string, label: string, value: number | null, min: number, max: number): Check {
  if (value === null) {
    return { id, label, status: "unbekannt", margin: null, text: `${label}: nicht angegeben (zulässig ${min}–${max} mm)` };
  }
  const margin = Math.min(value - min, max - value);
  const status: Ampel = margin < 0 ? "rot" : margin < LEGAL_MARGIN_WARN ? "gelb" : "gruen";
  return {
    id,
    label,
    status,
    margin,
    text: margin < 0 ? `${label} ${value} mm außerhalb ${min}–${max} mm` : `${label} ${value} mm innerhalb ${min}–${max} mm`,
  };
}

export interface LegalInput {
  heightFront: number | null;
  heightRear: number | null;
  perchFront?: number | null;
  perchRear?: number | null;
  /** Gemessene Bodenfreiheit beladen, mm. */
  groundClearanceLoaded?: number | null;
}

export function checkLegal(data: E46Data, input: LegalInput): Check[] {
  const l = data.limits;
  const checks: Check[] = [
    minCheck("hoeheVA", "Höhe VA", input.heightFront, req(l.minHeightFront)),
    minCheck("hoeheHA", "Höhe HA", input.heightRear, req(l.minHeightRear)),
  ];
  if (input.perchFront !== undefined) {
    checks.push(rangeCheck("tellerVA", "Federteller VA", input.perchFront, req(l.perchRangeFrontMin), req(l.perchRangeFrontMax)));
  }
  if (input.perchRear !== undefined) {
    checks.push(rangeCheck("tellerHA", "Federteller HA", input.perchRear, req(l.perchRangeRearMin), req(l.perchRangeRearMax)));
  }
  const gc = minCheck("boden", "Bodenfreiheit beladen", input.groundClearanceLoaded ?? null, req(l.minGroundClearance));
  if (gc.status === "unbekannt") {
    gc.text = `Bodenfreiheit beladen ≥ ${req(l.minGroundClearance)} mm – nicht berechenbar, an tiefster Stelle messen`;
  }
  checks.push(gc);
  checks.push({
    id: "rad",
    label: "Rad/Reifen",
    status: "unbekannt",
    margin: null,
    text: `Kombination muss im Gutachten der Felge mit Typ ${data.meta.type ?? "346C"} stehen – keine automatische Prüfung`,
  });
  return checks;
}

/** Gesamtstatus: schlechtester bekannter Einzelstatus. */
export function overall(checks: Check[]): Ampel {
  if (checks.some((c) => c.status === "rot")) return "rot";
  if (checks.some((c) => c.status === "gelb")) return "gelb";
  if (checks.some((c) => c.status === "gruen")) return "gruen";
  return "unbekannt";
}
