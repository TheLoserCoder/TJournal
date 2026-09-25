import { enUS, ru } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { useTranslation } from 'react-i18next';

import { TRANSLATION_KEYS } from '../../i18n-keys';
import type { DateTimeRangeFilterState } from './datetime-range-filter-state';
import { TimeField } from './time-field';

const DATE_PART_LENGTH = 2;
const DATE_PART_PADDING = '0';
const toDatePart = (value: number): string =>
  value.toString().padStart(DATE_PART_LENGTH, DATE_PART_PADDING);
const toDateKey = (value: Date | undefined): string =>
  value === undefined
    ? ''
    : `${value.getFullYear()}-${toDatePart(value.getMonth() + 1)}-${toDatePart(value.getDate())}`;
const toDate = (value: string): Date | undefined =>
  value === '' ? undefined : new Date(`${value}T00:00:00`);

interface DateTimeRangePanelProps {
  readonly onChange: (state: DateTimeRangeFilterState) => void;
  readonly state: DateTimeRangeFilterState;
}

/**
 * Calendar plus optional time bounds for an exact datetime window. The panel
 * edits one shared range; the feature predicate derives inclusive timestamp
 * boundaries from the selected dates and times.
 */
export const DateTimeRangePanel = ({ onChange, state }: DateTimeRangePanelProps): ReactElement => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : ru;
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(undefined);
  const range: DateRange | undefined =
    state.from === '' && state.to === ''
      ? undefined
      : { from: toDate(state.from), to: toDate(state.to) };
  const applyRange = (value: DateRange | undefined): void => {
    const from = toDateKey(value?.from);
    const to = toDateKey(value?.to);
    onChange({
      ...state,
      // A partial selection keeps the previous end date until the user picks it.
      from,
      to: to === '' ? state.to : to,
    });
  };
  return (
    <div className="ui-datetime-range">
      <div className="ui-calendar-panel">
        <DayPicker
          defaultMonth={range?.from ?? calendarMonth}
          locale={locale}
          mode="range"
          onMonthChange={setCalendarMonth}
          onSelect={(nextRange) => applyRange(nextRange as DateRange | undefined)}
          selected={range}
        />
      </div>
      {state.from !== '' && (
        <div className="ui-datetime-range-bounds">
          <CalendarDays aria-hidden="true" />
          <TimeField
            ariaLabel={t(TRANSLATION_KEYS.tableFilterFromTime)}
            onChange={(value) => onChange({ ...state, fromTime: value })}
            value={state.fromTime}
          />
          <TimeField
            ariaLabel={t(TRANSLATION_KEYS.tableFilterToTime)}
            onChange={(value) => onChange({ ...state, toTime: value })}
            value={state.toTime}
          />
        </div>
      )}
    </div>
  );
};
