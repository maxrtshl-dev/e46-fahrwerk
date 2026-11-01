import { fmtDeg, fmtDegDec, fmtMm } from "../core/format";
import type { Ampel } from "../core/legal";
import type { Computed } from "../app/compute";

const AMPEL_TEXT: Record<Ampel, string> = {
  gruen: "im Rahmen",
  gelb: "knapp",
  rot: "verletzt",
  unbekannt: "offen",
};

function Dot({ status }: { status: Ampel }) {
  return <span className={`dot dot-${status}`} aria-label={AMPEL_TEXT[status]} />;
}

/** Band „a … b“; gleiche Enden werden zu einem Wert. */
function band(b: { min: number; max: number }, f: (v: number) => string): string {
  const a = f(b.min);
  const z = f(b.max);
  return a === z ? a : `${a} … ${z.replace("≈ ", "")}`;
}


export function ResultsPanel({ c, roll }: { c: Computed; roll: number }) {
  const a = c.axle;
  const st = c.staticAxle;
  const k = c.kinConfidence;
  const kr = c.rearConfidence;
  const rcStock = c.stockAxle?.rollCenterHeight ?? null;
  const heightConf = c.d.vehicle.stockHeightFront.confidence;
  const factory = c.d.factoryAlignment.front;
  const r = c.rear;

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

      {r ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Hinterachse · Ersatzmodell</th>
                <th scope="col" className="num">statisch</th>
                <th scope="col" className="num">Lastfall außen</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Tieferlegung / Radhub</th>
                <td className="num">{fmtMm(r.lowering, heightConf, true)}</td>
                <td className="num">{fmtMm(r.travelOuter, heightConf, true)}</td>
              </tr>
              <tr>
                <th scope="row">Sturz zur Karosserie</th>
                <td className="num">{fmtDeg(r.static.camberBodyDeg, kr)}</td>
                <td className="num">{fmtDeg(r.load.camberBodyDeg, kr)}</td>
              </tr>
              <tr className="band-row">
                <th scope="row">Band der Annahmen</th>
                <td className="num">{band(r.bandStatic.camberDeg, (v) => fmtDeg(v + c.camberOffsetRear, kr))}</td>
                <td className="num">{band(r.bandLoad.camberDeg, (v) => fmtDeg(v + c.camberOffsetRear, kr))}</td>
              </tr>
              <tr>
                <th scope="row">Rollzentrum Höhe</th>
                <td className="num">{fmtMm(r.static.rollCenterHeight, kr, true)}</td>
                <td className="num">{fmtMm(r.load.rollCenterHeight, kr, true)}</td>
              </tr>
              <tr className="band-row">
                <th scope="row">Band der Annahmen</th>
                <td className="num">{band(r.bandStatic.rollCenterHeight, (v) => fmtMm(v, kr, true))}</td>
                <td className="num">{band(r.bandLoad.rollCenterHeight, (v) => fmtMm(v, kr, true))}</td>
              </tr>
              <tr>
                <th scope="row">Spurweite</th>
                <td className="num">{fmtMm(2 * r.static.halfTrackChange, kr, true)}</td>
                <td className="num">–</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="hint">{c.rearError ?? "Hinterachse: Höhe HA eintragen, dann rechnet das Ersatzmodell."}</p>
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
