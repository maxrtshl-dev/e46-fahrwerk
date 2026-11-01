# E46 Fahrwerk & Radhaus – App-Spezifikation (Startpaket für Claude Code)

> Diese Datei ist der Startpunkt für das Projekt. Als `SPEC.md` (oder `CLAUDE.md`) ins Repo-Root legen, zusammen mit `e46_data.json`. Claude Code soll beim Bauen **diese Datei als Quelle der Wahrheit** nutzen.

---

## 1. Ziel

Eine App, die für einen **BMW E46 328Ci Coupé (M52TU, Typ 346C)** in 3D zeigt:

1. **Was die Achsen beim Tieferlegen und Ein-/Ausfedern machen** – Sturz, Spur-Tendenz, Querlenkerwinkel, Momentanpol.
2. **Wo die Rollzentren liegen** (VA und HA) und wie sie mit der Fahrzeughöhe wandern.
3. **Wie es im Radhaus aussieht** bei verschiedenen Felgen-/Reifenkombinationen: Abstand Reifen–Kotflügelkante, Felge–Federbein, eingefedert, mit Sturz, mit Spurplatten.
4. **Ob ein Setup legal bleibt** (Mindestmaße aus dem Teilegutachten des DTS-Gewindefahrwerks).

Grundsatz: **Keine Scheingenauigkeit.** Jeder Eingangswert hat eine Quelle und eine Belastbarkeit. Geschätzte Werte werden in der UI als „≈“ markiert und lassen sich durch eigene Messungen ersetzen.

---

## 2. Tech-Stack (Vorschlag)

| Bereich | Wahl | Grund |
|---|---|---|
| Sprache | TypeScript | Typsicherheit bei Einheiten/Geometrie |
| UI | React + Vite | schnell, bekannt |
| 3D | three.js über **React Three Fiber** + drei | Orbit, Schnittansichten, Labels |
| State | Zustand | einfacher globaler Setup-State |
| Tests | Vitest | Kinematik-Rechenkern muss getestet sein |
| App | **PWA** zuerst, später Capacitor für iOS/Android | läuft sofort auf Handy und Desktop |

Rechenkern (`/src/core`) ist **reines TypeScript ohne three.js-Abhängigkeit**, damit er testbar und später wiederverwendbar ist.

---

## 3. Architektur

```
src/
  core/
    units.ts          // mm, deg, Umrechnung Grad↔Minuten (−0°20′)
    data.ts           // lädt e46_data.json, Typen mit {value, unit, source, confidence}
    tire.ts           // Reifen-/Felgengeometrie
    frontMcPherson.ts // VA-Kinematik (Frontansicht, 2D)
    rearAxle.ts       // HA-Kinematik (vereinfacht, 2D-Ersatzmodell)
    rideHeight.ts     // Fahrzeughöhe ↔ Einfederweg
    fitment.ts        // Radhaus-Freigang, Kollisionen
    legal.ts          // Grenzwerte Teilegutachten
  scene/
    Car.tsx           // vereinfachte Karosserie / Radhaus
    FrontAxle.tsx
    RearAxle.tsx
    Wheel.tsx
    Overlays.tsx      // Rollzentrum, Momentanpol, Hilfslinien, Maße
  ui/
    Controls.tsx      // Slider/Inputs
    ResultsPanel.tsx  // Zahlen + Ampel
    DataEditor.tsx    // Messwerte eintragen, Quelle/Belastbarkeit
  app/
    App.tsx
public/
  e46_data.json
```

---

## 4. Koordinatensystem & Einheiten

- Fahrzeugfest, **ISO 8855**: x nach vorn, y nach links, z nach oben.
- Ursprung: Fahrbahn, Fahrzeugmitte, Höhe der Vorderachse.
- Längen in **mm**, Winkel intern in **Grad (dezimal)**, Anzeige zusätzlich in **Grad/Minuten** (Werkstattformat, z. B. −1°30′).
- **Sturz negativ** = Rad oben nach innen. **Spur positiv** = Vorspur.
- **Fahrzeughöhe** = Radmitte senkrecht bis Radlaufkante (wie Teilegutachten/Abnahme).

---

## 5. Datenmodell

Jeder Zahlenwert in `e46_data.json` hat diese Form:

```ts
type Val = {
  value: number;
  unit: "mm" | "deg" | "N/mm" | "inch" | "-";
  source: string;          // Quelle oder "Messung Max <Datum>"
  confidence: "belegt" | "gerechnet" | "geschätzt" | "Annahme" | "gemessen";
  note?: string;
};
```

Die UI zeigt die Belastbarkeit farbig an. Der **DataEditor** erlaubt, jeden Wert zu überschreiben (gespeichert in localStorage bzw. exportierbar als JSON). Gemessene Werte haben Vorrang.

---

## 6. Startdaten (Stand: Recherche Okt. 2026)

Die vollständigen Werte stehen in `e46_data.json`. Zusammenfassung:

### Grenzen (Teilegutachten DTS 14-TAAS-0183/1K)
| Größe | Wert | Status |
|---|---|---|
| Mindestabstand Radmitte–Radlauf VA | 320 mm | belegt |
| Mindestabstand Radmitte–Radlauf HA | 310 mm | belegt |
| Federteller-Verstellbereich VA | 195–230 mm | belegt |
| Federteller-Verstellbereich HA | 20–45 mm | belegt |
| Mindestbodenfreiheit (beladen) | 80 mm | belegt |
| Anschlagpuffer VA | 50,2 mm hoch, Einfederweg +40 mm ggü. Serie | belegt |

### Fahrzeug
| Größe | Wert | Status |
|---|---|---|
| Spurweite VA / HA | 1480 / 1490 mm | gerundet |
| Serienhöhe Radmitte–Radlauf | ≈ 385 / 365 mm | Forum, unbestätigt |
| Ist-Höhe VA (vor Umbau) | ≈ 360–370 mm | Fotoschätzung |
| Federrate VA DTS | ≈ 48 N/mm (45–56) | gerechnet aus Drahtdaten |
| Setzen der Federn HA | bis ≈ 15 mm | Erfahrungswert |

### VA-Anlenkpunkte (Frontansicht, y = Abstand zur Fahrzeugmitte, z = Höhe, bei Serienhöhe)
| Punkt | y | z | Status |
|---|---|---|---|
| Querlenker innen | 355 | 178 | geschätzt |
| Querlenker außen (Traggelenk) | 675 | 160 | geschätzt |
| Domlager | 520 | 800 | geschätzt (Spreizung ≈ 13,5°) |

### Kalibrierwerte (Modell muss diese treffen)
| Größe | Wert | Status |
|---|---|---|
| Rollzentrum VA Serie | ≈ +91 mm | Modell, typ. McPherson 80–100 mm |
| Gradient RZ VA | ≈ 2,6 mm je mm Tieferlegung | Literatur |
| Kontrollpunkt | RZ ≈ −23 bis −27 mm bei ≈ 45 mm tiefer | MRT Engineering (E36) |
| Rollzentrum HA Serie | ≈ +110 mm | Annahme |
| Gradient RZ HA | 1,0–1,5 mm je mm | Annahme |
| Sturzzunahme HA | 0,015–0,03 °/mm | Annahme |

### BMW-Sollwerte Serie (TIS 32 00)
| | Sturz | Spur | Nachlauf |
|---|---|---|---|
| VA | −0°20′ ±20′ | 0°14′ ±8′ gesamt | 5°26′ |
| HA | −1°30′ ±15′ | 0°16′ ±6′ gesamt | – |

### Persönliche Ziele / Referenzen
- Wunsch-Setup „K“ (Keil): **322 / 320 mm**; Alternative 325 / 314 mm; konservativ ≈ 330 mm VA.
- Referenz Bruder: AP-Gewinde, eingetragen 330 / 310 mm.
- Sturz VA Ziel ≈ −1,5° bis −1°50′ (Dom nach innen gedrückt, max. ≈ 0,5° Versatz).
- Sturz HA kommt nach Tieferlegung kaum unter ≈ −2°.
- Fahrverhalten: neutral mit Hang zum Übersteuern. Negativ-Referenz: früherer E90 (zu untersteuernd).
- Reifen aktuell: ~~225/40 R18~~ → seit 2026-11-01 **BMW Styling 68**: VA 7,5J×17 ET41 mit 225/45 R17, HA 8,5J×17 ET50 mit 245/40 R17 (maßgeblich ist `e46_data.json`).

---

## 7. Berechnungen

### 7.1 Reifen & Felge (`tire.ts`)
- Reifendurchmesser: `D = Zoll·25,4 + 2 · Breite · Querschnitt/100`
  → 225/40 R18: 457,2 + 180 = **637,2 mm**, r = 318,6 mm (Test!).
- Statischer Radius: Eingabe, Default `r_stat ≈ r − 13 mm`.
- Felgenbreite in mm: `J · 25,4` (Maulweite, zwischen den Hörnern). Hornbreite je Seite ≈ 6–7 mm als Parameter.
- Lage relativ zur Radanlagefläche (positive Werte = Richtung Fahrzeugaußen):
  - Außenkante Felge: `+ (B/2 − ET) + Spurplatte`
  - Innenkante Felge: `− (B/2 + ET) + Spurplatte`
- Reifenflanke: Reifenbreite vs. Felgenbreite → Schulter steht je Seite um `(Reifenbreite − B)/2` über (vereinfacht, als Parameter einstellbar; Stretch = negativ).

### 7.2 Fahrzeughöhe ↔ Einfederung (`rideHeight.ts`)
- Tieferlegung `Δ = h_Serie − h_neu` (pro Achse).
- Im Kinematikmodell: Rad bewegt sich relativ zur Karosserie um `Δ` nach oben.
- Zusätzlich frei: dynamischer Einfederweg (Bump/Droop) und Wankwinkel.

### 7.3 Vorderachse McPherson (`frontMcPherson.ts`)
Ebenes Modell in der Frontansicht:
1. Querlenker dreht um inneren Lagerpunkt; Traggelenk liegt auf Kreisbahn.
2. Federbeinachse geht durch Domlager und Traggelenk (Länge variabel).
3. Zu gegebenem Einfederweg den Querlenkerwinkel lösen (numerisch, z. B. Bisection).
4. **Momentanpol (IC)**: Schnitt aus Querlenker-Gerade und Senkrechter zur Federbeinachse durch das Domlager.
5. **Rollzentrum**: Schnitt der Geraden Radaufstandspunkt → IC mit der Fahrzeugmitte (y = 0).
6. **Sturz**: Federbeinwinkel minus feste Spreizung, Konstante so kalibrieren, dass bei Serienhöhe −0°20′ herauskommt. Domversatz (Sturzkorrektur) als Parameter in mm bzw. Grad.
7. Ausgabe: RZ-Höhe, Querlenkerwinkel, Sturz (zur Karosserie und zur Fahrbahn), Spurweitenänderung, relative Spuränderung (Bump Steer, nur Tendenz).
8. **Kalibriertest**: Serienhöhe → RZ ≈ +91 mm; 45 mm tiefer → RZ ≈ −23 bis −27 mm. Abweichung > 10 mm = Test schlägt fehl.

### 7.4 Hinterachse (`rearAxle.ts`)
Der E46 hat hinten eine Mehrlenkerachse. **v1**: 2D-Ersatzmodell (oberer und unterer Lenker in der Frontansicht), Lenkerpunkte als Parameter, so kalibriert, dass:
- Serie: Sturz −1°30′, RZ ≈ +110 mm.
- Sturzzunahme und RZ-Gradient innerhalb der Annahmebänder liegen.

Alle HA-Ergebnisse werden als **Band (min–max)** angezeigt, nicht als Punktwert, bis echte Messwerte vorliegen. Später (v2): 3D-Mehrlenker mit gemessenen Punkten.

### 7.5 Radhaus-Freigang (`fitment.ts`)
Geprüft wird pro Rad, statisch und im Lastfall:
- **Kotflügelkante oben**: senkrechter Abstand Reifenlauffläche → Radlaufkante.
- **Kotflügelkante außen**: seitlicher Überstand der Reifenschulter gegenüber der Radlaufkante, inklusive Sturz (Rad oben wandert um `r · sin(Sturz)` nach innen).
- **Innen VA**: Felgeninnenkante und Reifenschulter gegen Federbein/Federteller (Abstand ab Radanlagefläche als Messwert).
- **Innen HA**: gegen Dämpfer/Lenker/Radhausschale (Messwert).
- Lastfälle: statisch · eingefedert bis Anschlagpuffer · Wanken (z. B. 2°) · VA zusätzlich Lenkeinschlag (v2).

Ampel: grün > 10 mm · gelb 3–10 mm · rot < 3 mm bzw. Kollision.

**Radlaufkante als Profil**: v1 als Kreisbogen um die Radmitte bei Serienhöhe, Radius aus Serienhöhe. Sobald gemessen, ersetzt eine Punktliste (Winkel → Höhe/Seitenlage) den Kreis.

### 7.6 Legal (`legal.ts`)
- Höhe VA ≥ 320 mm, HA ≥ 310 mm; Puffer < 3 mm = gelb.
- Bodenfreiheit ≥ 80 mm (beladen) – Hinweis, solange kein Messwert.
- Felgen/Reifen: Hinweis, dass Kombination im Gutachten der Felge mit Typ 346C stehen muss (keine automatische Prüfung).

---

## 8. Visualisierung & Bedienung

### Szene
- Vereinfachte Karosserie (Box/Hülle) mit **ausgeschnittenem Radhaus** und Radlaufkante als Linie.
- Achsen als Stäbe/Gelenke: Querlenker, Federbein, Domlager, HA-Lenker.
- Rad aus Felge (Zylinder mit Bett/Schüssel angedeutet) und Reifen (Torus-artig).
- Overlays: Momentanpol, Verbindungslinien, **Rollzentren als Punkte**, Rollachse als Linie VA–HA, Maßpfeile für Freigang.

### Ansichten
- Freie 3D-Orbit-Ansicht.
- **Frontansicht-Schnitt VA** und **HA** (orthografisch) – hier sieht man Kinematik und Rollzentrum am besten.
- **Radhaus-Detail**: Kamera von außen und von schräg innen auf ein Rad.
- Vergleich: zwei Setups übereinander (A transparent, B voll).

### Eingaben
- Höhe VA/HA (mm) mit Grenzlinie aus dem Gutachten.
- Felge: Zoll, J, ET, Spurplatte (mm), getrennt VA/HA.
- Reifen: Breite/Querschnitt/Zoll, statischer Radius.
- Sturzkorrektur VA (Domversatz), Exzenter HA (Sturz-Offset).
- Einfedern/Ausfedern (mm), Wankwinkel (°).
- Presets: Serie · Ist-Zustand · K 322/320 · 325/314 · konservativ 330 · Bruder 330/310.

### Ausgaben (ResultsPanel)
Pro Achse: Höhe, RZ-Höhe, Sturz (Grad/Minuten), Querlenkerwinkel, Restfederweg bis Puffer, Freigänge mit Ampel, Legal-Status. Unsicherheit immer mit „≈“ oder Band.

---

## 9. Messungen, die die Daten verbessern

Im DataEditor als Checkliste anlegen:
1. Ist-Höhe alle 4 Räder (Radmitte → Radlaufkante, ebener Boden, Tank halb).
2. Vermessungsprotokoll Ist-Zustand (Sturz/Spur bei bekannter Höhe) → kalibriert Sturzzunahme.
3. Nach Einbau DTS: Höhe nach 100–200 km (Setzen) und Vermessungsprotokoll.
4. Freier Weg bis Anschlagpuffer (Kabelbinder am Dämpferrohr).
5. **Radhausprofil**: je Rad 5–7 Punkte der Radlaufkante (z. B. alle 30° ab Radmitte) als Höhe und seitlicher Abstand zur Radanlagefläche.
6. **Innenfreigang**: Abstand Radanlagefläche → Federbein/Federteller (VA) bzw. → Dämpfer/Lenker (HA), mit Lineal waagerecht.
7. Anlenkpunkte VA, falls möglich (Querlenker innen/außen, Domlager-Mitte), Auto auf Böcken mit definierter Höhe.

---

## 10. Meilensteine

1. **M1 – Rechenkern**: `tire.ts`, `frontMcPherson.ts`, `rideHeight.ts`, `legal.ts` + Tests (Kalibrierwerte aus 6./7.3).
2. **M2 – 2D-Frontansicht VA**: Kinematik und Rollzentrum interaktiv (SVG oder R3F orthografisch).
3. **M3 – Radhaus-Freigang** mit Ampel, Felgen-/Reifeneingabe, Presets.
4. **M4 – 3D-Szene** mit Orbit, Radhaus-Detail, Setup-Vergleich.
5. **M5 – HA-Ersatzmodell**, Rollachse, DataEditor mit Messwerten.
6. **M6 – PWA** (offline, installierbar), danach optional Capacitor.

---

## 11. Regeln für die Umsetzung

- Werte nur so genau anzeigen, wie die Daten es hergeben.
- Keine Zahl im Code hart verdrahten, die nicht aus `e46_data.json` kommt (außer physikalischen Konstanten).
- Jede Kinematikfunktion hat Unit-Tests mit den Kalibrierwerten.
- UI-Sprache: **Deutsch**.
- Hinweis in der App: Ersetzt keine Achsvermessung und keine Abnahme.
