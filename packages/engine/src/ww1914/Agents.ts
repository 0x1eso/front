// Great War 1914, ww180 (6): named agents. A small pool of real spies
// (GwAgents.GW_AGENTS), each fit for one service and one country. A seat hires
// one from the 정보부 tab where its service already keeps a net; he adds his
// own work to that net's reports each chapter (what he sees, the trains he
// counts, the ships he burns, the papers he buys) until he is taken. Taken,
// he is tried by the state of the two countries: shot or held in war, swapped
// or held in peace, and some slip away. Either way he is lost for good, and
// the net and the trust with his country suffer. The AI hires by character.
// Everything here is hidden but the news of a capture.
import {
  GW_THEATRES,
  GwAgentFate,
  GwAgentState,
  GwSeatState,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_AGENTS,
  GwAgentCan,
  GwAgentDef,
  GwAgentsView,
} from "@openfront/engine-api/ww1914/GwAgents";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { allocOf } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { learn, sendReport } from "./Intel";
import { markSeen, offensivesOf, seenBy } from "./Offensives";
import { atPeace, GW_SPY_POWERS, intelOf, planOf, rivalsOf } from "./Spies";
import { atWarWith, memberEnd, naturalSide } from "./Wars";
import {
  clampTo,
  fights,
  moveGauge,
  news,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

const P_TAKEN = idHash("gw_agent_taken");
const P_SLIP = idHash("gw_agent_slip");
const P_WORK = idHash("gw_agent_work");
const P_SURE = idHash("gw_agent_sure");
const P_HIRE = idHash("gw_agent_hire");

/** Named agents a service keeps at work at once. */
export const AGENTS_AT_ONCE = 2;
/** Chapters a lost agent still counts as news for the `lost` condition. */
const LOST_FRESH = 2;
/** Percent a chapter an AI service hires, by character. */
const AI_HIRE_PCT = { opportunist: 8, hardline: 6, cautious: 3, principled: 2 };
/** Percent a slippery agent gets away when taken. */
const SLIP_PCT = 60;
/** Chapters between a saboteur's or a paper-buyer's blows. */
const BLOW_EVERY = 3;

const idx = (gw: GreatWar, tag: GwTag) =>
  gw.s.nations.findIndex((n) => n.tag === tag);
const roll = (gw: GreatWar, p: number, ...k: number[]) =>
  wwRoll(gw.s.seed, p, gw.s.chapter, ...k) % 100;
const agentIdx = (id: string) => GW_AGENTS.findIndex((d) => d.id === id);

function live(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  return n !== null && !n.out;
}

export function agentDef(id: string): GwAgentDef | undefined {
  return GW_AGENTS.find((d) => d.id === id);
}

function rows(gw: GreatWar): GwAgentState[] {
  return gw.s.agents ?? [];
}

/** `a`'s agents at work now. */
export function workingFor(gw: GreatWar, a: GwTag): GwAgentState[] {
  return rows(gw).filter((r) => r.by === a && r.fate === null);
}

/** Why `a` can't hire `def` now, or null when it can. */
function hireBlock(
  gw: GreatWar,
  a: GwTag,
  def: GwAgentDef,
): "no_net" | "date" | "full" | "gone" | null {
  const at = def.by[a];
  if (at === undefined || !live(gw, a)) return "gone";
  // One row per agent and service: Mata Hari can be both sides' (ww180).
  if (rows(gw).some((r) => r.id === def.id && r.by === a) || !live(gw, at)) {
    return "gone";
  }
  if (gw.s.day < daysFromCivil(def.from[0], def.from[1], 1)) return "date";
  if ((gw.nation(a)?.intel?.net[at] ?? 0) < 1) return "no_net";
  if (workingFor(gw, a).length >= AGENTS_AT_ONCE) return "full";
  return null;
}

export function canHire(gw: GreatWar, a: GwTag, id?: string): boolean {
  return GW_AGENTS.some(
    (d) => (id === undefined || d.id === id) && hireBlock(gw, a, d) === null,
  );
}

/** Hires `id`, or the best open one; false when none can be. */
export function hire(gw: GreatWar, a: GwTag, id?: string): boolean {
  const open = GW_AGENTS.filter(
    (d) => (id === undefined || d.id === id) && hireBlock(gw, a, d) === null,
  );
  // The best: the surest hand first, then the hardest to catch.
  const def = [...open].sort((x, y) => y.skill - x.skill || y.care - x.care)[0];
  if (def === undefined) return false;
  gw.s.agents ??= [];
  gw.s.agents.push({
    id: def.id,
    by: a,
    at: def.by[a]!,
    since: gw.s.chapter,
    fate: null,
    end: null,
    takenBy: null,
  });
  return true;
}

/** Whether a scene's `agent` condition holds for the seat. */
export function agentHolds(
  gw: GreatWar,
  seat: GwSeatState,
  can: GwAgentCan,
  id?: string,
): boolean {
  const a = seat.tag;
  switch (can) {
    case "hire":
      return canHire(gw, a, id);
    case "working":
      return workingFor(gw, a).some((r) => id === undefined || r.id === id);
    case "lost":
      return rows(gw).some(
        (r) =>
          r.by === a &&
          r.end !== null &&
          r.fate !== "recalled" &&
          (id === undefined || r.id === id) &&
          gw.s.chapter - r.end <= LOST_FRESH,
      );
  }
}

// ---- His work ----

function facing(gw: GreatWar, t: GwTheatre, a: GwTag, b: GwTag): boolean {
  const th = gw.s.theatres.find((x) => x.id === t);
  if (th === undefined || !th.open) return false;
  const ea = memberEnd(gw, t, a);
  const eb = memberEnd(gw, t, b);
  return ea !== null && eb !== null && ea !== eb;
}

/** A report he sends: the surer the hand, the likelier it is confirmed. */
function report(
  gw: GreatWar,
  r: GwAgentState,
  fact: "strain" | "prep" | "plan" | "mob",
  t: GwTheatre | null,
): void {
  const def = agentDef(r.id)!;
  const sure =
    roll(gw, P_SURE, agentIdx(r.id), GW_THEATRES.indexOf(t ?? "west")) <
    25 * def.skill;
  const lie = gw.nation(r.at)?.intel?.turned.includes(r.by) === true;
  const force = lie ? "lie" : sure ? "confirmed" : undefined;
  learn(gw, r.by, fact, r.at, t, "agents", force);
}

function eyes(gw: GreatWar, r: GwAgentState): void {
  const { by, at } = r;
  if (atWarWith(gw, by, at)) {
    const fronts = GW_THEATRES.filter((t) => facing(gw, t, by, at));
    const main = allocOf(gw, by)?.main;
    const t = fronts.find((y) => y === main) ?? fronts[0];
    if (t !== undefined) report(gw, r, "strain", t);
    return;
  }
  if (atPeace(gw, by) && rivalsOf(gw, by).includes(at)) {
    const plan = planOf(gw, at) !== null && (gw.s.chapter - r.since) % 2 === 0;
    report(gw, r, plan ? "plan" : "mob", null);
    return;
  }
  const seat = seatsOf(gw, by)[0];
  if (seat !== undefined && gw.nation(at)?.side === null) {
    sendReport(gw, seat, "lean", at, null, "agents");
  }
}

/** The trains he counts: an offensive gathering against us, confirmed. */
function trains(gw: GreatWar, r: GwAgentState): void {
  const { by, at } = r;
  if (!atWarWith(gw, by, at)) {
    eyes(gw, r);
    return;
  }
  const o = offensivesOf(gw).find(
    (x) => x.tag === at && x.launch === null && facing(gw, x.theatre, by, at),
  );
  if (o === undefined) {
    eyes(gw, r);
    return;
  }
  learn(gw, by, "prep", at, o.theatre, "agents", "confirmed");
  if (!seenBy(gw, o).includes(by)) markSeen(gw, o, by);
}

/** Every few chapters: a ship or a depot burns, or a paper turns. */
function blow(gw: GreatWar, r: GwAgentState, def: GwAgentDef): void {
  if ((gw.s.chapter - r.since) % BLOW_EVERY !== BLOW_EVERY - 1) return;
  if (roll(gw, P_WORK, agentIdx(r.id)) >= 20 + 10 * def.skill) return;
  const { by, at } = r;
  if (def.work === "sabotage") {
    if (!fights(gw.nation(by))) return;
    // The munitions he burns were bound for the hirer's foes.
    const victim = gw.nation(by)!.atWar.find((f) => live(gw, f) && f !== at);
    if (victim === undefined) return;
    moveGauge(gw, victim, "shells", -1, "shells_sabotaged");
    news(gw, "spy_sabotage", at);
    return;
  }
  // Papers: in war the foe's nerve; a neutral leans the buyer's way.
  const nx = gw.nation(at)!;
  if (atWarWith(gw, by, at)) {
    moveGauge(gw, at, "morale", -1, "morale_defeatist_press");
    return;
  }
  const side = naturalSide(gw, by);
  if (nx.side === null && side !== null) {
    nx.lean = clampTo(nx.lean + (side === "entente" ? 1 : -1), -1, 1);
  }
}

// ---- Taken ----

/** Percent a chapter he is taken: his country's hunters against his care. */
function takenPct(gw: GreatWar, r: GwAgentState, def: GwAgentDef): number {
  const counter = intelOf(gw, r.at).counter;
  return 2 + 3 * counter + 4 * (3 - def.care);
}

/** Who reads the hirer's traffic and fights him: he may take a man at sea. */
function readerOf(gw: GreatWar, r: GwAgentState): GwTag | null {
  for (const f of GW_SPY_POWERS) {
    if (f === r.at || !live(gw, f) || !atWarWith(gw, f, r.by)) continue;
    if (gw.nation(f)?.intel?.reads.includes(r.by) === true) return f;
  }
  return null;
}

/** The trial, by the state of the two countries. */
function fateOf(
  gw: GreatWar,
  r: GwAgentState,
  def: GwAgentDef,
  by: GwTag,
): GwAgentFate {
  if (def.slips === true && roll(gw, P_SLIP, agentIdx(r.id)) < SLIP_PCT) {
    return "fled";
  }
  const nc = gw.nation(by)!;
  if (atWarWith(gw, by, r.by)) {
    // A nervous country, or a strong service, makes an example of him.
    return intelOf(gw, by).counter >= 2 || nc.gauges.morale <= 2
      ? "executed"
      : "jailed";
  }
  return (nc.trust[r.by] ?? 0) >= 0 ? "swapped" : "jailed";
}

export function agentTaken(gw: GreatWar, r: GwAgentState, by: GwTag): void {
  const def = agentDef(r.id)!;
  const fate = fateOf(gw, r, def, by);
  r.fate = fate;
  r.end = gw.s.chapter;
  r.takenBy = by;
  const ia = intelOf(gw, r.by);
  const left = (ia.net[r.at] ?? 0) - 1;
  if (left > 0) ia.net[r.at] = left;
  else delete ia.net[r.at];
  const nx = gw.nation(r.at)!;
  const ns = gw.nation(r.by)!;
  nx.trust[r.by] = clampTo((nx.trust[r.by] ?? 0) - 1, -3, 3);
  if (nx.side === null && ns.side !== null) {
    nx.lean = clampTo(nx.lean + (ns.side === "central" ? 1 : -1), -1, 1);
    nx.readiness = clampTo(nx.readiness + 10, 0, 100);
  }
  news(gw, `agent_${r.id}`, by, r.by);
  news(gw, `agent_fate_${fate}`, by, r.by);
  for (const seat of seatsOf(gw, r.by)) reason(gw, seat, "agent_ours_lost");
  for (const seat of seatsOf(gw, by)) reason(gw, seat, "agent_we_took");
}

function recall(gw: GreatWar, r: GwAgentState): void {
  r.fate = "recalled";
  r.end = gw.s.chapter;
}

/** Chapter step (from Intel.intelStep, after the spies). */
export function agentsStep(gw: GreatWar): void {
  for (const r of rows(gw)) {
    if (r.fate !== null || r.since >= gw.s.chapter) continue;
    const def = agentDef(r.id);
    if (def === undefined) continue;
    if (!live(gw, r.by) || !live(gw, r.at)) {
      recall(gw, r);
      continue;
    }
    // His net was rolled up: he comes home before they find him too.
    if ((gw.nation(r.by)?.intel?.net[r.at] ?? 0) < 1) {
      recall(gw, r);
      continue;
    }
    const k = agentIdx(r.id);
    if (roll(gw, P_TAKEN, k, 1) < takenPct(gw, r, def)) {
      agentTaken(gw, r, r.at);
      continue;
    }
    const reader = gw.nation(r.at)?.side === null ? readerOf(gw, r) : null;
    if (reader !== null && roll(gw, P_TAKEN, k, 2) < 5) {
      agentTaken(gw, r, reader);
      continue;
    }
    if (def.work === "trains") trains(gw, r);
    else eyes(gw, r);
    if (def.work === "sabotage" || def.work === "papers") blow(gw, r, def);
  }
  for (const a of GW_SPY_POWERS) {
    if (!live(gw, a) || ruledBySeat(gw, a)) continue;
    const pct = AI_HIRE_PCT[gw.nation(a)!.ai];
    if (canHire(gw, a) && roll(gw, P_HIRE, idx(gw, a)) < pct) hire(gw, a);
  }
}

/** The seat's own agents and the pool its service could draw on. */
export function agentsView(gw: GreatWar, seat: GwSeatState): GwAgentsView {
  const a = seat.tag;
  return {
    mine: rows(gw)
      .filter((r) => r.by === a)
      .map((r) => ({
        id: r.id,
        at: r.at,
        since: r.since,
        fate: r.fate,
        end: r.end,
      })),
    pool: GW_AGENTS.filter(
      (d) =>
        d.by[a] !== undefined &&
        !rows(gw).some((r) => r.id === d.id && r.by === a),
    ).map((d) => {
      const wait = hireBlock(gw, a, d);
      return { id: d.id, at: d.by[a]!, open: wait === null, wait };
    }),
  };
}
