import { cloneLevel, DIRECTIONS, inBounds } from './level.mjs';

export class GameBoard {
  constructor(level, { mode = 'normal', number = 0, bonus = false, flagPos = [0, 0] } = {}) {
    Object.assign(this, cloneLevel(level));
    this.mode = mode;
    this.number = number;
    this.bonus = bonus;
    this.flagPos = flagPos;
    this.direction = null;
    this.turn = 0;
    this.teleTurn = 0;
    this.history = [];
    this.flagged = false;
    this.flagHelp = false;
    this.hint = null;
    const point1 = number % 10 || 10;
    const point2 = Math.ceil(number / 10) || 1;
    this.points = point1 * point2 * 1000 + point2 * 200;
    this.hintPenalty = 1500 + 500 * point2;
  }

  canMove(direction) {
    return DIRECTIONS[direction].every(([row, col]) =>
      inBounds(this.x + row, this.y + col) && this.grid[this.x + row][this.y + col] > 0);
  }

  cycleDirection(step) {
    this.hint = null;
    // Swing starts at 0 and advances before testing the first candidate.
    let index = this.direction === null ? 0 : this.direction;
    for (let tries = 0; tries < 16; tries++) {
      index = (index + step + 16) % 16;
      if (this.canMove(index)) { this.direction = index; return true; }
    }
    this.direction = null;
    return false;
  }

  move() {
    if (this.direction === null || !this.canMove(this.direction)) return false;
    const path = DIRECTIONS[this.direction];
    this.history.push({
      x: this.x, y: this.y, grid: this.grid.map(row => row.slice()),
      turn: this.turn, teleTurn: this.teleTurn
    });
    this.grid[this.x][this.y]--;
    for (let index = 0; index < 2; index++) {
      this.grid[this.x + path[index][0]][this.y + path[index][1]]--;
    }
    this.x += path[2][0];
    this.y += path[2][1];
    this.turn++;
    this.direction = null;
    this.hint = null;
    for (const tele of this.teles) {
      if (tele.sx === this.x && tele.sy === this.y &&
          inBounds(tele.ex, tele.ey) && this.grid[tele.ex][tele.ey] > 0) {
        this.grid[tele.sx][tele.sy]--;
        this.x = tele.ex;
        this.y = tele.ey;
        this.teleTurn++;
        break;
      }
    }
    return true;
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    Object.assign(this, previous);
    this.direction = null;
    this.hint = null;
    return true;
  }

  get complete() {
    return 3 * (this.steps - this.turn) + this.teleSteps - this.teleTurn === 0;
  }

  tick(ticks = 1) {
    this.points = Math.max(0, this.points - ticks * 5);
  }

  pressFlag(available) {
    if (this.mode !== 'normal' || !available || this.flagged) return false;
    if (this.flagHelp) {
      this.flagHelp = false;
      this.flagged = true;
      return true; // a flag was consumed
    }
    this.flagHelp = true;
    return false;
  }

  dismissFlagHelp() {
    this.flagHelp = false;
  }

  hintSnapshot() {
    return {
      x: this.x, y: this.y, steps: this.steps, teleSteps: this.teleSteps,
      turn: this.turn, teleTurn: this.teleTurn,
      grid: this.grid.map(row => row.slice()),
      teles: this.teles.map(tele => ({ ...tele }))
    };
  }

  applyHint(result) {
    if (result.status === 'solved') this.hint = result.direction;
    else if (result.status === 'unsolvable') this.hint = 'undo';
    else this.hint = result.status === 'timeout' ? 'timeout' : null;
    if (this.hint === 'undo' || typeof this.hint === 'number') {
      this.points = Math.max(0, this.points - this.hintPenalty);
    }
    return this.hint;
  }
}
