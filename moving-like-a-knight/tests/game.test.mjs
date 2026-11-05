import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { GameAudio } from '../audio.mjs';
import { GameBoard } from '../board.mjs';
import { LevelEditor } from '../editor.mjs';
import { parseLevel, serializeLevel } from '../level.mjs';
import { LevelRepository } from '../level-loader.mjs';
import { solveHint } from '../hint-solver.mjs';
import { KnightGame } from '../controller.mjs';

const fileText = path => readFileSync(new URL(`../levels/mainlevels/${path}`, import.meta.url), 'utf8');
const firstLevel = () => parseLevel(fileText('level_0.txt'));
const readAsync = promisify(readFile);
const fetchLevel = async path => ({
  ok: true,
  text: () => readAsync(new URL(`../${path}`, import.meta.url), 'utf8')
});

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
  const board = new GameBoard(firstLevel(), { flagPos: [8, 17] });
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

test('custom level can be verified, solved, named and serialized', () => {
  const editor = new LevelEditor();
  editor.level.x = 8;
  editor.level.y = 8;
  for (const [row, col] of [[8, 8], [8, 9], [8, 10], [7, 10]]) editor.level.grid[row][col] = 1;
  assert.equal(editor.startVerification(), null);
  assert.equal(editor.verifying, true);
  for (let tries = 0; tries < 16 && editor.board.direction !== 3; tries++) editor.handle('ArrowUp');
  assert.equal(editor.board.direction, 3);
  assert.equal(editor.handle('Enter').action, 'verified');
  editor.handle('s');
  editor.handle('T');
  editor.handle('e');
  editor.handle('s');
  editor.handle('t');
  assert.equal(editor.handle('Enter').action, 'save');
  assert.equal(editor.rename, 'Test');
  assert.deepEqual(parseLevel(serializeLevel(editor.level)), editor.level);
});

test('individual level files load, including flag positions', async () => {
  const repository = new LevelRepository(fetchLevel);
  const level = await repository.load(0);
  assert.equal(level.x, 8);
  assert.equal(level.steps, 5);
  assert.deepEqual(await repository.flagPosition(0), [8, 17]);
  assert.deepEqual(parseLevel(serializeLevel(level)), level);
});

test('hints solve level 29 and difficult easter eggs without changing the board', () => {
  for (const id of [29, 1001, 1003, 1005, 1006, 1009, 1010, 1015, 1016, 1019]) {
    const board = new GameBoard(parseLevel(fileText(`level_${id}.txt`)));
    const before = board.hintSnapshot();
    const answer = solveHint(before, { now: () => 0 });
    assert.equal(answer.status, 'solved', `level ${id}`);
    assert.deepEqual(board.hintSnapshot(), before, `search does not mutate level ${id}`);
    for (const direction of answer.path) {
      board.direction = direction;
      assert.equal(board.move(), true, `level ${id} accepts direction ${direction}`);
    }
    assert.equal(board.complete, true, `hint path wins level ${id}`);
  }
});

test('hint timeout is distinct from an impossible position and costs no points', () => {
  const board = new GameBoard(parseLevel(fileText('level_1001.txt')));
  let clockCalls = 0;
  const result = solveHint(board.hintSnapshot(), {
    timeLimitMs: 0, now: () => clockCalls++
  });
  assert.equal(result.status, 'timeout');
  const points = board.points;
  assert.equal(board.applyHint(result), 'timeout');
  assert.equal(board.points, points);
});

test('controller routes flag, mouse and win-screen keys through the correct state', async () => {
  const listeners = {};
  const canvasListeners = {};
  const context = { clearRect() {}, fillRect() {}, drawImage() {}, fillText() {} };
  const canvas = { getContext: () => context, addEventListener: (name, fn) => { canvasListeners[name] = fn; }, focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1040, height: 700 }) };
  const status = { classList: { add() {}, remove() {} } };
  const sound = { addEventListener() {}, setAttribute() {} };
  const importInput = { addEventListener() {}, value: '' };
  let downloaded = null, exportedBlob = null, downloadCount = 0;
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; } };
  globalThis.Audio = FakeAudio;
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.fetch = fetchLevel;
  globalThis.document = {
    getElementById: id => ({ game: canvas, notice: status, sound, 'level-import': importInput })[id],
    querySelectorAll: () => [], addEventListener: (name, fn) => { listeners[name] = fn; },
    createElement: () => ({ click() { downloaded = this.download; downloadCount++; }, remove() {} }),
    body: { append() {} },
    fonts: { ready: Promise.resolve() }
  };
  globalThis.URL.createObjectURL = blob => { exportedBlob = blob; return 'blob:test'; };
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.requestAnimationFrame = () => {};
  let hintWorker;
  globalThis.Worker = class {
    constructor() { hintWorker = this; this.terminated = false; }
    postMessage(snapshot) { this.snapshot = snapshot; }
    terminate() { this.terminated = true; }
  };
  const game = new KnightGame();
  game.progress.flags = 1;
  await game.loadMain();
  game.handle('h');
  assert.equal(game.board.hint, 'searching');
  assert.equal(hintWorker.snapshot.steps, game.board.steps);
  hintWorker.onmessage({ data: { status: 'solved', direction: 3 } });
  assert.equal(game.board.hint, 3);
  assert.equal(hintWorker.terminated, true);
  game.handle('h');
  game.handle('h');
  const cancelledWorker = hintWorker;
  game.handle('ArrowUp');
  assert.equal(cancelledWorker.terminated, true);
  cancelledWorker.onmessage({ data: { status: 'solved', direction: 3 } });
  assert.equal(game.board.hint, null, 'stale hint cannot reappear after input');
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
  const pointer = button => ({ button, clientX: 100, clientY: 100, preventDefault() { this.prevented = true; } });
  canvasListeners.pointerdown(pointer(0));
  assert.notEqual(game.board.direction, null);
  assert.equal(game.board.turn, 0, 'left click only selects direction');
  const right = pointer(2);
  canvasListeners.pointerdown(right);
  assert.equal(right.prevented, true);
  assert.equal(game.board.turn, 1, 'right click confirms the selected move');
  canvasListeners.pointerdown(pointer(2));
  assert.equal(game.board.turn, 0, 'right click undoes when no direction is selected');
  assert.equal(game.board.direction, null);
  const contextMenu = { prevented: false, preventDefault() { this.prevented = true; } };
  canvasListeners.contextmenu(contextMenu);
  assert.equal(contextMenu.prevented, true, 'browser context menu is blocked on canvas');
  game.activateAudio();
  game.setScreen('win');
  game.audio.playEffect('win');
  game.audio.clips.win.currentTime = 3;
  await game.handle(' ');
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
  let finishLoad;
  game.levels.load = () => new Promise(resolve => { finishLoad = resolve; });
  game.setScreen('win');
  game.audio.playEffect('win');
  const nextLevel = game.handle(' ');
  assert.equal(game.audio.clips.win.playing, false, 'Space stops win audio before the level file loads');
  finishLoad(firstLevel());
  await nextLevel;
  await game.importCustomLevel({ name: 'my level.txt', size: 100, text: async () => fileText('level_0.txt') });
  assert.equal(game.state.saved[0].name, 'my level');
  game.startEditor(game.state.saved[0].level, 'my level');
  game.editor.verified = true;
  game.handle('s');
  game.handle('Enter');
  assert.equal(game.state.saved.length, 1, 'editing a saved level may overwrite its existing name');
  assert.equal(downloaded, 'my_level.txt', 'confirming Save starts a download');
  assert.equal(downloadCount, 1);
  assert.deepEqual(parseLevel(await exportedBlob.text()), game.state.saved[0].level);
  game.setScreen('saved');
  game.exportSelectedLevel();
  assert.equal(downloaded, 'my_level.txt');
  assert.equal(downloadCount, 2, 'manual Export still works');
  assert.deepEqual(parseLevel(await exportedBlob.text()), game.state.saved[0].level);
  game.startEditor(firstLevel());
  game.editor.verified = true;
  game.handle('s');
  for (const key of ['N', 'e', 'w']) game.handle(key);
  game.handle('Enter');
  assert.equal(game.state.saved[0].name, 'New');
  assert.equal(downloaded, 'New.txt', 'a newly created level also downloads on Save');
  assert.equal(downloadCount, 3);
  assert.equal(game.downloadLevel({ name: 'Màn mới', level: firstLevel() }), 'Màn_mới.txt');
  game.setScreen('more');
  canvasListeners.pointerdown({ ...pointer(0), clientX: 900, clientY: 200 });
  assert.equal(game.state.moreIndex, 2);
  assert.equal(game.screen, 'more', 'left click only navigates a menu');
  canvasListeners.pointerdown({ ...pointer(2), clientX: 900, clientY: 200 });
  assert.equal(game.screen, 'custom', 'right click opens the selected menu item');
  game.state.editor = new LevelEditor(firstLevel(), 'verify mouse');
  game.editor.startVerification();
  game.setScreen('custom');
  canvasListeners.pointerdown(pointer(0));
  assert.notEqual(game.editor.board.direction, null);
  canvasListeners.pointerdown(pointer(2));
  assert.equal(game.editor.board.turn, 1);
  canvasListeners.pointerdown(pointer(2));
  assert.equal(game.editor.board.turn, 0, 'right click also undoes during custom verification');
});
