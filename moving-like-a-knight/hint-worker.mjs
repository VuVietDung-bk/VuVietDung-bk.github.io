import { solveHint } from './hint-solver.mjs';

self.onmessage = event => {
  self.postMessage(solveHint(event.data));
};
