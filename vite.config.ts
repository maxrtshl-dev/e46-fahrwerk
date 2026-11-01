import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // relative Pfade: läuft als Artifact und später als PWA
  plugins: [react()],
  test: { globals: true },
});
