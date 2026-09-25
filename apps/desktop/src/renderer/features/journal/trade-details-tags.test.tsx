import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TagDto, TradeDto } from '../../../shared/desktop-api';
import { i18n } from '../../i18n';
import { TradeDetailsDialogView } from './trade-details-dialog-view';

const TRADE_NOTE_UI_TEXT = {
  entryLabel: 'Entry note',
  reviewLabel: 'Post-trade review',
  reviewStatusLabel: 'Review status',
  reviewedStatus: 'Reviewed',
  searchHint: 'Searchable from the trades table.',
} as const;

const TEST_TAGS: readonly TagDto[] = [
  {
    color: 'indigo',
    createdAt: '2026-09-13T12:00:00.000Z',
    description: 'Trend continuation',
    id: 'tag-breakout',
    name: 'Breakout',
    updatedAt: '2026-09-13T12:00:00.000Z',
  },
  {
    color: 'rose',
    createdAt: '2026-09-13T12:00:00.000Z',
    description: '',
    id: 'tag-news',
    name: 'News',
    updatedAt: '2026-09-13T12:00:00.000Z',
  },
];

const TEST_TRADE: TradeDto = {
  account: null,
  closedAt: '2026-09-13T12:00:00.000Z',
  direction: 'long',
  entryNote: 'Breakout after retest',
  execution: null,
  id: 'trade-1',
  instrumentId: 'instrument-1',
  instrumentSymbol: 'EURUSD',
  resultKind: 'cash',
  resultSource: 'manual',
  resultValue: '100',
  reviewNote: 'Waited for confirmation.',
  reviewStatus: 'reviewed',
  riskBindingSnapshot: null,
  tagIds: ['tag-breakout', 'tag-news'],
};

describe('TradeDetailsDialogView tags', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows selected tags with remove buttons and keeps the picker for adding', () => {
    const onTagIdsChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <TradeDetailsDialogView
          accountId={null}
          accounts={[]}
          createTagLabel={(name) => `Create ${name}`}
          execution={null}
          executionPreview={null}
          instruments={[]}
          labels={{
            account: 'Account',
            accountUnassigned: 'No account',
            allocationLots: 'Lots',
            allocationPercent: 'Percent',
            apply: 'Save',
            archived: 'Archived',
            asset: 'Asset',
            calculationAvailable: 'Available',
            calculationUnavailable: 'Unavailable',
            cancel: 'Cancel',
            clear: 'Clear',
            close: 'Close',
            commission: 'Commission',
            date: 'Date',
            direction: 'Direction',
            directionLong: 'Long',
            directionShort: 'Short',
            entryNote: TRADE_NOTE_UI_TEXT.entryLabel,
            entryPrice: 'Entry',
            exitPrice: 'Exit',
            execution: 'Execution',
            exitAllocationKind: 'Allocation',
            addExit: 'Add exit',
            exitResult: 'Exit result',
            exitResultShort: 'Result',
            exitVolume: 'Volume',
            exits: 'Exits',
            partialClosures: 'Partial',
            quantityLots: 'Lots',
            removeExit: 'Remove',
            result: 'Result',
            reviewNote: TRADE_NOTE_UI_TEXT.reviewLabel,
            reviewStatus: TRADE_NOTE_UI_TEXT.reviewStatusLabel,
            reviewUnreviewed: 'Unreviewed',
            reviewReviewed: TRADE_NOTE_UI_TEXT.reviewedStatus,
            notesHint: TRADE_NOTE_UI_TEXT.searchHint,
            risk: 'Risk',
            spreadTicks: 'Spread',
            stopLoss: 'Stop',
            tags: 'Tags',
            tagsEmpty: 'No tags',
            tagsPlaceholder: 'Select tags',
            tagsSearch: 'Search',
            time: 'Time',
            title: 'Details',
            unit: 'Unit',
            unitCash: 'USD',
            unitPercent: '%',
          }}
          onAccountChange={vi.fn()}
          onAddExit={vi.fn()}
          onClose={vi.fn()}
          onCreateTag={vi.fn().mockResolvedValue(undefined)}
          onDirectionChange={vi.fn()}
          onEntryNoteChange={vi.fn()}
          onExecutionEnabledChange={vi.fn()}
          onExecutionFieldChange={vi.fn()}
          onExitAllocationKindChange={vi.fn()}
          onExitFieldChange={vi.fn()}
          onExitReportedResultChange={vi.fn()}
          onInstrumentChange={vi.fn()}
          onRemoveExit={vi.fn()}
          onResultKindChange={vi.fn()}
          onResultValueChange={vi.fn()}
          onReviewNoteChange={vi.fn()}
          onReviewStatusChange={vi.fn()}
          onSubmit={vi.fn()}
          onTagIdsChange={onTagIdsChange}
          onTimestampChange={vi.fn()}
          removeTagLabel={(name) => `Remove ${name}`}
          tagIds={TEST_TRADE.tagIds}
          tags={TEST_TAGS}
          tagsAddPlaceholder="Add tags"
          trade={TEST_TRADE}
          unitOptions={[]}
        />
      </I18nextProvider>,
    );

    expect(screen.getByRole('textbox', { name: TRADE_NOTE_UI_TEXT.entryLabel })).toHaveValue(
      TEST_TRADE.entryNote,
    );
    expect(screen.getByRole('textbox', { name: TRADE_NOTE_UI_TEXT.reviewLabel })).toHaveValue(
      TEST_TRADE.reviewNote,
    );
    expect(
      screen.getByRole('combobox', { name: TRADE_NOTE_UI_TEXT.reviewStatusLabel }),
    ).toHaveTextContent(TRADE_NOTE_UI_TEXT.reviewedStatus);
    expect(screen.getByText(TRADE_NOTE_UI_TEXT.searchHint)).toBeDefined();

    expect(screen.getByText('Breakout')).toBeDefined();
    expect(screen.getByText('News')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tags' })).toHaveTextContent('Add tags');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Breakout' }));
    expect(onTagIdsChange).toHaveBeenCalledWith(['tag-news']);
  });
});
