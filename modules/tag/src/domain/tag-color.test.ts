import { describe, expect, it } from 'vitest';

import { TAG_COLOR_IDS, TAG_COLOR_PALETTE, type Tag, type TagColorId } from './tag';
import { suggestTagColor, tagColorDistance } from './tag-color';

const createTag = (id: string, color: TagColorId, createdAt: string): Tag => ({
  color,
  createdAt,
  description: '',
  id,
  name: id,
  updatedAt: createdAt,
});

describe('tagColorDistance', () => {
  it('is symmetric and zero for the same colour', () => {
    for (const left of TAG_COLOR_PALETTE) {
      expect(tagColorDistance(left, left)).toBe(0);
      for (const right of TAG_COLOR_PALETTE) {
        expect(tagColorDistance(left, right)).toBe(tagColorDistance(right, left));
      }
    }
  });

  it('treats slate as a mid-distance neutral', () => {
    expect(tagColorDistance(TAG_COLOR_IDS.slate, TAG_COLOR_IDS.indigo)).toBe(2);
    expect(tagColorDistance(TAG_COLOR_IDS.slate, TAG_COLOR_IDS.slate)).toBe(0);
  });
});

describe('suggestTagColor', () => {
  it('starts with indigo on an empty catalogue', () => {
    expect(suggestTagColor([])).toBe(TAG_COLOR_IDS.indigo);
  });

  it('never repeats the previous colour while alternatives exist', () => {
    const existing = [createTag('a', TAG_COLOR_IDS.indigo, '2026-01-01T00:00:00.000Z')];
    expect(suggestTagColor(existing)).not.toBe(TAG_COLOR_IDS.indigo);
  });

  it('produces a deterministic spread over consecutive creations', () => {
    const existing: Tag[] = [];
    const first = suggestTagColor(existing);
    existing.push(createTag('a', first, '2026-01-01T00:00:00.000Z'));
    const second = suggestTagColor(existing);
    existing.push(createTag('b', second, '2026-01-02T00:00:00.000Z'));
    const third = suggestTagColor(existing);
    existing.push(createTag('c', third, '2026-01-03T00:00:00.000Z'));

    expect(new Set([first, second, third]).size).toBe(3);
    expect([first, second, third]).toEqual([
      TAG_COLOR_IDS.indigo,
      TAG_COLOR_IDS.olive,
      TAG_COLOR_IDS.cyan,
    ]);
  });

  it('prefers the least used colour over the most recent one', () => {
    const existing = TAG_COLOR_PALETTE.map((color, index) =>
      createTag(`tag-${index}`, color, `2026-01-0${(index % 9) + 1}T00:00:00.000Z`),
    );
    const suggestion = suggestTagColor(existing);
    expect(TAG_COLOR_PALETTE).toContain(suggestion);
    // Every colour has one tag, so the tie-break keeps the suggestion distinct
    // from the most recently created colours.
    const recent = existing.slice(-4).map((tag) => tag.color);
    expect(recent).not.toContain(suggestion);
  });

  it('respects manual colours when counting usage', () => {
    const existing = [
      createTag('a', TAG_COLOR_IDS.indigo, '2026-01-01T00:00:00.000Z'),
      createTag('b', TAG_COLOR_IDS.indigo, '2026-01-02T00:00:00.000Z'),
      createTag('c', TAG_COLOR_IDS.olive, '2026-01-03T00:00:00.000Z'),
    ];
    expect(suggestTagColor(existing)).not.toBe(TAG_COLOR_IDS.indigo);
  });
});
