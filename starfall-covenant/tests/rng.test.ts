import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';

describe('createRng', () => {
  it('相同種子產生相同序列', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.int(6)]).toEqual([b.next(), b.next(), b.int(6)]);
  });
});
