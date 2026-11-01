import { useEffect, useState } from "react";
import { Controls } from "../ui/Controls";
import { DataEditor } from "../ui/DataEditor";
import { FitmentPanel } from "../ui/Fitment";
import { FrontView } from "../ui/FrontView";
import { RearView, RollAxisView } from "../ui/RearView";
import { ResultsPanel } from "../ui/ResultsPanel";
import { MeasurementsPanel, WheelsPanel } from "../ui/Wheels";
import { useComputed } from "./compute";
import { data, useData, useSetup } from "./store";

type View = "achsen" | "daten";
const fromHash = (): View => (window.location.hash === "#daten" ? "daten" : "achsen");

export function App() {
  const s = useSetup();
  const d = useData();
  const c = useComputed(d, s);
  const [view, setView] = useState<View>(fromHash);
  useEffect(() => {
    const on = () => setView(fromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const own = Object.keys(s.overrides).length;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>E46 Fahrwerk</h1>
          <p className="sub">
            {data.meta.vehicle} · {data.meta.coilover}
          </p>
        </div>
        <p className="disclaimer">Modell aus geschätzten Anlenkpunkten. Ersetzt keine Achsvermessung und keine Abnahme.</p>
      </header>
      <nav className="tabs" aria-label="Ansicht">
        <a href="#achsen" className={view === "achsen" ? "tab active" : "tab"} aria-current={view === "achsen" ? "page" : undefined}>
          Achsen
        </a>
        <a href="#daten" className={view === "daten" ? "tab active" : "tab"} aria-current={view === "daten" ? "page" : undefined}>
          Daten & Messungen{own > 0 ? ` · ${own} eigene` : ""}
        </a>
      </nav>
      {view === "achsen" ? (
        <main className="layout">
          <div className="col-view">
            <FrontView c={c} heightFront={s.heightFront} />
            <ResultsPanel c={c} roll={s.roll} />
            <RearView c={c} />
            <RollAxisView c={c} />
            <FitmentPanel c={c} />
          </div>
          <div className="col-side">
            <Controls />
            <WheelsPanel />
            <MeasurementsPanel />
          </div>
        </main>
      ) : (
        <main>
          <DataEditor />
        </main>
      )}
    </div>
  );
}
