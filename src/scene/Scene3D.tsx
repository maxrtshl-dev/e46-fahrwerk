import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { computeAll, type Computed } from "../app/compute";
import { data, useData, useSetup, type Setup } from "../app/store";
import { bodyDims, Car, carLabels, carPose, type Palette } from "./Car";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clearScan, loadScan, saveScan } from "./scanStore";
import { ScanPanel, samplePoints, type LoadedScan } from "./ScanPanel";
import { BodyModel } from "./e46Body";

// Szene in mm, Fahrzeugsystem ISO 8855 (x vorn, y links, z oben); Fahrbahn z = 0.

type ViewId = "frei" | "front" | "heck" | "vl-aussen" | "vl-innen" | "hl-aussen" | "fit-vl" | "fit-hl" | "seite-vl";
const VIEWS: { id: ViewId; label: string }[] = [
  { id: "frei", label: "3D" },
  { id: "front", label: "Front VA" },
  { id: "heck", label: "Heck HA" },
  { id: "vl-aussen", label: "Radhaus VL außen" },
  { id: "vl-innen", label: "Radhaus VL innen" },
  { id: "hl-aussen", label: "Radhaus HL außen" },
  { id: "fit-vl", label: "Fitment VL (längs)" },
  { id: "fit-hl", label: "Fitment HL (längs)" },
  { id: "seite-vl", label: "Seite VL" },
];

function camFor(v: ViewId, wb: number): { pos: [number, number, number]; target: [number, number, number]; fov: number } {
  switch (v) {
    case "front":
      return { pos: [9000, 0, 450], target: [0, 0, 450], fov: 13 };
    case "heck":
      return { pos: [-wb - 9000, 0, 450], target: [-wb, 0, 450], fov: 13 };
    case "vl-aussen":
      return { pos: [700, 2300, 650], target: [0, 760, 450], fov: 35 };
    case "vl-innen":
      return { pos: [650, 150, 420], target: [0, 700, 480], fov: 55 };
    case "fit-vl": // nah am Rad, längs der Flanke von vorn: Kante und Schulter fluchten
      return { pos: [950, 1320, 980], target: [0, 830, 650], fov: 24 };
    case "fit-hl":
      return { pos: [-wb - 950, 1320, 970], target: [-wb, 830, 640], fov: 24 };
    case "seite-vl":
      return { pos: [0, 5200, 520], target: [0, 0, 520], fov: 13 };
    case "hl-aussen":
      return { pos: [-wb + 700, 2300, 650], target: [-wb, 760, 450], fov: 35 };
    default:
      return { pos: [3400, 3600, 1700], target: [-wb / 2, 0, 350], fov: 38 };
  }
}

/** In Rad-Ansichten nur die Maße dieser Achse zeigen. */
const FOCUS: Partial<Record<ViewId, "VA" | "HA">> = {
  "fit-vl": "VA",
  "seite-vl": "VA",
  "vl-aussen": "VA",
  "vl-innen": "VA",
  "fit-hl": "HA",
  "hl-aussen": "HA",
};

function CameraRig({ view, wb }: { view: ViewId; wb: number }) {
  const { camera } = useThree();
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    const c = camFor(view, wb);
    camera.position.set(...c.pos);
    (camera as THREE.PerspectiveCamera).fov = c.fov;
    camera.updateProjectionMatrix();
    controls.current?.target.set(...c.target);
    controls.current?.update();
  }, [view, wb, camera]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI * 0.495} />;
}

/** Schreibt in jedem Bild die Bildschirmlage der Etiketten in die HTML-Elemente. */
function LabelProjector({ labels, refs }: { labels: { id: string; pos: THREE.Vector3 }[]; refs: React.RefObject<Record<string, HTMLDivElement | null>> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const l of labels) {
      const el = refs.current?.[l.id];
      if (!el) continue;
      v.copy(l.pos).add(new THREE.Vector3(0, 0, 90)).project(camera);
      const behind = v.z > 1;
      el.style.display = behind ? "none" : "block";
      el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    }
  });
  return null;
}

/** Farben aus den CSS-Tokens, damit 3D zum hellen und dunklen Thema passt. */
function usePalette(): { main: Palette; ghost: Palette; bg: string; grid: string } {
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const t = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
    const ink = t("--ink", "#1b2329");
    const accent = t("--accent", "#2c5f8a");
    const rc = t("--rc", "#d9600f");
    const ghostC = t("--ghost", "#9aa6ae");
    return {
      main: { body: "#8f979e", glass: "#1d2a33", tire: "#23282c", rim: "#c9d0d5", arm: accent, spring: rc, rc, edge: ink },
      ghost: { body: ghostC, glass: ghostC, tire: ghostC, rim: ghostC, arm: ghostC, spring: ghostC, rc: ghostC, edge: ghostC },
      bg: t("--surface", "#ffffff"),
      grid: t("--line", "#d3dade"),
    };
  }, []);
}

export default function Scene3D({ c, s }: { c: Computed; s: Setup }) {
  const [view, setView] = useState<ViewId>("frei");
  const [compare, setCompare] = useState<string>("Serie");
  const [showBody, setShowBody] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const d = useData();
  const overrides = useSetup((st) => st.overrides);
  const pal = usePalette();
  const wb = d.vehicle.wheelbase.value ?? 2725;
  const model = useMemo(() => new BodyModel(bodyDims(d)), [d]);
  const labels = useMemo(() => {
    const all = carLabels(c, s, model, showDims);
    const f = FOCUS[view];
    return f ? all.filter((l) => l.id.startsWith(`${f}-`)) : all;
  }, [c, s, model, showDims, view]);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ---- eigener Scan (nur auf diesem Gerät)
  const scanAlign = useSetup((st) => st.scanAlign);
  const [scan, setScan] = useState<LoadedScan | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const parse = (name: string, buf: ArrayBuffer) =>
    new Promise<LoadedScan>((resolve, reject) =>
      new GLTFLoader().parse(buf, "", (g) => resolve({ name, object: g.scene, points: samplePoints(g.scene) }), reject),
    );
  useEffect(() => {
    let alive = true;
    loadScan().then(async (st) => {
      if (!st || !alive) return;
      try {
        const sc = await parse(st.name, st.data);
        if (alive) setScan(sc);
      } catch {
        setScanStatus("Gespeicherter Scan ließ sich nicht öffnen.");
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  const onScanFile = async (f: File) => {
    setScanStatus(`Lade ${f.name} …`);
    try {
      const buf = await f.arrayBuffer();
      const sc = await parse(f.name, buf);
      setScan(sc);
      await saveScan({ name: f.name, data: buf });
      setScanStatus(`${f.name} geladen (${(buf.byteLength / 1e6).toFixed(1).replace(".", ",")} MB). Jetzt ausrichten.`);
    } catch (e) {
      setScanStatus(`Konnte ${f.name} nicht laden: ${e instanceof Error ? e.message : String(e)}. Erwartet wird eine .glb-Datei.`);
    }
  };
  const onScanClear = async () => {
    await clearScan();
    setScan(null);
    setScanStatus("Scan von diesem Gerät entfernt.");
  };

  const ghost = useMemo(() => {
    const p = data.presets.find((x) => x.name === compare);
    if (!p) return null;
    const gs: Setup = { ...s, heightFront: p.front ?? s.heightFront, heightRear: p.rear ?? s.heightRear, bump: 0, roll: 0 };
    return computeAll(d, gs);
    // overrides stecken in d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare, d, s.wheels, s.camberCorrDeg, s.camberOffsetRearDeg, overrides]);

  return (
    <section className="panel scene-panel" aria-label="3D-Ansicht">
      <div className="scene-bar">
        <div className="seg" role="group" aria-label="Kamera">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className={view === v.id ? "chip active" : "chip"} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="scene-opts">
          <label htmlFor="cmp">Vergleich (grau)</label>
          <select id="cmp" value={compare} onChange={(e) => setCompare(e.target.value)}>
            <option value="">keiner</option>
            {data.presets.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} {p.front ?? "?"}/{p.rear ?? "?"}
              </option>
            ))}
          </select>
          <label className="check">
            <input type="checkbox" checked={showBody} onChange={(e) => setShowBody(e.target.checked)} /> Karosserie
          </label>
          <label className="check">
            <input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} /> Maße
          </label>
        </div>
      </div>
      <div className="canvas-wrap">
        <Canvas
          camera={{ up: [0, 0, 1], near: 20, far: 60000, fov: 38, position: [3400, 3600, 1700] }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
          style={{ background: pal.bg }}
        >
          <CameraRig view={view} wb={wb} />
          <hemisphereLight args={["#ffffff", "#8a949a", 1.1]} position={[0, 0, 5000]} />
          <directionalLight position={[3000, 2500, 6000]} intensity={1.6} />
          <directionalLight position={[-4000, -3000, 2500]} intensity={0.5} />
          <Grid
            rotation={[Math.PI / 2, 0, 0]}
            position={[-wb / 2, 0, -1]}
            args={[14000, 14000]}
            cellSize={100}
            sectionSize={1000}
            cellColor={pal.grid}
            sectionColor={pal.grid}
            fadeDistance={16000}
            infiniteGrid={false}
          />
          {ghost && <Car c={ghost} s={s} look={{ palette: pal.ghost, opacity: 0.35, showBody, labels: false }} />}
          <Car c={c} s={s} look={{ palette: pal.main, opacity: 1, showBody, labels: true, dims: showDims }} scan={scan ? { object: scan.object, align: scanAlign } : null} />
          <LabelProjector labels={labels} refs={labelRefs} />
        </Canvas>
        {labels.map((l) => (
          <div
            key={l.id}
            className="label3d"
            ref={(el) => {
              labelRefs.current[l.id] = el;
            }}
          >
            {l.text}
          </div>
        ))}
      </div>
      <ScanPanel
        scan={scan}
        onFile={onScanFile}
        onClear={onScanClear}
        status={scanStatus}
        groundZ={carPose(c).gF}
        wheelbase={wb}
        overhangFront={d.vehicle.overhangFront.value ?? 790}
        bodyLength={d.vehicle.bodyLength.value ?? 4488}
      />
      <p className="hint">
        Ziehen = drehen, zwei Finger = zoomen/verschieben. Maße an den linken Rädern aus derselben Rechnung wie die Radhaus-Ampel. Radlauf = Kreis um die
        Radmitte in Serienlage; die Kante sitzt seitlich auf der geschätzten Karosseriebreite, bis „Radlaufkante seitlich“ gemessen ist – dann an der
        gemessenen Stelle. Grau: Vergleichssetup ohne Federn und Wanken.
      </p>
    </section>
  );
}
