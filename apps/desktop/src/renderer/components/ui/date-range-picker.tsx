import { enUS, ru } from 'date-fns/locale';
import { CalendarDays, RotateCcw } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { useTranslation } from 'react-i18next';

import { IconButton } from './icon-button';
import { Popover } from './popover';
import { Tooltip } from './tooltip';

const DATE_PART_LENGTH = 2;
const DATE_PART_PADDING = '0';
const EMPTY_DATE_KEY = '';
const toDate = (value: string): Date | undefined =>
  value === EMPTY_DATE_KEY ? undefined : new Date(`${value}T00:00:00`);
const toDatePart = (value: number): string =>
  value.toString().padStart(DATE_PART_LENGTH, DATE_PART_PADDING);
const toDateKey = (value: Date | undefined): string =>
  value === undefined
    ? EMPTY_DATE_KEY
    : `${value.getFullYear()}-${toDatePart(value.getMonth() + 1)}-${toDatePart(value.getDate())}`;

interface DateRangePickerProps {
  readonly clearLabel: string;
  readonly from: string;
  readonly onChange: (range: { readonly from: string; readonly to: string }) => void;
  readonly summary: string;
  readonly to: string;
}

interface DatePickerProps {
  readonly clearLabel: string;
  readonly layer?: 'base' | 'dialog';
  readonly onChange: (value: string) => void;
  readonly summary: string;
  readonly value: string;
  readonly clearable?: boolean;
}

interface CalendarPanelProps {
  readonly clearLabel: string;
  readonly mode: 'range' | 'single';
  readonly onClear: () => void;
  readonly onSelect: (value: Date | DateRange | undefined) => void;
  readonly selected: Date | DateRange | undefined;
  readonly clearable: boolean;
}

const CalendarPanel = ({
  clearLabel,
  clearable,
  mode,
  onClear,
  onSelect,
  selected,
}: CalendarPanelProps): ReactElement => {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : ru;
  const calendar =
    mode === 'range' ? (
      <DayPicker
        locale={locale}
        mode="range"
        onSelect={(value) => onSelect(value)}
        selected={selected as DateRange | undefined}
      />
    ) : (
      <DayPicker
        locale={locale}
        mode="single"
        onSelect={(value) => onSelect(value)}
        selected={selected as Date | undefined}
      />
    );
  return (
    <div className="ui-calendar-panel">
      {clearable && (
        <div className="ui-calendar-actions">
          <Tooltip content={clearLabel}>
            <IconButton label={clearLabel} onClick={onClear}>
              <RotateCcw aria-hidden="true" />
            </IconButton>
          </Tooltip>
        </div>
      )}
      {calendar}
    </div>
  );
};

export const DateRangePickerPanel = ({
  clearLabel,
  from,
  onChange,
  summary,
  to,
}: DateRangePickerProps): ReactElement => {
  void summary;
  const range: DateRange | undefined =
    from === EMPTY_DATE_KEY && to === EMPTY_DATE_KEY
      ? undefined
      : { from: toDate(from), to: toDate(to) };

  return (
    <div className="ui-date-range-picker">
      <CalendarPanel
        clearLabel={clearLabel}
        clearable
        mode="range"
        onClear={() => onChange({ from: EMPTY_DATE_KEY, to: EMPTY_DATE_KEY })}
        onSelect={(nextRange) => {
          const rangeValue = nextRange as DateRange | undefined;
          onChange({
            from: toDateKey(rangeValue?.from),
            to: toDateKey(rangeValue?.to),
          });
        }}
        selected={range}
      />
    </div>
  );
};

export const DatePickerPanel = ({
  clearLabel,
  clearable = true,
  onChange,
  value,
}: DatePickerProps): ReactElement => (
  <CalendarPanel
    clearLabel={clearLabel}
    clearable={clearable}
    mode="single"
    onClear={() => onChange(EMPTY_DATE_KEY)}
    onSelect={(nextDate) => {
      const date = nextDate as Date | undefined;
      onChange(toDateKey(date));
    }}
    selected={toDate(value)}
  />
);

export const DatePicker = ({
  clearLabel,
  clearable = true,
  layer = 'base',
  onChange,
  summary,
  value,
}: DatePickerProps): ReactElement => {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      layer={layer}
      onOpenChange={setOpen}
      open={open}
      trigger={
        <button className="ui-filter-trigger ui-date-picker-trigger" type="button">
          <CalendarDays aria-hidden="true" />
          <span>{value || summary}</span>
        </button>
      }
    >
      <DatePickerPanel
        clearLabel={clearLabel}
        clearable={clearable}
        onChange={onChange}
        summary={summary}
        value={value}
      />
    </Popover>
  );
};

export const DateRangePicker = (props: DateRangePickerProps): ReactElement => {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      onOpenChange={setOpen}
      open={open}
      trigger={
        <button className="ui-filter-trigger" type="button">
          <CalendarDays aria-hidden="true" />
          {props.summary}
        </button>
      }
    >
      <DateRangePickerPanel {...props} />
    </Popover>
  );
};
