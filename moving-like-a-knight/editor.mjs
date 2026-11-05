import { GameBoard } from './board.mjs';
import { cloneLevel, ROWS, COLS } from './level.mjs';

export class LevelEditor {
  constructor(level = null, name = '') {
    this.level = level ? cloneLevel(level) : {
      x: -1, y: -1, steps: 0, teleSteps: 0,
      grid: Array.from({ length: ROWS }, () => Array(COLS).fill(-1)),
      teles: []
    };
    this.name = name;
    this.originalName = name;
    this.cursorX = 0;
    this.cursorY = 0;
    this.pendingTele = null;
    this.verifying = false;
    this.verified = false;
    this.saving = false;
    this.rename = name;
    this.board = null;
  }

  startVerification() {
    if (this.level.x < 0) return 'Place the knight with K first.';
    const sum = this.level.grid.flat().reduce((total, tile) => total + Math.max(0, tile), 0) - 1;
    if (sum < 0) return 'Add tiles before verifying.';
    this.level.steps = Math.floor(sum / 3);
    this.level.teleSteps = sum % 3;
    this.board = new GameBoard(this.level, { mode: 'custom' });
    this.verifying = !this.board.complete;
    this.verified = this.board.complete;
    return null;
  }

  handle(key) {
    const lower = key.toLowerCase();
    if (this.saving) {
      if (key === 'Enter') return { action: 'save' };
      if (key === 'Backspace') this.rename = this.rename.slice(0, -1);
      else if (key.length === 1 && /[a-z0-9 ]/i.test(key) && this.rename.length < 21) this.rename += key;
      return {};
    }
    if (this.verified) {
      if (lower === 's') { this.saving = true; this.rename = this.name; }
      else if (lower === 'e') { this.verified = false; this.verifying = false; }
      return {};
    }
    if (this.verifying) {
      if (key === 'ArrowUp') this.board.cycleDirection(1);
      else if (key === 'ArrowDown') this.board.cycleDirection(-1);
      else if (key === 'Enter') {
        if (this.board.move()) {
          if (this.board.complete) { this.verifying = false; this.verified = true; return { action: 'verified' }; }
          return { action: 'move' };
        }
      } else if (key === 'ArrowLeft') this.board.undo();
      else if (lower === 'v') this.verifying = false;
      else if (lower === 'e') return { action: 'exit' };
      return {};
    }
    if (key === 'ArrowUp') this.cursorX = Math.max(0, this.cursorX - 1);
    else if (key === 'ArrowDown') this.cursorX = Math.min(ROWS - 1, this.cursorX + 1);
    else if (key === 'ArrowLeft') this.cursorY = Math.max(0, this.cursorY - 1);
    else if (key === 'ArrowRight') this.cursorY = Math.min(COLS - 1, this.cursorY + 1);
    else if (key === '0') this.level.grid[this.cursorX][this.cursorY] = -1;
    else if (['1', '2', '3'].includes(key)) this.level.grid[this.cursorX][this.cursorY] = Number(key);
    else if (lower === 'k') { this.level.x = this.cursorX; this.level.y = this.cursorY; }
    else if (lower === 'v') return { error: this.startVerification() };
    else if (lower === 't') this.pendingTele = { sx: this.cursorX, sy: this.cursorY };
    else if (key === 'Enter' && this.pendingTele) {
      const tele = { ...this.pendingTele, ex: this.cursorX, ey: this.cursorY };
      if (tele.sx !== tele.ex || tele.sy !== tele.ey) this.level.teles.push(tele);
      this.pendingTele = null;
    } else if (lower === 'd') {
      this.level.teles = this.level.teles.filter(tele =>
        ![[tele.sx, tele.sy], [tele.ex, tele.ey]].some(([x, y]) => x === this.cursorX && y === this.cursorY));
    } else if (lower === 'e') return { action: 'exit' };
    return {};
  }
}
