import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../i18n';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { TableLayoutDialogView } from './table-layout-dialog-view';

const columns = [{ id: 'result', label: 'Result', visible: true }];

describe('TableLayoutDialogView risk setting', () => {
  afterEach(() => {
    cleanup();
  });

  it('edits the 1R default when the risk props are provided', async () => {
    await i18n.changeLanguage('en');
    const onRiskUsdChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <TableLayoutDialogView
          applyLabel="Apply"
          cancelLabel="Cancel"
          closeLabel="Close"
          columns={columns}
          onApply={vi.fn()}
          onClose={vi.fn()}
          onToggleColumn={vi.fn()}
          onRiskUsdChange={onRiskUsdChange}
          riskUsd="100"
          riskUsdHint={i18n.t(TRANSLATION_KEYS.tradeOneRiskHelp)}
          riskUsdLabel={i18n.t(TRANSLATION_KEYS.tradeOneRiskUsd)}
          title={i18n.t(TRANSLATION_KEYS.tableLayout)}
        />
      </I18nextProvider>,
    );

    const field = screen.getByLabelText(i18n.t(TRANSLATION_KEYS.tradeOneRiskUsd));
    expect(field).toHaveValue('100');
    expect(screen.getByText(i18n.t(TRANSLATION_KEYS.tradeOneRiskHelp))).toBeVisible();

    fireEvent.change(field, { target: { value: '150' } });
    expect(onRiskUsdChange).toHaveBeenCalledWith('150');
  });

  it('hides the 1R setting when the risk props are absent', async () => {
    await i18n.changeLanguage('en');
    render(
      <I18nextProvider i18n={i18n}>
        <TableLayoutDialogView
          applyLabel="Apply"
          cancelLabel="Cancel"
          closeLabel="Close"
          columns={columns}
          onApply={vi.fn()}
          onClose={vi.fn()}
          onToggleColumn={vi.fn()}
          title={i18n.t(TRANSLATION_KEYS.tableLayout)}
        />
      </I18nextProvider>,
    );

    expect(
      screen.queryByLabelText(i18n.t(TRANSLATION_KEYS.tradeOneRiskUsd)),
    ).not.toBeInTheDocument();
  });
});
