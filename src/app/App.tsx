import { Controls } from "../ui/Controls";
import { FrontView } from "../ui/FrontView";
import { InputsPanel, ResultsPanel } from "../ui/ResultsPanel";
import { useComputed } from "./compute";
import { data, useSetup } from "./store";

export function App() {
  const s = useSetup();
  const c = useComputed(s);
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
      <main className="layout">
        <div className="col-view">
          <FrontView axle={c.axle} tire={c.tire} heightFront={s.heightFront} />
          <ResultsPanel c={c} roll={s.roll} />
        </div>
        <div className="col-side">
          <Controls />
          <InputsPanel />
        </div>
      </main>
    </div>
  );
}
