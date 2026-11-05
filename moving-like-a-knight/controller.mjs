import { GameAudio } from './audio.mjs';
import { GameBoard } from './board.mjs';
import { LevelEditor } from './editor.mjs';
import { parseLevel } from './level.mjs';
import { FLAG_POSITIONS, LEVEL_DATA } from './levels.mjs';
import { GameRenderer } from './renderer.mjs';
import { DEFAULT_PROGRESS, loadCustom, loadProgress, saveCustom, saveProgress } from './storage.mjs';

export class KnightGame {
  constructor() {
    this.canvas = document.getElementById('game');
    this.noticeElement = document.getElementById('notice');
    this.soundButton = document.getElementById('sound');
    this.audio = new GameAudio();
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
    this.state.screen = screen;
    this.audio.setScreen(screen);
    this.draw();
  }

  persistProgress() {
    if (!saveProgress(this.progress)) this.showNotice('Browser storage is unavailable.');
  }

  startBoard(level, mode = 'normal', number = this.progress.level, bonus = false) {
    if (!level) { this.showNotice('This level is unavailable.'); return; }
    this.state.board = new GameBoard(level, {
      mode, number, bonus, flagPos: FLAG_POSITIONS[number] || [0, 0]
    });
    this.lastTick = performance.now();
    this.setScreen('board');
    this.canvas.focus();
  }

  loadMain() {
    const raw = LEVEL_DATA[String(this.progress.level)];
    if (!raw) { this.setScreen('victory'); return; }
    this.startBoard(parseLevel(raw), 'normal', this.progress.level);
  }

  tryBonus() {
    if (this.board.mode !== 'normal' || this.board.bonus || Math.random() >= 0.05) {
      this.showNotice('No valid move. Undo with ←.');
      return;
    }
    const ids = Object.keys(LEVEL_DATA).filter(id => Number(id) >= 1000);
    const id = ids[Math.floor(Math.random() * ids.length)];
    if (id) this.startBoard(parseLevel(LEVEL_DATA[id]), 'normal', this.board.number, true);
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
      if (this.progress.level >= 50) { this.setScreen('victory'); return; }
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
    if (this.state.saved.some(item => item.name.toLowerCase() === name.toLowerCase())) {
      this.showNotice('That name is already used.');
      return;
    }
    this.state.saved.unshift({ name, level: this.editor.level });
    if (!saveCustom(this.state.saved)) this.showNotice('Could not save level in this browser.');
    this.state.editor = null;
    this.setScreen('more');
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
      else if (state.menuIndex === 1) this.startBoard(parseLevel(LEVEL_DATA[String(state.replayIndex)]), 'replay', state.replayIndex);
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
    if (key === 'ArrowRight') this.state.publicIndex = Math.min(49, this.state.publicIndex + 10);
    else if (key === 'ArrowLeft') this.state.publicIndex = Math.max(0, this.state.publicIndex - 10);
    else if (key === 'ArrowDown') this.state.publicIndex = Math.min(49, this.state.publicIndex + 1);
    else if (key === 'ArrowUp') this.state.publicIndex = Math.max(0, this.state.publicIndex - 1);
    else if (key === 'Enter') this.startBoard(parseLevel(LEVEL_DATA[String(this.state.publicIndex)]), 'replay', this.state.publicIndex);
    else if (key.toLowerCase() === 'e') this.setScreen('more');
  }

  handle(key) {
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
          if (this.board.mode === 'normal') this.loadMain();
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
  }

  resetProgress() {
    this.state.progress = { ...DEFAULT_PROGRESS };
    this.audio.setVolumes(this.progress);
    this.persistProgress();
    this.loadMain();
    this.setScreen('reset');
  }

  bindInputs() {
    this.soundButton.addEventListener('click', () => {
      this.audioChosen = true;
      this.audio.setEnabled(!this.audio.enabled);
      this.updateSoundButton();
      this.canvas.focus();
    });
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
        if (key === 'reset') {
          if (confirm('Reset game progress and settings?')) this.resetProgress();
        } else if (this.screen === 'custom' && this.editor.verified && key === 's') {
          const name = prompt('Level name', this.editor.name || '');
          if (name !== null) { this.editor.rename = name.slice(0, 21); this.saveEditor(); }
        } else this.handle(key);
        this.activateAudio();
        this.canvas.focus();
      });
    }
    this.canvas.addEventListener('pointerdown', event => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * 1040 / rect.width;
      const y = (event.clientY - rect.top) * 700 / rect.height;
      this.canvas.focus();
      if (this.screen === 'title') {
        if (x < 100 && y > 580) this.setScreen('settings');
        else if (x > 370 && x < 780 && y > 430 && y < 650) {
          this.state.menuIndex = Math.max(0, Math.min(3, Math.floor((y - 440) / 50)));
          this.handle('Enter');
        }
      } else if (this.screen === 'more' && y > 130 && y < 450) {
        this.state.moreIndex = Math.max(0, Math.min(2, Math.floor(x / 347)));
        this.handle('Enter');
      } else if (this.screen === 'board') {
        if (this.board.flagHelp) { this.board.dismissFlagHelp(); this.draw(); }
        else if (x < 900 && y < 650) this.handle(this.board.direction !== null ? 'Enter' : 'ArrowUp');
      } else if (this.screen === 'win' || this.screen === 'reset') this.handle(' ');
      else if (this.screen === 'saved' || this.screen === 'public') {
        const index = Math.floor((y - 70) / 60);
        if (index >= 0 && index < 10) {
          if (this.screen === 'saved') {
            const selected = this.state.savedPage * 10 + index;
            if (selected < this.state.saved.length) { this.state.savedIndex = index; this.handle('Enter'); }
          } else {
            this.state.publicIndex = Math.min(49, Math.floor(this.state.publicIndex / 10) * 10 + index);
            this.handle('Enter');
          }
        }
      } else if (this.screen === 'settings' && x < 85 && y < 75) this.handle('e');
      this.activateAudio();
      this.draw();
    });
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
