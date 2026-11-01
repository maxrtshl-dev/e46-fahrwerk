import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Erzeugt sw.js mit der Liste aller gebauten Dateien (M6, offline).
 * Die Version ist ein Hash über die Dateinamen – jeder neue Build ersetzt den Cache.
 */
function serviceWorker(): Plugin {
  return {
    name: "e46-service-worker",
    apply: "build",
    generateBundle(_, bundle) {
      const pub = (dir: string, prefix = ""): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? pub(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
        );
      const files = ["./", ...Object.keys(bundle), ...pub("public")].filter((f) => f !== "sw.js");
      const version = createHash("sha256").update(files.sort().join("|")).digest("hex").slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: SW.replace("__VERSION__", version).replace("__FILES__", JSON.stringify(files)),
      });
    },
  };
}

const SW = `// erzeugt beim Build – nicht von Hand ändern
const CACHE = "e46-__VERSION__";
const FILES = __FILES__;
const FONT_CACHE = "e46-fonts";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Schriften: aus dem Cache, im Hintergrund aktualisieren
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONT_CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        const net = fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Seite: erst Netz (neue Version), sonst Cache. Dateien mit Hash: erst Cache.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./", { ignoreVary: true })));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreVary: true }).then((hit) => hit || fetch(e.request)));
});
`;

export default defineConfig({
  base: "./", // relative Pfade: läuft unter /e46-fahrwerk/ auf GitHub Pages und als Artifact
  plugins: [react(), serviceWorker()],
  test: { globals: true },
});
