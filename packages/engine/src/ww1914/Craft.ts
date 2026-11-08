// Great War 1914: statecraft, running (brief ww157). Inventions go proposal,
// prototype, trial, field; the year's great project goes through its three
// chapters to done or failed; the footing raises shells at the price of bread
// and order; shortages come with the blockade and stay until answered. Only
// seats have any of it: an AI country runs on what it has. The rows are
// engine-lib/ww1914/CraftRows; /home/eser/dev/ww157-format.md says how.
import {
  GW_INST_MAX,
  GW_INST_MIN,
  GwNationState,
  GwSeatState,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_FOOTINGS,
  gwCraftStart,
  GwCraftState,
  GwCraftView,
  GwInventionState,
  GwInventStep,
  GwProjectState,
  GwProjectStep,
  GwShortage,
} from "@openfront/engine-api/ww1914/GwCraft";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_FOOTING_RAISE,
  GW_FOOTING_TERMS,
  GW_OVERRULE_PRICE,
  GW_PROJECT_AIM,
  GW_PROJECT_ODDS_MAX,
  GW_PROJECT_ODDS_MIN,
  GW_PROJECT_PUSH,
  GW_PROJECT_SKILL,
  GW_RETRY_BONUS,
  GW_SURPRISE_CHAPTERS,
  GwCraftTerm,
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "@openfront/engine-lib/ww1914/CraftRows";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { makeCard, placeCard } from "./Desk";
import type { GreatWar } from "./GreatWar";
import { recordResult } from "./People";
import {
  castOf,
  holds,
  runEffects,
  SceneCtx,
  sceneOf,
  whoIn,
} from "./SceneRun";
import {
  clampTo,
  everyMonths,
  fights,
  isLongChapter,
  moveGauge,
  news,
  reason,
  seatsOf,
} from "./World";

const P_TRIAL = idHash("gw_craft_trial");
const P_PROJECT = idHash("gw_craft_project");
const MONTH = 30;
const RUNNING = ["prep", "opp", "exec"] as const;
const atWar = world({ is: "war" });

// ---- Rows ----

const inventionRows = (tag: string): readonly GwInventionRow[] =>
  (gwContent().inventions ?? []).filter((r) => r.tag === tag);
const inventionRow = (id: string): GwInventionRow | null =>
  (gwContent().inventions ?? []).find((r) => r.id === id) ?? null;
const projectRows = (tag: string): readonly GwProjectRow[] =>
  (gwContent().projects ?? []).filter((r) => r.tag === tag);
const projectRow = (id: string): GwProjectRow | null =>
  (gwContent().projects ?? []).find((r) => r.id === id) ?? null;
const footingRow = (tag: string): GwFootingRow | null =>
  (gwContent().footing ?? []).find((r) => r.tag === tag) ?? null;
const shortageRows = (tag: string): readonly GwShortageRow[] =>
  (gwContent().shortages ?? []).filter((r) => r.tag === tag);

export const agendaId = (tag: string): string => `${tag.toLowerCase()}_agenda`;

// ---- State ----

/** The seat's statecraft, made the first time anything happens. */
function craftOf(seat: GwSeatState): GwCraftState {
  if (seat.craft === undefined) {
    seat.craft = gwCraftStart();
    // Keep the schema's key order (craft, then house) so a restored save
    // encodes the same bytes as the live one.
    const house = seat.house;
    if (house !== undefined) {
      delete seat.house;
      seat.house = house;
    }
  }
  return seat.craft;
}

const inventionOf = (seat: GwSeatState, id: string) =>
  seat.craft?.inventions.find((x) => x.id === id) ?? null;

const isRunning = (p: GwProjectState) =>
  (RUNNING as readonly string[]).includes(p.phase);

export function runningProject(seat: GwSeatState): GwProjectState | null {
  const list = seat.craft?.projects ?? [];
  const last = list[list.length - 1] ?? null;
  return last !== null && isRunning(last) ? last : null;
}

const yearOf = (gw: GreatWar) => civilFromDays(gw.s.day).year;

function schedule(
  gw: GreatWar,
  seat: GwSeatState,
  scene: string,
  who: string | null = null,
): void {
  if (sceneOf(scene) === null) return;
  seat.scheduled.push({ scene, chapter: gw.s.chapter + 1, who });
}

function shiftInst(n: GwNationState, inst: string, delta: number): void {
  const key = inst as keyof GwNationState["inst"];
  const v = n.inst[key];
  if (v === undefined) return;
  n.inst[key] = clampTo(v + delta, GW_INST_MIN, GW_INST_MAX);
}

// ---- Conditions ----

type CraftCond = Extract<
  GwWorldCond,
  { is: "invention" | "project" | "footing" | "shortage" }
>;

export function craftHolds(ctx: SceneCtx, c: CraftCond): boolean {
  const { seat } = ctx;
  switch (c.is) {
    case "invention": {
      const st = inventionOf(seat, c.id);
      if (st === null || !c.of.includes(st.stage)) return false;
      return c.early === undefined || st.early === c.early;
    }
    case "project": {
      if (c.id === undefined) {
        const p = runningProject(seat);
        return p !== null && c.of.includes(p.phase);
      }
      const all = (seat.craft?.projects ?? []).filter((x) => x.id === c.id);
      return c.of.includes(all[all.length - 1]?.phase ?? "idle");
    }
    case "footing": {
      const v = seat.craft?.footing ?? 0;
      return v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);
    }
    case "shortage": {
      const st = seat.craft?.shortages.find((x) => x.id === c.id);
      if (st === undefined) return false;
      return st.solved === (c.solved ?? false);
    }
  }
}

// ---- Effects ----

type CraftEffect = Extract<
  GwWorldEffect,
  { do: "invent" | "project" | "project_lead" | "footing" | "shortage" }
>;

export function craftEffect(ctx: SceneCtx, e: CraftEffect): void {
  switch (e.do) {
    case "invent":
      invent(ctx, e.id, e.step);
      return;
    case "project":
      projectStep(ctx, e.step, e.id);
      return;
    case "project_lead": {
      const p = runningProject(ctx.seat);
      const who = whoIn(ctx, e.who);
      if (p !== null && who !== null) p.lead = who.id;
      return;
    }
    case "footing":
      setFooting(ctx, e.level);
      return;
    case "shortage":
      if (e.on) openShortage(ctx.gw, ctx.seat, e.id, false);
      else solveShortage(ctx.gw, ctx.seat, e.id);
      return;
  }
}

function invent(ctx: SceneCtx, id: string, step: GwInventStep): void {
  const { gw, seat } = ctx;
  const row = inventionRow(id);
  if (row === null || row.tag !== seat.tag) return;
  const c = craftOf(seat);
  let st = inventionOf(seat, id);
  if (st === null) {
    st = {
      id,
      stage: "proposed",
      since: gw.s.chapter,
      tries: 0,
      build: 0,
      early: false,
    };
    c.inventions.push(st);
  }
  const to = (stage: GwInventionState["stage"]) => {
    st.stage = stage;
    st.since = gw.s.chapter;
  };
  const open = st.stage === "proposed" || st.stage === "refused";
  switch (step) {
    case "back":
    case "quiet": {
      if (!open) return;
      const n = gw.nation(seat.tag);
      if (step === "back" && row.against !== undefined && n !== null) {
        n.authority = clampTo(
          n.authority - (row.price ?? GW_OVERRULE_PRICE),
          0,
          100,
        );
        shiftInst(n, row.against, -1);
        reason(gw, seat, "invent_overruled", row.inventor);
      } else {
        reason(gw, seat, `invent_${step}`, row.inventor);
      }
      st.tries = 1;
      st.build = step === "quiet" ? row.build * 2 : row.build;
      to("building");
      return;
    }
    case "refuse":
      if (!open) return;
      to("refused");
      reason(gw, seat, "invent_refused", row.inventor);
      return;
    case "retry":
      if (st.stage !== "failed") return;
      st.tries++;
      st.build = Math.ceil(row.build / 2);
      to("building");
      return;
    case "drop":
      if (st.stage === "fielded" || st.stage === "building") return;
      to("dropped");
      return;
    case "field":
      field(ctx, row, st);
      return;
  }
}

function field(ctx: SceneCtx, row: GwInventionRow, st: GwInventionState): void {
  const { gw, seat } = ctx;
  if (st.stage !== "ready") return;
  st.early = gw.s.chapter - st.since < row.ripe;
  st.stage = "fielded";
  st.since = gw.s.chapter;
  const n = gw.nation(seat.tag);
  if (row.tech !== undefined && n !== null && !n.techs.includes(row.tech)) {
    n.techs.push(row.tech);
  }
  for (const s of row.solves ?? []) solveShortage(gw, seat, s);
  runEffects(ctx, row.fielded ?? []);
  reason(gw, seat, st.early ? "invent_early" : "invent_fielded", row.inventor);
  news(gw, st.early ? "invent_leaked" : "invent_fielded", seat.tag);
  schedule(gw, seat, `${row.id}_used`);
  gw.touch();
}

/** The country tab's "into the war now". */
export function fieldOrder(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
): GwOrderBlock | null {
  const row = inventionRow(id);
  const st = inventionOf(seat, id);
  if (row === null || st?.stage !== "ready") return "no_craft";
  field({ gw, seat, cast: {} }, row, st);
  return null;
}

function leadFor(gw: GreatWar, seat: GwSeatState, row: GwProjectRow) {
  const probe: GwScene = {
    id: `${row.id}_lead`,
    nation: [row.tag],
    kind: "wire",
    cast: { lead: row.lead },
    salience: 0,
    tags: [],
    variants: [{ id: "base" }],
  };
  return castOf(gw, seat, probe)?.lead ?? null;
}

function projectStep(ctx: SceneCtx, step: GwProjectStep, id?: string): void {
  const { gw, seat } = ctx;
  const c = craftOf(seat);
  const now = runningProject(seat);
  switch (step) {
    case "start": {
      const row = id === undefined ? null : projectRow(id);
      if (row === null || row.tag !== seat.tag || now !== null) return;
      const lead = leadFor(gw, seat, row);
      c.projects.push({
        id: row.id,
        phase: "prep",
        day: gw.s.day,
        lead,
        push: 0,
        year: yearOf(gw),
      });
      c.picked = yearOf(gw);
      runEffects(ctx, row.start ?? []);
      reason(gw, seat, "project_started", lead ?? undefined);
      schedule(gw, seat, `${row.id}_prep`, lead);
      return;
    }
    case "later":
      c.picked = yearOf(gw);
      return;
    case "push":
    case "slow":
      if (now !== null)
        now.push += step === "push" ? GW_PROJECT_PUSH : -GW_PROJECT_PUSH;
      return;
    case "drop":
      if (now === null) return;
      now.phase = "dropped";
      now.day = gw.s.day;
      reason(gw, seat, "project_dropped", now.lead ?? undefined);
      return;
  }
}

function setFooting(ctx: SceneCtx, level: number): void {
  const { gw, seat } = ctx;
  const c = craftOf(seat);
  const row = footingRow(seat.tag);
  const up = level === c.footing + 1;
  if (level === c.footing || (level > c.footing && !up)) return;
  c.footing = level;
  c.footingSince = gw.s.chapter;
  reason(gw, seat, `footing_${GW_FOOTINGS[level]}`);
  if (!up) return;
  const step = row?.steps[level - 1];
  runEffects(ctx, step?.raise ?? GW_FOOTING_RAISE[level - 1]);
  if (level === 2) news(gw, "footing_total", seat.tag);
}

/** The country tab asks for the next step: its big scene comes now. */
export function raiseFooting(
  gw: GreatWar,
  seat: GwSeatState,
): GwOrderBlock | null {
  const v = footingView(gw, seat);
  const row = footingRow(seat.tag);
  if (v === null || row === null || !v.open || v.asked) return "no_footing";
  const c = craftOf(seat);
  const scene = sceneOf(row.steps[c.footing].scene);
  if (scene === null) return "no_footing";
  const card = makeCard(gw, seat, scene, "summon");
  if (card === null) return "no_footing";
  placeCard(gw, seat, card);
  c.footingAsked = gw.s.chapter;
  return null;
}

function footingView(gw: GreatWar, seat: GwSeatState): GwCraftView["raise"] {
  const row = footingRow(seat.tag);
  const level = seat.craft?.footing ?? 0;
  if (row === null || level >= 2) return null;
  const opens = row.steps[level].opens ?? atWar;
  return {
    open: holds({ gw, seat, cast: {} }, opens),
    asked: seat.craft?.footingAsked === gw.s.chapter,
  };
}

function openShortage(
  gw: GreatWar,
  seat: GwSeatState,
  id: GwShortage,
  call: boolean,
): void {
  const c = craftOf(seat);
  if (c.shortages.some((x) => x.id === id)) return;
  c.shortages.push({ id, since: gw.s.chapter, solved: false });
  reason(gw, seat, `shortage_${id}`);
  if (!call) return;
  const row = shortageRows(seat.tag).find((r) => r.id === id);
  if (row !== undefined) schedule(gw, seat, row.scene);
}

function solveShortage(gw: GreatWar, seat: GwSeatState, id: GwShortage): void {
  const c = craftOf(seat);
  const st = c.shortages.find((x) => x.id === id);
  if (st?.solved === true) return;
  if (st === undefined)
    c.shortages.push({ id, since: gw.s.chapter, solved: true });
  else st.solved = true;
  reason(gw, seat, `shortage_${id}_solved`);
}

// ---- The chapter's close ----

function runTerms(
  gw: GreatWar,
  tag: GwSeatState["tag"],
  terms: readonly GwCraftTerm[],
  key: (t: GwCraftTerm) => string,
): void {
  for (const t of terms) {
    if (everyMonths(gw, t.every, t.offset ?? 0)) {
      moveGauge(gw, tag, t.gauge, t.delta, key(t));
    }
  }
}

function inventionsClose(gw: GreatWar, seat: GwSeatState): void {
  const ch = gw.s.chapter;
  for (const st of seat.craft?.inventions ?? []) {
    const row = inventionRow(st.id);
    if (row === null) continue;
    if (st.stage === "building" && ch - st.since + 1 >= st.build) {
      const pct = row.trial + GW_RETRY_BONUS * (st.tries - 1);
      const ok = wwRoll(gw.s.seed, P_TRIAL, ch, idHash(st.id)) % 100 < pct;
      st.stage = ok ? "ready" : "failed";
      st.since = ch;
      reason(
        gw,
        seat,
        ok ? "invent_trial_ok" : "invent_trial_failed",
        row.inventor,
      );
      schedule(gw, seat, `${row.id}${ok ? "_ok" : "_fail"}`);
    } else if (st.stage === "ready" && ch - st.since === row.ripe) {
      reason(gw, seat, "invent_ripe", row.inventor);
    }
  }
  // One new proposal a chapter, the first whose time has come.
  const ctx: SceneCtx = { gw, seat, cast: {} };
  const fresh = inventionRows(seat.tag).find(
    (r) => inventionOf(seat, r.id) === null && holds(ctx, r.opens),
  );
  if (fresh === undefined) return;
  craftOf(seat).inventions.push({
    id: fresh.id,
    stage: "proposed",
    since: ch,
    tries: 0,
    build: 0,
    early: false,
  });
  schedule(gw, seat, fresh.id);
}

function projectsClose(gw: GreatWar, seat: GwSeatState): void {
  const rows = projectRows(seat.tag);
  if (rows.length === 0) return;
  const p = runningProject(seat);
  if (p === null) {
    const id = agendaId(seat.tag);
    const pending =
      seat.scheduled.some((q) => q.scene === id) ||
      seat.desk.some((x) => x.scene === id);
    const picked = seat.craft?.picked ?? -1;
    if (gw.s.chapter >= 1 && picked !== yearOf(gw) && !pending) {
      schedule(gw, seat, id);
    }
    return;
  }
  const row = projectRow(p.id);
  if (row === null || gw.s.day - p.day < (row.months ?? 2) * MONTH) return;
  p.day = gw.s.day;
  if (p.phase === "prep" || p.phase === "opp") {
    p.phase = p.phase === "prep" ? "opp" : "exec";
    schedule(gw, seat, `${p.id}_${p.phase}`, p.lead);
    return;
  }
  const ok =
    wwRoll(gw.s.seed, P_PROJECT, gw.s.chapter, idHash(p.id)) % 100 <
    projectOdds(gw, seat, row, p);
  p.phase = ok ? "done" : "failed";
  const ctx: SceneCtx = { gw, seat, cast: {} };
  runEffects(ctx, ok ? row.done : (row.failed ?? []));
  if (p.lead !== null) recordResult(gw, p.lead, ok);
  reason(gw, seat, ok ? "project_done" : "project_failed", p.lead ?? undefined);
  schedule(gw, seat, `${p.id}_${ok ? "done" : "fail"}`, p.lead);
}

/**
 * Percent the project gets done: the row, the chapters' choices, the aim, the
 * man; never below GW_PROJECT_ODDS_MIN or above GW_PROJECT_ODDS_MAX.
 */
export function projectOdds(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwProjectRow,
  p: GwProjectState,
): number {
  const aim = seat.aim !== null && (row.aims ?? []).includes(seat.aim);
  const lead = p.lead === null ? null : gw.person(p.lead);
  const skill = lead === null ? 0 : (lead.competence[2] - 2) * GW_PROJECT_SKILL;
  return clampTo(
    row.odds + p.push + (aim ? GW_PROJECT_AIM : 0) + skill,
    GW_PROJECT_ODDS_MIN,
    GW_PROJECT_ODDS_MAX,
  );
}

function shortagesClose(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
): void {
  const c = seat.craft;
  for (const st of c?.shortages ?? []) {
    if (st.solved) continue;
    const row = shortageRows(seat.tag).find((r) => r.id === st.id);
    runTerms(gw, seat.tag, row?.drag ?? [], () => `shortage_${st.id}`);
  }
  if (!fights(n)) return;
  const ctx: SceneCtx = { gw, seat, cast: {} };
  const fresh = shortageRows(seat.tag).find(
    (r) =>
      !(seat.craft?.shortages ?? []).some((x) => x.id === r.id) &&
      holds(ctx, r.when),
  );
  if (fresh !== undefined) openShortage(gw, seat, fresh.id, true);
}

function footingClose(gw: GreatWar, seat: GwSeatState, n: GwNationState): void {
  const level = seat.craft?.footing ?? 0;
  if (level === 0 || !fights(n) || !isLongChapter(gw)) return;
  const terms =
    footingRow(seat.tag)?.steps[level - 1].terms ?? GW_FOOTING_TERMS[level - 1];
  const name = GW_FOOTINGS[level];
  runTerms(gw, seat.tag, terms, (t) => `footing_${name}_${t.gauge}`);
}

/** Chapter step, after the home front: every seat's statecraft. */
export function craftStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.memoir !== null) continue;
    const n = gw.nation(seat.tag);
    if (n === null) continue;
    inventionsClose(gw, seat);
    projectsClose(gw, seat);
    if (gw.s.warChapter === null || !isLongChapter(gw)) continue;
    footingClose(gw, seat, n);
    shortagesClose(gw, seat, n);
  }
}

// ---- The war ----

/**
 * Percent a country's fielded inventions are worth in a theatre: full while
 * the surprise lasts, half once the enemy has learnt (at once if fielded early).
 */
export function craftEdge(
  gw: GreatWar,
  n: GwNationState | null,
  theatre: GwTheatre,
  role: "attack" | "defence",
): number {
  if (n === null) return 0;
  let out = 0;
  for (const seat of seatsOf(gw, n.tag)) {
    for (const st of seat.craft?.inventions ?? []) {
      if (st.stage !== "fielded") continue;
      const row = inventionRow(st.id);
      // A row with a research tech fights through the tech table alone.
      const edge = row?.tech === undefined ? row?.edge : undefined;
      if (edge === undefined) continue;
      if (edge.theatres !== undefined && !edge.theatres.includes(theatre))
        continue;
      const pct = (role === "attack" ? edge.attack : edge.defence) ?? 0;
      const full = !st.early && gw.s.chapter - st.since < GW_SURPRISE_CHAPTERS;
      out += full ? pct : pct >> 1;
    }
  }
  return out;
}

// ---- The view ----

export function craftView(gw: GreatWar, seat: GwSeatState): GwCraftView {
  const c = seat.craft;
  const ch = gw.s.chapter;
  const projects = (c?.projects ?? []).map((p) => ({
    id: p.id,
    phase: p.phase,
    lead: p.lead,
    year: p.year,
  }));
  const run = runningProject(seat);
  return {
    footing: c?.footing ?? 0,
    raise: footingView(gw, seat),
    inventions: (c?.inventions ?? []).map((st) => {
      const row = inventionRow(st.id);
      return {
        id: st.id,
        inventor: row?.inventor ?? "",
        stage: st.stage,
        early: st.early,
        ripe: st.stage === "ready" && row !== null && ch - st.since >= row.ripe,
      };
    }),
    project: run === null ? null : projects[projects.length - 1],
    past: projects.filter(
      (p) => !(RUNNING as readonly string[]).includes(p.phase),
    ),
    shortages: (c?.shortages ?? []).map((x) => ({
      id: x.id,
      solved: x.solved,
    })),
  };
}
