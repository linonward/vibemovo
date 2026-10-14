// Billing-period dates. All in UTC, as providers report period ends.

// The same day `months` calendar months later (or earlier). A month that
// lacks the day, such as February 31, gives its last day instead.
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

// The months of a yearly period, counted from 0 at its start, that have
// begun by `now`, leaving out month 0: the charge itself grants that one.
// The period starts a year before it ends.
export function monthsBegun(periodEnd: Date, now: Date): number[] {
  const start = addMonths(periodEnd, -12);
  const months: number[] = [];
  for (let month = 1; month < 12 && addMonths(start, month) <= now; month++) months.push(month);
  return months;
}
