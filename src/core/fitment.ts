// Radhaus-Freigang (SPEC 7.5), je Rad in der Frontansicht.
//
// Lokales System des Rads: lateral ab Radanlagefläche (+ = außen), vertikal ab Radmitte.
// Radlaufkante v1: Kreis um die Radmitte in Serienlage mit Radius = Serienhöhe.
// Wandert das Rad um den Hub nach oben, ist der kleinste Abstand Radmitte → Kante
// genau die aktuelle Höhe h (oben, senkrecht über der Radmitte).
//
// Vereinfachungen (dokumentiert):
//  - Oben zählt der unbelastete Reifenradius (Lauffläche oben ist nicht eingedrückt).
//  - Sturz kippt das Rad um die Radmitte; die Schulter oben wandert um r·sin(Sturz).
//  - VA: Federbein und Federteller sind starr mit dem Radträger – Sturz und Einfedern
//    ändern den Innenfreigang nicht. Lenkeinschlag folgt in v2.
//  - HA: Innenfreigang ohne Sturzeinfluss.

import { CLEARANCE_GREEN_ABOVE, CLEARANCE_RED_BELOW } from "./thresholds";
import type { Ampel } from "./legal";
import { rimEdgesWithHorn, tireRadius, tireShoulders, type LateralEdges, type RimInput, type TireSize } from "./tire";
import { toRad } from "./units";

export interface Clearance {
  id: string;
  label: string;
  /** Luft in mm, + = frei, − = Überdeckung/Kollision. null = nicht berechenbar. */
  value: number | null;
  status: Ampel;
  note: string;
}

export function ampel(gap: number | null): Ampel {
  if (gap === null) return "unbekannt";
  if (gap < CLEARANCE_RED_BELOW) return "rot";
  if (gap <= CLEARANCE_GREEN_ABOVE) return "gelb";
  return "gruen";
}

export interface WheelGeometry {
  tireRadius: number; // unbelastet
  rim: LateralEdges; // inkl. Horn
  shoulder: LateralEdges;
}

export function wheelGeometry(tire: TireSize, rim: RimInput): WheelGeometry {
  return { tireRadius: tireRadius(tire), rim: rimEdgesWithHorn(rim), shoulder: tireShoulders(tire, rim) };
}

export interface LoadCase {
  name: string;
  /** Höhe Radmitte → Radlaufkante in diesem Lastfall, mm. */
  height: number;
  /** Sturz zur Karosserie als Band [min, max] in Grad (VA: min = max). */
  camberMin: number;
  camberMax: number;
}

export interface FitmentInput {
  axle: "VA" | "HA";
  wheel: WheelGeometry;
  load: LoadCase;
  fenderLateral: number | null;
  /** VA: Radanlagefläche → Federbein (gegen Felgenhorn). HA: → Dämpfer/Lenker. */
  innerA: number | null;
  /** VA: Radanlagefläche → Federteller (gegen Reifenschulter). HA: ungenutzt. */
  innerB: number | null;
}

/** Laterale Lage der äußeren Schulter oben, Band über den Sturz. */
export function outerShoulderTop(w: WheelGeometry, camberMin: number, camberMax: number): { min: number; max: number } {
  const at = (c: number) => w.shoulder.outer + w.tireRadius * Math.sin(toRad(c));
  return { min: at(camberMin), max: at(camberMax) };
}

const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");

export function checkFitment(f: FitmentInput): Clearance[] {
  const { wheel: w, load } = f;
  const out: Clearance[] = [];

  const top = load.height - w.tireRadius;
  const sh = outerShoulderTop(w, load.camberMin, load.camberMax);
  // ungünstigster Sturz = am wenigsten negativ
  const lateral = f.fenderLateral === null ? null : f.fenderLateral - sh.max;

  let topStatus = ampel(top);
  let topNote = "senkrecht Lauffläche → Radlaufkante";
  if (top < CLEARANCE_RED_BELOW) {
    if (lateral !== null && lateral >= CLEARANCE_RED_BELOW) {
      // Schulter liegt innerhalb der Kante: der Reifen taucht ins Radhaus ein
      topStatus = "gelb";
      topNote =
        top < 0
          ? `Reifen taucht ${r1(-top)} mm ins Radhaus ein, Kante seitlich frei – Radhausschale prüfen`
          : "knapp unter der Kante, Kante seitlich frei – Radhausschale prüfen";
    } else if (lateral !== null) {
      topNote = "Schulter liegt unter der Kante – Kollision";
    } else {
      topNote = "Lauffläche erreicht die Kantenhöhe – Kollision, falls die Schulter unter der Kante liegt (seitliche Lage messen)";
    }
  }
  out.push({ id: "oben", label: "Radlauf oben", value: top, status: topStatus, note: topNote });

  if (lateral === null) {
    out.push({
      id: "aussen",
      label: "Radlauf außen",
      value: null,
      status: "unbekannt",
      note: `Schulter oben bei ${r1(sh.max)} mm ab Radanlagefläche – Radlaufkante seitlich messen`,
    });
  } else {
    out.push({
      id: "aussen",
      label: "Radlauf außen",
      value: lateral,
      status: ampel(lateral),
      note: lateral < 0 ? "Schulter steht über die Kante hinaus" : "seitlich Schulter → Kante, ungünstigster Sturz",
    });
  }

  if (f.axle === "VA") {
    out.push(innerCheck("federbein", "Felge → Federbein", f.innerA, -w.rim.inner, "Felgenhorn innen"));
    out.push(innerCheck("teller", "Reifen → Federteller", f.innerB, -w.shoulder.inner, "Reifenschulter innen"));
  } else {
    const worst = Math.max(-w.rim.inner, -w.shoulder.inner);
    out.push(innerCheck("innen", "Rad → Dämpfer/Lenker", f.innerA, worst, "weiter innen liegende Kante"));
  }
  return out;
}

function innerCheck(id: string, label: string, measured: number | null, edgeInward: number, edgeName: string): Clearance {
  if (measured === null) {
    return { id, label, value: null, status: "unbekannt", note: `${edgeName} ${r1(edgeInward)} mm innen – Abstand messen` };
  }
  const gap = measured - edgeInward;
  return { id, label, value: gap, status: ampel(gap), note: `${edgeName} ${r1(edgeInward)} mm innen, gemessen ${measured} mm` };
}

export function worst(cs: Clearance[]): Ampel {
  if (cs.some((c) => c.status === "rot")) return "rot";
  if (cs.some((c) => c.status === "gelb")) return "gelb";
  if (cs.some((c) => c.status === "gruen")) return "gruen";
  return "unbekannt";
}
