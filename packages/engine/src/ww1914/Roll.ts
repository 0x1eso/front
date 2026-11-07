import {
  GW_AI_KINDS,
  GW_FIELDS,
  GW_OPENINGS,
  GW_SECRETS,
  GW_SOURCES,
  GW_THREADS,
  GwNationState,
  GwOpening,
  GwSeatState,
  GwSecret,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { budgetStart } from "@openfront/engine-lib/ww1914/BudgetRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { openChapter } from "./Chapters";
import { openFirstCrisis } from "./Crises";
import type { GreatWar } from "./GreatWar";
import { GW_MANDATES } from "./Mandates";
import {
  GW_ENTRIES,
  GW_FORCE,
  GW_GAUGES_1914,
  GW_MANPOWER,
  GW_OPENING_DEAD,
} from "./Tables";
import { rollRuler } from "./Ruler";
import { clampTo } from "./World";

const P_OPENING = idHash("gw_opening");
const P_TEMPERAMENT = idHash("gw_temperament");
const P_COMPETENCE = idHash("gw_competence");
const P_HEALTH = idHash("gw_health");
const P_SOURCE = idHash("gw_source");
const P_AI = idHash("gw_ai");
const P_FORCE = idHash("gw_force");
const P_SECRET = idHash("gw_secret");
const P_THREAD = idHash("gw_thread");
const P_LEAN = idHash("gw_lean");
const P_MANDATE = idHash("gw_mandate");

/** Percent chance a world secret is there in a game. */
const SECRET_PCT = 35;
/** Hot long threads in a game (design §2.6). */
const THREADS_HOT = 3;
/** What a secret does to the hidden bands: country, theatre, step. */
const SECRET_FORCE: Readonly<
  Partial<Record<GwSecret, readonly [GwNationState["tag"], GwTheatre, number]>>
> = {
  rus_rail_ahead: ["RUS", "east", 1],
  fra_offensive_doctrine: ["FRA", "west", -1],
  bel_forts_strong: ["BEL", "west", 1],
  auh_rail_muddle: ["AUH", "east", -1],
  auh_redl_plans: ["AUH", "east", -1],
  ott_forts_short: ["OTT", "straits", -1],
};

/** Design §15 no. 7: Sarajevo 70, its variants 20, none 10. */
function openingOf(roll: number): GwOpening {
  const r = roll % 100;
  if (r < 70) return "sarajevo";
  if (r < 90) return GW_OPENINGS[1 + (r % 3)];
  return "no_sarajevo";
}

/** A country's hidden bands, its gauges and its men. */
function rollNation(gw: GreatWar, n: GwNationState, i: number): void {
  const seed = gw.s.seed;
  n.ai = GW_AI_KINDS[wwRoll(seed, P_AI, i) % GW_AI_KINDS.length];
  Object.assign(n.gauges, GW_GAUGES_1914[n.tag] ?? {});
  n.budget = budgetStart(n.tag, n.gauges.money);
  n.manpower = GW_MANPOWER[n.tag] ?? 20;
  n.readiness = GW_ENTRIES.find((e) => e.tag === n.tag)?.start ?? 0;
  const force = GW_FORCE[n.tag] ?? {};
  for (const [t, band] of Object.entries(force)) {
    const id = t as GwTheatre;
    const rolled = (band ?? 1) + (wwRoll(seed, P_FORCE, i, idHash(t)) % 3) - 1;
    n.strength[id] = clampTo(rolled, 1, 5);
    n.base[id] = n.strength[id];
  }
}

/** Which way a country leans: Britain's cabinet most of all (design §2.4). */
function rollLeans(gw: GreatWar): void {
  const s = gw.s;
  s.nations.forEach((n, i) => {
    const r = wwRoll(s.seed, P_LEAN, i) % 100;
    n.lean = r < 45 ? 1 : r < 80 ? 0 : -1;
    if (n.tag === "ITA" && s.secrets.includes("ita_fra_understanding")) {
      n.lean = 1;
    }
    if (n.tag === "OTT" && s.threads.includes("baghdad_rail")) n.lean = -1;
    if (n.tag === "GBR" && s.threads.includes("ireland")) {
      n.lean = Math.max(-1, n.lean - 1);
    }
    if (n.tag === "GBR" && s.threads.includes("naval_race")) {
      n.lean = Math.min(1, n.lean + 1);
    }
  });
}

/** The world secrets of this game, and what they do from the start. */
function rollSecrets(gw: GreatWar): void {
  const s = gw.s;
  s.secrets = GW_SECRETS.filter(
    (_, i) => wwRoll(s.seed, P_SECRET, i) % 100 < SECRET_PCT,
  );
  for (const id of s.secrets) {
    const f = SECRET_FORCE[id as GwSecret];
    if (f === undefined) continue;
    const n = gw.nation(f[0]);
    if (n === null) continue;
    const band = clampTo((n.strength[f[1]] ?? 1) + f[2], 1, 5);
    n.strength[f[1]] = band;
    n.base[f[1]] = band;
  }
  const ready = (tag: GwNationState["tag"], delta: number) => {
    const n = gw.nation(tag);
    if (n !== null) n.readiness += delta;
  };
  if (s.secrets.includes("jpn_tsingtao_plan")) ready("JPN", 20);
  if (s.secrets.includes("ott_fleet_late")) ready("OTT", 15);
  if (s.secrets.includes("bgr_loan_berlin")) ready("BGR", 15);
  if (s.secrets.includes("rou_treaty_dead")) ready("ROU", 10);
}

function rollThreads(gw: GreatWar): void {
  const s = gw.s;
  const order = [...GW_THREADS].sort(
    (a, b) =>
      wwRoll(s.seed, P_THREAD, idHash(a)) - wwRoll(s.seed, P_THREAD, idHash(b)),
  );
  s.threads = order.slice(0, THREADS_HOT);
  const heat = s.pressure;
  if (s.threads.includes("ireland")) heat.ireland += 3;
  if (s.threads.includes("poland")) heat.poland += 3;
  if (s.threads.includes("alsace_unrest")) heat.alsace += 3;
  if (s.threads.includes("naval_race")) heat.naval += 3;
  if (s.threads.includes("baghdad_rail")) heat.straits += 2;
  if (s.threads.includes("rus_rail")) heat.balkan += 1;
  if (s.threads.includes("reichstag_left")) heat.home += 3;
  const deu = gw.nation("DEU");
  if (
    deu?.inst.reichstag !== undefined &&
    s.threads.includes("reichstag_left")
  ) {
    deu.inst.reichstag = -1;
  }
}

/** Three tasks, one of each group, by the seat's country. */
function rollMandates(gw: GreatWar, seat: GwSeatState): void {
  const list = GW_MANDATES[seat.tag] ?? [];
  seat.mandates = (["war", "home", "name"] as const).flatMap((g, i) => {
    const of = list.filter((m) => m.group === g);
    if (of.length === 0) return [];
    return [of[wwRoll(gw.s.seed, P_MANDATE, seat.smallID, i) % of.length].id];
  });
}

/**
 * The game's own world (design §4.4), once, from the seed, then the first
 * chapter.
 */
export function rollWorld(gw: GreatWar, seed: number, ticks: number): void {
  const s = gw.s;
  s.seed = seed;
  s.rolled = true;
  s.opening = openingOf(wwRoll(seed, P_OPENING, 0));
  const defs = gwContent().people;
  s.people.forEach((p, i) => {
    const t = defs[i].temperaments;
    p.temperament = t[wwRoll(seed, P_TEMPERAMENT, i) % t.length];
    p.competence = GW_FIELDS.map(
      (_, f) => 1 + (wwRoll(seed, P_COMPETENCE, i, f) % 3),
    );
    p.health = 1 + (wwRoll(seed, P_HEALTH, i) % 3);
  });
  s.sources = GW_SOURCES.map((id, i) => ({
    id,
    band: 1 + (wwRoll(seed, P_SOURCE, i) % 3),
    right: 0,
    wrong: 0,
  }));
  for (const row of GW_OPENING_DEAD) {
    const p = gw.person(row.person);
    if (p !== null && row.openings.includes(s.opening)) p.status = "dead";
  }
  s.nations.forEach((n, i) => rollNation(gw, n, i));
  rollThreads(gw);
  rollSecrets(gw);
  rollLeans(gw);
  for (const seat of s.seats) rollMandates(gw, seat);
  for (const seat of s.seats) rollRuler(gw, seat);
  openFirstCrisis(gw);
  openChapter(gw, ticks);
}
