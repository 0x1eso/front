// Great War 1914: the dossier, 서류철 (brief ww158, S2). Files on the seat's own
// people, never the seat's own person. Each listed person has one to three
// possible weaknesses (`<TAG>_WEAK`); the seed
// decides which are true, so files differ each game. The police open a file
// when the schedule's entry asks (`<tag>_a_file`, effect `file`) and bring some
// unasked; a file comes as a police report, stamped by the police's band, and
// only an unconfirmed one can be false. In a talk with him a `hold` reply uses
// it: true, he does what the talk asks (his faction stays away from the vote,
// his plot cools), remembers it, and it may come out; false, he refuses, the
// file is burnt and the seat learns the police were wrong.
import type {
  GwPersonState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwDossierView,
  GwFile,
} from "@openfront/engine-api/ww1914/GwHouse";
import type { GwWho } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  dossierIds,
  GW_EXPOSE_CUNNING,
  GW_EXPOSE_PCT,
  GW_EXPOSE_PER_USE,
  GW_HELD_CHAPTERS,
  GW_POLICE_FILE_EVERY,
  GwWeakRow,
} from "@openfront/engine-lib/ww1914/HouseRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { govHeatBy } from "./Government";
import type { GreatWar } from "./GreatWar";
import { factionOf, houseEffect } from "./House";
import { checkNow, rollReport, sendHouseReport } from "./Intel";
import { plotRows } from "./Plots";
import { moveOpinion } from "./Press";
import { holderOf, personDef, SceneCtx, sceneOf } from "./SceneRun";
import { everyMonths, news, ownPeople, reason, seatPerson } from "./World";

const P_WEAK = idHash("gw_weak");
const P_FILE = idHash("gw_file");
const P_EXPOSE = idHash("gw_file_out");
const P_UNASKED = idHash("gw_file_unasked");

/** Files held at once before the police stop bringing them unasked. */
const UNASKED_CAP = 3;
/** Heat a used file takes off his plot: about one step. */
const HOLD_COOLS_PLOT = 3;
/** His faction's heat when a file is refused, and when one comes out. */
const REFUSED_HEAT = 1;
const FOUND_HEAT = 3;

type FileCond = Extract<GwWorldCond, { is: "file" }>;
type FileEffect = Extract<GwWorldEffect, { do: "file" | "use_file" }>;

// ---- Rows, truth ----

function weakRow(person: string): GwWeakRow | null {
  return (gwContent().weak ?? []).find((w) => w.person === person) ?? null;
}

/** Whether the weakness is real this game: the seed's, never stored. */
export function weakTrue(gw: GreatWar, person: string, weak: string): boolean {
  const row = weakRow(person);
  const w = row?.weak.find((x) => x.id === weak);
  if (w === undefined) return false;
  return wwRoll(gw.s.seed, P_WEAK, idHash(person), idHash(weak)) % 100 < w.odds;
}

/** Whom a `who` names: a role may be a pack-only outsider (no state). */
function whoId(ctx: SceneCtx, w: GwWho): string | null {
  if ("role" in w) return ctx.cast[w.role] ?? null;
  if ("office" in w) return holderOf(ctx.gw, ctx.seat, w.office)?.id ?? null;
  return w.person;
}

/** Never in a file: the seat's own person, and anyone not ours. */
function fileable(gw: GreatWar, seat: GwSeatState, who: string): boolean {
  if (seatPerson(seat) === who) return false;
  if (!who.startsWith(`${seat.tag.toLowerCase()}_`)) return false;
  const p = gw.person(who);
  return p === null || p.status === "active";
}

const held = (seat: GwSeatState) =>
  (seat.house?.files ?? []).filter((f) => !f.out);

/** The factions he leads or would lead (their leaders and radical). */
function factionsOf(seat: GwSeatState, who: string): string[] {
  return (gwContent().factions ?? [])
    .filter(
      (f) =>
        f.tag === seat.tag &&
        (f.radical === who || f.leaders.some((l) => l.person === who)),
    )
    .map((f) => f.id);
}

function heatFactions(ctx: SceneCtx, who: string, by: number): void {
  for (const id of factionsOf(ctx.seat, who)) {
    houseEffect(ctx, { do: "faction", id, delta: by });
  }
}

function moveTrust(p: GwPersonState | null, delta: number): void {
  if (p !== null) p.trust = Math.max(-3, Math.min(3, p.trust + delta));
}

// ---- Gathering ----

/**
 * The police open a file on him: one weakness he has no file for, true unless
 * the police's report is wrong (only an unconfirmed one can be). Nothing found:
 * a reason line, no file. Returns the file, if any.
 */
export function gatherFile(
  gw: GreatWar,
  seat: GwSeatState,
  who: string,
  unasked: boolean,
): GwFile | null {
  const h = seat.house;
  const row = weakRow(who);
  if (h === undefined || !fileable(gw, seat, who)) return null;
  const free = (row?.weak ?? []).filter(
    (w) => !h.files.some((f) => f.who === who && f.weak === w.id && !f.out),
  );
  const real = free.filter((w) => weakTrue(gw, who, w.id));
  const unreal = free.filter((w) => !weakTrue(gw, who, w.id));
  const roll = rollReport(gw, "police");
  if (roll.wrong && unreal.length === 0) roll.wrong = false;
  const from = roll.wrong ? unreal : real;
  if (from.length === 0) {
    reason(gw, seat, "file_nothing", who);
    return null;
  }
  const w = from[wwRoll(gw.s.seed, P_FILE, roll.uid) % from.length];
  const file: GwFile = {
    uid: h.nextFile++,
    who,
    weak: w.id,
    stamp: roll.stamp,
    truth: !roll.wrong,
    chapter: gw.s.chapter,
    used: 0,
    out: false,
  };
  h.files.push(file);
  const truth = file.truth ? 1 : 0;
  sendHouseReport(gw, seat, "file", truth, "police", fileKey(file), true, roll);
  reason(gw, seat, unasked ? "file_brought" : "file_opened", who);
  if (unasked) {
    const scene = dossierIds.unasked(seat.tag);
    if (sceneOf(scene) !== null) {
      seat.scheduled.push({ scene, chapter: gw.s.chapter + 1, who });
    }
  }
  return file;
}

/** The report a file came with names it so. */
const fileKey = (f: GwFile) => `file_${f.uid}`;

function settleReport(gw: GreatWar, f: GwFile): void {
  const r = gw.s.reports.find(
    (x) => x.fact === "file" && x.about === fileKey(f),
  );
  if (r !== undefined) checkNow(gw, r.uid);
}

// ---- Using it ----

/** The file is used in this talk: he gives way, or he calls the bluff. */
function holdFile(ctx: SceneCtx, who: string): void {
  const { gw, seat } = ctx;
  const f = held(seat)
    .filter((x) => x.who === who)
    .slice(-1)[0];
  if (f === undefined) return;
  f.used++;
  settleReport(gw, f);
  const p = gw.person(who);
  if (!f.truth) {
    f.out = true;
    moveTrust(p, -2);
    heatFactions(ctx, who, REFUSED_HEAT);
    reason(gw, seat, "file_refused", who);
    return;
  }
  for (const id of factionsOf(seat, who)) {
    const st = factionOf(seat, id);
    if (st !== null) st.held = gw.s.chapter + GW_HELD_CHAPTERS;
    for (const row of plotRows()) {
      if (row.tag === seat.tag && row.plot.by.includes(id)) {
        govHeatBy(gw, seat, row.id, -HOLD_COOLS_PLOT);
      }
    }
  }
  if (p !== null) {
    p.trust = Math.min(p.trust, -1);
    const m = { key: "file_held", who, chapter: gw.s.chapter, weight: -2 };
    p.memory.push(m);
    seat.memory.push({ ...m });
  }
  reason(gw, seat, "file_held", who);
  const cunning = p?.temperament === "cunning" ? GW_EXPOSE_CUNNING : 0;
  const pct = GW_EXPOSE_PCT + GW_EXPOSE_PER_USE * (f.used - 1) + cunning;
  if (wwRoll(gw.s.seed, P_EXPOSE, f.uid, f.used) % 100 < pct) {
    foundOut(ctx, f);
  }
}

/** It came out: a scandal in the papers, his faction and the press turn. */
function foundOut(ctx: SceneCtx, f: GwFile): void {
  const { gw, seat } = ctx;
  f.out = true;
  // Britain takes it worse: a free press and a House that won't have it.
  const worse = seat.tag === "GBR" ? 2 : 1;
  news(gw, "file_scandal", seat.tag);
  reason(gw, seat, "file_found_out", f.who);
  heatFactions(ctx, f.who, FOUND_HEAT);
  moveOpinion(seat, "press", -2 * worse);
  const camps = personDef(f.who)?.camps ?? [];
  for (const p of ownPeople(gw, seat.tag)) {
    const same = personDef(p.id)?.camps.some((c) => camps.includes(c));
    if (same === true) moveTrust(p, -worse);
  }
  const scene = dossierIds.scandal(seat.tag);
  if (sceneOf(scene) !== null) {
    seat.scheduled.push({ scene, chapter: gw.s.chapter + 1, who: f.who });
  }
}

// ---- The chapter ----

/** Chapter step: a held man stays cold; now and then a file comes unasked. */
export function dossierStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.house === undefined || seat.memoir !== null) continue;
    for (const f of held(seat)) {
      const p = gw.person(f.who);
      if (f.truth && f.used > 0 && p !== null) p.trust = Math.min(p.trust, -1);
    }
    if (!everyMonths(gw, GW_POLICE_FILE_EVERY, 2)) continue;
    if (held(seat).length >= UNASKED_CAP) continue;
    const pool = (gwContent().weak ?? [])
      .map((w) => w.person)
      .filter((id) => fileable(gw, seat, id) && gw.person(id) !== null);
    if (pool.length === 0) continue;
    const pick = wwRoll(gw.s.seed, P_UNASKED, gw.s.chapter) % pool.length;
    gatherFile(gw, seat, pool[pick], true);
  }
}

// ---- Scenes read and act ----

export function fileHolds(ctx: SceneCtx, c: FileCond): boolean {
  const id = whoId(ctx, c.who);
  const files = ctx.seat.house?.files.filter((f) => f.who === id) ?? [];
  const of = c.of ?? ["held"];
  return files.some(
    (f) =>
      (of.includes("held") && !f.out) ||
      (of.includes("used") && f.used > 0) ||
      (of.includes("out") && f.out),
  );
}

export function fileEffect(ctx: SceneCtx, e: FileEffect): void {
  const who = whoId(ctx, e.who);
  if (who === null) return;
  switch (e.do) {
    case "file":
      gatherFile(ctx.gw, ctx.seat, who, false);
      return;
    case "use_file":
      holdFile(ctx, who);
      return;
  }
}

// ---- The notebook ----

export function dossierView(
  gw: GreatWar,
  seat: GwSeatState,
): GwDossierView | undefined {
  const h = seat.house;
  if (h === undefined || (h.files.length === 0 && h.asks.length === 0)) {
    return undefined;
  }
  const asks = gwContent().asks ?? [];
  return {
    files: h.files.map((f) => ({
      uid: f.uid,
      who: f.who,
      weak: f.weak,
      stamp: f.stamp,
      chapter: f.chapter,
      used: f.used,
      out: f.out,
      // Once out the seat knows which: he refused it, or it came out.
      end: !f.out ? null : f.truth ? "found" : "burnt",
    })),
    asks: h.asks.flatMap((a) => {
      const row = asks.find((r) => r.id === a.id);
      if (row === undefined) return [];
      return [
        {
          id: a.id,
          from: row.from,
          kind: row.kind,
          stage: a.stage,
          chapter: a.chapter,
        },
      ];
    }),
  };
}
