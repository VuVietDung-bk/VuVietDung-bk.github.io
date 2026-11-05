export const ROWS = 25;
export const COLS = 35;
export const DIRECTIONS = [
  [[-1,0],[-2,0],[-2,1]], [[0,1],[-1,1],[-2,1]],
  [[-1,0],[-1,1],[-1,2]], [[0,1],[0,2],[-1,2]],
  [[0,1],[0,2],[1,2]], [[1,0],[1,1],[1,2]],
  [[0,1],[1,1],[2,1]], [[1,0],[2,0],[2,1]],
  [[1,0],[2,0],[2,-1]], [[0,-1],[1,-1],[2,-1]],
  [[1,0],[1,-1],[1,-2]], [[0,-1],[0,-2],[1,-2]],
  [[0,-1],[0,-2],[-1,-2]], [[-1,0],[-1,-1],[-1,-2]],
  [[0,-1],[-1,-1],[-2,-1]], [[-1,0],[-2,0],[-2,-1]]
];

export const inBounds = (row, col) => Number.isInteger(row) && Number.isInteger(col) &&
  row >= 0 && row < ROWS && col >= 0 && col < COLS;

export function parseLevel(raw) {
  if (!raw) return null;
  const lines = raw.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const [x, y, steps, teleSteps] = lines.shift().split(/\s+/).map(Number);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  const teles = [];
  let tele = false;
  for (const line of lines) {
    if (line === 'tele') { tele = true; continue; }
    const numbers = line.split(',').map(Number);
    if (numbers.length !== 4) continue;
    if (tele) {
      teles.push({ sx: numbers[0], sy: numbers[1], ex: numbers[2], ey: numbers[3] });
    } else {
      for (let col = numbers[1]; col < numbers[2]; col++) {
        if (inBounds(numbers[0], col)) grid[numbers[0]][col] = numbers[3];
      }
    }
  }
  return { x, y, steps, teleSteps, grid, teles };
}

export function validateLevel(level) {
  if (!level || !inBounds(level.x, level.y) ||
      !Number.isInteger(level.steps) || level.steps < 0 ||
      !Number.isInteger(level.teleSteps) || level.teleSteps < 0 ||
      !Array.isArray(level.grid) || level.grid.length !== ROWS ||
      !level.grid.every(row => Array.isArray(row) && row.length === COLS &&
        row.every(value => Number.isInteger(value) && value >= -1 && value <= 3)) ||
      !Array.isArray(level.teles) ||
      !level.teles.every(tele => inBounds(tele.sx, tele.sy) && inBounds(tele.ex, tele.ey))) {
    throw new Error('Invalid level file.');
  }
  return level;
}

export function serializeLevel(level) {
  validateLevel(level);
  const lines = [`${level.x} ${level.y} ${level.steps} ${level.teleSteps}`];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS;) {
      const value = level.grid[row][col];
      if (value <= 0) { col++; continue; }
      const start = col;
      while (col < COLS && level.grid[row][col] === value) col++;
      lines.push(`${row},${start},${col},${value}`);
    }
  }
  if (level.teles.length) {
    lines.push('tele');
    for (const tele of level.teles) lines.push(`${tele.sx},${tele.sy},${tele.ex},${tele.ey}`);
  }
  return `${lines.join('\n')}\n`;
}

export function cloneLevel(level) {
  return {
    x: level.x, y: level.y, steps: level.steps, teleSteps: level.teleSteps,
    grid: level.grid.map(row => row.slice()),
    teles: level.teles.map(tele => ({ ...tele }))
  };
}
