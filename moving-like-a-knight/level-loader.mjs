import { parseLevel } from './level.mjs';

// Change MAIN_LEVEL_COUNT only when adding/removing campaign levels.
// Editing level_N.txt or flagpos.txt requires no JavaScript changes.
export const MAIN_LEVEL_COUNT = 50;
export const BONUS_LEVEL_IDS = Array.from({ length: 20 }, (_, index) => index + 1000);

export class LevelRepository {
  constructor(fetchFile = (url, options) => fetch(url, options)) {
    this.fetchFile = fetchFile;
    this.cache = new Map();
    this.flagPositions = null;
  }

  async readText(path) {
    const response = await this.fetchFile(`levels/mainlevels/${path}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Cannot load ${path} (HTTP ${response.status})`);
    return response.text();
  }

  async load(number) {
    if (!Number.isInteger(number) || number < 0) throw new Error('Invalid level number');
    if (!this.cache.has(number)) {
      const pending = this.readText(`level_${number}.txt`).then(raw => {
        const level = parseLevel(raw);
        if (!level) throw new Error(`Level ${number} is empty`);
        return level;
      }).catch(error => { this.cache.delete(number); throw error; });
      this.cache.set(number, pending);
    }
    return this.cache.get(number);
  }

  async flagPosition(number) {
    if (!this.flagPositions) {
      this.flagPositions = this.readText('flagpos.txt').then(raw =>
        raw.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number))
      ).catch(error => { this.flagPositions = null; throw error; });
    }
    const positions = await this.flagPositions;
    return positions[number] || [0, 0];
  }
}
