import type { Confidence } from "../core/data";
import { fmtMm } from "../core/format";
import type { Vec2 } from "../core/frontMcPherson";
import type { TwoLinkResult } from "../core/twoLink";
import type { Computed } from "../app/compute";

// Frontansicht HA (Ersatzmodell), statisch und symmetrisch. Fahrzeug links = rechts im Bild.
const X = (p: Vec2) => p.y;
const Y = (p: Vec2) => -p.z;
const m = (p: Vec2): Vec2 => ({ y: -p.y, z: p.z });

function Side({ r, mirror, ghost, tireW }: { r: TwoLinkResult; mirror: boolean; ghost?: boolean; tireW: number }) {
  const f = mirror ? m : (p: Vec2) => p;
  const Li = f(r.lowerInner);
  const Lo = f(r.lowerOuter);
  const Ui = f(r.upperInner);
  const Uo = f(r.upperOuter);
  const wc = f(r.wheelCenter);
  const rad = r.wheelCenter.z - r.groundZ;
  const rot = mirror ? -r.camberBodyDeg : r.camberBodyDeg;
  return (
    <g className={ghost ? "ghost" : undefined}>
      <g transform={`rotate(${rot} ${X(wc)} ${Y(wc)})`}>
        <rect x={X(wc) - tireW / 2} y={Y(wc) - rad} width={tireW} height={2 * rad} rx={tireW * 0.22} className="tire" />
        <line x1={X(wc)} y1={Y(wc) - rad} x2={X(wc)} y2={Y(wc) + rad} className="wheel-plane" />
      </g>
      <line x1={X(Li)} y1={Y(Li)} x2={X(Lo)} y2={Y(Lo)} className="arm" />
      <line x1={X(Ui)} y1={Y(Ui)} x2={X(Uo)} y2={Y(Uo)} className="arm" />
      <line x1={X(Lo)} y1={Y(Lo)} x2={X(Uo)} y2={Y(Uo)} className="strut" />
      {[Li, Lo, Ui, Uo].map((p, i) => (
        <circle key={i} cx={X(p)} cy={Y(p)} r={11} className="joint" />
      ))}
    </g>
  );
}

export function RearView({ c }: { c: Computed }) {
  const r = c.rear;
  if (!r) return null;
  const tireW = c.fitRear.wheel.tire?.widthMm ?? 245;
  const s = r.static;
  const ic = s.instantCenter;
  const rcZ = s.rollCenterHeight;
  return (
    <figure className="view">
      <svg viewBox="-980 -700 1960 780" role="img" aria-label="Hinterachse Ersatzmodell in der Frontansicht">
        <rect x={-980} y={0} width={1960} height={80} fill="url(#hatch)" />
        <line x1={-980} y1={0} x2={980} y2={0} className="ground" />
        <line x1={0} y1={-700} x2={0} y2={80} className="center" />
        <Side r={r.stock} mirror={false} ghost tireW={tireW} />
        <Side r={r.stock} mirror ghost tireW={tireW} />
        <g transform={`translate(0 ${s.groundZ})`}>
          {ic && (
            <g className="construction">
              <line x1={X(s.contactPoint)} y1={Y(s.contactPoint)} x2={X(ic)} y2={Y(ic)} className="pole" />
              <line x1={X(s.lowerOuter)} y1={Y(s.lowerOuter)} x2={X(ic)} y2={Y(ic)} className="aux" />
              <line x1={X(s.upperOuter)} y1={Y(s.upperOuter)} x2={X(ic)} y2={Y(ic)} className="aux" />
            </g>
          )}
          <Side r={s} mirror={false} tireW={tireW} />
          <Side r={s} mirror tireW={tireW} />
          {rcZ !== null && (
            <g className="rc">
              <circle cx={0} cy={-(rcZ + s.groundZ)} r={16} />
              <text x={26} y={-(rcZ + s.groundZ) - 18} className="label rc-label">
                RZ {fmtMm(rcZ, c.rearConfidence, true)}
              </text>
            </g>
          )}
        </g>
        <text x={-960} y={-660} className="label small">Hinterachse · Ersatzmodell, Lenkerpunkte angenommen</text>
      </svg>
    </figure>
  );
}

/** Seitenansicht: Rollzentren VA/HA und Rollachse, Serie grau. Fahrtrichtung links. */
export function RollAxisView({ c }: { c: Computed }) {
  const ra = c.rollAxis;
  const wb = c.d.vehicle.wheelbase.value;
  if (!ra || !wb) return null;
  const x0 = -500;
  const x1 = wb + 500;
  const zs = 3; // Höhen 3-fach überhöht, sonst ist die Neigung nicht zu sehen
  const yv = (z: number) => -z * zs;
  const conf = c.rearConfidence;
  const incl = ra.now.inclinationDeg;
  const points: { name: string; x: number; z: number; conf: Confidence }[] = [
    { name: "VA", x: 0, z: ra.now.front, conf: c.kinConfidence },
    { name: "HA", x: wb, z: ra.now.rear, conf },
  ];
  return (
    <figure className="view">
      <svg viewBox={`${x0} ${-760} ${x1 - x0} 1260`} role="img" aria-label="Rollachse in der Seitenansicht">
        <line x1={x0} x2={x1} y1={0} y2={0} className="ground" />
        {[0, wb].map((x, i) => (
          <g key={x}>
            <line x1={x} x2={x} y1={yv(-120)} y2={yv(220)} className="axle-mark" />
            <text x={x} y={yv(-120) + 70} textAnchor="middle" className="label big muted">
              {i === 0 ? "Vorderachse" : "Hinterachse"}
            </text>
          </g>
        ))}
        <line x1={x0} x2={x1} y1={yv(ra.stock.heightAt(x0))} y2={yv(ra.stock.heightAt(x1))} className="axis-ghost" />
        <line x1={x0} x2={x1} y1={yv(ra.now.heightAt(x0))} y2={yv(ra.now.heightAt(x1))} className="axis" />
        {points.map((p) => (
          <g key={p.name} className="rc">
            <circle cx={p.x} cy={yv(p.z)} r={26} />
            <text x={p.x + (p.name === "VA" ? 40 : -40)} y={yv(p.z) - 40} textAnchor={p.name === "VA" ? "start" : "end"} className="label rc-label big">
              {p.name} {fmtMm(p.z, p.conf, true)}
            </text>
          </g>
        ))}
        <circle cx={0} cy={yv(ra.stock.front)} r={18} className="rc-ghost" />
        <circle cx={wb} cy={yv(ra.stock.rear)} r={18} className="rc-ghost" />
        <text x={x0 + 20} y={-690} className="label big">
          ← Fahrtrichtung · Höhen 3-fach überhöht
        </text>
      </svg>
      <figcaption>
        Rollachse {incl >= 0 ? "steigt nach hinten" : "fällt nach hinten"} um ≈ {Math.abs(incl).toFixed(1).replace(".", ",")}° · Serie ≈{" "}
        {ra.stock.inclinationDeg.toFixed(1).replace(".", ",")}° · HA aus Ersatzmodell (Annahmen)
      </figcaption>
    </figure>
  );
}
