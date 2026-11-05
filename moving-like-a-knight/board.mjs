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

  findHint(now = () => performance.now()) {
    if (this.steps - this.turn > 21) { this.hint = 'overflow'; return this.hint; }
    this.direction = null;
    const grid = this.grid.map(row => row.slice());
    const memo = new Set();
    const deadline = now() + 400;
    const solve = (x, y, steps, teleSteps) => {
      if (3 * steps + teleSteps === 0) return [];
      if (steps < 0 || teleSteps < 0 || now() > deadline) return null;
      const key = `${x},${y},${steps},${teleSteps},${grid.map(row => row.join(',')).join(';')}`;
      if (memo.has(key)) return null;
      for (let direction = 0; direction < 16; direction++) {
        const path = DIRECTIONS[direction];
        if (!path.every(([row, col]) => inBounds(x + row, y + col) && grid[x + row][y + col] > 0)) continue;
        grid[x][y]--;
        for (let index = 0; index < 2; index++) grid[x + path[index][0]][y + path[index][1]]--;
        let nextX = x + path[2][0], nextY = y + path[2][1], teleported = null;
        for (const tele of this.teles) {
          if (tele.sx === nextX && tele.sy === nextY &&
              inBounds(tele.ex, tele.ey) && grid[tele.ex][tele.ey] > 0) {
            grid[nextX][nextY]--;
            teleported = tele;
            nextX = tele.ex;
            nextY = tele.ey;
            break;
          }
        }
        const rest = solve(nextX, nextY, steps - 1, teleSteps - Number(Boolean(teleported)));
        if (teleported) grid[teleported.sx][teleported.sy]++;
        grid[x][y]++;
        for (let index = 0; index < 2; index++) grid[x + path[index][0]][y + path[index][1]]++;
        if (rest) return [direction, ...rest];
      }
      memo.add(key);
      return null;
    };
    const answer = solve(this.x, this.y, this.steps - this.turn, this.teleSteps - this.teleTurn);
    this.hint = answer?.length ? answer[0] : 'undo';
    this.points = Math.max(0, this.points - this.hintPenalty);
    return this.hint;
  }
}
