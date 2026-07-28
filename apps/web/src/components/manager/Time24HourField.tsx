import { useId } from 'react';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute.toString().padStart(2, '0'));

interface Time24HourFieldProps {
  label: string;
  hourLabel: string;
  minuteLabel: string;
  value: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function Time24HourField({
  label,
  hourLabel,
  minuteLabel,
  value,
  disabled = false,
  onChange,
}: Readonly<Time24HourFieldProps>) {
  const id = useId();
  const [hour = '00', minute = '00'] = value?.split(':') ?? [];

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1 text-xs font-medium text-gray-500 sm:sr-only">{label}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
        <select
          id={`${id}-hour`}
          aria-label={`${label} - ${hourLabel}`}
          value={hour}
          onChange={(event) => onChange(`${event.target.value}:${minute}`)}
          className="min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-center text-sm tabular-nums disabled:bg-gray-100 disabled:text-gray-400"
        >
          {HOURS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="font-bold text-gray-500">
          :
        </span>
        <select
          id={`${id}-minute`}
          aria-label={`${label} - ${minuteLabel}`}
          value={minute}
          onChange={(event) => onChange(`${hour}:${event.target.value}`)}
          className="min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-center text-sm tabular-nums disabled:bg-gray-100 disabled:text-gray-400"
        >
          {MINUTES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
