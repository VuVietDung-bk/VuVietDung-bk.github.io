# Moving Like A Knight (web)

A static Canvas port of the Java Swing game in `../Moving_Like_A_Knight/` for GitHub Pages. Open `index.html` through a static server or GitHub Pages; no build step is required.

- `game.js` starts the app; `controller.mjs` handles screens and input.
- `audio.mjs` owns background tracks, sound effects, volume and restart behavior.
- `board.mjs` owns knight movement, undo, hints, flags and scoring.
- `level.mjs` parses levels; `levels.mjs` contains the original level files and flag positions.
- `editor.mjs` owns custom level creation and verification; `storage.mjs` owns local progress.
- `renderer.mjs` draws the original artwork on Canvas.
- `assets/images/` and `assets/music/` are byte-for-byte copies of the original PNG and WAV assets. Audio files are large (about 69 MiB together), so the browser loads them on interaction.

Progress, settings and custom levels are saved in this browser's `localStorage`. The original keyboard controls are supported. On-screen controls cover movement and common actions; open “Level editor and menu controls” for editing tools on touch devices.

## Keyboard controls

| Screen | Keys |
| --- | --- |
| Title | Up/Down select, Left/Right choose replay level, Enter open, S settings, X exit to More |
| Board | Up/Down cycle knight paths, Enter move, Left undo, H hint, F flag, hold D to reset progress, E menu, X exit to More |
| Win | Space next level, E menu, X exit to More |
| More | Left/Right select, Enter open, E menu |
| Settings | Up/Down select setting, Left/Right change it, E menu |
| Saved levels | Up/Down select, Left/Right page, Enter play, L edit, X delete, E back |
| Editor | Arrows move cursor, 0–3 edit tile, K place knight, T/Enter place teleporter, D delete teleporter, V verify, S save after verification, E back |

The browser cannot close its own tab like the Java program, so X returns to the website's More page. On the flag guide, any key other than F dismisses the guide; it also performs its usual action, matching the Java version.
