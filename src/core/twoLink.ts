// Ebenes Doppellenker-Ersatzmodell (Frontansicht): unterer und oberer Lenker,
// Radträger als starre Koppel zwischen den äußeren Gelenken (SPEC 7.4, v1).
// Gleiche Konventionen wie frontMcPherson: y nach außen, z = Höhe, z = 0 Fahrbahn in Serienlage.

import { intersect, type Vec2 } from "./frontMcPherson";
import { toDeg, toRad } from "./units";

export interface TwoLinkGeometry {
  lowerInner: Vec2;
  lowerOuter: Vec2;
  upperInner: Vec2;
  upperOuter: Vec2;
  wheelCenter: Vec2;
  stockCamberDeg: number;
  referenceStaticRadius: number;
}

export interface TwoLinkInput {
  travel: number; // Radhub ab Serienlage, + = nach oben
  camberOffsetDeg?: number; // Exzenter: zusätzlicher Sturz, + = positiver
  staticRadius?: number;
}

export interface TwoLinkResult {
  lowerInner: Vec2;
  lowerOuter: Vec2;
  upperInner: Vec2;
  upperOuter: Vec2;
  wheelCenter: Vec2;
  contactPoint: Vec2;
  groundZ: number;
  instantCenter: Vec2 | null;
  rollCenterHeight: number | null;
  camberBodyDeg: number;
  halfTrackChange: number;
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec2, b: Vec2): Vec2 => ({ y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec2, s: number): Vec2 => ({ y: a.y * s, z: a.z * s });
const len = (a: Vec2) => Math.hypot(a.y, a.z);
const unit = (a: Vec2) => scale(a, 1 / len(a));
const dot = (a: Vec2, b: Vec2) => a.y * b.y + a.z * b.z;
const perp = (a: Vec2): Vec2 => ({ y: a.z, z: -a.y });

/** Schnitt zweier Kreise; liefert den Punkt, der `near` am nächsten liegt. */
function circleCircle(c1: Vec2, r1: number, c2: Vec2, r2: number, near: Vec2): Vec2 | null {
  const d = len(sub(c2, c1));
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const u = unit(sub(c2, c1));
  const m = add(c1, scale(u, a));
  const p1 = add(m, scale(perp(u), h));
  const p2 = add(m, scale(perp(u), -h));
  return len(sub(p1, near)) < len(sub(p2, near)) ? p1 : p2;
}

const inclination = (lo: Vec2, up: Vec2) => toDeg(Math.atan2(lo.y - up.y, up.z - lo.z));

export function solveTwoLink(g: TwoLinkGeometry, input: TwoLinkInput): TwoLinkResult {
  const Li = g.lowerInner;
  const Ui = g.upperInner;
  const Lo0 = g.lowerOuter;
  const Uo0 = g.upperOuter;
  const rL = len(sub(Lo0, Li));
  const rU = len(sub(Uo0, Ui));
  const rK = len(sub(Uo0, Lo0));
  const k0 = unit(sub(Uo0, Lo0));
  const wcRel = sub(g.wheelCenter, Lo0);
  const local = { out: dot(wcRel, perp(k0)), up: dot(wcRel, k0) };
  const theta0 = Math.atan2(Lo0.z - Li.z, Lo0.y - Li.y);
  const r = input.staticRadius ?? g.referenceStaticRadius;

  const pose = (theta: number) => {
    const Lo = { y: Li.y + rL * Math.cos(theta), z: Li.z + rL * Math.sin(theta) };
    const Uo = circleCircle(Ui, rU, Lo, rK, Uo0);
    if (!Uo) return null;
    const k = unit(sub(Uo, Lo));
    const wc = add(Lo, add(scale(perp(k), local.out), scale(k, local.up)));
    return { Lo, Uo, wc };
  };

  const target = g.wheelCenter.z + input.travel;
  let lo = theta0 - toRad(22);
  let hi = theta0 + toRad(22);
  const f = (th: number) => {
    const p = pose(th);
    return p ? p.wc.z - target : NaN;
  };
  const flo = f(lo);
  const fhi = f(hi);
  if (!(flo <= 0) || !(fhi >= 0)) {
    throw new Error(`Radhub HA ${input.travel.toFixed(1)} mm liegt außerhalb des Modellbereichs`);
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Number.isNaN(fm)) throw new Error("Lenkergeometrie HA nicht lösbar");
    if (fm < 0) lo = mid;
    else hi = mid;
  }
  const p = pose((lo + hi) / 2)!;
  const groundZ = p.wc.z - r;
  const contact = { y: p.wc.y, z: groundZ };
  const ic = intersect(Li, sub(p.Lo, Li), Ui, sub(p.Uo, Ui));
  let rc: number | null = null;
  const ray = ic ? sub(ic, contact) : sub(p.Lo, Li);
  if (Math.abs(ray.y) > 1e-9) rc = contact.z + ray.z * ((0 - contact.y) / ray.y) - groundZ;

  return {
    lowerInner: Li,
    lowerOuter: p.Lo,
    upperInner: Ui,
    upperOuter: p.Uo,
    wheelCenter: p.wc,
    contactPoint: contact,
    groundZ,
    instantCenter: ic,
    rollCenterHeight: rc,
    camberBodyDeg: g.stockCamberDeg - (inclination(p.Lo, p.Uo) - inclination(Lo0, Uo0)) + (input.camberOffsetDeg ?? 0),
    halfTrackChange: contact.y - g.wheelCenter.y,
  };
}
