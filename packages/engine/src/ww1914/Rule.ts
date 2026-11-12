// Great War 1914 (ww190 §3): ruling occupied land. Once a country has held
// two places of another for three months it rules them, and how it rules is
// a row of `s.rule`: by the army, by civil officials, or through a client
// state; how hard (0..3); whether relief comes in; how far the people resist
// (0..3). Hard rule feeds the ruler (bread, money, forced labour) and stirs
// resistance, the neutral papers and the ruled country's own nerve; relief
// and a client calm it. The row closes when the ruler holds none of it.
// Scenes read it through `rule`, `resist`, `ruled`, `relief` and move it
// with `{ do: "rule" }`; an AI ruler picks by its character.
import type {
  GwClient,
  GwRulePolicy,
  GwRuleRow,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
  GwPlace,
} from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_CLIENT_ROWS,
  GW_RIVAL_CLAIMS,
  gwClientRow,
} from "@openfront/engine-lib/ww1914/FateRows";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import { foundOnRule } from "./Fate";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./Land";
import { beatenAt, monthsHeld } from "./Occupation";
import { moveBond } from "./PeaceYears";
import {
  clampTo,
  isLongChapter,
  monthsFrom,
  moveGauge,
  news,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

export type GwRuleCond = Extract<
  GwWorldCond,
  { is: "rule" | "resist" | "ruled" | "relief" }
>;
export type GwRuleEffect = Extract<GwWorldEffect, { do: "rule" }>;

/** Places of a country held, and months held, before the holder rules them. */
const RULE_PLACES = 2;
const RULE_MONTHS = 3;
const HARD_MAX = 3;
const RESIST_MAX = 3;
/** An opportunist ruler sets up a client state after this long. */
const CLIENT_AFTER = 12;
/** America's readiness a hard rule adds every three months while neutral. */
const NEUTRAL_OUTRAGE = 2;

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

/**
 * Whether a multiple of `k` months, counted from chapter `from`, falls in
 * this chapter: the beat a row's monthly rules keep, whatever the calendar.
 */
export function beatSince(gw: GreatWar, from: number, k: number): boolean {
  const all = gwChapters(gw.s.calendar);
  const c = all[gw.s.chapter];
  const a = all[clampTo(from, 0, all.length - 1)];
  const end = c.day - a.day;
  if (end <= 0 || k <= 0) return false;
  const start = Math.max(0, end - c.spanDays);
  const span = 30 * k;
  return Math.floor(end / span) > Math.floor(start / span);
}

const rows = (gw: GreatWar): GwRuleRow[] => gw.s.rule ?? [];

export function ruleOf(gw: GreatWar, by: GwTag, of: GwTag): GwRuleRow | null {
  return rows(gw).find((r) => r.by === by && r.of === of) ?? null;
}

/** Places of `of` that `by` holds. */
function placesHeld(gw: GreatWar, by: GwTag, of: GwTag): GwPlace[] {
  return GW_PLACE_KEYS.filter(
    (p) => GW_PLACES[p].owner === of && holderOf(gw, p) === by,
  );
}

/** A client state can be set up: `of` beaten, or its capital or the land held. */
export function clientOpen(
  gw: GreatWar,
  by: GwTag,
  of: GwTag,
  client: GwClient,
): boolean {
  const row = gwClientRow(client);
  if (row.of !== of) return false;
  const n = gw.nation(of);
  if (n?.out === true || beatenAt(gw, of) !== null) return true;
  const cap = GW_CAPITALS[of];
  if (cap !== undefined && holderOf(gw, cap) === by) return true;
  // ww199: the state's own places (GW_CLIENT_ROWS), not whole groups.
  return row.places.every((p) => holderOf(gw, p) === by);
}

const usNeutral = (gw: GreatWar): boolean => {
  const usa = gw.nation("USA");
  return usa !== null && usa.side === null && !usa.out;
};

function tell(gw: GreatWar, tag: GwTag, key: string): void {
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, key);
}

function moveMen(gw: GreatWar, tag: GwTag, d: number, key: string): void {
  const n = gw.nation(tag);
  if (n === null) return;
  n.manpower = clampTo(n.manpower + d, 0, 100);
  tell(gw, tag, key);
}

export function setRule(
  gw: GreatWar,
  by: GwTag,
  of: GwTag,
  ch: {
    policy?: GwRulePolicy;
    hard?: number;
    relief?: boolean;
    client?: GwClient;
  },
): void {
  const r = ruleOf(gw, by, of);
  if (r === null) return;
  if (ch.client !== undefined) {
    if (r.client === null && clientOpen(gw, by, of, ch.client)) {
      r.client = ch.client;
      r.policy = "client";
      r.resist = Math.max(0, r.resist - 1);
      news(gw, "rule_client", by, of);
      tell(gw, by, "rule_client");
      // ww199: the state stands on the map, its own colour and name.
      foundOnRule(gw, ch.client, by);
      const rival = GW_RIVAL_CLAIMS[ch.client];
      if (rival?.includes(by) === true) {
        moveBond(gw, rival[0], rival[1], -1);
      }
    }
  } else if (ch.policy !== undefined && r.client === null) {
    // A client stands once it is set up; the ruler can't take it back.
    if (ch.policy !== "client") r.policy = ch.policy;
  }
  if (ch.hard !== undefined) r.hard = clampTo(r.hard + ch.hard, 0, HARD_MAX);
  if (ch.relief !== undefined && ch.relief !== r.relief) {
    r.relief = ch.relief;
    if (ch.relief) {
      r.resist = Math.max(0, r.resist - 1);
      news(gw, "relief_in", by, of);
      tell(gw, by, "relief_in");
    }
  }
}

/** Resistance in land `by` rules (of `of`, or the highest), 0..3. */
export function resistOf(gw: GreatWar, by: GwTag, of?: GwTag): number {
  return rows(gw)
    .filter((r) => r.by === by && (of === undefined || r.of === of))
    .reduce((m, r) => Math.max(m, r.resist), 0);
}

export function ruleHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwRuleCond,
): boolean {
  const all = rows(gw);
  switch (c.is) {
    case "rule":
      return all.some(
        (r) =>
          r.by === seat.tag &&
          (c.of === undefined || r.of === c.of) &&
          (c.policy === undefined || r.policy === c.policy) &&
          (c.client === undefined || r.client === c.client) &&
          inRange(r.hard, c),
      );
    case "resist": {
      const mine = all.filter(
        (r) => r.by === seat.tag && (c.of === undefined || r.of === c.of),
      );
      return mine.length > 0 && inRange(resistOf(gw, seat.tag, c.of), c);
    }
    case "ruled":
      return all.some(
        (r) =>
          r.of === seat.tag &&
          (c.by === undefined || r.by === c.by) &&
          (c.policy === undefined || r.policy === c.policy) &&
          inRange(r.hard, c),
      );
    case "relief":
      return c.of === undefined
        ? all.some((r) => r.of === seat.tag && r.relief)
        : all.some((r) => r.by === seat.tag && r.of === c.of && r.relief);
  }
}

export function ruleDo(gw: GreatWar, seat: GwSeatState, e: GwRuleEffect): void {
  const ch: Parameters<typeof setRule>[3] = {};
  if (e.policy !== undefined) ch.policy = e.policy;
  if (e.hard !== undefined) ch.hard = e.hard;
  if (e.relief !== undefined) ch.relief = e.relief;
  if (e.client !== undefined) ch.client = e.client;
  setRule(gw, seat.tag, e.of, ch);
}

// ---- The chapter ----

/** How an AI ruler starts out, by its character. */
function aiStart(gw: GreatWar, r: GwRuleRow): void {
  const n = gw.nation(r.by);
  if (n === null) return;
  switch (n.ai) {
    case "hardline":
      r.policy = "army";
      r.hard = 2;
      break;
    case "opportunist":
    case "cautious":
      r.policy = "civil";
      r.hard = 1;
      break;
    case "principled":
      r.policy = "civil";
      r.hard = 0;
      break;
  }
}

/** An AI ruler's monthly turn: relief while America watches, a client later. */
function aiRule(gw: GreatWar, r: GwRuleRow): void {
  const n = gw.nation(r.by);
  if (n === null) return;
  if (!r.relief && n.ai !== "hardline" && usNeutral(gw)) {
    setRule(gw, r.by, r.of, { relief: true });
  }
  if (
    n.ai === "opportunist" &&
    r.client === null &&
    monthsFrom(gw, r.since) >= CLIENT_AFTER
  ) {
    const client = GW_CLIENT_ROWS.map((x) => x.id).find((c) =>
      clientOpen(gw, r.by, r.of, c),
    );
    if (client !== undefined) setRule(gw, r.by, r.of, { client });
  }
}

/** Rows open where land has been held long enough, and close where none is. */
function openAndClose(gw: GreatWar): void {
  const s = gw.s;
  if (s.rule !== undefined) {
    const kept = s.rule.filter((r) => placesHeld(gw, r.by, r.of).length > 0);
    if (kept.length !== s.rule.length) s.rule = kept;
  }
  const counts = new Map<string, { by: GwTag; of: GwTag; n: number }>();
  for (const p of GW_PLACE_KEYS) {
    const by = s.held[p];
    const of = GW_PLACES[p].owner;
    if (by === undefined || by === of) continue;
    if (monthsHeld(gw, p) < RULE_MONTHS) continue;
    const a = gw.nation(by);
    const b = gw.nation(of);
    if (a === null || b === null) continue;
    if (a.side !== null && a.side === b.side) continue;
    const key = `${by}_${of}`;
    const row = counts.get(key) ?? { by, of, n: 0 };
    row.n++;
    counts.set(key, row);
  }
  for (const { by, of, n } of counts.values()) {
    if (n < RULE_PLACES || ruleOf(gw, by, of) !== null) continue;
    const r: GwRuleRow = {
      by,
      of,
      // A seat starts under the army's own government until it says otherwise.
      policy: "army",
      hard: 1,
      relief: false,
      resist: 0,
      client: null,
      since: s.chapter,
    };
    if (!ruledBySeat(gw, by)) aiStart(gw, r);
    s.rule ??= [];
    s.rule.push(r);
    news(gw, "rule_opened", by, of);
    tell(gw, by, "rule_opened");
  }
}

/** One row's month: what hard rule brings, and what it stirs. */
export function ruleMonth(gw: GreatWar, r: GwRuleRow): void {
  const at = (k: number) => beatSince(gw, r.since, k);
  if (r.hard >= 1 && at(Math.max(1, 6 - 2 * r.hard))) {
    moveGauge(gw, r.by, "bread", 1, "rule_requisition");
  }
  if (r.hard >= 2 && at(6)) moveGauge(gw, r.by, "money", 1, "rule_levy");
  if (r.hard >= 3 && at(6)) moveMen(gw, r.by, 2, "rule_labour");
  if (r.resist < RESIST_MAX && at(6 - r.hard)) {
    r.resist++;
    if (r.resist === RESIST_MAX) {
      news(gw, "occupied_rising", r.of, r.by);
      tell(gw, r.by, "occupied_rising");
    }
  }
  if (r.resist >= 2 && at(6)) {
    moveGauge(gw, r.by, "order", -1, "rule_resistance");
  }
  if (r.resist >= RESIST_MAX && at(6)) moveMen(gw, r.by, -1, "rule_garrisons");
  if (r.hard >= 2 && at(6)) {
    moveGauge(gw, r.of, "morale", -1, "rule_hard_ruled");
  }
  if (r.client !== null && at(6)) moveMen(gw, r.by, 1, "rule_legions");
  // The neutral papers: America leans against the side that rules hard.
  const usa = gw.nation("USA");
  const side = gw.nation(r.by)?.side ?? null;
  if (r.hard >= 2 && usNeutral(gw) && usa !== null && side !== null && at(3)) {
    const against = usa.lean >= 0 ? "central" : "entente";
    if (side === against) {
      const d = r.relief ? NEUTRAL_OUTRAGE >> 1 : NEUTRAL_OUTRAGE;
      usa.readiness = clampTo(usa.readiness + d, 0, 100);
    }
  }
}

/** Chapter step, after occupation moved the land. */
export function ruleStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.armistice !== null || !isLongChapter(gw)) return;
  if (s.rule === undefined && Object.keys(s.held).length === 0) return;
  openAndClose(gw);
  for (const r of rows(gw)) {
    if (r.since === s.chapter) continue;
    // ww199: a table's rows (annexed land, a term's government) run in Fate.
    if (r.policy === "annexed" || r.until !== undefined) continue;
    if (!ruledBySeat(gw, r.by)) aiRule(gw, r);
    ruleMonth(gw, r);
  }
}
