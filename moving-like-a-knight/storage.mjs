export const DEFAULT_PROGRESS = {
  level: 0, flags: 0, points: 0, theme: 'grass', horse: 'default',
  menuVolume: 50, gameVolume: 50
};

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export const loadProgress = () => ({ ...DEFAULT_PROGRESS, ...read('moving-knight-progress', {}) });
export const saveProgress = value => write('moving-knight-progress', value);
export const loadCustom = () => {
  const levels = read('moving-knight-custom', []);
  return Array.isArray(levels) ? levels : [];
};
export const saveCustom = value => write('moving-knight-custom', value);
