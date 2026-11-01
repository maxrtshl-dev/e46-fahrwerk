import { fmtMm } from "../core/format";
import type { Clearance, LoadCase, WheelGeometry } from "../core/fitment";
import type { Ampel } from "../core/legal";
import { MM_PER_INCH } from "../core/tire";
import { formatDegMin } from "../core/units";
import type { AxleFitment, Computed } from "../app/compute";
import { useSetup, type WheelSetup } from "../app/store";
import type { E46Data } from "../core/data";

const AMPEL: Record<Ampel, string> = { gruen: "frei", gelb: "knapp", rot: "Kollision/kritisch", unbekannt: "offen" };

/**
 * Radhaus-Schnitt, Blick von vorn auf das linke Rad (außen = rechts im Bild).
 * Lokal: x = lateral ab Radanlagefläche, z = Höhe ab Radmitte. SVG: Y = −z.
 */
function Section({
  axle,
  geo,
  rimInch,
  load,
  fenderLateral,
  innerA,
  innerB,
  top,
}: {
  axle: "VA" | "HA";
  geo: WheelGeometry;
  rimInch: number;
  load: LoadCase;
  fenderLateral: number | null;
  innerA: number | null;
  innerB: number | null;
  top: Clearance | undefined;
}) {
  const r = geo.tireRadius;
  const rimR = (rimInch * MM_PER_INCH) / 2;
  const h = load.height;
  const cam = (load.camberMin + load.camberMax) / 2;
  const x0 = -260;
  const x1 = 200;
  const yTop = -(Math.max(h, r) + 70);
  const yBot = -(rimR - 120);
  const sh = geo.shoulder;
  const rim = geo.rim;
  const midX = (sh.inner + sh.outer) / 2;

  // Reifenquerschnitt oben: Flanken leicht gewölbt
  const tirePath = [
    `M ${rim.inner + 6} ${-rimR}`,
    `C ${sh.inner - 4} ${-rimR - 30}, ${sh.inner - 2} ${-r + 50}, ${sh.inner + 22} ${-r}`,
    `L ${sh.outer - 22} ${-r}`,
    `C ${sh.outer + 2} ${-r + 50}, ${sh.outer + 4} ${-rimR - 30}, ${rim.outer - 6} ${-rimR}`,
    "Z",
  ].join(" ");

  return (
    <svg viewBox={`${x0} ${yTop} ${x1 - x0} ${yBot - yTop}`} className="section" role="img" aria-label={`Radhaus-Schnitt ${axle}`}>
      {/* Radanlagefläche als Bezug */}
      <line x1={0} x2={0} y1={yTop} y2={yBot} className="ref" />
      <text x={4} y={yBot - 8} className="label small">Radanlagefläche</text>

      <g transform={`rotate(${cam} 0 0)`}>
        <path d={tirePath} className="tire-sec" />
        {/* Felge: Bett und Hörner */}
        <line x1={rim.inner} x2={rim.outer} y1={-rimR + 26} y2={-rimR + 26} className="rim-sec" />
        <line x1={rim.inner} x2={rim.inner} y1={-rimR + 26} y2={-rimR - 10} className="rim-sec" />
        <line x1={rim.outer} x2={rim.outer} y1={-rimR + 26} y2={-rimR - 10} className="rim-sec" />
        <line x1={0} x2={rim.outer - 20} y1={-rimR + 120} y2={-rimR + 26} className="rim-sec thin" />
        {axle === "VA" && innerA !== null && (
          <rect x={-innerA - 55} y={-(rimR + 10)} width={55} height={rimR + 10 - (rimR - 110)} className="body-part" />
        )}
        {axle === "VA" && innerB !== null && (
          <rect x={-innerB - 90} y={-(r - 10)} width={90} height={14} rx={3} className="body-part" />
        )}
      </g>

      {axle === "HA" && innerA !== null && (
        <rect x={-innerA - 45} y={-(r + 30)} width={45} height={r + 30 - (rimR - 110)} className="body-part" />
      )}

      {/* Radlaufkante */}
      {fenderLateral !== null ? (
        <path
          d={`M ${fenderLateral + 10} ${-h - 60} Q ${fenderLateral + 14} ${-h} ${fenderLateral} ${-h} L ${fenderLateral - 30} ${-h + 4}`}
          className="fender-sec"
        />
      ) : (
        <>
          <line x1={-60} x2={x1 - 10} y1={-h} y2={-h} className="fender-unknown" />
          <text x={x1 - 12} y={-h + 24} className="label small" textAnchor="end">
            Kante, seitlich nicht gemessen
          </text>
        </>
      )}

      {/* Spalt oben */}
      {top && top.value !== null && (
        <g className={`gap gap-${top.status}`}>
          <line x1={midX} x2={midX} y1={-r} y2={-h} />
          <text x={midX + 10} y={-(r + h) / 2 + 8} className="label">
            {Math.round(top.value)}
          </text>
        </g>
      )}
      <text x={x0 + 10} y={yTop + 30} className="label small">
        {load.name} · h {Math.round(h)} · Sturz {formatDegMin(cam)}
      </text>
    </svg>
  );
}

function AxleCard({ f, w, d }: { f: AxleFitment; w: WheelSetup; d: E46Data }) {
  const m = d.fitment;
  const isVA = f.axle === "VA";
  const last = f.cases[f.cases.length - 1];
  const rows = f.cases[0]?.checks ?? [];
  return (
    <article className={`fit-card fit-${f.status}`}>
      <header className="fit-head">
        <h3>{isVA ? "Vorderachse" : "Hinterachse"}</h3>
        <span className="num fit-spec">
          {String(w.widthJ).replace(".", ",")}J ET{w.et}
          {w.spacer ? ` +${w.spacer}` : ""} · {w.tire}
        </span>
        <span className={`pill pill-${f.status}`}>{AMPEL[f.status]}</span>
      </header>
      {f.missing && <p className="hint">{f.missing}</p>}
      {last && f.wheel.geo && f.wheel.tire && (
        <Section
          axle={f.axle}
          geo={f.wheel.geo}
          rimInch={f.wheel.tire.rimInch}
          load={last.load}
          fenderLateral={isVA ? m.fenderLateralFront.value : m.fenderLateralRear.value}
          innerA={isVA ? m.innerStrutFront.value : m.innerRear.value}
          innerB={isVA ? m.innerPerchFront.value : null}
          top={last.checks.find((c) => c.id === "oben")}
        />
      )}
      {f.cases.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Freigang</th>
                {f.cases.map((c) => (
                  <th key={c.load.name} scope="col" className="num">
                    {c.load.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  {f.cases.map((c) => {
                    const cl = c.checks[i]!;
                    return (
                      <td key={c.load.name} className="num" title={cl.note}>
                        <span className={`dot dot-${cl.status}`} /> {cl.value === null ? "offen" : fmtMm(cl.value, "gerechnet")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {f.cases[0] && (
        <ul className="notes">
          {f.cases[f.cases.length - 1]!.checks.map((c) => (
            <li key={c.id}>
              <strong>{c.label}:</strong> {c.note}
            </li>
          ))}
        </ul>
      )}
      {!isVA && <p className="hint">HA-Sturz als Band aus Annahmen, außen zählt der ungünstigste Wert.</p>}
    </article>
  );
}

export function FitmentPanel({ c }: { c: Computed }) {
  const wheels = useSetup((s) => s.wheels);
  return (
    <section className="panel" aria-label="Radhaus-Freigang">
      <h2>Radhaus</h2>
      <p className="hint">
        Radlaufkante als Kreis um die Radmitte in Serienlage (v1) · grün &gt; 10 mm · gelb 3–10 mm · rot &lt; 3 mm · Lenkeinschlag folgt
      </p>
      <div className="fit-grid">
        <AxleCard f={c.fitFront} w={wheels.front} d={c.d} />
        <AxleCard f={c.fitRear} w={wheels.rear} d={c.d} />
      </div>
    </section>
  );
}
