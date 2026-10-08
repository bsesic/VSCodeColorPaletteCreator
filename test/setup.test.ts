import * as assert from 'assert';
import { PALETTE_FORMAT_VERSION } from '../src/core/version';

describe('project setup', () => {
  it('exposes a palette format version', () => {
    assert.strictEqual(PALETTE_FORMAT_VERSION, 1);
  });
});
