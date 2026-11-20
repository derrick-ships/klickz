import { describe, expect, it } from 'vitest';
import { selectThumbBackfill } from '../src/lib/thumb-backfill';

describe('thumbnail backfill selection', () => {
  it('selects only missing owned creation PNGs, once, capped per session', () => {
    const rows = Array.from({length: 45}, (_, i) => ({image_path:`user/creations/${i}.png`, settings: undefined}));
    rows.push({image_path:'user/references/a.png',settings:undefined}, {image_path:'other/creations/b.png',settings:undefined}, {image_path:'user/creations/c.jpg',settings:undefined});
    const missing = new Set(rows.map(row => row.image_path.replace(/\.png$/, '.jpg')));
    const seen = new Set(['user/creations/0.png']);
    const selected = selectThumbBackfill(rows, 'user', missing, seen, 39);
    expect(selected).toHaveLength(39);
    expect(selected[0].image_path).toBe('user/creations/1.png');
    expect(selected.every(row => row.image_path?.startsWith('user/creations/') && row.image_path.endsWith('.png'))).toBe(true);
    expect(selectThumbBackfill(rows, 'user', new Set(), new Set())).toEqual([]);
    expect(selectThumbBackfill(rows, 'user', missing, new Set(), 0)).toEqual([]);
  });
});
