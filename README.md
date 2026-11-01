# E46 Fahrwerk & Radhaus

Web-App für einen BMW E46 328Ci Coupé (Typ 346C) mit DTS-Gewindefahrwerk:
Kinematik der Vorderachse (McPherson) und Hinterachse (Ersatzmodell),
Rollzentren und Rollachse, Radhaus-Freigang und Grenzen aus dem Teilegutachten.

Jeder Eingangswert hat Quelle und Belastbarkeit (`public/e46_data.json`).
Geschätzte Werte werden mit „≈“ angezeigt und lassen sich im Reiter
„Daten & Messungen“ durch eigene Messungen ersetzen.

**Ersetzt keine Achsvermessung und keine Abnahme.**

## Benutzen

Auf dem iPhone die Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
Danach startet sie wie eine App und läuft auch ohne Netz.

## Entwickeln

```bash
npm install
npm run dev        # lokal ansehen
npm test           # Rechenkern, Kalibrierwerte
npm run build      # → dist/
```

Jeder Push auf `main` baut und veröffentlicht über GitHub Actions auf
GitHub Pages (`.github/workflows/pages.yml`).

Grundlage und Regeln: `SPEC.md`. Stand und Modellannahmen: `CLAUDE.md`.
