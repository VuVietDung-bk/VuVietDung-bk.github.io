# Japanese Learning

This is the static GitHub Pages reader for a separate private Obsidian vault. `data/index.js` and `data/notes-*.js` are generated from its Markdown notes. The original vault is not modified by the build script.

To refresh the website after editing the vault:

1. Clone or update the vault at `japanese-vault/` in the website repository root.
2. Install build dependencies if needed: `python3 -m pip install PyYAML markdown-it-py`.
3. Run `python3 scripts/build_japanese_learning.py` from the website repository root.
4. Commit the changed files under `japanese-learning/` and push the website repository.

The reader works both from a local `index.html` file and on GitHub Pages. It supports search, JLPT filters, frontmatter fields, furigana, callouts, the LaTeX expressions currently used by the vault, and links between existing notes. Stroke-order SVGs are bundled with their note data and can be replayed in the reader. Empty Kanji section headings are hidden and identified in a short notice. Obsidian-only Dataview blocks are omitted; search and filters replace their index function.
