// Great War 1914 (ww150): what runs under the story. The rival: one of the
// circle, by the seed, hidden until the memoir, on a track of three stages.
// Letters: a thread with a foreign ruler. The opening: a first game of a nation
// starts with few people and a small desk. Tables: engine-lib/ww1914/StoryRows.
import { GameType } from "@openfront/engine-api/game/GameTypes";
import type {
  GwCard,
  GwPersonState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_RIVAL_CLASH,
  GW_RIVAL_GATHERING,
  GW_RIVAL_SIGNS,
  GwRivalAct,
} from "@openfront/engine-api/ww1914/GwStory";
import {
  GW_STANCES,
  GwCond,
  GwEffect,
  GwStance,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_HEADS,
  GW_OPENING_CHAPTERS,
  GW_OPENING_CIRCLE,
  GW_RIVAL_BARS,
  GW_RIVAL_ROWS,
} from "@openfront/engine-lib/ww1914/StoryRows";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { actRow, personDef, SceneCtx, sceneOf, whoIn } from "./SceneRun";
import { seatPerson, seatsOf } from "./World";

const P_RIVAL = idHash("gw_rival");

/** Heat a seat's act moves, in tenths of the game: the same on every calendar. */
const ACT_TENTHS = 2;
/** Trust from which an embraced rival stops gathering. */
const EMBRACE_HOLDS = 2;

const chapterCount = (gw: GreatWar) => gwChapters(gw.s.calendar).length;

function stageAt(gw: GreatWar, heat: number): number {
  const n = chapterCount(gw);
  if (heat * 100 >= GW_RIVAL_BARS.clash * n) return GW_RIVAL_CLASH;
  if (heat * 100 >= GW_RIVAL_BARS.gathering * n) return GW_RIVAL_GATHERING;
  return GW_RIVAL_SIGNS;
}

/** One of the row, by the seed; a row nobody is left of gives no rival. */
export function rollRival(gw: GreatWar, seat: GwSeatState): void {
  const rows = (GW_RIVAL_ROWS[seat.tag] ?? []).filter(
    (id) => gw.person(id)?.status === "active" && id !== seatPerson(seat),
  );
  if (rows.length === 0) return;
  const roll = wwRoll(gw.s.seed, P_RIVAL, seat.smallID);
  seat.story.rival.who = rows[roll % rows.length];
  seat.story.rival.stage = GW_RIVAL_SIGNS;
}

/** The rival if the track is open and he is on his feet. */
export function rivalMan(
  gw: GreatWar,
  seat: GwSeatState,
): GwPersonState | null {
  const r = seat.story.rival;
  if (r.who === null || r.end !== null) return null;
  const p = gw.person(r.who);
  return p?.status === "active" ? p : null;
}

/** A chapter closes: the track moves, or closes with him gone. */
export function storyStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    const r = seat.story.rival;
    if (r.who === null || r.end !== null) continue;
    const p = rivalMan(gw, seat);
    if (p === null || r.who === seatPerson(seat)) {
      r.end = r.act === "strike" ? "broken" : "gone";
      continue;
    }
    const held = r.act === "embrace" && p.trust >= EMBRACE_HOLDS;
    r.heat += held ? 0 : p.trust < 0 ? 2 : 1;
    r.stage = r.act === "strike" ? GW_RIVAL_CLASH : stageAt(gw, r.heat);
  }
}

function rivalAct(gw: GreatWar, seat: GwSeatState, act: GwRivalAct): void {
  const r = seat.story.rival;
  const p = rivalMan(gw, seat);
  if (p === null) return;
  const step = Math.max(1, Math.floor((chapterCount(gw) * ACT_TENTHS) / 10));
  r.act = act;
  if (act === "embrace") r.heat = Math.max(0, r.heat - step);
  if (act === "push") r.heat += step;
  if (act === "strike") {
    r.heat = Math.max(r.heat, stageBar(gw));
    r.stage = GW_RIVAL_CLASH;
    return;
  }
  r.stage = stageAt(gw, r.heat);
}

function stageBar(gw: GreatWar): number {
  return Math.ceil((GW_RIVAL_BARS.clash * chapterCount(gw)) / 100);
}

/** That country's ruler, for a letter: never a seat's, never the dead. */
export function headOf(
  gw: GreatWar,
  seat: GwSeatState,
  tag: GwTag,
): GwPersonState | null {
  const n = gw.nation(tag);
  if (n === null || tag === seat.tag || seatsOf(gw, tag).length > 0) {
    return null;
  }
  const fits = (GW_HEADS[tag] ?? []).filter(
    (r) =>
      (r.regimes === undefined || r.regimes.includes(n.regime)) &&
      (r.from === undefined || gw.s.day >= dayOf(r.from)),
  );
  const row = fits[fits.length - 1];
  if (row === undefined) return null;
  const p = gw.person(row.person);
  return p?.status === "active" ? p : null;
}

function dayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return daysFromCivil(y, m, d);
}

/** The country of the person a condition or effect names. */
function tagOfWho(ctx: SceneCtx, who: Parameters<typeof whoIn>[1]) {
  const p = whoIn(ctx, who);
  return p === null ? null : (personDef(p.id)?.tag ?? null);
}

/** A letter came: `placeCard` writes it into the thread. */
export function noteLetterIn(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
): void {
  const scene = sceneOf(card.scene);
  if (scene?.kind !== "letter" || scene.who === undefined) return;
  const tag = personDef(card.cast[scene.who])?.tag;
  if (tag === undefined) return;
  seat.story.letters.push({
    with: tag,
    out: false,
    scene: card.scene,
    variant: card.variant,
    tone: null,
    chapter: gw.s.chapter,
  });
}

type StoryCond = Extract<
  GwCond,
  {
    kind:
      | "rival_stage"
      | "rival_act"
      | "rival_end"
      | "character"
      | "at_war_with"
      | "letters"
      | "first_game";
  }
>;

const between = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

export function storyHolds(ctx: SceneCtx, c: StoryCond): boolean {
  const { gw, seat } = ctx;
  const r = seat.story.rival;
  switch (c.kind) {
    case "rival_stage":
      return r.who !== null && r.end === null && between(r.stage, c);
    case "rival_act":
      return r.act !== null && c.of.includes(r.act);
    case "rival_end":
      return r.end !== null && c.of.includes(r.end);
    case "character": {
      const tag = tagOfWho(ctx, c.who);
      if (tag === null || seatsOf(gw, tag).length > 0) return false;
      const n = gw.nation(tag);
      return n !== null && c.of.includes(n.ai);
    }
    case "at_war_with": {
      const tag = tagOfWho(ctx, c.who);
      return tag !== null && gw.nation(seat.tag)?.atWar.includes(tag) === true;
    }
    case "letters": {
      const tag = tagOfWho(ctx, c.who);
      const count = seat.story.letters.filter(
        (x) =>
          x.with === tag &&
          (c.out === undefined || x.out === c.out) &&
          (c.tone === undefined || x.tone === c.tone) &&
          (c.within === undefined || gw.s.chapter - x.chapter <= c.within),
      ).length;
      return between(count, c.min === undefined ? { ...c, min: 1 } : c);
    }
    case "first_game":
      return firstGame(gw, seat);
  }
}

/** A 친서 takes its tone from the schedule: the field `tone`, if it has one. */
function pickedTone(ctx: SceneCtx): GwStance | null {
  const tone = actRow(ctx)?.picks.tone?.[0];
  return GW_STANCES.find((x) => x === tone) ?? null;
}

type StoryEffect = Extract<
  GwEffect,
  { kind: "rival" | "rival_end" | "letter" }
>;

export function storyEffect(ctx: SceneCtx, e: StoryEffect): void {
  const { gw, seat } = ctx;
  switch (e.kind) {
    case "rival":
      rivalAct(gw, seat, e.act);
      return;
    case "rival_end":
      if (rivalMan(gw, seat) !== null) seat.story.rival.end = e.end;
      return;
    case "letter": {
      const tag = tagOfWho(ctx, e.who);
      if (tag === null) return;
      seat.story.letters.push({
        with: tag,
        out: true,
        scene: ctx.card?.scene ?? null,
        variant: ctx.card?.variant ?? null,
        tone: e.tone ?? pickedTone(ctx),
        chapter: gw.s.chapter,
      });
      return;
    }
  }
}

/**
 * A first game of this nation: the lobby said which the shelf holds. No list
 * means nobody asked (a friends' game, a test): no opening.
 */
export function firstGame(gw: GreatWar, seat: GwSeatState): boolean {
  const config = gw.mg.config().gameConfig();
  const played = config.greatWar1914Played;
  if (played === undefined || config.gameType !== GameType.Singleplayer) {
    return false;
  }
  return !played.includes(seat.tag);
}

/** This chapter's desk is held down for a first game. */
export function inOpening(gw: GreatWar, seat: GwSeatState): boolean {
  return gw.s.chapter < GW_OPENING_CHAPTERS && firstGame(gw, seat);
}

/** Those of `people` a first game hasn't brought in yet. */
export function newcomers(
  gw: GreatWar,
  seat: GwSeatState,
  people: readonly string[],
): string[] {
  const circle = GW_OPENING_CIRCLE[seat.tag] ?? [];
  const self = seatPerson(seat);
  return people.filter(
    (id) => id !== self && !circle.includes(id) && !seat.story.met.includes(id),
  );
}
