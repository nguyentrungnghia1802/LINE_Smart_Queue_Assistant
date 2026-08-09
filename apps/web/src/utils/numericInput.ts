export function normalizeBoundedNumberInput(
  rawValue: string,
  options: { min: number; max: number; integer: boolean }
): string | null {
  if (rawValue === '') return '';
  if (rawValue === '-' && options.min < 0) return rawValue;

  const pattern = options.integer ? /^-?\d+$/ : /^-?\d+(?:\.\d*)?$/;
  if (!pattern.test(rawValue)) return null;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < options.min || value > options.max) return null;
  if (options.integer && !Number.isInteger(value)) return null;
  return rawValue;
}
