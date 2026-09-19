import { Clock3 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';

interface TimeFieldProps {
  readonly ariaLabel: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TimeField = ({ ariaLabel, onChange, value }: TimeFieldProps): ReactElement => {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  const commit = (): void => {
    if (TIME_PATTERN.test(draft)) {
      if (draft !== value) onChange(draft);
    } else {
      setDraft(value);
    }
  };

  return (
    <span className="ui-time-field">
      <Clock3 aria-hidden="true" className="ui-time-field-icon" />
      <input
        aria-label={ariaLabel}
        autoComplete="off"
        className="ui-time-field-input"
        inputMode="numeric"
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          commit();
        }}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
        spellCheck={false}
        value={draft}
      />
    </span>
  );
};
