# E46 Fahrwerk & Radhaus

Öffentliches Repo, veröffentlicht über GitHub Pages:
<https://maxrtshl-dev.github.io/e46-fahrwerk/>. Entstanden im privaten
Finanz-Repo `Assistent` und mit Historie hierher umgezogen (2026-11-01).
**Öffentlich** – keine privaten Daten (Kontostände, Adressen, Kennzeichen,
FIN) hier ablegen.

- **Quelle der Wahrheit ist `SPEC.md`.** Fahrzeugdaten nur aus
  `public/e46_data.json` – keine Zahl im Code hart verdrahten (Ausnahme:
  physikalische Konstanten und die SPEC-Schwellen in `src/core/thresholds.ts`).
- `src/core/` ist reines TypeScript ohne three.js/React. Jede Kinematikfunktion
  hat Vitest-Tests mit den Kalibrierwerten aus der JSON.
- Prüfen: `npm test` und `npm run typecheck`.
- Lokal ansehen: `npm run dev`. Bauen: `npm run build` → `dist/`.
- **Ziel-Hosting: GitHub Pages** aus eigenem Repo, Push auf `main` baut und
  veröffentlicht. Service Worker entsteht beim Build (`vite.config.ts`),
  Cache-Version = Hash der Dateiliste.
- **Zusätzlich als Artifact:** <https://claude.ai/artifact/32A3Gk5sV1rZguaADhD1Zf>
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
| M3 Radhaus-Freigang (`fitment.ts`, HA-Band `rearAxle.ts`, Räder je Achse, Messwerte) | fertig, 43 Tests gesamt |
| M4 3D-Szene (`src/scene/`, R3F, nachgeladen im Reiter „3D“): Orbit, Front/Heck, Radhaus-Detail, Vergleich mit Preset, Rollachse | fertig, 57 Tests gesamt |
| M5 HA-Ersatzmodell (`twoLink.ts`), Rollachse (`rollAxis.ts`), Daten-Editor mit Überschreibungen, Checkliste, Export/Import | fertig, 55 Tests gesamt |
| M6 PWA: Manifest, Icons, Service Worker (offline geprüft), Pages-Workflow | fertig |

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

## Annahmen M3

- Räder: Styling 68, VA 7,5J ET41 225/45 R17, HA 8,5J ET50 245/40 R17
  (montiert, Angabe Max 2026-11-01). r stat. = r − 13 mm, nicht gemessen.
- Zweiter Radsatz in `wheels.sets`: 18" Doppelspeiche (nach Foto vermutlich
  Styling 193, E90), VA 8J ET34 225/40 R18, HA 8,5J ET37 255/35 R18. In der
  App per Knopf umschaltbar; `wheels.current` bleibt Referenz für die Radlage.
- Radlaufkante als Kreis um die Radmitte in Serienlage → Spalt oben = Höhe −
  unbelasteter Reifenradius. Hängt nur an der eingestellten Höhe und der
  Reifengröße, nicht an der geschätzten Serienhöhe.
- Spalt oben < 3 mm ist nur dann rot, wenn die Schulter unter der Kante liegt
  oder die seitliche Lage nicht gemessen ist; sonst gelb („taucht ein“).
- VA: Federbein/Federteller starr mit Radträger → Innenfreigang unabhängig von
  Sturz und Einfedern. Lenkeinschlag fehlt (v2).
- HA: Sturz als Band aus den Annahmen; außen zählt der ungünstigste Wert.
- Messwerte (`fitment.*` in der JSON) sind leer; die App speichert eigene
  Eingaben nur im Browser. Messwerte gehören in die JSON, sobald sie da sind.

## Annahmen M5

- HA: ebener Doppellenker als Ersatz der Mehrlenkerachse, Punkte in
  `rearEquivalent` (Annahme). Kalibriert auf die Bandmitte: RZ 110 mm,
  Gradient ≈ 1,27, Sturzzunahme ≈ 0,022 °/mm. Die Annahmebänder werden
  daneben weiter angezeigt.
- **Widerspruch, offen:** Die SPEC sagt, der HA-Sturz komme nach dem
  Tieferlegen kaum unter ≈ −2°. Das Annahmeband liefert bei 45 mm tiefer
  −2°11′…−2°51′. Ein Vermessungsprotokoll bei bekannter Höhe klärt das; dann
  `calibration.camberGainRear*` anpassen und `rearEquivalent` neu kalibrieren.
- Rollachse statisch (nur Höhen), Radstand 2725 mm.
- Eigene Werte: Überschreibungen je JSON-Pfad (`store.overrides`), nur im
  Browser. „Kopieren“ liefert JSON `{pfad: Val}` – das kommt per Chat zu Claude
  und wird mit Quelle in `public/e46_data.json` eingetragen.

## Annahmen M4

- Szene in mm im Fahrzeugsystem (ISO 8855, z oben). Achsen kommen direkt aus
  dem Rechenkern (Karosseriesystem); `bodyToRoad` legt die Karosserie so, dass
  die Fahrbahn waagerecht liegt → Tieferlegen, Nicken, Wanken sichtbar.
- Lenker liegen vereinfacht in der Achsebene (x = 0 bzw. −Radstand).
- Karosserie E46 Coupé als Loft aus Querschnitten (`scene/e46Body.ts`),
  skaliert auf `vehicle.bodyLength/Width/Height/overhangFront` (geschätzt, aus
  dem Gedächtnis – prüfen). Proportionen der Stationen sind reine Darstellung.
  Radläufe per Shader ausgeschnitten: Kreis um die Radmitte in Serienlage,
  Radius Serienhöhe – dieselbe Kante wie in `fitment.ts`.
- `BodyModel` (in `e46Body.ts`) beantwortet Hautabfragen (`sideY`, `topZ`,
  `surfaceX`); `e46Details.ts` projiziert darauf Scheiben (Hofmeister-Knick),
  Fugen, Türgriff, Nieren, Scheinwerfer mit Ringen, Rückleuchten, Diffusor,
  Endrohre und Spiegel. Formen nach Augenmaß, keine Logos.
- Abgeglichen mit Fotos von Max (2026-11-01, nicht im Repo): Silber, M-Front
  mit Mitteleinlass und Nebeltaschen, Sicke über Kotflügel/Tür/Seitenwand,
  dunkler Seitenblinker, Schiebedach, Facelift-Rückleuchten, Spoilerlippe,
  M-Diffusor, Doppelendrohr links, Tankklappe rechts. **Kennzeichen nie
  übernehmen** – Schilder bleiben leer.
- Felgen (`scene/styling68.ts`, `wheelStar`): Styling 68 mit 5, Styling 193 mit
  7 Doppelspeichen, gewölbt von der Radanlagefläche (ET) bis zum Horn,
  Lochkreis 5×120. Stilisiert.
- Fitment in 3D (`scene/fitmentMarks.ts`): Bördelkante (Rohr) und Radhausschale
  je Rad, Maße Spalt oben und Schulter ↔ Kante an den linken Rädern – dieselben
  Werte wie `fitment.ts` (Test). Kante seitlich: `fitment.fenderLateral*` +
  Radanlagefläche, ohne Messung auf der Karosseriehaut (als „Kante geschätzt“
  beschriftet). Kameras „Fitment VL/HL“ und „Seite VL“; dort nur Maße dieser Achse.
- Radlage: Referenz-ET aus `wheels.current`, Abweichung und Spurplatte
  verschieben das Rad (`wheelLateralShift`).
- Etiketten: eigene HTML-Ebene, per `useFrame` projiziert (drei `<Html>`
  rendert das erste Etikett unter React 19 leer).
