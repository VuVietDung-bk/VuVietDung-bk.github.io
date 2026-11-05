# Moving Like A Knight (web)

A static Canvas port of the Java Swing game in `../Moving_Like_A_Knight/` for GitHub Pages. Open `index.html` through a static server or GitHub Pages; no build step is required.

- `game.js` contains the game logic and Canvas rendering.
- `levels.js` contains the original level files and flag positions converted to JavaScript data.
- `assets/images/` and `assets/music/` are byte-for-byte copies of the original PNG and WAV assets. The audio files are large (about 69 MiB together), so the browser loads them on interaction.
- Progress, settings and custom levels are saved in the current browser's `localStorage`.

The game accepts the original keyboard controls. The on-screen controls cover movement and common actions; open “Level editor and menu controls” for editing tools on touch devices.
