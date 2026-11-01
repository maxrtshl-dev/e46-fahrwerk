import { useState } from "react";
import type { Confidence, E46Data, Overrides, Val } from "../core/data";
import { applyOverrides } from "../core/data";
import { baseData, measuredVal, useData, useSetup } from "../app/store";
import { Conf } from "./Conf";
import { NumField } from "./NumField";

const SECTIONS: [keyof E46Data, string][] = [
  ["vehicle", "Fahrzeug"],
  ["fitment", "Radhaus-Messwerte"],
  ["frontHardpoints", "Anlenkpunkte VA (bei Serienhöhe)"],
  ["rearEquivalent", "Ersatzmodell HA"],
  ["limits", "Grenzen Teilegutachten"],
  ["calibration", "Kalibrierung"],
];

const LABELS: Record<string, string> = {
  trackFront: "Spurweite VA",
  trackRear: "Spurweite HA",
  stockHeightFront: "Serienhöhe VA",
  stockHeightRear: "Serienhöhe HA",
  currentHeightFront: "Ist-Höhe VA",
  currentHeightRear: "Ist-Höhe HA",
  springRateFront: "Federrate VA",
  springSettleRear: "Setzen Federn HA",
  wheelbase: "Radstand",
  fenderLateralFront: "VA Radlaufkante seitlich",
  fenderLateralRear: "HA Radlaufkante seitlich",
  innerStrutFront: "VA → Federbein",
  innerPerchFront: "VA → Federteller",
  innerRear: "HA → Dämpfer/Lenker",
  bumpTravelFront: "VA Weg bis Puffer",
  bumpTravelRear: "HA Weg bis Puffer",
  lowerArmInner: "Querlenker innen",
  lowerArmOuter: "Traggelenk",
  strutTop: "Domlager",
  maxCamberOffsetAtTop: "max. Sturzkorrektur Dom",
  lowerInner: "unterer Lenker innen",
  lowerOuter: "unterer Lenker außen",
  upperInner: "oberer Lenker innen",
  upperOuter: "oberer Lenker außen",
  minHeightFront: "Mindesthöhe VA",
  minHeightRear: "Mindesthöhe HA",
  perchRangeFrontMin: "Federteller VA min",
  perchRangeFrontMax: "Federteller VA max",
  perchRangeRearMin: "Federteller HA min",
  perchRangeRearMax: "Federteller HA max",
  minGroundClearance: "Bodenfreiheit beladen min",
  bumpStopHeightFront: "Anschlagpuffer VA Höhe",
  rollCenterFrontStock: "RZ VA Serie",
  rollCenterFrontGradient: "RZ-Gradient VA",
  rollCenterRearStock: "RZ HA Serie",
  rollCenterRearGradientMin: "RZ-Gradient HA min",
  rollCenterRearGradientMax: "RZ-Gradient HA max",
  camberGainRearMin: "Sturzzunahme HA min",
  camberGainRearMax: "Sturzzunahme HA max",
};

const isVal = (v: unknown): v is Val => typeof v === "object" && v !== null && "confidence" in v && "unit" in v;

interface Row {
  path: string;
  label: string;
  base: Val;
  eff: Val;
}

function rows(base: E46Data, eff: E46Data, section: keyof E46Data): Row[] {
  const b = base[section] as unknown as Record<string, unknown>;
  const e = eff[section] as unknown as Record<string, unknown>;
  const out: Row[] = [];
  for (const [k, v] of Object.entries(b)) {
    const label = LABELS[k] ?? k;
    if (isVal(v)) out.push({ path: `${section}.${k}`, label, base: v, eff: e[k] as Val });
    else if (typeof v === "object" && v !== null && "y" in v && "z" in v) {
      for (const axis of ["y", "z"] as const) {
        const bv = (v as Record<string, unknown>)[axis];
        if (isVal(bv)) {
          out.push({
            path: `${section}.${k}.${axis}`,
            label: `${label} ${axis}`,
            base: bv,
            eff: (e[k] as Record<string, Val>)[axis]!,
          });
        }
      }
    }
  }
  return out;
}

const CONF: Confidence[] = ["gemessen", "belegt", "gerechnet", "geschätzt", "Annahme"];

function EditorRow({ r }: { r: Row }) {
  const own = useSetup((s) => s.overrides[r.path]);
  const setOverride = useSetup((s) => s.setOverride);
  const id = `ed-${r.path.replace(/\./g, "-")}`;
  return (
    <tr className={own ? "own" : undefined}>
      <th scope="row">
        <label htmlFor={id}>{r.label}</label>
      </th>
      <td className="num" data-k="Repo">
        {r.base.value ?? "–"} <span className="unit">{r.base.unit}</span>
      </td>
      <td>
        <Conf c={r.eff.confidence} />
      </td>
      <td className="edit">
        <NumField
          id={id}
          className="short"
          value={own ? own.value : null}
          allowEmpty
          placeholder="–"
          onChange={(v) => setOverride(r.path, v === null ? null : { ...measuredVal(r.base, v), confidence: own?.confidence ?? "gemessen" })}
        />
        {own && (
          <>
            <select
              aria-label={`Belastbarkeit ${r.label}`}
              value={own.confidence}
              onChange={(e) => setOverride(r.path, { ...own, confidence: e.target.value as Confidence })}
            >
              {CONF.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="button" className="link" onClick={() => setOverride(r.path, null)}>
              Repo-Wert
            </button>
          </>
        )}
      </td>
      <td className="src">{own ? own.source : r.base.source || r.base.note || ""}</td>
    </tr>
  );
}

function Summary({ d }: { d: E46Data }) {
  const count: Record<Confidence, number> = { gemessen: 0, belegt: 0, gerechnet: 0, "geschätzt": 0, Annahme: 0 };
  let missing = 0;
  for (const [sec] of SECTIONS) {
    for (const r of rows(baseData, d, sec)) {
      count[r.eff.confidence]++;
      if (r.eff.value === null) missing++;
    }
  }
  return (
    <div className="summary">
      {CONF.map((c) => (
        <span key={c} className="summary-item">
          <Conf c={c} /> <span className="num">{count[c]}</span>
        </span>
      ))}
      <span className="summary-item hint">davon ohne Wert: {missing}</span>
    </div>
  );
}

function Checklist() {
  const done = useSetup((s) => s.todoDone);
  const toggle = useSetup((s) => s.toggleTodo);
  return (
    <ol className="todo">
      {baseData.measurementsTodo.map((t, i) => (
        <li key={i}>
          <label>
            <input type="checkbox" checked={!!done[i]} onChange={() => toggle(i)} /> <span>{t}</span>
          </label>
        </li>
      ))}
    </ol>
  );
}

function ExportImport() {
  const overrides = useSetup((s) => s.overrides);
  const replace = useSetup((s) => s.replaceOverrides);
  const [msg, setMsg] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const json = JSON.stringify(overrides, null, 2);
  const n = Object.keys(overrides).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setMsg("Kopiert. In den Chat einfügen, dann landen die Werte in e46_data.json.");
    } catch {
      setMsg("Kopieren nicht erlaubt – Text unten markieren und kopieren.");
    }
  };
  const load = (text: string) => {
    try {
      const o = JSON.parse(text) as Overrides;
      applyOverrides(baseData, o); // prüft die Pfade
      replace(o);
      setMsg(`${Object.keys(o).length} Werte übernommen.`);
      setPaste("");
    } catch (e) {
      setMsg(`Nicht übernommen: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="io">
      <div className="io-row">
        <button type="button" className="btn" onClick={copy} disabled={n === 0}>
          {n === 0 ? "Keine eigenen Werte" : `${n} eigene Werte kopieren`}
        </button>
        <label className="btn btn-ghost" htmlFor="io-file">
          Datei laden
        </label>
        <input
          id="io-file"
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) load(await f.text());
            e.target.value = "";
          }}
        />
      </div>
      {msg && <p className="hint">{msg}</p>}
      {n > 0 && (
        <details>
          <summary>JSON ansehen</summary>
          <textarea readOnly rows={8} value={json} aria-label="eigene Werte als JSON" />
        </details>
      )}
      <label htmlFor="io-paste" className="hint">
        Werte einfügen (JSON aus einem anderen Gerät)
      </label>
      <textarea id="io-paste" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{"fitment.innerRear": {…}}' />
      <div className="io-row">
        <button type="button" className="btn btn-ghost" disabled={!paste.trim()} onClick={() => load(paste)}>
          Einfügen
        </button>
      </div>
    </div>
  );
}

export function DataEditor() {
  const d = useData();
  return (
    <div className="data-page">
      <section className="panel">
        <h2>Belastbarkeit</h2>
        <p className="hint">
          Jeder Eingangswert mit Quelle. Ein eigener Wert ersetzt den Repo-Wert in allen Rechnungen, als „gemessen“ markiert. Gespeichert nur in diesem
          Browser – über „kopieren“ kommen die Werte ins Repo.
        </p>
        <Summary d={d} />
      </section>

      <div className="data-grid">
        <section className="panel">
          <h2>Messungen</h2>
          <Checklist />
        </section>
        <section className="panel">
          <h2>Übertragen</h2>
          <ExportImport />
        </section>
      </div>

      {SECTIONS.map(([sec, title]) => (
        <section key={sec} className="panel">
          <h2>{title}</h2>
          <div className="table-wrap">
            <table className="editor">
              <thead>
                <tr>
                  <th scope="col">Wert</th>
                  <th scope="col" className="num">Repo</th>
                  <th scope="col">Status</th>
                  <th scope="col">eigener Wert</th>
                  <th scope="col">Quelle</th>
                </tr>
              </thead>
              <tbody>
                {rows(baseData, d, sec).map((r) => (
                  <EditorRow key={r.path} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
