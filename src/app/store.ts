import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import raw from "../../public/e46_data.json";
import type { E46Data, Preset } from "../core/data";
import { req } from "../core/data";

export const data = raw as unknown as E46Data;

export interface Setup {
  preset: string | null;
  heightFront: number;
  heightRear: number | null;
  bump: number; // mm, + = einfedern
  roll: number; // Grad, + = Karosserie neigt nach rechts
  camberCorrDeg: number; // Domversatz als Sturzkorrektur, Grad (≥ 0)
  wheels: { front: WheelSetup; rear: WheelSetup };
  /** Eigene Messwerte Radhaus (mm), Schlüssel aus data.fitment. */
  measured: Partial<Record<MeasureKey, number | null>>;
}

export interface WheelSetup {
  widthJ: number;
  et: number;
  spacer: number;
  tire: string;
  staticRadius: number;
}

export type MeasureKey = Exclude<keyof E46Data["fitment"], "note">;

/** Messwert: eigene Eingabe vor Datenwert. */
export function measure(s: Setup, k: MeasureKey): number | null {
  const own = s.measured[k];
  if (own !== undefined && own !== null) return own;
  return data.fitment[k].value;
}

interface Store extends Setup {
  set: (p: Partial<Setup>) => void;
  setWheel: (axle: "front" | "rear", p: Partial<WheelSetup>) => void;
  setMeasured: (k: MeasureKey, v: number | null) => void;
  applyPreset: (p: Preset) => void;
}

const stockFront = req(data.vehicle.stockHeightFront);
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
  heightRear: data.vehicle.stockHeightRear.value,
  bump: 0,
  roll: 0,
  camberCorrDeg: 0,
  wheels: { front: toSetup(data.wheels.current.front), rear: toSetup(data.wheels.current.rear) },
  measured: {},
};

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
      setWheel: (axle, p) => set((st) => ({ wheels: { ...st.wheels, [axle]: { ...st.wheels[axle], ...p } } })),
      setMeasured: (k, v) => set((st) => ({ measured: { ...st.measured, [k]: v } })),
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
      version: 2,
      // v1 kannte nur einen Reifen für beide Achsen: Räder neu aus den Daten
      migrate: (old) => ({ ...initialSetup, ...(old as object), wheels: initialSetup.wheels, measured: {} }) as Store,
    },
  ),
);
