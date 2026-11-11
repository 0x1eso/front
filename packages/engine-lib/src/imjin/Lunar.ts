// ww177 (Imjin design §2): the lunar date and the reign year, for the
// Imjin War's date line. A table, not an ephemeris: the engine has no sin.
// Built by the lane's script from true new moons (Meeus ch. 49) and mean
// principal terms between December solstices (pingqi, as the Ming Datong
// calendar Joseon used), with the day at UT+8. It gives 1592-05-23 as the
// 4th month's 13th, Hansan (1592-08-14) as 7/8, Myeongnyang (1597-10-26) as
// 9/16 and Noryang (1598-12-16) as 11/19. 1591's leap month is the third,
// after the Ming Shilu (leap 3/18 = 1591-05-10); the modern ephemeris put it
// a month early on a one-day edge. Other months may differ from the
// historical almanac by a day.
/** Days since 1970-01-01 of lunar 1589, month 1, day 1 (the table's first). */
const FIRST_DAY = -139112;
/** The table's first lunar year. */
const FIRST_YEAR = 1589;
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/**
 * One letter a month from FIRST_DAY: ALPHABET index = (length − 29) |
 * leap << 1 | month << 2. Runs to the end of 1650.
 */
const TABLE =
  "EJMRUZdglpsxEINQVYdhkptwFIMPQUZdglptwFIMRUYdglptwFJMQVYchkptuxFI" +
  "NQVYchkpsxFJMRUZcglotwFJMRVYdgilotwFINRUZchkpsxEJMRUZdglotwFINQS" +
  "VZchlotxEINQUZchlpsxFIMRUYdglpsxFJKMRUYdglotxFINQVYchkpsxFINRUZc" +
  "glmpsxEJNQVYdglotwFINQVZchkpsxEJMRUZadhkpsxEJMQVYdhlotwFINQUZchl" +
  "otxEJMPQUZchkptxEJMRUYdglotxEJNQVYchkpsvwFJNQVYchkpsxEJNQVYdglot" +
  "wFINQVZchilotwFINQVYdhkpsxEJMQVYdhkptwFINQSVYdglptwFINQUZcglptxE" +
  "JMRUYdgkptwFJLMRUYdgkptwFJMRVYchkpsxEJMRVYdglorsxEJMRUZdglotwFIM" +
  "RUZdglpsxEJMQVYbchlpsxEJMQVYdglpsxFINQUZcglpsxFJMRSUZcglpsxFINRU" +
  "YdgkpsxFJMRUZchkotuxFINRUZchkpswFINRUZchlotwFIMRUZdgjlotwFIMRUZc" +
  "hlotxEJMQVYchlotxFINQSVYchkptxFINQUZcglotxFINQVYdgkpsxFGJNQVYdgk" +
  "psxEJNQVZchkpswFINQVZchlotuwFINQVYdhkptwFIMRUYdhkptxEJMQVYadglpt" +
  "xEJMQVYchkptxEJNQUZcglotxEJNORUZcglotwFJNQVYdgkpsxEJNQVYdhkot";

export interface LunarDate {
  /** The lunar year (its month 1 falls in this Gregorian year). */
  year: number;
  month: number;
  leap: boolean;
  day: number;
}

interface Month {
  start: number;
  year: number;
  month: number;
  leap: boolean;
}

let months: Month[] | null = null;

function table(): Month[] {
  if (months !== null) return months;
  const out: Month[] = [];
  let start = FIRST_DAY;
  let year = FIRST_YEAR - 1;
  for (const ch of TABLE) {
    const v = ALPHABET.indexOf(ch);
    const month = v >> 2;
    const leap = (v & 2) !== 0;
    if (month === 1 && !leap) year++;
    out.push({ start, year, month, leap });
    start += 29 + (v & 1);
  }
  out.push({ start, year: -1, month: 0, leap: false });
  months = out;
  return out;
}

/** The lunar date of a day (days since 1970-01-01); null outside 1589-1650. */
export function lunarOf(days: number): LunarDate | null {
  const t = table();
  if (days < t[0].start || days >= t[t.length - 1].start) return null;
  let lo = 0;
  let hi = t.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid].start <= days) lo = mid;
    else hi = mid - 1;
  }
  const m = t[lo];
  return {
    year: m.year,
    month: m.month,
    leap: m.leap,
    day: days - m.start + 1,
  };
}

// ---- Reign years ----

/** The courts whose reign years the date line can show. */
export const IMJIN_COURTS = ["joseon", "japan", "ming"] as const;
export type ImjinCourt = (typeof IMJIN_COURTS)[number];

/** An era: its key (`imjin.era.<key>`) and the year it shows. */
export interface ReignYear {
  era: string;
  year: number;
}

interface Era {
  key: string;
  /** The first lunar date of the era: year, month, day (leap months count as their month). */
  from: readonly [number, number, number];
  /** The lunar year counted as its year 1. */
  first: number;
}

/**
 * Joseon counts a king's years from the lunar year after his accession,
 * Ming from the new year after, Japan's eras from the year they begin.
 * Japanese era starts are their own calendar's dates, read here on the
 * Ming one.
 */
const ERAS: Readonly<Record<ImjinCourt, readonly Era[]>> = {
  joseon: [
    { key: "seonjo", from: [1567, 1, 1], first: 1568 },
    { key: "gwanghae", from: [1609, 1, 1], first: 1609 },
    { key: "injo", from: [1623, 3, 13], first: 1623 },
  ],
  japan: [
    { key: "tensho", from: [1573, 7, 28], first: 1573 },
    { key: "bunroku", from: [1592, 12, 8], first: 1592 },
    { key: "keicho", from: [1596, 10, 27], first: 1596 },
    { key: "genna", from: [1615, 7, 13], first: 1615 },
    { key: "kanei", from: [1624, 2, 30], first: 1624 },
  ],
  ming: [
    { key: "wanli", from: [1573, 1, 1], first: 1573 },
    { key: "tianqi", from: [1621, 1, 1], first: 1621 },
    { key: "chongzhen", from: [1628, 1, 1], first: 1628 },
  ],
};

const before = (d: LunarDate, f: readonly [number, number, number]) =>
  d.year !== f[0]
    ? d.year < f[0]
    : d.month !== f[1]
      ? d.month < f[1]
      : d.day < f[2];

/** The court's reign year on a lunar date (null before its first era). */
export function reignYearOf(court: ImjinCourt, d: LunarDate): ReignYear | null {
  let out: ReignYear | null = null;
  for (const e of ERAS[court]) {
    if (before(d, e.from)) break;
    out = { era: e.key, year: d.year - e.first + 1 };
  }
  return out;
}
