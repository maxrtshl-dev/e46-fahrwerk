import { useState } from "react";
import type * as THREE from "three";
import { NumField } from "../ui/NumField";
import { useSetup } from "../app/store";
import { autoFit, autoYaw, samplePoints, scaleToLength } from "./scanAlign";

export interface LoadedScan {
  name: string;
  object: THREE.Object3D;
  points: THREE.Vector3[];
}

/** Bedienfeld „Eigener Scan“: laden, ausrichten, ein-/ausblenden. Bleibt auf dem Gerät. */
export function ScanPanel({
  scan,
  onFile,
  onClear,
  groundZ,
  wheelbase,
  overhangFront,
  bodyLength,
  status,
}: {
  scan: LoadedScan | null;
  onFile: (f: File) => void;
  onClear: () => void;
  groundZ: number;
  wheelbase: number;
  overhangFront: number;
  bodyLength: number;
  status: string | null;
}) {
  const a = useSetup((s) => s.scanAlign);
  const set = useSetup((s) => s.setScanAlign);
  const [open, setOpen] = useState(true);

  const auto = () => {
    if (!scan) return;
    const yaw = autoYaw(scan.points, a);
    const fit = autoFit(scan.points, { ...a, yawDeg: yaw }, wheelbase, overhangFront, groundZ);
    set({ yawDeg: yaw, dx: fit.dx, dy: fit.dy, dz: fit.dz });
  };
  const turn = (deg: number) => {
    if (!scan) return;
    const yaw = (((a.yawDeg + deg + 180) % 360) + 360) % 360 - 180;
    const fit = autoFit(scan.points, { ...a, yawDeg: yaw }, wheelbase, overhangFront, groundZ);
    set({ yawDeg: yaw, dx: fit.dx, dy: fit.dy, dz: fit.dz });
  };
  const num = (k: "dx" | "dy" | "dz" | "yawDeg" | "scale", label: string, step: number, unit: string) => (
    <div className="scan-num">
      <label htmlFor={`scan-${k}`}>{label}</label>
      <div className="inline">
        <button type="button" className="chip" aria-label={`${label} kleiner`} onClick={() => set({ [k]: +(a[k] - step).toFixed(4) })}>
          −
        </button>
        <NumField id={`scan-${k}`} className="short" value={+a[k].toFixed(k === "scale" ? 4 : 1)} onChange={(v) => v !== null && set({ [k]: v })} />
        <button type="button" className="chip" aria-label={`${label} größer`} onClick={() => set({ [k]: +(a[k] + step).toFixed(4) })}>
          +
        </button>
        <span className="unit">{unit}</span>
      </div>
    </div>
  );

  return (
    <details className="scan" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Eigener Scan {scan ? `· ${scan.name}` : ""}</summary>
      <p className="hint">
        GLB aus Scaniverse oder Polycam. Der Scan bleibt nur auf diesem Gerät – er wird nicht hochgeladen und landet nicht im Repo.
      </p>
      <div className="io-row">
        <label className="btn" htmlFor="scan-file">
          {scan ? "Anderen Scan laden" : "Scan laden (GLB)"}
        </label>
        <input
          id="scan-file"
          type="file"
          accept=".glb,model/gltf-binary"
          className="visually-hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        {scan && (
          <button type="button" className="btn btn-ghost" onClick={onClear}>
            Scan entfernen
          </button>
        )}
      </div>
      {status && <p className="hint">{status}</p>}
      {scan && (
        <>
          <ol className="scan-steps">
            <li>Höhe VA/HA links auf die Höhe stellen, die das Auto beim Scannen hatte.</li>
            <li>„Automatisch ausrichten“, dann Kamera „Seite VL“: gescannte Räder sollen auf den berechneten liegen.</li>
            <li>Vorne und hinten vertauscht? „180°“. Rest mit den Feinwerten.</li>
          </ol>
          <div className="io-row">
            <button type="button" className="btn" onClick={auto}>
              Automatisch ausrichten
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => turn(180)}>
              180°
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => turn(90)}>
              90°
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => set({ upAxis: a.upAxis === "y" ? "z" : "y" })}>
              Oben: {a.upAxis.toUpperCase()}
            </button>
          </div>
          <div className="scan-grid">
            {num("dx", "Längs", 5, "mm")}
            {num("dy", "Quer", 5, "mm")}
            {num("dz", "Höhe", 2, "mm")}
            {num("yawDeg", "Drehung", 0.5, "°")}
            {num("scale", "Maßstab", 0.002, "×")}
          </div>
          <div className="io-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => set({ scale: scaleToLength(scan.points, a, bodyLength) })}
              title="Nur nötig, wenn der Scan ohne LiDAR entstand"
            >
              Länge auf {bodyLength} mm
            </button>
          </div>
          <div className="scan-opts">
            <label className="check">
              <input type="checkbox" checked={a.visible} onChange={(e) => set({ visible: e.target.checked })} /> Scan zeigen
            </label>
            <label className="check">
              <input type="checkbox" checked={a.hideBody} onChange={(e) => set({ hideBody: e.target.checked })} /> Nachbau ausblenden
            </label>
            <label className="check">
              <input type="checkbox" checked={a.hideWheels} onChange={(e) => set({ hideWheels: e.target.checked })} /> Räder im Scan durch berechnete
              ersetzen
            </label>
            <label htmlFor="scan-op" className="check">
              Deckkraft
              <input id="scan-op" type="range" min={0.15} max={1} step={0.05} value={a.opacity} onChange={(e) => set({ opacity: Number(e.target.value) })} />
            </label>
          </div>
        </>
      )}
    </details>
  );
}

export { samplePoints };
