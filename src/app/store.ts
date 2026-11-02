import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import raw from "../../public/e46_data.json";
import type { E46Data, Overrides, Preset, Val, WheelSet, WheelStyle } from "../core/data";
import { applyOverrides, req } from "../core/data";
import { defaultAlign, type ScanAlign } from "../scene/scanAlign";

/** Daten aus dem Repo, unverändert. */
export const baseData = raw as unknown as E46Data;
/** Kurzname für Stellen, die nur Repo-Werte brauchen (Texte, Presets). */
export const data = baseData;

export interface WheelSetup {
  widthJ: number;
  et: number;
  spacer: number;
  tire: string;
  staticRadius: number;
}

export interface Setup {
  preset: string | null;
  heightFront: number;
  heightRear: number | null;
  bump: number; // mm, + = einfedern
  roll: number; // Grad, + = Karosserie neigt nach rechts
  camberCorrDeg: number; // Domversatz VA als Sturzkorrektur, Grad (≥ 0)
  camberOffsetRearDeg: number; // Exzenter HA, Grad (− = negativer)
  wheels: { front: WheelSetup; rear: WheelSetup };
  /** Felgendesign für die 3D-Ansicht. */
  wheelStyle: WheelStyle;
  /** Gewählter Radsatz aus data.wheels.sets; null = von Hand geändert. */
  wheelSet: string | null;
  /** Eigene Werte je Pfad in e46_data.json – Messungen haben Vorrang. */
  overrides: Overrides;
  /** Checkliste Messungen: Index in measurementsTodo → erledigt. */
  todoDone: Record<number, boolean>;
  /** Ausrichtung des eigenen Scans (der Scan selbst liegt nur in IndexedDB). */
  scanAlign: ScanAlign;
}

export type MeasureKey = Exclude<keyof E46Data["fitment"], "note">;

interface Store extends Setup {
  set: (p: Partial<Setup>) => void;
  setWheel: (axle: "front" | "rear", p: Partial<WheelSetup>) => void;
  applyWheelSet: (w: WheelSet) => void;
  setOverride: (path: string, v: Val | null) => void;
  replaceOverrides: (o: Overrides) => void;
  toggleTodo: (i: number) => void;
  setScanAlign: (p: Partial<ScanAlign>) => void;
  applyPreset: (p: Preset) => void;
}

const stockFront = req(baseData.vehicle.stockHeightFront);

const toSetup = (w: E46Data["wheels"]["current"]["front"]): WheelSetup => ({
  widthJ: w.widthJ ?? 8,
  et: w.et ?? 40,
  spacer: w.spacer,
  tire: w.tire,
  staticRadius: w.staticRadius,
});

export const initialSetup: Setup = {
  preset: "Serie",
  heightFront: stockFront,
  heightRear: baseData.vehicle.stockHeightRear.value,
  bump: 0,
  roll: 0,
  camberCorrDeg: 0,
  camberOffsetRearDeg: 0,
  wheels: { front: toSetup(baseData.wheels.current.front), rear: toSetup(baseData.wheels.current.rear) },
  wheelStyle: baseData.wheels.current.style ?? "styling68",
  wheelSet: baseData.wheels.sets?.[0]?.id ?? null,
  overrides: {},
  todoDone: {},
  scanAlign: defaultAlign,
};

/** Neue eigene Messung für einen Pfad. */
export function measuredVal(base: Val, value: number): Val {
  const today = new Date().toISOString().slice(0, 10);
  return { value, unit: base.unit, source: `Messung Max ${today}`, confidence: "gemessen", note: base.note };
}

// localStorage kann im Artifact-Rahmen fehlen oder werfen – dann eben ohne.
const safeStorage = createJSONStorage(() => {
  try {
    const s = window.localStorage;
    s.getItem("probe");
    return s;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useSetup = create<Store>()(
  persist(
    (set) => ({
      ...initialSetup,
      set: (p) => set({ ...p, preset: "preset" in p ? (p.preset ?? null) : null }),
      setWheel: (axle, p) => set((st) => ({ wheels: { ...st.wheels, [axle]: { ...st.wheels[axle], ...p } }, wheelSet: null })),
      applyWheelSet: (w) => set({ wheels: { front: toSetup(w.front), rear: toSetup(w.rear) }, wheelStyle: w.style, wheelSet: w.id }),
      setOverride: (path, v) =>
        set((st) => {
          const next = { ...st.overrides };
          if (v === null) delete next[path];
          else next[path] = v;
          return { overrides: next };
        }),
      replaceOverrides: (o) => set({ overrides: o }),
      toggleTodo: (i) => set((st) => ({ todoDone: { ...st.todoDone, [i]: !st.todoDone[i] } })),
      setScanAlign: (p) => set((st) => ({ scanAlign: { ...st.scanAlign, ...p } })),
      applyPreset: (p) =>
        set({
          preset: p.name,
          heightFront: p.front ?? stockFront,
          heightRear: p.rear,
          bump: 0,
          roll: 0,
        }),
    }),
    {
      name: "e46-fahrwerk-setup",
      storage: safeStorage,
      version: 5,
      migrate: (old, version) => {
        const o = (old ?? {}) as Partial<Setup> & { measured?: Record<string, number | null> };
        const overrides: Overrides = {};
        // v2: Radhaus-Messwerte → Überschreibungen
        for (const [k, v] of Object.entries(o.measured ?? {})) {
          const base = baseData.fitment[k as MeasureKey];
          if (base && typeof v === "number") overrides[`fitment.${k}`] = measuredVal(base, v);
        }
        return {
          ...initialSetup,
          ...o,
          wheels: version < 2 ? initialSetup.wheels : (o.wheels ?? initialSetup.wheels),
          overrides: { ...overrides, ...(o.overrides ?? {}) },
          todoDone: o.todoDone ?? {},
          wheelStyle: o.wheelStyle ?? initialSetup.wheelStyle,
          wheelSet: o.wheelSet === undefined ? initialSetup.wheelSet : o.wheelSet,
          scanAlign: { ...defaultAlign, ...(o.scanAlign ?? {}) },
        } as Store;
      },
    },
  ),
);

/** Repo-Daten mit eigenen Werten. Ungültige Pfade werden übergangen. */
export function useData(): E46Data {
  const overrides = useSetup((s) => s.overrides);
  return useMemo(() => {
    const valid: Overrides = {};
    for (const [p, v] of Object.entries(overrides)) {
      try {
        applyOverrides(baseData, { [p]: v });
        valid[p] = v;
      } catch {
        /* Pfad gibt es in dieser Datenversion nicht mehr */
      }
    }
    return applyOverrides(baseData, valid);
  }, [overrides]);
}
