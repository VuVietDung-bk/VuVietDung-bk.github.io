const search = document.querySelector('#search');
const group = document.querySelector('#group');
const level = document.querySelector('#level');
const results = document.querySelector('#results');
const count = document.querySelector('#result-count');
const showMore = document.querySelector('#show-more');
const note = document.querySelector('#note');
const entries = window.JapaneseVaultIndex || [];
const chunks = new Map();
let shown = 40;
let lastRequest = 0;

const featured = [
  { title: '📄総合目次', label: 'Tổng mục lục', detail: 'Bắt đầu từ toàn bộ kho ghi chú', icon: '⌂' },
  { title: '📄漢字総覧', label: 'Kanji', detail: 'Tra cứu Hán tự theo cấp độ', icon: '字' },
  { title: '〜ている', label: 'Ngữ pháp', detail: 'Mẫu câu và cách dùng', icon: '文' },
  { title: '🍱料理と食事', label: 'Từ vựng', detail: 'Chủ đề ẩm thực và đời sống', icon: '語' }
];

function element(tag, text, className) {
  const value = document.createElement(tag);
  if (text !== undefined) value.textContent = text;
  if (className) value.className = className;
  return value;
}

function entryFor(title) {
  return entries.find(([, name]) => name === title);
}

function formatNumber(number) {
  return new Intl.NumberFormat('vi-VN').format(number);
}

function renderResults() {
  if (!entries.length) return;
  const query = search.value.trim().toLocaleLowerCase();
  const selectedGroup = group.value;
  const selectedLevel = level.value;
  const browsing = Boolean(query || selectedGroup || selectedLevel);
  let matched;
  if (browsing) {
    matched = entries.filter(([, title, category, jlpt, han]) =>
      (!selectedGroup || category === selectedGroup) &&
      (!selectedLevel || jlpt === selectedLevel) &&
      (!query || `${title} ${han} ${jlpt}`.toLocaleLowerCase().includes(query))
    );
    if (query) matched.sort((a, b) => Number(b[1].toLocaleLowerCase().startsWith(query)) - Number(a[1].toLocaleLowerCase().startsWith(query)));
  } else {
    matched = featured.map(item => entryFor(item.title)).filter(Boolean);
  }
  count.textContent = browsing ? `${formatNumber(matched.length)} kết quả` : `${formatNumber(entries.length)} ghi chú`;
  const visible = matched.slice(0, shown);
  results.replaceChildren(...visible.map(([id, title, category, jlpt, han]) => {
    const row = element('li');
    const link = element('a', title);
    link.href = `#note/${id}`;
    if (location.hash === link.hash) link.setAttribute('aria-current', 'true');
    link.append(element('small', [category, jlpt, han].filter(Boolean).join(' · ')));
    row.append(link);
    return row;
  }));
  showMore.hidden = !browsing || matched.length <= shown;
}

function renderHome() {
  document.title = 'Japanese Learning | Viet Dung Vu';
  const mark = element('div', '日', 'welcome-mark');
  mark.setAttribute('aria-hidden', 'true');
  const kicker = element('span', 'GHI CHÚ HỌC TIẾNG NHẬT', 'welcome-kicker');
  const title = element('h1', 'Học theo cách của bạn.');
  const lead = element('p', 'Tìm nhanh một chữ Kanji, một mẫu ngữ pháp hoặc chủ đề từ vựng. Mọi ghi chú của Japanese Vault đều có thể mở ngay tại đây.', 'lead');
  const heading = element('h2', 'Bắt đầu từ đâu?', 'quick-heading');
  const cards = element('div', undefined, 'quick-grid');
  for (const item of featured) {
    const entry = entryFor(item.title);
    if (!entry) continue;
    const card = element('a', undefined, 'quick-card');
    card.href = `#note/${entry[0]}`;
    card.append(element('span', item.icon, 'quick-icon'), element('strong', item.label), element('small', item.detail));
    cards.append(card);
  }
  const footer = element('p', `${formatNumber(entries.length)} ghi chú · Tra cứu theo cấp độ JLPT và Hán Việt ở cột bên trái.`, 'welcome-footer');
  note.replaceChildren(mark, kicker, title, lead, heading, cards, footer);
  renderResults();
}

function loadChunk(number) {
  if (!chunks.has(number)) {
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `data/notes-${number}.js`;
      script.onload = () => {
        const data = window.JapaneseVaultChunks?.[number];
        data ? resolve(data) : reject(new Error('Missing note data'));
        script.remove();
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('Unable to load note data'));
      };
      document.head.append(script);
    });
    chunks.set(number, promise);
  }
  return chunks.get(number);
}

function createStrokePanel(source) {
  const panel = element('section', undefined, 'stroke-panel');
  panel.setAttribute('aria-label', 'Thứ tự nét viết');
  const heading = element('div', undefined, 'stroke-heading');
  heading.append(element('strong', 'Thứ tự nét viết'));
  const replay = element('button', '↻ Phát lại', 'stroke-replay');
  replay.type = 'button';
  heading.append(replay);
  const canvas = element('div', undefined, 'stroke-canvas');

  function draw() {
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) return;
    for (const unsafe of parsed.querySelectorAll('script, foreignObject')) unsafe.remove();
    for (const item of parsed.querySelectorAll('*')) {
      for (const attribute of [...item.attributes]) {
        if (/^on/i.test(attribute.name) ||
            (/(?:^|:)href$/i.test(attribute.name) && !attribute.value.startsWith('#'))) {
          item.removeAttribute(attribute.name);
        }
      }
    }
    const svg = document.importNode(parsed.documentElement, true);
    svg.setAttribute('aria-label', 'Hình động mô tả thứ tự nét viết');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const stroke of svg.querySelectorAll('.stroke')) {
        stroke.style.animation = 'none';
        stroke.style.strokeDashoffset = '0';
        stroke.style.opacity = '1';
      }
      for (const badge of svg.querySelectorAll('.badge-group')) {
        badge.style.animation = 'none';
        badge.style.opacity = '1';
      }
    }
    canvas.replaceChildren(svg);
  }

  replay.addEventListener('click', draw);
  panel.append(heading, canvas);
  draw();
  return panel;
}

async function openNote() {
  const request = ++lastRequest;
  const match = location.hash.match(/^#note\/(\d+)$/);
  if (!match) {
    renderHome();
    return;
  }
  const id = Number(match[1]);
  const entry = entries[id];
  if (!entry || entry[0] !== id) {
    note.replaceChildren(element('h1', 'Không tìm thấy ghi chú'), element('p', 'Hãy chọn một ghi chú khác trong danh sách.'));
    return;
  }
  note.replaceChildren(element('div', 'Đang mở ghi chú…', 'loading-state'));
  try {
    const items = await loadChunk(Math.floor(id / 100));
    if (request !== lastRequest) return;
    const item = items[id % 100];
    if (!item || item.id !== id) throw new Error('Invalid note data');
    const topline = element('div', undefined, 'note-topline');
    const home = element('a', '← Tổng quan');
    home.href = 'index.html';
    topline.append(home, element('span', [entry[2], entry[3]].filter(Boolean).join(' · ')));
    const kicker = element('span', 'JAPANESE VAULT', 'note-kicker');
    const title = element('h1', entry[1]);
    note.replaceChildren(topline, kicker, title);
    if (item.stroke) note.append(createStrokePanel(item.stroke));
    if (item.fields.length) {
      const fields = element('dl', undefined, 'note-meta');
      for (const [label, value] of item.fields) {
        const field = element('div');
        field.append(element('dt', label), element('dd', value));
        fields.append(field);
      }
      note.append(fields);
    }
    const body = element('div', undefined, 'note-body');
    body.innerHTML = item.html;
    note.append(body);
    if (item.missing?.length) {
      const notice = element('div', undefined, 'note-empty');
      notice.append(
        element('strong', 'Nội dung chưa được bổ sung'),
        element('p', `${item.missing.join(' và ')} đang để trống trong ghi chú gốc.`)
      );
      note.append(notice);
    }
    document.title = `${entry[1]} | Japanese Learning`;
    renderResults();
    note.focus({preventScroll: true});
    if (window.matchMedia('(max-width: 700px)').matches) note.scrollIntoView({block: 'start'});
    else window.scrollTo(0, 0);
  } catch {
    note.replaceChildren(element('h1', 'Không thể mở ghi chú'), element('p', 'Hãy tải lại trang rồi thử lại.'));
  }
}

for (const control of [search, group, level]) control.addEventListener('input', () => {
  shown = 40;
  renderResults();
});
showMore.addEventListener('click', () => {
  shown += 40;
  renderResults();
});
window.addEventListener('hashchange', openNote);
if (entries.length) {
  renderHome();
  if (location.hash) openNote();
} else {
  note.replaceChildren(element('h1', 'Không thể tải thư viện'), element('p', 'Hãy tải lại trang. Nếu lỗi vẫn còn, hãy kiểm tra tệp data/index.js.'));
  count.textContent = 'Không có dữ liệu';
}
