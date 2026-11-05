const FILES = {
  title: 'titlemusic.wav',
  game: 'nhacvip.wav',
  win: 'amthanhchienthang.wav',
  move1: 'move_1.wav',
  move2: 'move_2.wav'
};

const MUSIC_FOR_SCREEN = {
  title: 'title', more: 'title', saved: 'title', public: 'title', custom: 'title',
  board: 'game', victory: 'game', reset: 'game'
};

export class GameAudio {
  constructor(createAudio = () => new Audio()) {
    this.clips = {};
    for (const [key, filename] of Object.entries(FILES)) {
      const clip = createAudio();
      clip.preload = 'none';
      clip.src = `assets/music/${filename}`;
      clip.loop = key === 'title' || key === 'game';
      this.clips[key] = clip;
    }
    this.enabled = false;
    this.screen = 'title';
    this.music = null;
  }

  static gain(value) {
    return Math.pow(Math.max(0, Math.min(100, Number(value) || 0)) / 100, 2) * 0.65;
  }

  setVolumes(settings) {
    this.clips.title.volume = GameAudio.gain(settings.menuVolume);
    for (const key of ['game', 'win', 'move1', 'move2']) {
      this.clips[key].volume = GameAudio.gain(settings.gameVolume);
    }
  }

  stop(key) {
    const clip = this.clips[key];
    clip.pause();
    try { clip.currentTime = 0; } catch { /* metadata may still be loading */ }
  }

  stopEffects() {
    for (const key of ['win', 'move1', 'move2']) this.stop(key);
  }

  setScreen(screen) {
    if (screen !== this.screen) this.stopEffects();
    this.screen = screen;
    const next = this.enabled ? MUSIC_FOR_SCREEN[screen] || null : null;
    if (this.music === next) return;
    if (this.music) this.stop(this.music);
    this.music = next;
    if (next) {
      this.stop(next);
      this.clips[next].play().catch(() => {});
    }
  }

  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      if (this.music) this.stop(this.music);
      this.music = null;
      this.stopEffects();
    } else {
      this.setScreen(this.screen);
    }
  }

  playEffect(key) {
    if (!this.enabled) return;
    this.stop(key);
    this.clips[key].play().catch(() => {});
  }
}
