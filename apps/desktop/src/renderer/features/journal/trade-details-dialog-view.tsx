import type { ReactElement } from 'react';

import type { AccountDto, InstrumentDto, TagDto, TradeDto } from '../../../shared/desktop-api';
import type { TradeExecutionInputDto } from '../../../shared/desktop-api';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { DatePicker } from '../../components/ui/date-range-picker';
import { DirectionToggle } from '../../components/ui/direction-toggle';
import { Dialog } from '../../components/ui/dialog';
import { Select, type SelectOption } from '../../components/ui/select';
import { Combobox } from '../../components/ui/combobox';
import { TextArea } from '../../components/ui/text-area';
import { TextField } from '../../components/ui/text-field';
import { TimeField } from '../../components/ui/time-field';
import { Checkbox } from '../../components/ui/checkbox';
import { IconButton } from '../../components/ui/icon-button';
import { TagChip } from './tag-chip';
import { TagPicker } from './tag-picker';

export interface TradeDetailsDialogLabels {
  readonly account: string;
  readonly accountUnassigned: string;
  readonly archived: string;
  readonly apply: string;
  readonly asset: string;
  readonly cancel: string;
  readonly clear: string;
  readonly close: string;
  readonly commission: string;
  readonly date: string;
  readonly time: string;
  readonly direction: string;
  readonly directionLong: string;
  readonly directionShort: string;
  readonly entryPrice: string;
  readonly exitPrice: string;
  readonly execution: string;
  readonly exits: string;
  readonly exitAllocationKind: string;
  readonly addExit: string;
  readonly removeExit: string;
  readonly quantityLots: string;
  readonly exitVolume: string;
  readonly exitResult: string;
  readonly exitResultShort: string;
  readonly spreadTicks: string;
  readonly calculationAvailable: string;
  readonly calculationUnavailable: string;
  readonly partialClosures: string;
  readonly result: string;
  readonly risk: string;
  readonly entryNote: string;
  readonly reviewNote: string;
  readonly reviewStatus: string;
  readonly reviewUnreviewed: string;
  readonly reviewReviewed: string;
  readonly notesHint: string;
  readonly stopLoss: string;
  readonly title: string;
  readonly unit: string;
  readonly unitCash: string;
  readonly unitPercent: string;
  readonly allocationPercent: string;
  readonly allocationLots: string;
  readonly tags: string;
  readonly tagsEmpty: string;
  readonly tagsPlaceholder: string;
  readonly tagsSearch: string;
}

interface TradeDetailsDialogViewProps {
  readonly accounts: readonly AccountDto[];
  readonly accountId: string | null;
  readonly instruments: readonly InstrumentDto[];
  readonly labels: TradeDetailsDialogLabels;
  readonly onClose: () => void;
  readonly onAccountChange: (value: string | null) => void;
  readonly execution: TradeExecutionInputDto | null;
  readonly executionPreview: string | null;
  readonly onDirectionChange: (value: 'long' | 'short') => void;
  readonly onEntryNoteChange: (value: string) => void;
  readonly onExecutionEnabledChange: (value: boolean) => void;
  readonly onExecutionFieldChange: (
    field: 'commissionUsd' | 'entryPrice' | 'quantityLots' | 'spreadTicks' | 'stopLossPrice',
    value: string,
  ) => void;
  readonly onExitFieldChange: (
    index: number,
    field: 'allocationValue' | 'exitPrice',
    value: string,
  ) => void;
  readonly onExitAllocationKindChange: (value: 'lots' | 'percent') => void;
  readonly onExitReportedResultChange: (
    index: number,
    kind: 'cash' | 'percent' | null,
    value: string | null,
  ) => void;
  readonly onAddExit: () => void;
  readonly onRemoveExit: (index: number) => void;
  readonly onInstrumentChange: (instrumentId: string) => void;
  readonly onResultKindChange: (value: TradeDto['resultKind']) => void;
  readonly onResultValueChange: (value: string) => void;
  readonly onReviewNoteChange: (value: string) => void;
  readonly onReviewStatusChange: (value: TradeDto['reviewStatus']) => void;
  readonly onSubmit: () => void;
  readonly createTagLabel: (name: string) => string;
  readonly onCreateTag: (name: string) => Promise<void>;
  readonly onTagIdsChange: (ids: readonly string[]) => void;
  readonly onTimestampChange: (value: string) => void;
  readonly removeTagLabel: (name: string) => string;
  readonly tagIds: readonly string[];
  readonly tags: readonly TagDto[];
  readonly tagsAddPlaceholder: string;
  readonly trade: TradeDto;
  readonly unitOptions: readonly SelectOption[];
}

export const TradeDetailsDialogView = ({
  accountId,
  accounts,
  execution,
  executionPreview,
  instruments,
  labels,
  onClose,
  onAccountChange,
  onDirectionChange,
  onEntryNoteChange,
  onExecutionEnabledChange,
  onExecutionFieldChange,
  onExitFieldChange,
  onExitAllocationKindChange,
  onExitReportedResultChange,
  onAddExit,
  onRemoveExit,
  onInstrumentChange,
  onResultKindChange,
  onResultValueChange,
  onReviewNoteChange,
  onReviewStatusChange,
  onSubmit,
  createTagLabel,
  onCreateTag,
  onTagIdsChange,
  onTimestampChange,
  removeTagLabel,
  tagIds,
  tags,
  tagsAddPlaceholder,
  trade,
  unitOptions,
}: TradeDetailsDialogViewProps): ReactElement => {
  const date = trade.closedAt.slice(0, 10);
  const time = trade.closedAt.slice(11, 16);
  const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));

  return (
    <Dialog
      closeLabel={labels.close}
      contentClassName="trade-details-dialog"
      onOpenChange={(open) => !open && onClose()}
      open
      title={labels.title}
    >
      <div className="trade-details-form">
        <label>
          {labels.account}
          <Select
            ariaLabel={labels.account}
            layer="dialog"
            onValueChange={(value) => onAccountChange(value === '' ? null : value)}
            options={[
              ...(trade.id === '' ? [] : [{ label: labels.accountUnassigned, value: '' }]),
              ...accounts
                .filter((account) => account.archivedAt === null || account.id === accountId)
                .map((account) => ({
                  label:
                    account.archivedAt === null
                      ? account.name
                      : `${account.name} (${labels.archived})`,
                  value: account.id,
                })),
            ]}
            placeholder={labels.account}
            value={accountId ?? ''}
          />
        </label>
        <label>
          {labels.direction}
          <DirectionToggle
            ariaLabel={labels.direction}
            longLabel={labels.directionLong}
            onChange={onDirectionChange}
            shortLabel={labels.directionShort}
            value={trade.direction ?? 'long'}
          />
        </label>
        <label>
          {labels.asset}
          <Combobox
            ariaLabel={labels.asset}
            layer="dialog"
            onChange={(value) => {
              const instrument = instruments.find((item) => item.symbol === value);
              if (instrument !== undefined) onInstrumentChange(instrument.id);
            }}
            options={instruments
              .filter(
                (instrument) =>
                  instrument.archivedAt === null || instrument.id === trade.instrumentId,
              )
              .map((instrument) => instrument.symbol)}
            placeholder={labels.asset}
            value={trade.instrumentSymbol}
          />
        </label>
        <div className="trade-details-date-fields">
          <label>
            {labels.date}
            <DatePicker
              clearLabel={labels.clear}
              clearable={false}
              layer="dialog"
              onChange={(value) => onTimestampChange(`${value}T${time}`)}
              summary={labels.date}
              value={date}
            />
          </label>
          <label>
            {labels.time}
            <TimeField
              ariaLabel={labels.time}
              onChange={(value) => onTimestampChange(`${date}T${value}`)}
              value={time}
            />
          </label>
        </div>
        <label>
          {labels.result}
          <TextField
            onChange={(event) => onResultValueChange(event.target.value)}
            placeholder={labels.result}
            value={trade.resultValue}
          />
        </label>
        <label>
          {labels.unit}
          <Select
            ariaLabel={labels.unit}
            layer="dialog"
            onValueChange={(value) => onResultKindChange(value as TradeDto['resultKind'])}
            options={unitOptions}
            placeholder={labels.unit}
            value={trade.resultKind}
          />
        </label>
        <div className="trade-tags-field">
          <span id="trade-tags-label">{labels.tags}</span>
          {selectedTags.length > 0 ? (
            <div aria-labelledby="trade-tags-label" className="tag-selected-list">
              {selectedTags.map((tag) => (
                <span className="tag-selected-chip" key={tag.id}>
                  <TagChip color={tag.color} label={tag.name} title={tag.name} />
                  <button
                    aria-label={removeTagLabel(tag.name)}
                    className="tag-selected-remove"
                    onClick={() =>
                      onTagIdsChange(tagIds.filter((selectedId) => selectedId !== tag.id))
                    }
                    type="button"
                  >
                    <X aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <TagPicker
            className="trade-tags-picker"
            createLabel={createTagLabel}
            emptyMessage={labels.tagsEmpty}
            hasSelection={false}
            label={labels.tags}
            layer="dialog"
            onCreateTag={onCreateTag}
            onSelectedIdsChange={onTagIdsChange}
            options={tags}
            placeholder={tagsAddPlaceholder}
            searchPlaceholder={labels.tagsSearch}
            selectedIds={tagIds}
          />
        </div>
        <label>
          {labels.entryNote}
          <TextArea
            autoComplete="off"
            name="entryNote"
            onChange={(event) => onEntryNoteChange(event.target.value)}
            rows={3}
            spellCheck
            value={trade.entryNote ?? ''}
          />
        </label>
        <label>
          {labels.reviewNote}
          <TextArea
            autoComplete="off"
            name="reviewNote"
            onChange={(event) => onReviewNoteChange(event.target.value)}
            rows={3}
            spellCheck
            value={trade.reviewNote ?? ''}
          />
        </label>
        <label>
          {labels.reviewStatus}
          <Select
            ariaLabel={labels.reviewStatus}
            layer="dialog"
            onValueChange={(value) => onReviewStatusChange(value as TradeDto['reviewStatus'])}
            options={[
              { label: labels.reviewUnreviewed, value: 'unreviewed' },
              { label: labels.reviewReviewed, value: 'reviewed' },
            ]}
            placeholder={labels.reviewStatus}
            value={trade.reviewStatus}
          />
        </label>
        <p className="entity-defaults-help">{labels.notesHint}</p>
        <label className="trade-execution-toggle">
          <Checkbox
            ariaLabel={labels.execution}
            checked={execution !== null}
            onCheckedChange={onExecutionEnabledChange}
          />
          {labels.execution}
        </label>
        {execution !== null && (
          <fieldset className="trade-execution-fields">
            <legend>{labels.execution}</legend>
            <div className="trade-execution-core-fields">
              <label>
                {labels.entryPrice}
                <TextField
                  inputMode="decimal"
                  placeholder={labels.entryPrice}
                  value={execution.entryPrice}
                  onChange={(event) => onExecutionFieldChange('entryPrice', event.target.value)}
                />
              </label>
              <label>
                {labels.stopLoss}
                <TextField
                  inputMode="decimal"
                  placeholder={labels.stopLoss}
                  value={execution.stopLossPrice ?? ''}
                  onChange={(event) => onExecutionFieldChange('stopLossPrice', event.target.value)}
                />
              </label>
              <label>
                {labels.quantityLots}
                <TextField
                  inputMode="decimal"
                  placeholder={labels.quantityLots}
                  value={execution.quantityLots}
                  onChange={(event) => onExecutionFieldChange('quantityLots', event.target.value)}
                />
              </label>
              <label>
                {labels.commission}
                <TextField
                  inputMode="decimal"
                  placeholder={labels.commission}
                  value={execution.commissionUsd}
                  onChange={(event) => onExecutionFieldChange('commissionUsd', event.target.value)}
                />
              </label>
              <label>
                {labels.spreadTicks}
                <TextField
                  inputMode="decimal"
                  placeholder={labels.spreadTicks}
                  value={execution.spreadTicks}
                  onChange={(event) => onExecutionFieldChange('spreadTicks', event.target.value)}
                />
              </label>
            </div>
            <div className="trade-exits-heading">
              <strong>{labels.exits}</strong>
              <div className="trade-exit-allocation-kind">
                <span>{labels.exitAllocationKind}</span>
                <Select
                  ariaLabel={labels.exitAllocationKind}
                  layer="dialog"
                  value={execution.exits[0]?.allocationKind ?? 'percent'}
                  onValueChange={(value) => onExitAllocationKindChange(value as 'lots' | 'percent')}
                  options={[
                    { label: labels.allocationPercent, value: 'percent' },
                    { label: labels.allocationLots, value: 'lots' },
                  ]}
                  placeholder={labels.exitAllocationKind}
                />
              </div>
              <Button type="button" variant={BUTTON_VARIANTS.secondary} onClick={onAddExit}>
                <Plus aria-hidden="true" />
                {labels.addExit}
              </Button>
            </div>
            <div className="trade-exit-editor">
              <div className="trade-exit-head">
                <span>{labels.exitPrice}</span>
                <span>
                  {execution.exits[0]?.allocationKind === 'lots'
                    ? labels.quantityLots
                    : labels.unitPercent}
                </span>
                <span>{labels.exitResultShort}</span>
                <span aria-hidden="true" />
              </div>
              <div className="trade-exit-rows">
                {execution.exits.map((exit, index) => (
                  <div className="trade-exit-row" key={exit.id}>
                    <TextField
                      aria-label={labels.exitPrice}
                      inputMode="decimal"
                      placeholder={labels.exitPrice}
                      value={exit.exitPrice}
                      onChange={(event) =>
                        onExitFieldChange(index, 'exitPrice', event.target.value)
                      }
                    />
                    <TextField
                      aria-label={labels.exitVolume}
                      disabled={index === execution.exits.length - 1 && execution.exits.length > 1}
                      inputMode="decimal"
                      placeholder={
                        exit.allocationKind === 'percent' ? labels.unitPercent : labels.quantityLots
                      }
                      value={exit.allocationValue}
                      onChange={(event) =>
                        onExitFieldChange(index, 'allocationValue', event.target.value)
                      }
                    />
                    <TextField
                      aria-label={labels.exitResult}
                      inputMode="decimal"
                      placeholder={labels.exitResult}
                      value={exit.reportedResultValue ?? ''}
                      onChange={(event) =>
                        onExitReportedResultChange(
                          index,
                          exit.reportedResultKind ?? 'cash',
                          event.target.value === '' ? null : event.target.value,
                        )
                      }
                    />
                    <IconButton
                      className="trade-exit-remove"
                      label={labels.removeExit}
                      onClick={() => onRemoveExit(index)}
                      variant="danger"
                    >
                      <Trash2 aria-hidden="true" />
                    </IconButton>
                  </div>
                ))}
              </div>
            </div>
            <p className={executionPreview === null ? 'calculation-hint' : 'calculation-preview'}>
              {executionPreview === null
                ? labels.calculationUnavailable
                : `${labels.calculationAvailable} ${executionPreview} ${labels.unitCash}`}
            </p>
          </fieldset>
        )}
      </div>
      <div className="ui-dialog-actions">
        <Button onClick={onClose} type="button" variant={BUTTON_VARIANTS.secondary}>
          {labels.cancel}
        </Button>
        <Button onClick={onSubmit} type="button">
          {labels.apply}
        </Button>
      </div>
    </Dialog>
  );
};
