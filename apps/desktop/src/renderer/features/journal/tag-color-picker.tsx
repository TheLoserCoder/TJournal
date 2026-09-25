import { useTranslation } from 'react-i18next';
import type { ReactElement } from 'react';

import { TAG_COLOR_PALETTE, type TagColorId } from '@tjournal/tag/palette';

import { TRANSLATION_KEYS } from '../../i18n-keys';

const TAG_COLOR_LABEL_KEYS: Readonly<Record<TagColorId, string>> = {
  amber: TRANSLATION_KEYS.tagColorAmber,
  blue: TRANSLATION_KEYS.tagColorBlue,
  cyan: TRANSLATION_KEYS.tagColorCyan,
  indigo: TRANSLATION_KEYS.tagColorIndigo,
  olive: TRANSLATION_KEYS.tagColorOlive,
  orange: TRANSLATION_KEYS.tagColorOrange,
  rose: TRANSLATION_KEYS.tagColorRose,
  slate: TRANSLATION_KEYS.tagColorSlate,
  teal: TRANSLATION_KEYS.tagColorTeal,
  violet: TRANSLATION_KEYS.tagColorViolet,
};

interface TagColorPickerProps {
  readonly onChange: (color: TagColorId) => void;
  readonly value: TagColorId;
}

/** Colour swatches; selection is conveyed by a check mark, not by colour alone. */
export const TagColorPicker = ({ onChange, value }: TagColorPickerProps): ReactElement => {
  const { t } = useTranslation();
  return (
    <div
      aria-label={t(TRANSLATION_KEYS.fieldTagColor)}
      className="tag-color-picker"
      role="radiogroup"
    >
      {TAG_COLOR_PALETTE.map((color) => {
        const selected = color === value;
        return (
          <button
            aria-checked={selected}
            aria-label={t(TAG_COLOR_LABEL_KEYS[color] as Parameters<typeof t>[0])}
            className={['tag-color-swatch', `tag-chip-${color}`, selected ? 'is-selected' : '']
              .filter(Boolean)
              .join(' ')}
            key={color}
            onClick={() => onChange(color)}
            role="radio"
            type="button"
          >
            {selected ? <span aria-hidden="true">✓</span> : null}
          </button>
        );
      })}
    </div>
  );
};
