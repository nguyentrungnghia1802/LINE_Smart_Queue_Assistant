import type { InputHTMLAttributes, KeyboardEvent } from 'react';

type BoundedNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'max' | 'min' | 'onChange' | 'step' | 'type' | 'value'
> & {
  value: string | number;
  min: number;
  max: number;
  integer?: boolean;
  onValueChange: (value: string) => void;
};

export function BoundedNumberInput({
  value,
  min,
  max,
  integer = true,
  onValueChange,
  onKeyDown,
  ...props
}: Readonly<BoundedNumberInputProps>) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.key === 'e' ||
      event.key === 'E' ||
      event.key === '+' ||
      (event.key === '-' && min >= 0) ||
      (event.key === '.' && integer)
    ) {
      event.preventDefault();
    }
    onKeyDown?.(event);
  }

  return (
    <input
      {...props}
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      min={min}
      max={max}
      step={integer ? 1 : 'any'}
      value={value}
      onKeyDown={handleKeyDown}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}
