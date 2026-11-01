# E46 Fahrwerk & Radhaus

Eigenständiges Projekt im Repo, unabhängig von `finanzen/`. Die Finanz-Regeln
aus der Wurzel-`CLAUDE.md` gelten hier nicht.

- **Quelle der Wahrheit ist `SPEC.md`.** Fahrzeugdaten nur aus
  `public/e46_data.json` – keine Zahl im Code hart verdrahten (Ausnahme:
  physikalische Konstanten und die SPEC-Schwellen in `src/core/thresholds.ts`).
- `src/core/` ist reines TypeScript ohne three.js/React. Jede Kinematikfunktion
  hat Vitest-Tests mit den Kalibrierwerten aus der JSON.
- Prüfen: `npm test` und `npm run typecheck` (im Ordner `fahrwerk/`).
- Lokal ansehen: `npm run dev`. Bauen: `npm run build` → `dist/`.
- **Veröffentlicht als Artifact:** <https://claude.ai/artifact/32A3Gk5sV1rZguaADhD1Zf>
  (Slug `105b9777-ce0e-45c2-acb9-c91f7a661406`). Nach jedem Build neu
  veröffentlichen mit `publish_files`, Modus `replace` – die Dateinamen in
  `dist/assets/` tragen einen Hash und ändern sich.
- UI-Sprache Deutsch. Keine Scheingenauigkeit: geschätzte Werte mit „≈“,
  HA-Ergebnisse als Band.

## Stand

| Meilenstein | Status |
|---|---|
| M1 Rechenkern (units, data, tire, rideHeight, frontMcPherson, legal) | fertig |
| M2 2D-Frontansicht VA (SVG, ganze Achse mit Wanken, `frontAxle.ts`, `format.ts`) | fertig, 33 Tests gesamt |
| M3 Radhaus-Freigang (`fitment.ts`) | offen |
| M4 3D-Szene | offen |
| M5 HA-Ersatzmodell, DataEditor | offen |
| M6 PWA | offen |

## Modellannahmen M1 (bewusst, dokumentiert)

- Radträger starr mit Federbeinrohr; Radmitte auf halber Spurweite, Höhe =
  statischer Radius aus `wheels.current` – damit gelten die z-Werte der
  Anlenkpunkte.
- Aufstandspunkt senkrecht unter der Radmitte.
- Sturz = BMW-Sollwert Serie − Änderung der Federbeinneigung.
- Spuränderung (Bump Steer) liefert `null`: Spurstangenpunkte fehlen.
- Restfederweg bis Puffer: nicht berechenbar, solange nur „+40 mm ggü. Serie“
  belegt ist – Messung „Freier Weg bis Anschlagpuffer“ nötig.

## Annahmen M2

- Wanken: jedes Rad wird mit seinem Radhub gelöst; Fahrbahn = Gerade durch
  beide Aufstandspunkte; Rollzentrum = Schnitt der beiden Polstrahlen.
- Darstellung im Fahrbahnsystem (Straße waagerecht), Serie grau dahinter.
  Blick von vorn: Fahrzeug links erscheint rechts im Bild.
- Anzeige gerundet nach Belastbarkeit (`format.ts`): geschätzt → 5 mm / 5′.
