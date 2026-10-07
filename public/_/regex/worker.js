import { execAll } from './lib.js';
// The page terminates this worker if a pattern takes longer than a second.
self.onmessage = ({ data: { id, pattern, flags, text, repl } }) => {
  try {
    self.postMessage({ id, ...execAll(pattern, flags, text, repl) });
  } catch (e) {
    self.postMessage({ id, error: e.message });
  }
};
