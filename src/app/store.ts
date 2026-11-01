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
  tire: string;
  staticRadius: number;
}

interface Store extends Setup {
  set: (p: Partial<Setup>) => void;
  applyPreset: (p: Preset) => void;
}

const stockFront = req(data.vehicle.stockHeightFront);
const wheel = data.wheels.current.front;

export const initialSetup: Setup = {
  preset: "Serie",
  heightFront: stockFront,
  heightRear: data.vehicle.stockHeightRear.value,
  bump: 0,
  roll: 0,
  camberCorrDeg: 0,
  tire: wheel.tire,
  staticRadius: wheel.staticRadius,
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
      applyPreset: (p) =>
        set({
          preset: p.name,
          heightFront: p.front ?? stockFront,
          heightRear: p.rear,
          bump: 0,
          roll: 0,
        }),
    }),
    { name: "e46-fahrwerk-setup", storage: safeStorage, version: 1 },
  ),
);
