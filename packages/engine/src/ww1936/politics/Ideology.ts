// World War 1936 P3: drift, elections, regime crises, governments, leaders,
// civil war (spec §5.2–§5.8).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DRIFT_KEYS,
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  IDEOLOGIES,
  PersonId,
  WW_CRISIS_COOLDOWN_DAYS,
  WW_CRISIS_DAYS,
  WW_ELECTION_DAYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dateOfDay, dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  addPopularity,
  largestOther,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { startCivilWar } from "../endgame/CivilWar";
import { advisorFitsIdeology } from "./Advisors";
import { fitsFactionIdeology, leaveFaction } from "./Factions";
import { setLawFree } from "./Laws";
import { addSpirit, hasRule } from "./Spirits";
import type { WwPolitics } from "./WwPolitics";

/** Spec §5.7: after the 26 February incident Japan's leader is a title. */
const JPN_TITLES_FROM = dayOfDate("1936-02-26");
const JPN_TITLE = "title:jpn_prime_minister";

/**
 * Spec §5.4: a dated `<tag>_election_<year>` event for this country fired
 * today (the day's common step runs before every country's step): it is
 * that year's election (e.g. Britain's of 1945).
 */
function datedElectionToday(
  pol: WwPolitics,
  tag: CountryTag,
  day: number,
): boolean {
  const prefix = `${tag.toLowerCase()}_election_`;
  for (const i of pol.content.dateEvents.get(day) ?? []) {
    const e = pol.content.events[i];
    if (
      e.id.startsWith(prefix) &&
      /^\d{4}$/.test(e.id.slice(prefix.length)) &&
      e.date?.to.includes(tag) === true
    ) {
      return true;
    }
  }
  return false;
}

/** Spec §5.2 drift, §5.4 elections, §5.5 regime crisis. */
export function dailyIdeology(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {
  const c = pol.country(id)!;
  for (let i = 0; i < 4; i++) {
    const d = c.stats[DRIFT_KEYS[i]];
    if (d !== 0) addPopularity(c.pop, i, d);
  }
  if (c.ruling === IDEO_DEM) {
    // Controller ruling R6: suspended elections come back on the first day
    // at peace; an overdue one is held at once.
    if (c.electionsSuspended && !pol.ww.hasWar(id)) {
      c.electionsSuspended = false;
      c.flags.delete("elections_suspended");
    }
    if (datedElectionToday(pol, c.tag, day)) {
      // The dated event is the election: the next one in four years.
      c.nextElectionDay = day + WW_ELECTION_DAYS;
      pol.messageAll("ww1936_election", { countryTag: c.tag });
      return;
    }
    if (
      c.electionsSuspended ||
      hasRule(pol, id, "no_elections") ||
      c.nextElectionDay < 0 ||
      day < c.nextElectionDay
    ) {
      return;
    }
    c.nextElectionDay = day + WW_ELECTION_DAYS;
    // Spec §5.4: a country's own election event for that year replaces the generic one.
    const own = `${c.tag.toLowerCase()}_election_${dateOfDay(day).year}`;
    pol.queueEvent(
      pol.content.eventIdx.has(own) ? own : "gen_election",
      id,
      id,
      0,
      0,
    );
    pol.messageAll("ww1936_election", { countryTag: c.tag });
    return;
  }
  let fire = -1;
  for (let x = 0; x < 4; x++) {
    if (x === c.ruling) continue;
    c.crisisDays[x] = c.pop[x] >= 6000 ? c.crisisDays[x] + 1 : 0;
    if (c.crisisDays[x] >= WW_CRISIS_DAYS && fire < 0) fire = x;
  }
  if (fire >= 0 && day >= c.crisisCooldownUntil) {
    c.crisisDays[fire] = 0;
    c.crisisCooldownUntil = day + WW_CRISIS_COOLDOWN_DAYS;
    pol.queueEvent("gen_regime_crisis", id, id, 0, 0);
  }
  void tick;
}

/**
 * Spec §5.6-1, §5.7 (controller ruling R7): the country table's leader for
 * the ideology, or its title when none; a leader-only person past their
 * `until` is not seated again, nor a named Japanese leader on or after
 * 1936-02-26 (the prime minister's title instead).
 */
export function governmentLeader(
  pol: WwPolitics,
  id: number,
  ideology: number,
  day: number,
): PersonId {
  const c = pol.country(id)!;
  const name = IDEOLOGIES[ideology];
  const title = `title:leader_${name}`;
  const leader = pol.content.countryIdx.get(c.tag)?.leaders[name] ?? title;
  if (leader.startsWith("title:")) return leader;
  if (c.tag === "JPN" && day >= JPN_TITLES_FROM) return JPN_TITLE;
  const p = pol.content.personIdx.get(leader);
  if (
    p?.until !== undefined &&
    !p.roles.includes("advisor") &&
    dayOfDate(p.until) <= day
  ) {
    return title;
  }
  return leader;
}

/** Spec §5.6, in this order. */
export function setGovernment(
  pol: WwPolitics,
  id: number,
  ideology: number,
  tick: number,
): void {
  const c = pol.country(id);
  if (c === null || c.ruling === ideology || ideology < 0 || ideology > 3) {
    return;
  }
  const day = pol.day();
  const name = IDEOLOGIES[ideology];
  // 1. the government and its leader (who leaves an advisor seat, §5.7).
  c.ruling = ideology;
  c.leader = governmentLeader(pol, id, ideology, day);
  c.advisors = c.advisors.map((a) => (a === c.leader ? null : a));
  // 2. at least half the vote for the new government.
  if (c.pop[ideology] < 5000) {
    addPopularity(c.pop, ideology, 5000 - c.pop[ideology]);
  }
  if (ideology === IDEO_DEM && c.nextElectionDay < day) {
    c.nextElectionDay = day + WW_ELECTION_DAYS;
  }
  // 3. factions (controller ruling R8, Factions.fitsFactionIdeology): a member whose new government
  // misfits leaves at peace; a leader takes its faction's ideology with it
  // and the members that misfit now leave at peace.
  const fi = pol.factionIdx(id);
  if (fi >= 0) {
    const f = pol.faction(fi)!;
    if (f.leader === id) {
      for (const m of [...f.members].sort((a, b) => a - b)) {
        if (m === id || pol.ww.hasWar(m)) continue;
        if (!fitsFactionIdeology(pol.country(m)!.ruling, ideology)) {
          leaveFaction(pol, m, tick);
        }
      }
    } else if (
      !pol.ww.hasWar(id) &&
      !fitsFactionIdeology(ideology, pol.factionIdeology(fi))
    ) {
      leaveFaction(pol, id, tick);
    }
  }
  // 4. laws this government may not keep go to the nearest allowed step (free).
  const ce = pol.econ.country(id);
  if (ce !== null) {
    const authoritarian = ideology === IDEO_COM || ideology === IDEO_FAS;
    if (authoritarian && ce.laws.trade === "free_trade") {
      setLawFree(pol, id, "trade", "export_focus");
    }
    if (
      !authoritarian &&
      !pol.ww.hasWar(id) &&
      ce.laws.trade === "closed_economy"
    ) {
      setLawFree(pol, id, "trade", "limited_exports");
    }
  }
  // 5. advisors bound to another ideology (their own or a trait's, titled
  // cards too) go, unpaid.
  c.advisors = c.advisors.map((a) =>
    a === null || advisorFitsIdeology(pol, c, a, ideology) ? a : null,
  );
  // 7. everyone hears of it.
  pol.recomputeStats(id);
  pol.markCountry(id);
  pol.messageAll("ww1936_government_changed", {
    countryTag: c.tag,
    ideology: name,
  });
  pol.markGlobal();
}

/** Spec §5.7: a leader who sits as an advisor leaves that seat. Never gated (R7). */
export function setLeader(
  pol: WwPolitics,
  id: number,
  person: PersonId,
  tick: number,
): void {
  const c = pol.country(id);
  if (c === null || c.leader === person) return;
  c.leader = person;
  c.advisors = c.advisors.map((a) => (a === person ? null : a));
  pol.recomputeStats(id);
  pol.markCountry(id);
  pol.messageAll("ww1936_leader_changed", { countryTag: c.tag, person });
  void tick;
}

/** Spec §5.8 in P3: a violent change of government. */
export function civilWar(
  pol: WwPolitics,
  id: number,
  ideology: number,
  tick: number,
): void {
  const c = pol.country(id);
  if (c === null) return;
  // P5 hook (C): a real civil war when lane C splits the country (spec §15).
  if (startCivilWar(pol.ww.endgame, id, IDEOLOGIES[ideology], tick)) return;
  setGovernment(pol, id, ideology, tick);
  c.stabBaseBp = Math.max(0, c.stabBaseBp - 2500);
  c.wsBaseBp = Math.max(0, c.wsBaseBp - 1000);
  addSpirit(pol, id, "gen_civil_strife", 180, pol.day());
}

/** "largest_other" and "ruling" in effects (spec §5.4, §5.5 content); -1 when unknown. */
export function resolveIdeology(
  pol: WwPolitics,
  id: number,
  v: string,
): number {
  const c = pol.country(id)!;
  if (v === "largest_other") return largestOther(c.pop, c.ruling);
  if (v === "ruling") return c.ruling;
  return IDEOLOGIES.indexOf(v as (typeof IDEOLOGIES)[number]);
}
