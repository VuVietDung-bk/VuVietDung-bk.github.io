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

export const inBounds = (row, col) => row >= 0 && row < ROWS && col >= 0 && col < COLS;

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

export function cloneLevel(level) {
  return {
    x: level.x, y: level.y, steps: level.steps, teleSteps: level.teleSteps,
    grid: level.grid.map(row => row.slice()),
    teles: level.teles.map(tele => ({ ...tele }))
  };
}
