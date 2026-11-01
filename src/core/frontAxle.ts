// Ganze Vorderachse in der Frontansicht: linkes und rechtes Rad, Wanken,
// Rollzentrum als Schnitt der beiden Polstrahlen (SPEC 7.3, 8).
//
// Karosseriesystem nach ISO 8855: y nach links. Das linke Rad wird direkt
// gelöst, das rechte gespiegelt. Vereinfachung beim Wanken: jedes Rad wird mit
// seinem Radhub gelöst, die Fahrbahn ist die Gerade durch beide Aufstandspunkte.

import { intersect, solveFront, type FrontGeometry, type FrontResult, type Vec2 } from "./frontMcPherson";
import { camberToRoad, wheelTravel } from "./rideHeight";

export interface AxleInput {
  /** Radhub beider Räder ab Serienlage: Tieferlegung + Einfedern, mm. */
  travel: number;
  /** Wankwinkel, + = Karosserie neigt nach rechts (Linkskurve, rechts kurvenäußer). */
  rollDeg: number;
  strutTopShiftInward?: number;
  staticRadius?: number;
}

export interface SideResult extends FrontResult {
  side: "links" | "rechts";
  travel: number;
  outer: boolean;
  camberRoadDeg: number;
}

export interface AxleResult {
  left: SideResult;
  right: SideResult;
  /** Rollzentrum im Karosseriesystem; null wenn Polstrahlen parallel. */
  rollCenter: Vec2 | null;
  /** Höhe über der Fahrbahngeraden, mm. */
  rollCenterHeight: number | null;
  /** Gesamt-Spurweitenänderung am Aufstandspunkt, mm. */
  trackChange: number;
}

const mirror = (p: Vec2): Vec2 => ({ y: -p.y, z: p.z });

function mirrorResult(r: FrontResult): FrontResult {
  return {
    ...r,
    lowerArmInner: mirror(r.lowerArmInner),
    lowerArmOuter: mirror(r.lowerArmOuter),
    strutTop: mirror(r.strutTop),
    wheelCenter: mirror(r.wheelCenter),
    contactPoint: mirror(r.contactPoint),
    instantCenter: r.instantCenter ? mirror(r.instantCenter) : null,
  };
}

/** Richtung des Polstrahls vom Aufstandspunkt aus. */
function poleRay(r: FrontResult): Vec2 {
  if (r.instantCenter) {
    return { y: r.instantCenter.y - r.contactPoint.y, z: r.instantCenter.z - r.contactPoint.z };
  }
  return { y: r.lowerArmOuter.y - r.lowerArmInner.y, z: r.lowerArmOuter.z - r.lowerArmInner.z };
}

export function solveFrontAxle(g: FrontGeometry, input: AxleInput): AxleResult {
  const track = 2 * g.wheelCenter.y;
  const roll = input.rollDeg;
  // + Wanken: rechts federt ein (kurvenäußer), links aus
  const travelRight = wheelTravel({ lowering: input.travel, rollDeg: roll, track, outer: true });
  const travelLeft = wheelTravel({ lowering: input.travel, rollDeg: roll, track, outer: false });
  const common = { strutTopShiftInward: input.strutTopShiftInward, staticRadius: input.staticRadius };

  const l = solveFront(g, { travel: travelLeft, ...common });
  const r = mirrorResult(solveFront(g, { travel: travelRight, ...common }));

  const rightOuter = roll > 0;
  const leftOuter = roll < 0;
  const left: SideResult = {
    ...l,
    side: "links",
    travel: travelLeft,
    outer: leftOuter,
    camberRoadDeg: camberToRoad(l.camberBodyDeg, Math.abs(roll), leftOuter),
  };
  const right: SideResult = {
    ...r,
    side: "rechts",
    travel: travelRight,
    outer: rightOuter,
    camberRoadDeg: camberToRoad(r.camberBodyDeg, Math.abs(roll), rightOuter),
  };

  const rc = intersect(left.contactPoint, poleRay(left), right.contactPoint, poleRay(right));
  let rcHeight: number | null = null;
  if (rc) {
    const cl = left.contactPoint;
    const cr = right.contactPoint;
    const groundAtRc = cr.z + ((cl.z - cr.z) * (rc.y - cr.y)) / (cl.y - cr.y);
    rcHeight = rc.z - groundAtRc;
  }

  return {
    left,
    right,
    rollCenter: rc,
    rollCenterHeight: rcHeight,
    trackChange: left.contactPoint.y - right.contactPoint.y - track,
  };
}
