import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../i18n';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { NumberFilterPanel } from './number-filter-panel';
import { createEmptyNumberFilterState, NUMBER_FILTER_MODES } from './number-filter-state';

describe('NumberFilterPanel', () => {
  afterEach(() => {
    cleanup();
  });

  const renderPanel = (
    mode: (typeof NUMBER_FILTER_MODES)[keyof typeof NUMBER_FILTER_MODES],
    unit?: string,
  ) => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <NumberFilterPanel
          label="Result"
          onChange={onChange}
          state={{ ...createEmptyNumberFilterState(), mode }}
          {...(unit === undefined ? {} : { unit })}
        />
      </I18nextProvider>,
    );
    return onChange;
  };

  it('shows the minimum input for the greater-than mode', async () => {
    await i18n.changeLanguage('en');
    const onChange = renderPanel(NUMBER_FILTER_MODES.greaterThan);

    const minimum = screen.getByLabelText(i18n.t(TRANSLATION_KEYS.tableFilterMinimum));
    expect(minimum).toBeVisible();
    expect(
      screen.queryByLabelText(i18n.t(TRANSLATION_KEYS.tableFilterMaximum)),
    ).not.toBeInTheDocument();

    fireEvent.change(minimum, { target: { value: '100' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minimum: '100', mode: NUMBER_FILTER_MODES.greaterThan }),
    );
  });

  it('shows the maximum input for the less-than mode', async () => {
    await i18n.changeLanguage('en');
    renderPanel(NUMBER_FILTER_MODES.lessThan);

    expect(screen.getByLabelText(i18n.t(TRANSLATION_KEYS.tableFilterMaximum))).toBeVisible();
    expect(
      screen.queryByLabelText(i18n.t(TRANSLATION_KEYS.tableFilterMinimum)),
    ).not.toBeInTheDocument();
  });

  it('shows a single value input for the equals mode', async () => {
    await i18n.changeLanguage('en');
    const onChange = renderPanel(NUMBER_FILTER_MODES.equals);

    const value = screen.getByLabelText(i18n.t(TRANSLATION_KEYS.tableFilterValue));
    expect(value).toBeVisible();

    fireEvent.change(value, { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minimum: '42', mode: NUMBER_FILTER_MODES.equals }),
    );
  });

  it('shows both bounds for the between mode', async () => {
    await i18n.changeLanguage('en');
    renderPanel(NUMBER_FILTER_MODES.between);

    expect(screen.getByLabelText(i18n.t(TRANSLATION_KEYS.tableFilterMinimum))).toBeVisible();
    expect(screen.getByLabelText(i18n.t(TRANSLATION_KEYS.tableFilterMaximum))).toBeVisible();
  });

  it('carries the currency in the placeholder instead of a separate label', async () => {
    await i18n.changeLanguage('en');
    renderPanel(NUMBER_FILTER_MODES.greaterThan, 'USD');

    const minimum = screen.getByLabelText(i18n.t(TRANSLATION_KEYS.tableFilterMinimum));
    expect(minimum).toBeVisible();
    expect(minimum).toHaveAttribute(
      'placeholder',
      i18n.t(TRANSLATION_KEYS.tableFilterMinimumCurrency),
    );
    expect(i18n.t(TRANSLATION_KEYS.tableFilterMinimumCurrency)).toContain('$');
  });

  it('keeps the mode selector and value in a single row', async () => {
    await i18n.changeLanguage('en');
    renderPanel(NUMBER_FILTER_MODES.greaterThan);

    const row = document.querySelector('.ui-number-filter-row');
    expect(row).not.toBeNull();
    expect(row?.querySelector('.ui-number-filter-mode')).not.toBeNull();
    expect(row?.querySelector('.ui-number-filter-value')).not.toBeNull();
    expect(document.querySelector('.ui-number-filter-unit')).toBeNull();
  });
});
