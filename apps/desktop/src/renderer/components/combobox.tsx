import { useMemo, type ReactElement } from 'react';

interface ComboboxProps {
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
  readonly value: string;
}
export const Combobox = ({ onChange, options, value }: ComboboxProps): ReactElement => {
  const listId = 'instrument-options';
  const matching = useMemo(
    () => options.filter((option) => option.includes(value.toUpperCase())),
    [options, value],
  );
  return (
    <>
      <input
        aria-label="Актив"
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      <datalist id={listId}>
        {matching.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
};
