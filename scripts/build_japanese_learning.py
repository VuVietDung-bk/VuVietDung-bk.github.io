"""Build a small static reader for the Obsidian notes in japanese-vault/.

Run from the repository root: python3 scripts/build_japanese_learning.py
Requires PyYAML and markdown-it-py (pip install PyYAML markdown-it-py).
Generated files in japanese-learning/data/ are meant to be committed to GitHub Pages.
JavaScript data files also work when index.html is opened directly from a folder.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

import yaml
from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parents[1]
VAULT = ROOT / 'japanese-vault'
OUTPUT = ROOT / 'japanese-learning' / 'data'
CHUNK_SIZE = 100


def split_frontmatter(source: str) -> tuple[dict, str]:
    source = source.replace('\r\n', '\n')
    if not source.startswith('---\n'):
        return {}, source
    end = source.find('\n---\n', 4)
    if end < 0:
        return {}, source
    raw = source[4:end]
    try:
        metadata = yaml.safe_load(raw) or {}
    except yaml.YAMLError:
        # A number of vault notes have unquoted colons in their meanings.
        # Recover the simple fields so those notes remain searchable.
        metadata = {}
        for line in raw.splitlines():
            match = re.match(r'^([a-z_]+):\s*(.*)$', line)
            if match:
                metadata[match.group(1)] = match.group(2).strip().strip('"')
    return metadata if isinstance(metadata, dict) else {}, source[end + 5:]


def group(path: Path) -> str:
    parts = path.relative_to(VAULT).parts
    if any('漢字' in part for part in parts[:-1]):
        return 'Kanji'
    if any('文法' in part for part in parts[:-1]):
        return 'Grammar'
    if path.stem == '🍱料理と食事':
        return 'Vocabulary'
    return 'Overview'


def plain(value: object) -> str:
    return '' if value is None else str(value)


def remove_empty_kanji_sections(source: str) -> tuple[str, list[str]]:
    headings = [
        ('### 1. Chiết tự & Nguồn gốc (Lục thư)', 'Chiết tự & nguồn gốc'),
        ('### 2. Từ vựng ghép quan trọng', 'Từ vựng ghép'),
    ]
    first = source.find(headings[0][0])
    second = source.find(headings[1][0])
    if first < 0 or second < first:
        return source, []
    prefix = source[:first].strip()
    if prefix == '---':
        prefix = ''
    sections = [source[first + len(headings[0][0]):second], source[second + len(headings[1][0]):]]
    output = [prefix] if prefix else []
    missing = []
    for (heading, label), body in zip(headings, sections):
        if body.replace('---', '').strip():
            output.append(heading + body)
        else:
            missing.append(label)
    return '\n\n'.join(output).strip(), missing


def render_math(expression: str, display: bool) -> str:
    """Render the small TeX subset currently used by the vault, without a CDN."""
    value = html.escape(expression.strip())
    value = value.replace(r'\rightarrow', '→').replace(r'\leftrightarrow', '↔')
    value = re.sub(r'\\text\{([^{}]*)\}', lambda match: match.group(1), value)
    value = re.sub(r'([\w])_\{([^{}]+)\}', r'\1<sub>\2</sub>', value)
    kind = 'math-block' if display else 'math-inline'
    tag = 'div' if display else 'span'
    return f'<{tag} class="{kind}">{value}</{tag}>'


def protect_math(source: str) -> tuple[str, dict[str, str]]:
    replacements = {}

    def replace(display: bool):
        def inner(match: re.Match) -> str:
            key = f'MATHPLACEHOLDER{len(replacements)}END'
            replacements[key] = render_math(match.group(1), display)
            return key
        return inner

    source = re.sub(r'\$\$(.*?)\$\$', replace(True), source, flags=re.DOTALL)
    source = re.sub(r'(?<!\$)\$([^$\n]+)\$(?!\$)', replace(False), source)
    return source, replacements


def protect_inline_styles(source: str, markdown: MarkdownIt) -> tuple[str, dict[str, str]]:
    """Keep Obsidian highlights and emphasis beside Japanese text intact."""
    replacements = {}

    def replace(tag: str):
        def inner(match: re.Match) -> str:
            key = f'INLINEPLACEHOLDER{len(replacements)}END'
            content = markdown.renderInline(match.group(1))
            replacements[key] = f'<{tag}>{content}</{tag}>'
            return key
        return inner

    source = re.sub(r'==([^=\n]+)==', replace('mark'), source)
    source = re.sub(r'\*\*([^*\n]+)\*\*', replace('strong'), source)
    return source, replacements


def render_callouts(rendered: str) -> str:
    labels = {
        'info': 'Thông tin', 'tip': 'Gợi ý', 'warning': 'Lưu ý',
        'example': 'Ví dụ', 'danger': 'Chú ý', 'todo': 'Việc cần làm',
        'question': 'Câu hỏi', 'quote': 'Trích dẫn',
    }
    pattern = re.compile(r'<blockquote>\s*<p>\[!([a-z]+)\][+-]?\s*(.*?)</p>(.*?)</blockquote>', re.DOTALL)

    def replace(match: re.Match) -> str:
        kind = match.group(1)
        title, _, first_body_line = match.group(2).partition('\n')
        title = title.strip() or labels.get(kind, 'Ghi chú')
        body = (f'<p>{first_body_line.strip()}</p>' if first_body_line.strip() else '') + match.group(3)
        return f'<aside class="callout callout-{kind}"><div class="callout-title">{title}</div>{body}</aside>'

    return pattern.sub(replace, rendered)


def compact_svg(source: str) -> str:
    source = re.sub(r'^<\?xml[^>]*\?>\s*', '', source)
    source = re.sub(r'<!--.*?-->', '', source, flags=re.DOTALL)
    source = re.sub(r'/\*.*?\*/', '', source, flags=re.DOTALL)
    return re.sub(r'>\s+<', '><', source).strip()


def main() -> None:
    files = sorted(VAULT.rglob('*.md'), key=lambda path: str(path.relative_to(VAULT)))
    if not files:
        raise SystemExit('No Markdown notes found in japanese-vault/')
    notes = []
    names = {}
    for index, path in enumerate(files):
        metadata, body = split_frontmatter(path.read_text(encoding='utf-8'))
        item = {'id': index, 'title': path.stem, 'group': group(path),
                'level': plain(metadata.get('jlpt')), 'han': plain(metadata.get('han_viet')),
                'metadata': metadata, 'body': body}
        notes.append(item)
        names[path.stem] = index
        aliases = metadata.get('aliases') or []
        if isinstance(aliases, list):
            for alias in aliases:
                names.setdefault(str(alias), index)

    markdown = MarkdownIt('commonmark', {'html': False}).enable(['table', 'strikethrough'])
    wiki = re.compile(r'(!?)\[\[([^\]]+)\]\]')
    dataview = re.compile(r'```dataview(?:js)?\s*\n.*?```', re.DOTALL)
    furigana = re.compile(r'\{([^{}|]+)\|([^{}]+)\}')
    strokes = VAULT / '📁 01_漢字' / '📁 筆順・画像'
    index_data = []
    chunks = []
    chunk = []

    for item in notes:
        index_data.append([item['id'], item['title'], item['group'], item['level'], item['han']])
        source = dataview.sub('', item['body'])
        source, missing = remove_empty_kanji_sections(source)
        source = re.sub(r'</?b>', '**', source)
        source, math = protect_math(source)

        def replace_wiki(match: re.Match) -> str:
            raw = match.group(2)
            target, _, label = raw.partition('|')
            target = target.split('#', 1)[0].removesuffix('.md').strip()
            if match.group(1):
                return '🇯🇵' if target == 'japan_flag.svg' else label or target
            display = label or target
            note_id = names.get(target)
            if note_id is None:
                note_id = names.get(target.rsplit('/', 1)[-1])
            if note_id is None:
                return display
            return f'[{display}](#note/{note_id})'

        source = wiki.sub(replace_wiki, source)
        source, inline_styles = protect_inline_styles(source, markdown)
        rendered = markdown.render(source)
        for key, value in math.items():
            if value.startswith('<div'):
                rendered = rendered.replace(f'<p>{key}</p>', value)
            rendered = rendered.replace(key, value)
        for key, value in inline_styles.items():
            rendered = rendered.replace(key, value)
        rendered = render_callouts(rendered)
        # The vault's {漢字|かん|じ} syntax stores furigana. Convert it in text nodes.
        def ruby(match: re.Match) -> str:
            base = html.escape(match.group(1))
            reading = html.escape(''.join(match.group(2).split('|')))
            return f'<ruby>{base}<rt>{reading}</rt></ruby>'
        rendered = furigana.sub(ruby, rendered)
        metadata = item['metadata']
        fields = []
        for key, label in [('han_viet', 'Hán Việt'), ('jlpt', 'JLPT'), ('grade', 'Nhóm'),
                           ('so_net', 'Số nét'), ('on', 'On'), ('kun', 'Kun'), ('nghia', 'Nghĩa')]:
            value = plain(metadata.get(key)).strip()
            if value:
                fields.append([label, value])
        stroke_path = strokes / f"{item['title']}.svg" if item['group'] == 'Kanji' else None
        stroke = compact_svg(stroke_path.read_text(encoding='utf-8')) if stroke_path and stroke_path.is_file() else None
        chunk.append({'id': item['id'], 'html': rendered, 'fields': fields,
                      'missing': missing, 'stroke': stroke})
        if len(chunk) == CHUNK_SIZE:
            chunks.append(chunk)
            chunk = []
    if chunk:
        chunks.append(chunk)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for old in OUTPUT.glob('notes-*.json'):
        old.unlink()
    for old in OUTPUT.glob('notes-*.js'):
        old.unlink()
    (OUTPUT / 'index.json').unlink(missing_ok=True)
    (OUTPUT / 'index.js').write_text(
        'window.JapaneseVaultIndex=' + json.dumps(index_data, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8'
    )
    for number, items in enumerate(chunks):
        (OUTPUT / f'notes-{number}.js').write_text(
            'window.JapaneseVaultChunks=window.JapaneseVaultChunks||[];'
            f'window.JapaneseVaultChunks[{number}]='
            + json.dumps(items, ensure_ascii=False, separators=(',', ':')) + ';\n',
            encoding='utf-8'
        )
    print(f'Generated {len(notes)} notes in {len(chunks)} chunks')


if __name__ == '__main__':
    main()
