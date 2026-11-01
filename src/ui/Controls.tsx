import { req } from "../core/data";
import { defaultStaticRadius, parseTireSize } from "../core/tire";
import { TIRE_DEFLECTION_DEFAULT } from "../core/thresholds";
import { formatDegMin } from "../core/units";
import { data, useSetup } from "../app/store";

const minF = req(data.limits.minHeightFront);
const minR = req(data.limits.minHeightRear);
const stockF = req(data.vehicle.stockHeightFront);
const stockR = req(data.vehicle.stockHeightRear);
const maxCorr = req(data.frontHardpoints.maxCamberOffsetAtTop);

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  display?: string;
  limit?: number; // Grenzlinie (Gutachten)
  stock?: number;
  onChange: (v: number) => void;
  hint?: string;
}

function Slider({ id, label, value, min, max, step, unit, display, limit, stock, onChange, hint }: SliderProps) {
  const pct = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="num">
          {display ?? `${value} ${unit}`}
        </output>
      </div>
      <div className="slider-wrap">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {limit !== undefined && (
          <span className="mark mark-limit" style={{ left: pct(limit) }} title={`Grenze Gutachten ${limit} ${unit}`} />
        )}
        {stock !== undefined && <span className="mark mark-stock" style={{ left: pct(stock) }} title={`Serie ≈ ${stock} ${unit}`} />}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Controls() {
  const s = useSetup();
  const set = s.set;

  return (
    <section className="panel controls" aria-label="Eingaben">
      <h2>Setup</h2>
      <div className="presets" role="group" aria-label="Presets">
        {data.presets.map((p) => (
          <button
            key={p.name}
            type="button"
            className={s.preset === p.name ? "chip active" : "chip"}
            onClick={() => s.applyPreset(p)}
          >
            <span>{p.name}</span>
            <span className="chip-num">
              {p.front ?? "?"}/{p.rear ?? "?"}
            </span>
          </button>
        ))}
      </div>

      <Slider
        id="hVA"
        label="Höhe VA"
        value={s.heightFront}
        min={minF - 25}
        max={stockF + 15}
        step={1}
        unit="mm"
        limit={minF}
        stock={stockF}
        onChange={(v) => set({ heightFront: v })}
        hint={`Radmitte → Radlaufkante · rot: Grenze ${minF} mm · grau: Serie ≈ ${stockF} mm`}
      />

      <div className="field">
        <div className="field-head">
          <label htmlFor="hHA">Höhe HA</label>
          <span className="hint-inline">nur Grenzprüfung, Kinematik HA folgt in M5</span>
        </div>
        <div className="inline">
          <input
            id="hHA"
            type="number"
            inputMode="numeric"
            placeholder="unbekannt"
            value={s.heightRear ?? ""}
            min={minR - 30}
            max={stockR + 20}
            onChange={(e) => set({ heightRear: e.target.value === "" ? null : Number(e.target.value) })}
          />
          <span className="unit">mm</span>
        </div>
      </div>

      <Slider
        id="bump"
        label="Ein-/Ausfedern"
        value={s.bump}
        min={-80}
        max={80}
        step={1}
        unit="mm"
        display={`${s.bump > 0 ? "+" : ""}${s.bump} mm`}
        stock={0}
        onChange={(v) => set({ bump: v })}
        hint="+ = Rad wandert zur Karosserie (einfedern)"
      />

      <Slider
        id="roll"
        label="Wanken"
        value={s.roll}
        min={-3}
        max={3}
        step={0.1}
        unit="°"
        display={`${s.roll.toFixed(1).replace(".", ",")}°`}
        stock={0}
        onChange={(v) => set({ roll: v })}
        hint="+ = Karosserie neigt nach rechts (Linkskurve, rechtes Rad außen)"
      />

      <Slider
        id="corr"
        label="Sturzkorrektur Dom"
        value={s.camberCorrDeg}
        min={0}
        max={maxCorr}
        step={0.05}
        unit="°"
        display={s.camberCorrDeg === 0 ? "keine" : `${formatDegMin(-s.camberCorrDeg)}`}
        onChange={(v) => set({ camberCorrDeg: v })}
        hint={`Domlager nach innen gedrückt, max. ≈ ${String(maxCorr).replace(".", ",")}° über die Langlöcher`}
      />

      <div className="field">
        <div className="field-head">
          <label htmlFor="tire">Reifen VA</label>
        </div>
        <div className="inline">
          <input
            id="tire"
            type="text"
            value={s.tire}
            onChange={(e) => {
              const t = e.target.value;
              try {
                const r = defaultStaticRadius(parseTireSize(t), TIRE_DEFLECTION_DEFAULT);
                set({ tire: t, staticRadius: Math.round(r) });
              } catch {
                set({ tire: t });
              }
            }}
          />
          <label htmlFor="rstat" className="sub">
            r stat.
          </label>
          <input
            id="rstat"
            type="number"
            inputMode="numeric"
            className="short"
            value={s.staticRadius}
            onChange={(e) => set({ staticRadius: Number(e.target.value) || s.staticRadius })}
          />
          <span className="unit">mm</span>
        </div>
      </div>
    </section>
  );
}
