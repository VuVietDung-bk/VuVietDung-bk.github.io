import { GameAudio } from './audio.mjs';
import { GameBoard } from './board.mjs?v=6';
import { LevelEditor } from './editor.mjs?v=4';
import { BONUS_LEVEL_IDS, LevelRepository, MAIN_LEVEL_COUNT } from './level-loader.mjs';
import { parseLevel, serializeLevel, validateLevel } from './level.mjs?v=4';
import { GameRenderer } from './renderer.mjs?v=4';
import { DEFAULT_PROGRESS, loadCustom, loadProgress, saveCustom, saveProgress } from './storage.mjs';

export class KnightGame {
  constructor() {
    this.canvas = document.getElementById('game');
    this.noticeElement = document.getElementById('notice');
    this.soundButton = document.getElementById('sound');
    this.importInput = document.getElementById('level-import');
    this.audio = new GameAudio();
    this.levels = new LevelRepository();
    this.levelRequest = 0;
    this.state = {
      screen: 'title', progress: loadProgress(), saved: loadCustom(),
      board: null, editor: null, winImage: 'gg',
      menuIndex: 0, replayIndex: 0, moreIndex: 0,
      savedIndex: 0, savedPage: 0, publicIndex: 0, selectedSetting: 0
    };
    this.audio.setVolumes(this.state.progress);
    this.renderer = new GameRenderer(this.canvas, () => this.draw());
    this.audioChosen = false;
    this.lastTick = performance.now();
    this.resetHold = null;
    this.noticeTimer = null;
    this.bindInputs();
    document.fonts.ready.then(() => this.draw());
    this.draw();
    requestAnimationFrame(now => this.frame(now));
  }

  get screen() { return this.state.screen; }
  get progress() { return this.state.progress; }
  get board() { return this.state.board; }
  get editor() { return this.state.editor; }

  draw() { this.renderer.draw(this.state); }

  showNotice(message) {
    this.noticeElement.textContent = message;
    this.noticeElement.classList.add('visible');
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.noticeElement.classList.remove('visible'), 2800);
  }

  updateSoundButton() {
    const enabled = this.audio.enabled;
    this.soundButton.textContent = enabled ? '♪ Sound on' : '♪ Sound off';
    this.soundButton.setAttribute('aria-pressed', String(enabled));
    this.soundButton.setAttribute('aria-label', enabled ? 'Mute game audio' : 'Unmute game audio');
  }

  activateAudio() {
    if (this.audioChosen) return;
    this.audioChosen = true;
    this.audio.setEnabled(true);
    this.updateSoundButton();
  }

  setScreen(screen) {
    if (screen !== this.state.screen) this.levelRequest++;
    this.state.screen = screen;
    this.audio.setScreen(screen);
    this.draw();
  }

  persistProgress() {
    if (!saveProgress(this.progress)) this.showNotice('Browser storage is unavailable.');
  }

  startBoard(level, mode = 'normal', number = this.progress.level, bonus = false, flagPos = [0, 0]) {
    if (!level) { this.showNotice('This level is unavailable.'); return; }
    this.state.board = new GameBoard(level, {
      mode, number, bonus, flagPos
    });
    this.lastTick = performance.now();
    this.setScreen('board');
    this.canvas.focus();
  }

  async loadFileLevel(fileNumber, mode = 'normal', number = fileNumber, bonus = false) {
    const request = ++this.levelRequest;
    this.showNotice('Loading level…');
    try {
      const [level, flagPos] = await Promise.all([
        this.levels.load(fileNumber), this.levels.flagPosition(number)
      ]);
      if (request !== this.levelRequest) return;
      this.noticeElement.classList.remove('visible');
      this.startBoard(level, mode, number, bonus, flagPos);
    } catch (error) {
      if (request === this.levelRequest) this.showNotice(error.message);
    }
  }

  loadMain() {
    if (this.progress.level >= MAIN_LEVEL_COUNT) { this.setScreen('victory'); return; }
    return this.loadFileLevel(this.progress.level, 'normal');
  }

  tryBonus() {
    if (this.board.mode !== 'normal' || this.board.bonus || Math.random() >= 0.05) {
      this.showNotice('No valid move. Undo with ←.');
      return;
    }
    const id = BONUS_LEVEL_IDS[Math.floor(Math.random() * BONUS_LEVEL_IDS.length)];
    if (id !== undefined) this.loadFileLevel(id, 'normal', this.board.number, true);
  }

  completeBoard() {
    const board = this.board;
    if (board.mode === 'normal') {
      if (board.bonus) {
        this.progress.level = board.number + 1;
        this.progress.flags++;
      } else {
        if (board.flagged && board.x === board.flagPos[0] && board.y === board.flagPos[1] && Math.random() < 0.34) {
          this.progress.flags++;
        }
        this.progress.level = board.number + 1;
        this.progress.points += Math.floor(board.points);
      }
      this.persistProgress();
      if (this.progress.level >= MAIN_LEVEL_COUNT) { this.setScreen('victory'); return; }
      this.state.winImage = board.bonus ? 'ggeasteregg' : Math.random() < 0.04 ? 'easteregg' : 'gg';
    } else {
      this.state.winImage = 'gg';
    }
    this.setScreen('win');
    this.audio.playEffect('win');
  }

  handleBoard(key) {
    const lower = key.toLowerCase();
    if (this.board.flagHelp && lower !== 'f') {
      this.board.dismissFlagHelp();
      if (key === 'Escape') return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (!this.board.cycleDirection(key === 'ArrowUp' ? 1 : -1)) this.tryBonus();
    } else if (key === 'Enter') {
      if (this.board.move()) {
        this.audio.playEffect(Math.random() < 0.0075 ? 'move1' : 'move2');
        if (this.board.complete) this.completeBoard();
      }
    } else if (key === 'ArrowLeft') {
      this.board.undo();
    } else if (lower === 'h') {
      if (this.board.hint !== null) this.board.hint = null;
      else this.board.findHint();
    } else if (lower === 'f') {
      if (this.board.pressFlag(this.progress.flags > 0)) {
        this.progress.flags--;
        this.persistProgress();
      }
    } else if (lower === 'e') {
      this.setScreen(this.board.mode === 'custom' ? 'saved' : 'title');
    } else if (lower === 'x') {
      location.href = '../more.html';
    }
  }

  saveEditor() {
    const name = this.editor.rename.trim();
    if (!name) { this.showNotice('Enter a level name.'); return; }
    const originalIndex = this.editor.originalName
      ? this.state.saved.findIndex(item => item.name === this.editor.originalName) : -1;
    if (this.state.saved.some((item, index) => index !== originalIndex && item.name.toLowerCase() === name.toLowerCase())) {
      this.showNotice('That name is already used.');
      return;
    }
    if (originalIndex >= 0) this.state.saved.splice(originalIndex, 1);
    const item = { name, level: this.editor.level };
    this.state.saved.unshift(item);
    const savedLocally = saveCustom(this.state.saved);
    const downloaded = this.downloadLevel(item);
    this.state.editor = null;
    this.setScreen('more');
    if (downloaded && savedLocally) this.showNotice(`Saved and downloaded ${downloaded}`);
    else if (downloaded) this.showNotice(`Downloaded ${downloaded}; browser storage is unavailable.`);
    else if (savedLocally) this.showNotice('Saved in browser, but download failed. Use Export selected.');
    else this.showNotice('Could not save or download the level.');
  }

  async importCustomLevel(file) {
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error('Level file is too large.');
      const level = validateLevel(parseLevel(await file.text()));
      const base = file.name.replace(/\.txt$/i, '').trim().slice(0, 21) || 'Imported level';
      let name = base, suffix = 2;
      while (this.state.saved.some(item => item.name.toLowerCase() === name.toLowerCase())) {
        const ending = ` ${suffix++}`;
        name = base.slice(0, 21 - ending.length) + ending;
      }
      const updated = [{ name, level }, ...this.state.saved];
      if (!saveCustom(updated)) throw new Error('Could not save level in this browser.');
      this.state.saved = updated;
      this.state.savedIndex = 0;
      this.state.savedPage = 0;
      this.setScreen('saved');
      this.showNotice(`Imported ${name}`);
    } catch (error) {
      this.showNotice(error.message || 'Could not import level.');
    } finally {
      this.importInput.value = '';
    }
  }

  exportSelectedLevel() {
    if (this.screen !== 'saved') { this.showNotice('Open Saved Levels to select a level first.'); return; }
    const item = this.state.saved[this.state.savedPage * 10 + this.state.savedIndex];
    if (!item) { this.showNotice('No saved level selected.'); return; }
    if (!this.downloadLevel(item)) this.showNotice('Could not export level.');
  }

  downloadLevel(item) {
    try {
      const data = serializeLevel(item.level);
      const url = URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url;
      const safeName = item.name.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, '_').slice(0, 80) || 'level';
      const filename = `${safeName}.txt`;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return filename;
    } catch (error) {
      return null;
    }
  }

  startEditor(level = null, name = '') {
    this.state.editor = new LevelEditor(level, name);
    this.setScreen('custom');
  }

  handleEditor(key) {
    const result = this.editor.handle(key);
    if (result.error) this.showNotice(result.error);
    if (result.action === 'move' || result.action === 'verified') {
      this.audio.playEffect(Math.random() < 0.0075 ? 'move1' : 'move2');
    }
    if (result.action === 'save') this.saveEditor();
    if (result.action === 'exit') this.setScreen('more');
  }

  handleTitle(key) {
    const state = this.state;
    if (key === 'ArrowDown') {
      state.menuIndex = (state.menuIndex + 1) % 4;
      if (this.progress.level <= 30 && state.menuIndex === 2) state.menuIndex = 3;
    } else if (key === 'ArrowUp') {
      state.menuIndex = (state.menuIndex + 3) % 4;
      if (this.progress.level <= 30 && state.menuIndex === 2) state.menuIndex = 1;
    } else if (state.menuIndex === 1 && key === 'ArrowLeft') {
      state.replayIndex = Math.max(0, state.replayIndex - 1);
    } else if (state.menuIndex === 1 && key === 'ArrowRight') {
      state.replayIndex = Math.min(Math.max(0, this.progress.level - 1), state.replayIndex + 1);
    } else if (key.toLowerCase() === 's') {
      this.setScreen('settings');
    } else if (key.toLowerCase() === 'x') {
      location.href = '../more.html';
    } else if (key === 'Enter') {
      if (state.menuIndex === 0) this.loadMain();
      else if (state.menuIndex === 1) this.loadFileLevel(state.replayIndex, 'replay');
      else if (state.menuIndex === 2) this.setScreen('more');
      else location.href = '../more.html';
    }
  }

  handleSettings(key) {
    const state = this.state;
    if (key === 'ArrowUp') state.selectedSetting = (state.selectedSetting + 3) % 4;
    else if (key === 'ArrowDown') state.selectedSetting = (state.selectedSetting + 1) % 4;
    else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const step = key === 'ArrowRight' ? 1 : -1;
      if (state.selectedSetting < 2) {
        const setting = state.selectedSetting === 0 ? 'menuVolume' : 'gameVolume';
        this.progress[setting] = Math.max(0, Math.min(100, this.progress[setting] + step));
      } else if (state.selectedSetting === 2) {
        this.progress.theme = this.progress.theme === 'grass' ? 'stone' : 'grass';
      } else {
        this.progress.horse = this.progress.horse === 'default' ? 'mad' : 'default';
      }
      this.audio.setVolumes(this.progress);
      this.persistProgress();
    } else if (key.toLowerCase() === 'e') this.setScreen('title');
  }

  handleMore(key) {
    if (key === 'ArrowRight') this.state.moreIndex = (this.state.moreIndex + 1) % 3;
    else if (key === 'ArrowLeft') this.state.moreIndex = (this.state.moreIndex + 2) % 3;
    else if (key === 'Enter') {
      if (this.state.moreIndex === 0) this.setScreen('public');
      else if (this.state.moreIndex === 1) {
        this.state.savedIndex = 0;
        this.state.savedPage = 0;
        this.setScreen('saved');
      } else this.startEditor();
    } else if (key.toLowerCase() === 'e') this.setScreen('title');
  }

  handleSaved(key) {
    const state = this.state;
    const count = Math.max(1, Math.min(10, state.saved.length - state.savedPage * 10));
    if (key === 'ArrowRight') {
      state.savedPage = Math.min(Math.max(0, Math.ceil(state.saved.length / 10) - 1), state.savedPage + 1);
      state.savedIndex = 0;
    } else if (key === 'ArrowLeft') {
      state.savedPage = Math.max(0, state.savedPage - 1);
      state.savedIndex = 0;
    } else if (key === 'ArrowDown') state.savedIndex = (state.savedIndex + 1) % count;
    else if (key === 'ArrowUp') state.savedIndex = (state.savedIndex - 1 + count) % count;
    else if (key === 'Enter' && state.saved.length) {
      const item = state.saved[state.savedPage * 10 + state.savedIndex];
      if (item) { this.state.editor = { name: item.name }; this.startBoard(item.level, 'custom'); }
    } else if (key.toLowerCase() === 'l' && state.saved.length) {
      const item = state.saved[state.savedPage * 10 + state.savedIndex];
      if (item) this.startEditor(item.level, item.name);
    } else if (key.toLowerCase() === 'x' && state.saved.length) {
      const index = state.savedPage * 10 + state.savedIndex;
      const item = state.saved[index];
      if (item && confirm(`Delete ${item.name}?`)) {
        state.saved.splice(index, 1);
        if (!saveCustom(state.saved)) this.showNotice('Could not save changes in this browser.');
        state.savedIndex = 0;
        state.savedPage = 0;
      }
    } else if (key.toLowerCase() === 'e') this.setScreen('more');
  }

  handlePublic(key) {
    if (key === 'ArrowRight') this.state.publicIndex = Math.min(MAIN_LEVEL_COUNT - 1, this.state.publicIndex + 10);
    else if (key === 'ArrowLeft') this.state.publicIndex = Math.max(0, this.state.publicIndex - 10);
    else if (key === 'ArrowDown') this.state.publicIndex = Math.min(MAIN_LEVEL_COUNT - 1, this.state.publicIndex + 1);
    else if (key === 'ArrowUp') this.state.publicIndex = Math.max(0, this.state.publicIndex - 1);
    else if (key === 'Enter') this.loadFileLevel(this.state.publicIndex, 'replay');
    else if (key.toLowerCase() === 'e') this.setScreen('more');
  }

  handle(key) {
    let pending;
    switch (this.screen) {
      case 'title': this.handleTitle(key); break;
      case 'board': this.handleBoard(key); break;
      case 'custom': this.handleEditor(key); break;
      case 'settings': this.handleSettings(key); break;
      case 'more': this.handleMore(key); break;
      case 'saved': this.handleSaved(key); break;
      case 'public': this.handlePublic(key); break;
      case 'win':
      case 'reset':
        if (key === ' ' || key === 'Enter') {
          if (this.board.mode === 'normal') {
            this.audio.stopEffects();
            pending = this.loadMain();
          }
          else this.setScreen(this.board.mode === 'custom' ? 'saved' : 'title');
        } else if (key.toLowerCase() === 'e') this.setScreen('title');
        else if (key.toLowerCase() === 'x') location.href = '../more.html';
        break;
      case 'victory':
        if (key.toLowerCase() === 'e' || key === 'Enter') this.setScreen('title');
        else if (key.toLowerCase() === 'x') location.href = '../more.html';
        break;
    }
    this.draw();
    return pending;
  }

  resetProgress() {
    this.state.progress = { ...DEFAULT_PROGRESS };
    this.audio.setVolumes(this.progress);
    this.persistProgress();
    this.state.board = { mode: 'normal' };
    this.setScreen('reset');
  }

  onCanvasPointer(event) {
    if (event.button !== 0 && event.button !== 2) return;
    if (event.button === 2) event.preventDefault();
    const choose = event.button === 2;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * 1040 / rect.width;
    const y = (event.clientY - rect.top) * 700 / rect.height;
    this.canvas.focus();

    if (this.screen === 'board') {
      if (this.board.flagHelp) {
        if (choose) this.handle('f');
        else this.board.dismissFlagHelp();
      } else if (x < 900 && y < 650) {
        this.handle(choose ? (this.board.direction === null ? 'ArrowLeft' : 'Enter') : 'ArrowUp');
      }
    } else if (this.screen === 'title') {
      if (!choose && x < 100 && y > 580) this.setScreen('settings');
      else if (!choose && x > 370 && x < 780 && y > 430 && y < 650) {
        this.state.menuIndex = Math.max(0, Math.min(3, Math.floor((y - 440) / 50)));
      } else if (choose) this.handle('Enter');
    } else if (this.screen === 'more') {
      if (!choose && y > 130 && y < 450) this.state.moreIndex = Math.max(0, Math.min(2, Math.floor(x / 347)));
      else if (choose) this.handle('Enter');
    } else if (this.screen === 'saved' || this.screen === 'public') {
      if (!choose) {
        const index = Math.floor((y - 70) / 60);
        if (index >= 0 && index < 10) {
          if (this.screen === 'saved') {
            if (this.state.savedPage * 10 + index < this.state.saved.length) this.state.savedIndex = index;
          } else {
            this.state.publicIndex = Math.min(MAIN_LEVEL_COUNT - 1, Math.floor(this.state.publicIndex / 10) * 10 + index);
          }
        }
      } else this.handle('Enter');
    } else if (this.screen === 'custom') {
      if (this.editor.verifying && x < 900 && y < 650) {
        this.handle(choose ? (this.editor.board.direction === null ? 'ArrowLeft' : 'Enter') : 'ArrowUp');
      } else if (!choose && !this.editor.verified && x >= 25 && x < 900 && y >= 25 && y < 650) {
        this.editor.cursorX = Math.floor(y / 25) - 1;
        this.editor.cursorY = Math.floor(x / 25) - 1;
      } else if (choose) this.handle('Enter');
    } else if (this.screen === 'win' || this.screen === 'reset') {
      if (choose) this.handle(' ');
    } else if (this.screen === 'settings') {
      if (!choose && x < 85 && y < 75) this.handle('e');
    }
    this.activateAudio();
    this.draw();
  }

  bindInputs() {
    this.soundButton.addEventListener('click', () => {
      this.audioChosen = true;
      this.audio.setEnabled(!this.audio.enabled);
      this.updateSoundButton();
      this.canvas.focus();
    });
    this.importInput.addEventListener('change', event => this.importCustomLevel(event.target.files?.[0]));
    document.addEventListener('keydown', event => {
      if (event.target.tagName === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Backspace'].includes(event.key)) event.preventDefault();
      if (this.screen === 'board' && event.key.toLowerCase() === 'd') {
        this.board.dismissFlagHelp();
        this.draw();
        if (this.resetHold === null) this.resetHold = performance.now();
        this.activateAudio();
        return;
      }
      this.handle(event.key);
      this.activateAudio();
    });
    document.addEventListener('keyup', event => {
      if (event.key.toLowerCase() === 'd') this.resetHold = null;
    });
    for (const button of document.querySelectorAll('[data-key]')) {
      button.addEventListener('click', () => {
        const key = button.dataset.key;
        if (key === 'import') this.importInput.click();
        else if (key === 'export') this.exportSelectedLevel();
        else if (key === 'reset') {
          if (confirm('Reset game progress and settings?')) this.resetProgress();
        } else if (this.screen === 'custom' && this.editor.verified && key === 's') {
          const name = prompt('Level name', this.editor.name || '');
          if (name !== null) { this.editor.rename = name.slice(0, 21); this.saveEditor(); }
        } else this.handle(key);
        this.activateAudio();
        this.canvas.focus();
      });
    }
    this.canvas.addEventListener('pointerdown', event => this.onCanvasPointer(event));
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
  }

  frame(now) {
    if (this.screen === 'board') {
      if (now - this.lastTick >= 100) {
        const ticks = Math.floor((now - this.lastTick) / 100);
        this.lastTick += ticks * 100;
        this.board.tick(ticks);
        this.draw();
      }
      if (this.resetHold !== null && now - this.resetHold >= 1500) {
        this.resetHold = null;
        this.resetProgress();
      }
    }
    requestAnimationFrame(next => this.frame(next));
  }
}
