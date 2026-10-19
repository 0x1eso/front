// World War 1936 (spec §3.1): one day is 0.75 s, 15 ticks are two days.
// Integer Gregorian arithmetic (H. Hinnant's days_from_civil), no Date.

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

/** Days since 1970-01-01. */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDays(days: number): CivilDate {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36524) -
      Math.floor(doe / 146096)) /
      365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

const EPOCH_1936 = daysFromCivil(1936, 1, 1);

/** Days since 1936-01-01 at `tick`; 0 until the preparation minute ends. */
export function dayIndex(tick: number, prepEndTick: number): number {
  return tick <= prepEndTick ? 0 : Math.floor(((tick - prepEndTick) * 2) / 15);
}

/** The first tick of day `day`. */
export function dayStartTick(day: number, prepEndTick: number): number {
  return prepEndTick + Math.ceil((day * 15) / 2);
}

export function dateOfDay(day: number): CivilDate {
  return civilFromDays(EPOCH_1936 + day);
}

/** Days since 1936-01-01 of an ISO date "YYYY-MM-DD". */
export function dayOfDate(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m === null) throw new Error(`not an ISO date: ${iso}`);
  return daysFromCivil(Number(m[1]), Number(m[2]), Number(m[3])) - EPOCH_1936;
}

export function formatIsoDate(d: CivilDate): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}
