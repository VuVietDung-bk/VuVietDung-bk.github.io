import { COLS, DIRECTIONS, inBounds } from './level.mjs';

// Solve against the same completion condition as GameBoard.complete. A level may
// contain more teleporters than its header's teleSteps count.
export function solveHint(level, {
  timeLimitMs = 15000, maxStates = 1_500_000, now = () => performance.now()
} = {}) {
  const cells = [];
  const byPosition = new Map();
  for (let row = 0; row < level.grid.length; row++) {
    for (let col = 0; col < level.grid[row].length; col++) {
      if (level.grid[row][col] > 0) {
        byPosition.set(row * COLS + col, cells.length);
        cells.push([row, col]);
      }
    }
  }
  const values = Uint8Array.from(cells, ([row, col]) => level.grid[row][col]);
  const moves = cells.map(([row, col]) => DIRECTIONS.map(path => {
    const indices = path.map(([dr, dc]) => inBounds(row + dr, col + dc)
      ? byPosition.get((row + dr) * COLS + col + dc) : undefined);
    return indices.every(index => index !== undefined) ? indices : null;
  }));
  const teleports = new Map();
  const teleportDestinations = new Set();
  for (const tele of level.teles) {
    const source = byPosition.get(tele.sx * COLS + tele.sy);
    const destination = byPosition.get(tele.ex * COLS + tele.ey);
    if (source !== undefined && destination !== undefined) {
      if (!teleports.has(source)) teleports.set(source, []);
      teleports.get(source).push(destination);
      teleportDestinations.add(destination);
    }
  }
  const neighbors = cells.map(([row, col]) => [
    [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
  ].map(([r, c]) => byPosition.get(r * COLS + c)).filter(index => index !== undefined));

  const start = byPosition.get(level.x * COLS + level.y);
  const remaining = 3 * (level.steps - (level.turn || 0)) + level.teleSteps - (level.teleTurn || 0);
  if (remaining === 0) return { status: 'complete' };
  if (start === undefined || remaining < 0) return { status: 'unsolvable' };

  const deadline = now() + timeLimitMs;
  const useHeuristic = remaining > 63;
  const failed = new Set();
  let visited = 0;
  let timedOut = false;
  const search = (position, left) => {
    if (left === 0) return [];
    if (left < 0 || timedOut) return null;
    if ((++visited & 1023) === 0 && (now() > deadline || failed.size >= maxStates)) {
      timedOut = true;
      return null;
    }
    const key = `${position}:${String.fromCharCode(...values)}`;
    if (failed.has(key)) return null;
    for (let index = 0; index < values.length; index++) {
      if (values[index] > 0 && index !== position && !teleportDestinations.has(index) &&
          neighbors[index].every(neighbor => values[neighbor] === 0)) {
        failed.add(key);
        return null;
      }
    }
    const options = [];
    for (let direction = 0; direction < 16; direction++) {
      const path = moves[position][direction];
      if (!path || path.some(index => values[index] === 0)) continue;
      const exits = useHeuristic ? moves[path[2]].reduce((count, nextPath) =>
        count + Number(Boolean(nextPath && nextPath.every(index => values[index] > 0))), 0) : 0;
      options.push({ direction, exits });
    }
    if (useHeuristic) options.sort((a, b) => a.exits - b.exits || a.direction - b.direction);
    for (const { direction } of options) {
      const path = moves[position][direction];
      values[position]--;
      values[path[0]]--;
      values[path[1]]--;
      let next = path[2];
      let teleported = false;
      for (const destination of teleports.get(next) || []) {
        if (values[destination] > 0) {
          values[next]--;
          next = destination;
          teleported = true;
          break;
        }
      }
      const result = search(next, left - 3 - Number(teleported));
      if (teleported) values[path[2]]++;
      values[position]++;
      values[path[0]]++;
      values[path[1]]++;
      if (result !== null) return [direction, ...result];
      if (timedOut) return null;
    }
    failed.add(key);
    return null;
  };

  const path = search(start, remaining);
  if (path !== null) return { status: 'solved', direction: path[0], path, visited };
  return { status: timedOut ? 'timeout' : 'unsolvable', visited };
}
