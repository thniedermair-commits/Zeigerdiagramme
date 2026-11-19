# ZeigerLab – Zeigerdiagramme

Interaktive Lern-App für den Unterricht (z. B. Elektroniker/-innen für Betriebstechnik, 11. Klasse) zu **R, L und C an Wechselspannung**: Blindwiderstände, Phasenverschiebung und Zeigerdiagramme.

## Starten

Kein Server und keine Installation nötig: `index.html` im Browser öffnen (funktioniert auch offline).
Alternativ über GitHub Pages veröffentlichen, damit die Klasse einen Link nutzen kann.

## Bereiche

| Bereich | Inhalt |
|---|---|
| ⚡ **Grundlagen** | Rotierender Zeiger mit Liniendiagramm für R, L und C, Merksätze, Blindwiderstand in Abhängigkeit von der Frequenz |
| 🧪 **Simulator** | 9 Schaltungen (einzeln, Reihe, parallel) mit Schaltplan, Zeigerdiagramm, Liniendiagramm, Widerstandsdreieck und vollständigem Rechenweg, Resonanzfrequenz bei R-L-C |
| 🎯 **Aufgaben** | Ergebnisse eingeben und prüfen lassen (Toleranz 2 %), Tipps, Lösungsweg; Zeigerdiagramm maßstäblich auf einem Kästchenraster zeichnen (Bezugszeiger, Maßstab, „Fuß an Spitze“), automatische Prüfung und grafisches Ablesen; Sterne als Fortschritt |
| 📘 **Formeln** | Formelsammlung und Anleitung zum Zeichnen eines Zeigerdiagramms |

Eigene Aufgaben (z. B. aus dem Arbeitsbuch) lassen sich über „Eigene Aufgabe erstellen“ oder im Simulator anlegen. Antworten und Fortschritt werden nur lokal im Browser gespeichert.

## Beispielaufgabe (getestet)

Spule mit L = 0,4 H und Wicklungswiderstand R = 100 Ω an 230 V / 50 Hz:
X<sub>L</sub> = 125,7 Ω · Z = 160,6 Ω · I = 1,432 A · U<sub>R</sub> = 143,2 V · U<sub>L</sub> = 180 V · φ = 51,5° (induktiv) · cos φ = 0,62.
Zeigerdiagramm mit 1 Kästchen ≙ 20 V: U<sub>R</sub> = 7,2 K., U<sub>L</sub> = 9 K., U = 11,5 K.

## Dateien

- `index.html` – Grundgerüst
- `css/style.css` – Design (hell/dunkel)
- `js/physics.js` – Berechnungen
- `js/render.js` – Schaltpläne und Diagramme (SVG)
- `js/editor.js` – interaktiver Zeigerdiagramm-Editor
- `js/tasks.js` – Aufgabensammlung (hier lassen sich weitere Aufgaben ergänzen)
- `js/app.js` – Oberfläche
