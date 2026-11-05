import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../audio.mjs';
import { GameBoard } from '../board.mjs';
import { LevelEditor } from '../editor.mjs';
import { parseLevel } from '../level.mjs';
import { LEVEL_DATA } from '../levels.mjs';
import { KnightGame } from '../controller.mjs';

class FakeAudio {
  constructor() { this.currentTime = 0; this.playing = false; this.plays = 0; this.pauses = 0; }
  play() { this.playing = true; this.plays++; return Promise.resolve(); }
  pause() { this.playing = false; this.pauses++; }
}

test('tracks restart at zero and win sound stops on the next level', () => {
  const audio = new GameAudio(() => new FakeAudio());
  audio.setVolumes({ menuVolume: 50, gameVolume: 50 });
  audio.setEnabled(true);
  assert.equal(audio.clips.title.plays, 1);
  audio.clips.title.currentTime = 20;
  audio.setScreen('more');
  assert.equal(audio.clips.title.currentTime, 20, 'menu track continues within menu screens');
  audio.setScreen('board');
  assert.equal(audio.clips.title.currentTime, 0);
  audio.clips.game.currentTime = 15;
  audio.setScreen('win');
  assert.equal(audio.clips.game.currentTime, 0);
  audio.playEffect('win');
  audio.clips.win.currentTime = 4;
  audio.setScreen('board');
  assert.equal(audio.clips.win.playing, false);
  assert.equal(audio.clips.win.currentTime, 0);
  assert.equal(audio.clips.game.plays, 2);
  assert.equal(audio.clips.game.currentTime, 0);
  audio.clips.game.currentTime = 13;
  audio.setScreen('title');
  assert.equal(audio.clips.game.currentTime, 0);
  assert.equal(audio.clips.title.plays, 2);
  assert.equal(audio.clips.title.currentTime, 0);
  audio.clips.title.currentTime = 6;
  audio.setScreen('settings');
  assert.equal(audio.clips.title.currentTime, 0);
  audio.setScreen('title');
  assert.equal(audio.clips.title.plays, 3);
  audio.playEffect('win');
  audio.clips.win.currentTime = 2;
  audio.setEnabled(false);
  assert.equal(audio.clips.win.playing, false);
  assert.equal(audio.clips.win.currentTime, 0);
  audio.setEnabled(true);
  assert.equal(audio.clips.title.currentTime, 0);
});

test('flag help dismisses on another key, F consumes one flag, Enter only moves after choosing', () => {
  const board = new GameBoard(parseLevel(LEVEL_DATA['0']), { flagPos: [8, 17] });
  const original = [board.x, board.y];
  assert.equal(board.move(), false);
  assert.deepEqual([board.x, board.y], original);
  assert.equal(board.pressFlag(true), false);
  assert.equal(board.flagHelp, true);
  board.dismissFlagHelp();
  assert.equal(board.flagHelp, false);
  board.pressFlag(true);
  assert.equal(board.pressFlag(true), true);
  assert.equal(board.flagged, true);
  assert.equal(board.flagHelp, false);
  assert.equal(board.cycleDirection(1), true);
  assert.equal(board.move(), true);
  assert.equal(board.turn, 1);
  assert.equal(board.undo(), true);
  assert.deepEqual([board.x, board.y], original);
});

test('level editor writes tile values 1, 2 and 3 from the matching keys', () => {
  const editor = new LevelEditor();
  for (const value of [1, 2, 3]) {
    editor.handle(String(value));
    assert.equal(editor.level.grid[0][0], value);
  }
  editor.handle('0');
  assert.equal(editor.level.grid[0][0], -1);
});

test('controller routes flag and win-screen keys through the correct state', () => {
  const listeners = {};
  const context = { clearRect() {}, fillRect() {}, drawImage() {}, fillText() {} };
  const canvas = { getContext: () => context, addEventListener() {}, focus() {} };
  const status = { classList: { add() {}, remove() {} } };
  const sound = { addEventListener() {}, setAttribute() {} };
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; } };
  globalThis.Audio = FakeAudio;
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.document = {
    getElementById: id => ({ game: canvas, notice: status, sound })[id],
    querySelectorAll: () => [], addEventListener: (name, fn) => { listeners[name] = fn; },
    fonts: { ready: Promise.resolve() }
  };
  globalThis.requestAnimationFrame = () => {};
  const game = new KnightGame();
  game.progress.flags = 1;
  game.loadMain();
  game.handle('f');
  assert.equal(game.board.flagHelp, true);
  listeners.keydown({ key: 'd', target: { tagName: 'BODY' }, preventDefault() {} });
  assert.equal(game.board.flagHelp, false, 'holding D also dismisses the guide');
  listeners.keyup({ key: 'd' });
  game.handle('f');
  game.handle('ArrowUp');
  assert.equal(game.board.flagHelp, false);
  assert.notEqual(game.board.direction, null);
  game.handle('f');
  game.handle('f');
  assert.equal(game.progress.flags, 0);
  assert.equal(game.board.flagged, true);
  game.activateAudio();
  game.setScreen('win');
  game.audio.playEffect('win');
  game.audio.clips.win.currentTime = 3;
  game.handle(' ');
  assert.equal(game.screen, 'board');
  assert.equal(game.audio.clips.win.playing, false);
  assert.equal(game.audio.clips.win.currentTime, 0);
  game.handle('e');
  assert.equal(game.screen, 'title');
  game.setScreen('win');
  game.audio.playEffect('win');
  game.handle('e');
  assert.equal(game.audio.clips.win.playing, false);
  assert.equal(game.screen, 'title');
});
