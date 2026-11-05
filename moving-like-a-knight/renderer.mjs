import { COLS, ROWS, DIRECTIONS } from './level.mjs';

const IMAGE_NAMES = [
  'title', 'settingicon', 'arrows', 'midtitle', 'mouse', 'instruction',
  'ins_custom', 'ins_verify', 'ins_saved_levels', 'savedlevelscreen',
  'savelevelscreen', 'resetscreen', 'victory', 'gg', 'ggeasteregg',
  'easteregg', 'flag', 'flagins', 'flagriel', 'grass_dirt', 'stone_dirt',
  'grass_ee_dirt', 'telein', 'teleout', 'smalldot', 'bigdot', 'hintdot',
  'undo', 'skillissue', 'custom_cursor', 'exiticon', 'arrowleft',
  'arrowright', 'defaulthorseyleft', 'defaulthorseyright',
  'madhorseyleft', 'madhorseyright'
];
for (const theme of ['grass', 'stone', 'grass_ee']) {
  for (let value = 0; value < 4; value++) IMAGE_NAMES.push(`${theme}_${value}`);
}

export class GameRenderer {
  constructor(canvas, onImageLoad = () => {}) {
    this.ctx = canvas.getContext('2d');
    this.images = {};
    for (const name of IMAGE_NAMES) {
      const image = new Image();
      image.onload = onImageLoad;
      image.src = `assets/images/${name}.png`;
      this.images[name] = image;
    }
  }

  image(name, x, y, width, height) {
    const image = this.images[name];
    if (image?.complete && image.naturalWidth) {
      this.ctx.drawImage(image, x, y, width ?? image.naturalWidth, height ?? image.naturalHeight);
    }
  }

  text(value, x, y, size = 30, color = 'white') {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px Shopee, Arial, sans-serif`;
    this.ctx.fillText(String(value), x, y);
  }

  draw(state) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 1040, 700);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 1040, 700);
    switch (state.screen) {
      case 'title': this.title(state); break;
      case 'board': this.board(state); break;
      case 'win': this.image(state.winImage, 0, 0); break;
      case 'victory': this.image('victory', 0, 0); break;
      case 'reset': this.image('resetscreen', 0, 0); break;
      case 'more':
        this.image('midtitle', 0, 0);
        this.image('mouse', 103 + 393 * state.moreIndex, 150);
        break;
      case 'settings': this.settings(state); break;
      case 'saved':
      case 'public': this.saved(state); break;
      case 'custom': this.editor(state); break;
    }
  }

  title(state) {
    this.image('title', 0, 0);
    this.image('settingicon', 10, 600);
    ['CONTINUE', 'REPLAY', 'MORE', 'EXIT'].forEach((label, index) =>
      this.text(label, 400, 475 + 50 * index, 40, state.menuIndex === index ? 'white' : '#888'));
    this.text(state.progress.level, 638, 475, 40, state.menuIndex === 0 ? 'white' : '#888');
    if (state.menuIndex === 1) {
      this.image('arrows', 580, 492);
      this.text(String(state.replayIndex).padStart(2, '0'), 638, 525, 40);
    }
    if (state.progress.level <= 30) this.text('Beat level 30 for more!', 600, 575, 20, '#888');
  }

  board(state) {
    const { board, progress } = state;
    const ctx = this.ctx;
    ctx.fillStyle = board.bonus ? '#8034e3' : '#8a4f34';
    ctx.fillRect(0, 0, 1040, 700);
    const theme = board.bonus ? 'grass_ee' : progress.theme;
    this.image(`${theme}_dirt`, 25, 25);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const value = board.grid[row][col];
        if (value >= 0) this.image(`${theme}_${Math.min(3, value)}`, (col + 1) * 25, (row + 1) * 25);
      }
    }
    board.teles.forEach((tele, index) => {
      this.image('telein', (tele.sy + 1) * 25, (tele.sx + 1) * 25);
      this.image('teleout', (tele.ey + 1) * 25, (tele.ex + 1) * 25);
      this.text(index + 1, (tele.sy + 1) * 25 + 7, (tele.sx + 2) * 25 - 5, 18, 'black');
      this.text(index + 1, (tele.ey + 1) * 25 + 7, (tele.ex + 2) * 25 - 5, 18, 'black');
    });
    if (board.flagged) {
      this.image('flagriel', (board.flagPos[1] + 1) * 25, (board.flagPos[0] + 1) * 25);
    }
    const facing = board.direction !== null && board.direction > 7 ? 'left' : 'right';
    this.image(`${progress.horse}horsey${facing}`, (board.y + 1) * 25, (board.x + 1) * 25);
    if (board.direction !== null) {
      DIRECTIONS[board.direction].forEach(([row, col], index) =>
        this.image(index === 2 ? 'bigdot' : 'smalldot', (board.y + col + 1) * 25, (board.x + row + 1) * 25));
    }
    if (board.hint === 'overflow') this.image('skillissue', 260, 220);
    else if (board.hint === 'undo') this.image('undo', (board.y + 1) * 25, (board.x + 1) * 25);
    else if (typeof board.hint === 'number') {
      DIRECTIONS[board.hint].forEach(([row, col]) =>
        this.image('hintdot', (board.y + col + 1) * 25, (board.x + row + 1) * 25));
    }
    this.image('instruction', 900, 0);
    if (board.mode === 'normal' && progress.flags > 0) this.image('flag', 900, 635);
    if (board.mode === 'normal') {
      this.text(board.bonus ? 'Level ???' : `Level ${board.number}`, 400, 685, 35);
      this.text(`Level point: ${Math.floor(board.points)}`, 700, 665, 15);
      this.text(`Total point: ${progress.points}`, 700, 685, 15);
      if (progress.flags > 0) this.text(`Flag uses left: ${progress.flags}`, 25, 675, 22);
    } else {
      this.text(board.mode === 'custom' ? state.editor?.name || 'Custom Level' : `Level ${board.number}`, 400, 685, 35);
    }
    if (board.flagHelp) this.image('flagins', 0, 0);
  }

  settings(state) {
    const { progress } = state;
    this.image('exiticon', 10, 10);
    this.text('SETTINGS', 410, 50, 45);
    ['MENU MUSIC', 'INGAME MUSIC', 'THEME', 'HORSEY'].forEach((label, index) =>
      this.text(label, 60, index === 3 ? 450 : 110 + 60 * index, 26,
        state.selectedSetting === index ? 'white' : '#888'));
    for (let index = 0; index < 2; index++) {
      const value = progress[index ? 'gameVolume' : 'menuVolume'];
      const color = index === state.selectedSetting ? 'white' : '#888';
      this.text(value, 300, 110 + 60 * index, 26, color);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(350, 90 + 60 * index, 606, 20);
      this.ctx.fillRect(350 + 6 * value, 80 + 60 * index, 6, 40);
    }
    for (let index = 0; index < 2; index++) {
      const theme = index ? 'stone' : 'grass';
      const horse = index ? 'mad' : 'default';
      this.image(`${theme}_dirt`, 175 + 125 * index, 275, 100, 100);
      for (let tile = 0; tile < 4; tile++) {
        this.image(`${theme}_${tile}`, 200 + 125 * index + 25 * (tile % 2), 300 + 25 * Math.floor(tile / 2));
      }
      if (state.selectedSetting === 2 && progress.theme === theme) this.image('mouse', 200 + 125 * index, 200);
      this.ctx.fillStyle = '#888';
      this.ctx.fillRect(200 + 125 * index, 475, 50, 25);
      this.image(`${horse}horseyleft`, 200 + 125 * index, 475);
      this.image(`${horse}horseyright`, 225 + 125 * index, 475);
      if (state.selectedSetting === 3 && progress.horse === horse) this.image('mouse', 200 + 125 * index, 400);
    }
  }

  saved(state) {
    this.image('savedlevelscreen', 0, 0);
    this.image('ins_saved_levels', 0, 0);
    const publicLevels = Array.from({ length: 50 }, (_, id) => ({ name: `Level ${id}` }));
    const list = state.screen === 'saved' ? state.saved : publicLevels;
    const page = state.screen === 'saved' ? state.savedPage : Math.floor(state.publicIndex / 10);
    const selected = state.screen === 'saved' ? state.savedIndex : state.publicIndex % 10;
    this.text(`Page ${page + 1}/${Math.max(1, Math.ceil(list.length / 10))}`, 740, 32, 35);
    for (let index = 0; index < 10; index++) {
      const item = list[page * 10 + index];
      if (!item) break;
      this.text(item.name.toUpperCase(), 300, 107 + index * 60, 35, index === selected ? 'white' : '#888');
    }
    if (page > 0) this.image('arrowleft', 23, 300);
    if ((page + 1) * 10 < list.length) this.image('arrowright', 941, 300);
    if (!list.length) this.text('No saved levels yet', 300, 150, 30);
  }

  editor(state) {
    const { editor, progress } = state;
    if (editor.verified) {
      this.image('savelevelscreen', 0, 0);
      if (editor.saving) {
        this.text(`Level name: ${editor.rename}`, 100, 200, 35);
        this.text('Enter to save · Backspace to edit', 100, 250, 23);
      }
      return;
    }
    this.ctx.fillStyle = '#8a4f34';
    this.ctx.fillRect(0, 0, 1040, 700);
    this.image(`${progress.theme}_dirt`, 25, 25);
    this.image('exiticon', 10, 650);
    const grid = editor.verifying ? editor.board.grid : editor.level.grid;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (grid[row][col] >= 0) this.image(`${progress.theme}_${Math.min(3, grid[row][col])}`, (col + 1) * 25, (row + 1) * 25);
      }
    }
    editor.level.teles.forEach(tele => {
      this.image('telein', (tele.sy + 1) * 25, (tele.sx + 1) * 25);
      this.image('teleout', (tele.ey + 1) * 25, (tele.ex + 1) * 25);
    });
    if (editor.level.x >= 0) {
      const x = editor.verifying ? editor.board.x : editor.level.x;
      const y = editor.verifying ? editor.board.y : editor.level.y;
      this.image(`${progress.horse}horseyright`, (y + 1) * 25, (x + 1) * 25);
    }
    this.image(editor.verifying ? 'ins_verify' : 'ins_custom', 900, 0);
    if (!editor.verifying) this.image('custom_cursor', (editor.cursorY + 1) * 25, (editor.cursorX + 1) * 25);
    if (editor.pendingTele) this.text('Move cursor, then Enter to place teleporter exit', 190, 24, 20);
    this.text('Custom Level', 400, 685, 35);
  }
}
