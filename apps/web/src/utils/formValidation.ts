export const INPUT_LIMITS = {
  search: 160,
  displayName: 120,
  organizationName: 200,
  branchName: 160,
  queueName: 120,
  productName: 200,
  email: 254,
  password: 128,
  phone: 20,
  postalCode: 8,
  prefecture: 20,
  city: 100,
  addressLine: 200,
  currentAddress: 300,
  description: 1000,
  shortDescription: 500,
  jobTitle: 120,
  employeeCode: 50,
  slug: 120,
  url: 2_000,
  notes: 500,
} as const;

export type ApiFieldErrors = Record<string, string[]>;

export function getApiFieldErrors(error: unknown): ApiFieldErrors {
  if (!error || typeof error !== 'object' || !('details' in error)) return {};
  const details = (error as { details?: unknown }).details;
  if (!details || typeof details !== 'object' || !('fieldErrors' in details)) return {};
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== 'object') return {};
  return fieldErrors as ApiFieldErrors;
}

export function firstFieldError(errors: ApiFieldErrors, ...paths: string[]): string | undefined {
  for (const path of paths) {
    const message = errors[path]?.[0];
    if (message) return message;
  }
  return undefined;
}
