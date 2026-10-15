import { describe, expect, it } from 'vitest';
import { shuffled } from './shuffle.ts';

describe('shuffled', () => {
  const items = ['a', 'b', 'c', 'd'];
  it('is a stable permutation for a given seed', () => {
    const one = shuffled(items, 'run1|node');
    expect(shuffled(items, 'run1|node')).toEqual(one);
    expect([...one].sort()).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
  it('puts the first item first only about a quarter of the time', () => {
    let first = 0;
    for (let i = 0; i < 400; i++) if (shuffled(items, `seed${i}`)[0] === 'a') first++;
    expect(first).toBeGreaterThan(60);
    expect(first).toBeLessThan(140);
  });
});
