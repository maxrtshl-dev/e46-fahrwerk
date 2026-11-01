// Vorderachse McPherson, ebenes Modell in der Frontansicht (SPEC 7.3).
//
// Koordinaten im Karosseriesystem: y = Abstand zur Fahrzeugmitte (nach außen),
// z = Höhe; z = 0 ist die Fahrbahn in Serienlage. Betrachtet wird ein Rad.
//
// Modell:
//  - Querlenker A→B dreht um den inneren Lagerpunkt A.
//  - Radträger = starrer Körper, fest verbunden mit dem Federbeinrohr. Seine Lage
//    ist bestimmt durch das Traggelenk B und die Richtung B→Domlager T.
//  - Radmitte ist im Radträger fest; ihre Lage wird aus der Serienlage übernommen.
//  - Zu einem Radhub wird der Querlenkerwinkel per Bisektion gelöst.
//  - Momentanpol: Querlenker-Gerade ∩ Senkrechte zur Federbeinachse durch T.
//  - Rollzentrum: Gerade Radaufstandspunkt→Momentanpol ∩ Fahrzeugmitte (y = 0).
//
// Bewusst NICHT modelliert: Spuränderung (Bump Steer) – dafür fehlen die
// Spurstangenpunkte. Statt einer erfundenen Zahl liefert das Modell `null`.

import type { E46Data } from "./data";
import { req } from "./data";
import { parseDegMin, toDeg, toRad } from "./units";

export interface Vec2 {
  y: number;
  z: number;
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec2, b: Vec2): Vec2 => ({ y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec2, s: number): Vec2 => ({ y: a.y * s, z: a.z * s });
const len = (a: Vec2): number => Math.hypot(a.y, a.z);
const unit = (a: Vec2): Vec2 => scale(a, 1 / len(a));
const dot = (a: Vec2, b: Vec2): number => a.y * b.y + a.z * b.z;
/** um −90° gedreht: aus der Federbeinachse (nach oben) wird die Richtung nach außen. */
const perp = (a: Vec2): Vec2 => ({ y: a.z, z: -a.y });

/** Schnittpunkt zweier Geraden (Punkt + Richtung); null wenn (fast) parallel. */
export function intersect(p: Vec2, d: Vec2, q: Vec2, e: Vec2): Vec2 | null {
  const det = d.y * -e.z - d.z * -e.y;
  if (Math.abs(det) < 1e-9) return null;
  const r = sub(q, p);
  const s = (r.y * -e.z - r.z * -e.y) / det;
  return add(p, scale(d, s));
}

export interface FrontGeometry {
  lowerArmInner: Vec2;
  lowerArmOuter: Vec2; // Serienlage
  strutTop: Vec2;
  wheelCenter: Vec2; // Serienlage
  stockCamberDeg: number; // Sturz in Serienlage (BMW-Sollwert)
  referenceStaticRadius: number; // r_stat, mit dem die z-Werte der Anlenkpunkte gelten
}

/**
 * Seitliche Lage der Radebene des Referenzrads (wheels.current) ab Fahrzeugmitte:
 * Radanlagefläche = Spurweite/2 + ET des Rads, mit dem die Spurweite gilt;
 * Radebene = Radanlagefläche − ET des Referenzrads.
 */
export function wheelPlaneY(data: E46Data, axle: "front" | "rear"): number {
  const track = req(axle === "front" ? data.vehicle.trackFront : data.vehicle.trackRear, "Spurweite");
  const etTrack = data.vehicle.trackReferenceEt?.value ?? null;
  const w = data.wheels.current[axle];
  if (etTrack === null || w.et === null) return track / 2;
  return track / 2 + etTrack - w.et;
}

/**
 * Geometrie aus den Daten. Annahme: die Höhen der Anlenkpunkte gelten mit dem
 * aktuell eingetragenen Rad (statischer Radius) in Serienhöhe; die Radmitte liegt
 * in der Radebene des Referenzrads (`wheelPlaneY`).
 */
export function frontGeometryFromData(data: E46Data): FrontGeometry {
  const hp = data.frontHardpoints;
  const r = data.wheels.current.front.staticRadius;
  return {
    lowerArmInner: { y: req(hp.lowerArmInner.y), z: req(hp.lowerArmInner.z) },
    lowerArmOuter: { y: req(hp.lowerArmOuter.y), z: req(hp.lowerArmOuter.z) },
    strutTop: { y: req(hp.strutTop.y), z: req(hp.strutTop.z) },
    wheelCenter: { y: wheelPlaneY(data, "front"), z: r },
    stockCamberDeg: parseDegMin(data.factoryAlignment.front.camber).value,
    referenceStaticRadius: r,
  };
}

export interface FrontInput {
  /** Radhub relativ zur Karosserie ab Serienlage, + = nach oben (Tieferlegung + Einfedern). */
  travel: number;
  /** Domlager nach innen versetzt (Sturzkorrektur), mm. */
  strutTopShiftInward?: number;
  /** Statischer Radius des montierten Rads; Default = Referenzradius. */
  staticRadius?: number;
}

export interface FrontResult {
  lowerArmInner: Vec2;
  lowerArmOuter: Vec2;
  strutTop: Vec2;
  wheelCenter: Vec2;
  contactPoint: Vec2;
  groundZ: number; // Fahrbahn im Karosseriesystem
  instantCenter: Vec2 | null; // null = Momentanpol im Unendlichen
  /** Rollzentrumshöhe über Fahrbahn, mm. null wenn nicht definiert. */
  rollCenterHeight: number | null;
  /** Querlenkerwinkel, + = Traggelenk höher als inneres Lager. */
  lowerArmAngleDeg: number;
  /** Spreizung der Federbeinachse gegen die Senkrechte, + = oben innen. */
  strutInclinationDeg: number;
  camberBodyDeg: number;
  /** Änderung der halben Spurweite am Aufstandspunkt ggü. Serie, mm. */
  halfTrackChange: number;
  /** Spuränderung – nicht modelliert (Spurstangenpunkte fehlen). */
  toeChangeDeg: null;
}

const strutInclination = (b: Vec2, t: Vec2): number => toDeg(Math.atan2(b.y - t.y, t.z - b.z));

export function solveFront(g: FrontGeometry, input: FrontInput): FrontResult {
  const A = g.lowerArmInner;
  const B0 = g.lowerArmOuter;
  const T0 = g.strutTop;
  const T: Vec2 = { y: T0.y - (input.strutTopShiftInward ?? 0), z: T0.z };
  const r = input.staticRadius ?? g.referenceStaticRadius;

  // Radmitte im Radträgersystem (Ursprung B, Achsen: perp(u) nach außen, u nach oben)
  const u0 = unit(sub(T0, B0));
  const wcRel = sub(g.wheelCenter, B0);
  const local = { out: dot(wcRel, perp(u0)), up: dot(wcRel, u0) };

  const L = len(sub(B0, A));
  const theta0 = Math.atan2(B0.z - A.z, B0.y - A.y);

  const pose = (theta: number) => {
    const B = { y: A.y + L * Math.cos(theta), z: A.z + L * Math.sin(theta) };
    const u = unit(sub(T, B));
    const wc = add(B, add(scale(perp(u), local.out), scale(u, local.up)));
    return { B, u, wc };
  };

  // Bisektion auf die Höhe der Radmitte
  const target = g.wheelCenter.z + input.travel;
  let lo = theta0 - toRad(45);
  let hi = theta0 + toRad(45);
  const f = (th: number) => pose(th).wc.z - target;
  if (f(lo) > 0 || f(hi) < 0) {
    throw new Error(`Radhub ${input.travel.toFixed(1)} mm liegt außerhalb des Modellbereichs`);
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  const { B, u, wc } = pose((lo + hi) / 2);

  const groundZ = wc.z - r;
  const contact: Vec2 = { y: wc.y, z: groundZ };

  const ic = intersect(A, sub(B, A), T, perp(u));
  let rollCenterHeight: number | null = null;
  if (ic) {
    const d = sub(ic, contact);
    if (Math.abs(d.y) > 1e-9) {
      const zAtCenter = contact.z + d.z * ((0 - contact.y) / d.y);
      rollCenterHeight = zAtCenter - groundZ;
    }
  } else {
    // Momentanpol im Unendlichen: Polstrahl parallel zum Querlenker
    const d = sub(B, A);
    rollCenterHeight = d.z * ((0 - contact.y) / d.y);
  }

  const incl = strutInclination(B, T);
  const incl0 = strutInclination(B0, T0);

  return {
    lowerArmInner: A,
    lowerArmOuter: B,
    strutTop: T,
    wheelCenter: wc,
    contactPoint: contact,
    groundZ,
    instantCenter: ic,
    rollCenterHeight,
    lowerArmAngleDeg: toDeg(Math.atan2(B.z - A.z, B.y - A.y)),
    strutInclinationDeg: incl,
    camberBodyDeg: g.stockCamberDeg - (incl - incl0),
    halfTrackChange: contact.y - g.wheelCenter.y,
    toeChangeDeg: null,
  };
}

/** Domversatz in mm für eine gewünschte Sturzkorrektur in Grad (Serienlage). */
export function strutTopShiftForCamber(g: FrontGeometry, camberDeltaDeg: number): number {
  const strutLen = len(sub(g.strutTop, g.lowerArmOuter));
  return strutLen * Math.tan(toRad(Math.abs(camberDeltaDeg)));
}
