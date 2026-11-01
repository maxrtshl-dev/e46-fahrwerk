import type { AxleResult, SideResult } from "../core/frontAxle";
import type { Vec2 } from "../core/frontMcPherson";
import { fmtMm } from "../core/format";
import type { TireSize } from "../core/tire";
import { MM_PER_INCH, tireRadius } from "../core/tire";
import type { Computed } from "../app/compute";

// Darstellung: Blick von vorn. Fahrzeug links (+y) erscheint rechts im Bild.
// SVG-Koordinaten: x = y, Y = −z (mm).
const X = (p: Vec2) => p.y;
const Y = (p: Vec2) => -p.z;
const RAY = 2600; // Polstrahlen so weit verlängern, dass sie den Bildrand verlassen


function ext(from: Vec2, to: Vec2 | null, dirIfNull: Vec2, len = RAY): Vec2 {
  const d = to ? { y: to.y - from.y, z: to.z - from.z } : dirIfNull;
  const n = Math.hypot(d.y, d.z) || 1;
  return { y: from.y + (d.y / n) * len, z: from.z + (d.z / n) * len };
}

function Line({ a, b, className }: { a: Vec2; b: Vec2; className: string }) {
  return <line x1={X(a)} y1={Y(a)} x2={X(b)} y2={Y(b)} className={className} />;
}

function Wheel({ s, tire, ghost }: { s: SideResult; tire: TireSize | null; ghost?: boolean }) {
  const r = s.wheelCenter.z - s.groundZ; // statischer Radius
  const w = tire?.widthMm ?? 225;
  const rimR = tire ? (tire.rimInch * MM_PER_INCH) / 2 : r * 0.72;
  const rot = s.side === "links" ? s.camberBodyDeg : -s.camberBodyDeg;
  const cx = X(s.wheelCenter);
  const cy = Y(s.wheelCenter);
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`} className={ghost ? "ghost" : undefined}>
      <rect x={cx - w / 2} y={cy - r} width={w} height={2 * r} rx={w * 0.22} className="tire" />
      <rect x={cx - w / 2 + 16} y={cy - rimR} width={w - 32} height={2 * rimR} rx={6} className="rim" />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} className="wheel-plane" />
      <circle cx={cx} cy={cy} r={9} className="hub" />
    </g>
  );
}

function Corner({ s, ghost }: { s: SideResult; ghost?: boolean }) {
  const cls = ghost ? "ghost" : undefined;
  return (
    <g className={cls}>
      <Line a={s.lowerArmInner} b={s.lowerArmOuter} className="arm" />
      <Line a={s.lowerArmOuter} b={s.strutTop} className="strut" />
      <circle cx={X(s.lowerArmInner)} cy={Y(s.lowerArmInner)} r={11} className="joint" />
      <circle cx={X(s.lowerArmOuter)} cy={Y(s.lowerArmOuter)} r={11} className="joint" />
      <rect x={X(s.strutTop) - 34} y={Y(s.strutTop) - 9} width={68} height={18} rx={4} className="mount" />
    </g>
  );
}

function PoleLines({ s }: { s: SideResult }) {
  const armDir = { y: s.lowerArmOuter.y - s.lowerArmInner.y, z: s.lowerArmOuter.z - s.lowerArmInner.z };
  const strutPerp = { y: s.strutTop.z - s.lowerArmOuter.z, z: -(s.strutTop.y - s.lowerArmOuter.y) };
  const ic = s.instantCenter;
  // ohne Momentanpol: parallel zum Querlenker, Richtung Fahrzeugmitte (B → A)
  const armToCenter = { y: -armDir.y, z: -armDir.z };
  return (
    <g className="construction">
      <Line a={s.lowerArmOuter} b={ext(s.lowerArmOuter, ic, armToCenter)} className="aux" />
      <Line a={s.strutTop} b={ext(s.strutTop, ic, strutPerp)} className="aux" />
      <Line a={s.contactPoint} b={ext(s.contactPoint, ic, armToCenter)} className="pole" />
    </g>
  );
}

export function FrontView({ c, heightFront }: { c: Computed; heightFront: number }) {
  const { axle, tire, stockAxle, kinConfidence } = c;
  if (!stockAxle) return <figure className="view"><p className="error">{c.error}</p></figure>;
  const stockH = c.d.vehicle.stockHeightFront.value ?? 0;
  // Karosseriesystem → Fahrbahnsystem: Fahrbahn waagerecht auf Y = 0
  let transform = "";
  if (axle) {
    const cl = axle.left.contactPoint;
    const cr = axle.right.contactPoint;
    const m = { y: (cl.y + cr.y) / 2, z: (cl.z + cr.z) / 2 };
    const alpha = (Math.atan2(cl.z - cr.z, cl.y - cr.y) * 180) / Math.PI;
    transform = `rotate(${alpha}) translate(${-m.y} ${m.z})`;
  }
  const fenderZ = stockAxle.left.wheelCenter.z + stockH; // Radlaufkante, karosseriefest
  const tireR = tire ? tireRadius(tire) : 320;

  return (
    <figure className="view">
      <svg viewBox="-980 -930 1960 1010" role="img" aria-label="Vorderachse in der Frontansicht">
        <defs>
          <pattern id="hatch" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="18" className="hatch-line" />
          </pattern>
        </defs>

        {/* Fahrbahn */}
        <rect x={-980} y={0} width={1960} height={80} fill="url(#hatch)" />
        <line x1={-980} y1={0} x2={980} y2={0} className="ground" />
        <line x1={0} y1={-930} x2={0} y2={80} className="center" />

        {/* Serie als Geisterbild */}
        <g>
          {[stockAxle.left, stockAxle.right].map((s) => (
            <g key={`g-${s.side}`}>
              <Wheel s={s} tire={tire} ghost />
              <Corner s={s} ghost />
            </g>
          ))}
          {stockAxle.rollCenter && (
            <circle cx={X(stockAxle.rollCenter)} cy={Y(stockAxle.rollCenter)} r={13} className="rc-ghost" />
          )}
        </g>

        {axle && (
          <g transform={transform}>
            {/* Radlaufkante (karosseriefest) */}
            {[1, -1].map((side) => (
              <line
                key={side}
                x1={side * (axle.left.wheelCenter.y - tireR * 0.55)}
                x2={side * (axle.left.wheelCenter.y + tireR * 0.45)}
                y1={-fenderZ}
                y2={-fenderZ}
                className="fender"
              />
            ))}
            <PoleLines s={axle.left} />
            <PoleLines s={axle.right} />
            {[axle.left, axle.right].map((s) => (
              <g key={s.side}>
                <Wheel s={s} tire={tire} />
                <Corner s={s} />
              </g>
            ))}

            {/* Höhenmaß Radmitte → Radlaufkante, linkes Rad (rechts im Bild) */}
            <g className="dim">
              <line
                x1={axle.left.wheelCenter.y + tireR * 0.6}
                x2={axle.left.wheelCenter.y + tireR * 0.6}
                y1={-axle.left.wheelCenter.z}
                y2={-fenderZ}
              />
              <line
                x1={axle.left.wheelCenter.y}
                x2={axle.left.wheelCenter.y + tireR * 0.68}
                y1={-axle.left.wheelCenter.z}
                y2={-axle.left.wheelCenter.z}
                className="dim-ext"
              />
              <text
                x={axle.left.wheelCenter.y + tireR * 0.6 + 14}
                y={(-axle.left.wheelCenter.z - fenderZ) / 2 + 10}
                className="label"
              >
                {heightFront}
              </text>
            </g>

            {axle.rollCenter && (
              <g className="rc">
                <circle cx={X(axle.rollCenter)} cy={Y(axle.rollCenter)} r={16} />
                <text x={X(axle.rollCenter) + 26} y={Y(axle.rollCenter) - 18} className="label rc-label">
                  RZ {fmtMm(axle.rollCenterHeight, kinConfidence, true)}
                </text>
              </g>
            )}
          </g>
        )}

        <text x={-960} y={-890} className="label small">Blick von vorn</text>
        <text x={-960} y={60} className="label small">Fzg. rechts</text>
        <text x={960} y={60} className="label small" textAnchor="end">Fzg. links</text>
      </svg>
      <figcaption>
        <span className="key key-pole" /> Polstrahl Aufstandspunkt → Momentanpol
        <span className="key key-aux" /> Querlenker / ⟂ Federbein
        <span className="key key-ghost" /> Serie
      </figcaption>
    </figure>
  );
}
