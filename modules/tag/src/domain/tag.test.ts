import { describe, expect, it } from 'vitest';

import {
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  TAG_VALIDATION_CODES,
  TagValidationError,
  isTagColorId,
  normalizeTagDescription,
  normalizeTagName,
  normalizeTagNameKey,
  requireTagColor,
} from './tag';

describe('tag domain normalisation', () => {
  it('trims the display name', () => {
    expect(normalizeTagName('  Breakout  ')).toBe('Breakout');
  });

  it('rejects an empty name', () => {
    expect(() => normalizeTagName('   ')).toThrow(TagValidationError);
  });

  it('rejects a name over the limit', () => {
    expect(() => normalizeTagName('a'.repeat(TAG_NAME_MAX_LENGTH + 1))).toThrow(TagValidationError);
  });

  it('builds a case-insensitive identity key', () => {
    expect(normalizeTagNameKey('  News  ')).toBe(normalizeTagNameKey('news'));
  });

  it('keeps the display name untouched while keying uniqueness', () => {
    expect(normalizeTagName('News')).toBe('News');
    expect(normalizeTagNameKey('News')).toBe('news');
  });

  it('defaults a missing description to an empty string', () => {
    expect(normalizeTagDescription(undefined)).toBe('');
    expect(normalizeTagDescription('  reason  ')).toBe('reason');
  });

  it('rejects a description over the limit', () => {
    expect(() => normalizeTagDescription('a'.repeat(TAG_DESCRIPTION_MAX_LENGTH + 1))).toThrow(
      TagValidationError,
    );
  });

  it('rejects an unknown colour', () => {
    expect(() => requireTagColor('chartreuse')).toThrow(TagValidationError);
    expect(isTagColorId('indigo')).toBe(true);
    expect(isTagColorId('chartreuse')).toBe(false);
  });

  it('exposes stable issue codes', () => {
    expect(TAG_VALIDATION_CODES.nameRequired).toBe('tag-name-required');
  });
});
