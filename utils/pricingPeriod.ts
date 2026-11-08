const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a YYYY-MM-DD value as a UTC calendar date; undefined when the format or the date is invalid.
 */
function parseDateOnly(value: string): Date | undefined {
  const match = DATE_ONLY.exec(value);
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return roundTrips ? date : undefined;
}

/**
 * Checks a project pricing period the way the Approx API does before the request is sent:
 * both values YYYY-MM-DD, the start not after the end, both in the same calendar year.
 * Returns the error to show, or undefined when the period is valid.
 */
export function pricingPeriodError(
  start: string,
  end: string,
): string | undefined {
  const startDate = parseDateOnly(start);
  if (!startDate) {
    return `Pricing Period Start must be a date in YYYY-MM-DD format (got "${start}").`;
  }
  const endDate = parseDateOnly(end);
  if (!endDate) {
    return `Pricing Period End must be a date in YYYY-MM-DD format (got "${end}").`;
  }
  if (endDate.getTime() < startDate.getTime()) {
    return "Pricing Period End must be on or after Pricing Period Start.";
  }
  if (endDate.getUTCFullYear() !== startDate.getUTCFullYear()) {
    return "Pricing Period Start and End must be in the same calendar year.";
  }
  return undefined;
}
