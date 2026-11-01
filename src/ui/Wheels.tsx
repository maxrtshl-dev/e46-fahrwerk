import { defaultStaticRadius, parseTireSize, tireRadius } from "../core/tire";
import { TIRE_DEFLECTION_DEFAULT } from "../core/thresholds";
import { data, useSetup, type MeasureKey } from "../app/store";
import { NumField } from "./NumField";

function WheelFields({ axle, label }: { axle: "front" | "rear"; label: string }) {
  const w = useSetup((s) => s.wheels[axle]);
  const setWheel = useSetup((s) => s.setWheel);
  const p = axle === "front" ? "va" : "ha";
  let r: number | null = null;
  try {
    r = tireRadius(parseTireSize(w.tire));
  } catch {
    r = null;
  }
  return (
    <fieldset className="wheel">
      <legend>{label}</legend>
      <div className="grid4">
        <label htmlFor={`${p}-j`}>
          Breite J
          <NumField id={`${p}-j`} value={w.widthJ} onChange={(v) => v !== null && setWheel(axle, { widthJ: v })} />
        </label>
        <label htmlFor={`${p}-et`}>
          ET
          <NumField id={`${p}-et`} value={w.et} onChange={(v) => v !== null && setWheel(axle, { et: v })} />
        </label>
        <label htmlFor={`${p}-sp`}>
          Spurplatte
          <NumField id={`${p}-sp`} value={w.spacer} onChange={(v) => setWheel(axle, { spacer: v ?? 0 })} />
        </label>
        <label htmlFor={`${p}-rs`}>
          r stat.
          <NumField id={`${p}-rs`} value={w.staticRadius} onChange={(v) => v !== null && setWheel(axle, { staticRadius: v })} />
        </label>
      </div>
      <label htmlFor={`${p}-tire`} className="tire-field">
        Reifen
        <input
          id={`${p}-tire`}
          type="text"
          value={w.tire}
          onChange={(e) => {
            const t = e.target.value;
            try {
              const rs = Math.round(defaultStaticRadius(parseTireSize(t), TIRE_DEFLECTION_DEFAULT));
              setWheel(axle, { tire: t, staticRadius: rs });
            } catch {
              setWheel(axle, { tire: t });
            }
          }}
        />
      </label>
      <p className="hint">
        {r === null ? "Reifengröße nicht lesbar, Format 225/45 R17" : `Ø ${(2 * r).toFixed(1).replace(".", ",")} mm unbelastet · r stat. ohne Messung ≈ r − ${TIRE_DEFLECTION_DEFAULT} mm`}
      </p>
    </fieldset>
  );
}

export function WheelsPanel() {
  return (
    <section className="panel" aria-label="Räder">
      <h2>Räder</h2>
      <p className="hint">{data.wheels.current.name ?? "aktuelle Räder"} · ET und Spurplatte in mm, Spurplatte je Seite</p>
      <WheelFields axle="front" label="Vorderachse" />
      <WheelFields axle="rear" label="Hinterachse" />
    </section>
  );
}

const FIELDS: [MeasureKey, string][] = [
  ["fenderLateralFront", "VA Radlaufkante seitlich"],
  ["innerStrutFront", "VA → Federbein"],
  ["innerPerchFront", "VA → Federteller"],
  ["bumpTravelFront", "VA Weg bis Puffer"],
  ["fenderLateralRear", "HA Radlaufkante seitlich"],
  ["innerRear", "HA → Dämpfer/Lenker"],
  ["bumpTravelRear", "HA Weg bis Puffer"],
];

export function MeasurementsPanel() {
  const measured = useSetup((s) => s.measured);
  const setMeasured = useSetup((s) => s.setMeasured);
  return (
    <section className="panel" aria-label="Messwerte Radhaus">
      <h2>Messwerte Radhaus</h2>
      <p className="hint">{data.fitment.note}. Leer = nicht gemessen. Gespeichert nur in diesem Browser.</p>
      <div className="measures">
        {FIELDS.map(([k, label]) => (
          <div key={k} className="measure">
            <label htmlFor={`m-${k}`}>{label}</label>
            <div className="inline">
              <NumField
                id={`m-${k}`}
                className="short"
                value={measured[k] ?? data.fitment[k].value}
                allowEmpty
                placeholder="–"
                onChange={(v) => setMeasured(k, v)}
              />
              <span className="unit">mm</span>
            </div>
            <p className="hint">{data.fitment[k].note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
