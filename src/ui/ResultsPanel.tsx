import type { Confidence, Val } from "../core/data";
import { fmtDeg, fmtDegDec, fmtMm } from "../core/format";
import type { Ampel } from "../core/legal";
import { data } from "../app/store";
import { kinConfidence, stockAxle, type Computed } from "../app/compute";

const AMPEL_TEXT: Record<Ampel, string> = {
  gruen: "im Rahmen",
  gelb: "knapp",
  rot: "verletzt",
  unbekannt: "offen",
};

function Dot({ status }: { status: Ampel }) {
  return <span className={`dot dot-${status}`} aria-label={AMPEL_TEXT[status]} />;
}

function Conf({ c }: { c: Confidence }) {
  return <span className={`conf conf-${c === "geschätzt" ? "geschaetzt" : c}`}>{c}</span>;
}

const heightConf = data.vehicle.stockHeightFront.confidence;
const factory = data.factoryAlignment.front;

export function ResultsPanel({ c, roll }: { c: Computed; roll: number }) {
  const a = c.axle;
  const st = c.staticAxle;
  const k = kinConfidence;
  const rcStock = stockAxle.rollCenterHeight;

  return (
    <section className="panel results" aria-label="Ergebnisse">
      <div className="tiles">
        <div className={`tile tile-${c.legal}`}>
          <span className="tile-label">Gutachten</span>
          <span className="tile-value">{AMPEL_TEXT[c.legal]}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Rollzentrum VA statisch</span>
          <span className="tile-value num">{st ? fmtMm(st.rollCenterHeight, k, true) : "–"}</span>
          <span className="tile-sub">Serie {fmtMm(rcStock, k, true)}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Sturz VA statisch</span>
          <span className="tile-value num">{st ? fmtDeg(st.left.camberBodyDeg, k) : "–"}</span>
          <span className="tile-sub">BMW Serie {factory.camber.replace(/'/g, "′").replace("-", "−")}</span>
        </div>
      </div>

      {c.error && <p className="error">{c.error}. Höhe oder Federweg zurücknehmen.</p>}

      {a && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Vorderachse</th>
                <th scope="col" className="num">links{a.left.outer ? " · außen" : ""}</th>
                <th scope="col" className="num">rechts{a.right.outer ? " · außen" : ""}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Radhub ggü. Serie</th>
                <td className="num">{fmtMm(a.left.travel, heightConf, true)}</td>
                <td className="num">{fmtMm(a.right.travel, heightConf, true)}</td>
              </tr>
              <tr>
                <th scope="row">Sturz zur Karosserie</th>
                <td className="num">{fmtDeg(a.left.camberBodyDeg, k)}</td>
                <td className="num">{fmtDeg(a.right.camberBodyDeg, k)}</td>
              </tr>
              <tr>
                <th scope="row">Sturz zur Fahrbahn</th>
                <td className="num">{fmtDeg(a.left.camberRoadDeg, k)}</td>
                <td className="num">{fmtDeg(a.right.camberRoadDeg, k)}</td>
              </tr>
              <tr>
                <th scope="row">Querlenkerwinkel</th>
                <td className="num">{fmtDegDec(a.left.lowerArmAngleDeg, k)}</td>
                <td className="num">{fmtDegDec(a.right.lowerArmAngleDeg, k)}</td>
              </tr>
              <tr>
                <th scope="row">Rollzentrum Höhe</th>
                <td className="num" colSpan={2}>{fmtMm(a.rollCenterHeight, k, true)}</td>
              </tr>
              {roll !== 0 && a.rollCenter && (
                <tr>
                  <th scope="row">Rollzentrum seitlich</th>
                  <td className="num" colSpan={2}>
                    {fmtMm(Math.abs(a.rollCenter.y), k)} nach {a.rollCenter.y > 0 ? "links" : "rechts"}
                  </td>
                </tr>
              )}
              <tr>
                <th scope="row">Spurweite</th>
                <td className="num" colSpan={2}>{fmtMm(a.trackChange, k, true)}</td>
              </tr>
              <tr>
                <th scope="row">Spuränderung</th>
                <td colSpan={2} className="na">nicht berechnet: Spurstangenpunkte fehlen</td>
              </tr>
              <tr>
                <th scope="row">Restweg bis Puffer</th>
                <td colSpan={2} className="na">unbekannt: freien Weg messen (Gutachten nennt nur +40 mm ggü. Serie)</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <h3>Gutachten DTS</h3>
      <ul className="checks">
        {c.checks.map((ch) => (
          <li key={ch.id}>
            <Dot status={ch.status} />
            <span>{ch.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const INPUTS: [string, Val][] = [
  ["Querlenker innen y", data.frontHardpoints.lowerArmInner.y],
  ["Querlenker innen z", data.frontHardpoints.lowerArmInner.z],
  ["Traggelenk y", data.frontHardpoints.lowerArmOuter.y],
  ["Traggelenk z", data.frontHardpoints.lowerArmOuter.z],
  ["Domlager y", data.frontHardpoints.strutTop.y],
  ["Domlager z", data.frontHardpoints.strutTop.z],
  ["Spurweite VA", data.vehicle.trackFront],
  ["Serienhöhe VA", data.vehicle.stockHeightFront],
  ["Mindesthöhe VA", data.limits.minHeightFront],
  ["Mindesthöhe HA", data.limits.minHeightRear],
];

export function InputsPanel() {
  return (
    <section className="panel inputs" aria-label="Eingangsdaten">
      <h2>Eingangsdaten</h2>
      <p className="hint">
        Das Ergebnis ist so belastbar wie der schwächste Wert. Messwerte eintragen folgt mit dem Daten-Editor (M5).
      </p>
      <div className="table-wrap">
        <table>
          <tbody>
            {INPUTS.map(([label, v]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td className="num">{v.value ?? "–"} {v.unit}</td>
                <td>
                  <Conf c={v.confidence} />
                </td>
                <td className="src">{v.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
