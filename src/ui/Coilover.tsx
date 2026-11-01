import type { PerchResult } from "../core/coilover";
import type { Val } from "../core/data";
import type { Computed } from "../app/compute";
import { data, measuredVal, useSetup } from "../app/store";
import { NumField } from "./NumField";
import { LEGAL_MARGIN_WARN } from "../core/thresholds";

const n1 = (v: number) => v.toFixed(1).replace(".", ",");
const band = (b: { min: number; max: number }, f: (v: number) => string) => {
  const a = f(b.min);
  const z = f(b.max);
  return a === z ? a : `${a} … ${z}`;
};

function Ref({ k, label, d }: { k: "refPerchFront" | "refHeightFront" | "refPerchRear" | "refHeightRear"; label: string; d: Val }) {
  const setOverride = useSetup((s) => s.setOverride);
  const own = useSetup((s) => s.overrides[`coilover.${k}`]);
  return (
    <label htmlFor={`co-${k}`} className="co-ref">
      {label}
      <NumField
        id={`co-${k}`}
        className="short"
        value={own?.value ?? d.value}
        allowEmpty
        placeholder="–"
        onChange={(v) => setOverride(`coilover.${k}`, v === null ? null : measuredVal(data.coilover[k], v))}
      />
    </label>
  );
}

function AxleBlock({ title, p, target, hint, refs }: { title: string; p: PerchResult | null; target: number | null; hint?: string; refs: React.ReactNode }) {
  if (!p) return null;
  const approx = p.heightPerPerch.min !== p.heightPerPerch.max;
  // gleiche Schwelle wie die Gutachtenprüfung (SPEC 7.6)
  const margin = p.perch ? Math.min(p.perch.min - p.range.min, p.range.max - p.perch.max) : null;
  const status = margin === null ? "unbekannt" : margin < 0 ? "rot" : margin < LEGAL_MARGIN_WARN ? "gelb" : "gruen";
  const word = status === "rot" ? "außerhalb des Gutachtens" : status === "gelb" ? "knapp am Rand" : "im Bereich";
  return (
    <div className="co-axle">
      <h3>{title}</h3>
      <dl className="co-list">
        <dt>1 mm Federteller</dt>
        <dd className="num">≈ {band(p.heightPerPerch, n1)} mm Höhe</dd>
        <dt>Verstellbereich Gutachten</dt>
        <dd className="num">
          {p.range.min}–{p.range.max} mm ≙ ≈ {band(p.heightSpan, (v) => String(Math.round(v)))} mm Höhe
        </dd>
        <dt>Federteller für {target ?? "–"} mm</dt>
        <dd className="num">
          {p.perch ? (
            <>
              <span className={`dot dot-${status}`} /> ≈ {band(p.perch, (v) => String(Math.round(v)))} mm {word}
            </>
          ) : (
            <span className="na">Referenz messen</span>
          )}
        </dd>
      </dl>
      <div className="co-refs">{refs}</div>
      {hint && <p className="hint">{hint}</p>}
      {approx && <p className="hint">Band: Lage der Feder auf dem unteren Lenker ist angenommen.</p>}
    </div>
  );
}

export function CoiloverPanel({ c }: { c: Computed }) {
  const s = useSetup();
  const co = c.d.coilover;
  const settle = c.d.vehicle.springSettleRear.value;
  return (
    <section className="panel" aria-label="Gewinde">
      <h2>Gewinde</h2>
      <p className="hint">
        Referenz = einmal gemessen: Federteller-Maß wie im Gutachten und die Höhe dabei (Radmitte → Kante). Dann rechnet die App das Maß für jede Zielhöhe.
      </p>
      <AxleBlock
        title="Vorderachse"
        p={c.perch.front}
        target={s.heightFront}
        refs={
          <>
            <Ref k="refPerchFront" label="Maß" d={co.refPerchFront} />
            <Ref k="refHeightFront" label="Höhe" d={co.refHeightFront} />
          </>
        }
      />
      <AxleBlock
        title="Hinterachse"
        p={c.perch.rear}
        target={s.heightRear}
        hint={settle ? `Neue Federn setzen sich hinten bis ≈ ${settle} mm – nach 100–200 km Höhe und Referenz neu messen.` : undefined}
        refs={
          <>
            <Ref k="refPerchRear" label="Maß" d={co.refPerchRear} />
            <Ref k="refHeightRear" label="Höhe" d={co.refHeightRear} />
          </>
        }
      />
      {!c.perch.rear && <p className="hint">Hinterachse: Höhe HA eintragen.</p>}
    </section>
  );
}
