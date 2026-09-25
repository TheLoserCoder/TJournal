import { TAG_COLOR_IDS, TAG_COLOR_PALETTE, isTagColorId, type Tag, type TagColorId } from './tag';

/**
 * Chromatic colours are placed on a wheel so that visual distance is a simple
 * circular distance. `slate` is neutral, so it keeps a fixed mid distance to
 * every hue instead of pretending to sit between two of them.
 */
const COLOR_RING: Readonly<Record<Exclude<TagColorId, 'slate'>, number>> = {
  [TAG_COLOR_IDS.indigo]: 0,
  [TAG_COLOR_IDS.violet]: 1,
  [TAG_COLOR_IDS.rose]: 2,
  [TAG_COLOR_IDS.orange]: 3,
  [TAG_COLOR_IDS.amber]: 4,
  [TAG_COLOR_IDS.olive]: 5,
  [TAG_COLOR_IDS.teal]: 6,
  [TAG_COLOR_IDS.cyan]: 7,
  [TAG_COLOR_IDS.blue]: 8,
};
const COLOR_RING_SIZE = 9;
const NEUTRAL_COLOR_DISTANCE = 2;
const RECENT_COLOR_WINDOW = 4;

export const tagColorDistance = (left: TagColorId, right: TagColorId): number => {
  if (left === right) return 0;
  if (left === TAG_COLOR_IDS.slate || right === TAG_COLOR_IDS.slate) {
    return NEUTRAL_COLOR_DISTANCE;
  }
  const difference = Math.abs(COLOR_RING[left] - COLOR_RING[right]);
  return Math.min(difference, COLOR_RING_SIZE - difference);
};

const countColors = (existing: readonly Tag[]): ReadonlyMap<TagColorId, number> => {
  const counts = new Map<TagColorId, number>(TAG_COLOR_PALETTE.map((color) => [color, 0]));
  for (const tag of existing) {
    if (!isTagColorId(tag.color)) continue;
    counts.set(tag.color, (counts.get(tag.color) ?? 0) + 1);
  }
  return counts;
};

/**
 * Chooses the least used palette colour, then the one furthest from the colours
 * of the most recently created tags. The result is deterministic and never
 * repeats a neighbour while an alternative remains available.
 */
export const suggestTagColor = (existing: readonly Tag[]): TagColorId => {
  const counts = countColors(existing);
  const minimumCount = Math.min(...TAG_COLOR_PALETTE.map((color) => counts.get(color) ?? 0));
  const candidates = TAG_COLOR_PALETTE.filter((color) => (counts.get(color) ?? 0) === minimumCount);
  const fallback = candidates[0] ?? TAG_COLOR_IDS.indigo;
  const recent = existing
    .slice(-RECENT_COLOR_WINDOW)
    .map((tag) => tag.color)
    .filter(isTagColorId);
  if (recent.length === 0) return fallback;

  let best = fallback;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = Math.min(...recent.map((color) => tagColorDistance(candidate, color)));
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
};
