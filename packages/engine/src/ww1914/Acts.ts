// Great War 1914 (원수의 일정): what the seat starts itself. An entry spends a
// slot, runs its effects, and its scene plays by the usual desk. Conditions on
// what was picked are in SceneRun (`picked`, `tone_fits`); the AI has none of this
// and a proxy leaves the slots unused.
import { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwAct,
  GwActField,
  gwSplitPicks,
} from "@openfront/engine-api/ww1914/GwActs";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwActView } from "@openfront/engine-api/ww1914/GwView";
import {
  GW_STANCES,
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_AGENDA_ALL,
  GW_AGENDA_LEADS,
  GW_SUBJECT_BLOCS,
  GW_TONE_EFFECTS,
} from "@openfront/engine-lib/ww1914/ActRules";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { stanceFit } from "@openfront/engine-lib/ww1914/TalkRules";
import { GW_TIME_PRICES } from "@openfront/engine-lib/ww1914/TaskRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { goAway } from "./Departments";
import { inStage, makeCard, placeCard } from "./Desk";
import type { GreatWar } from "./GreatWar";
import { factionLeader } from "./House";
import {
  castOf,
  holderOf,
  holds,
  personDef,
  runEffects,
  SceneCtx,
  sceneOf,
} from "./SceneRun";
import { spendTime, timeLeft } from "./Time";
import { ownPeople, seatPerson, seatsOf, stageOf } from "./World";

const P_CAUGHT = idHash("gw_act_caught");

/** With no cooldown of its own, chapters before an entry can be taken again. */
export const GW_ACT_COOLDOWN = 3;

/** Roles a pick fills aren't known yet: the entry's conditions skip them. */
function castBefore(gw: GreatWar, seat: GwSeatState, scene: GwScene) {
  const known = Object.entries(scene.cast).filter(([, rule]) => {
    const list = "any_of" in rule ? rule.any_of : [rule];
    return !list.some((x) => "picked" in x);
  });
  return castOf(gw, seat, { ...scene, cast: Object.fromEntries(known) });
}

function rested(gw: GreatWar, seat: GwSeatState, a: GwAct): boolean {
  const last = seat.acted.filter((x) => x.act === a.id).slice(-1)[0];
  if (last === undefined) return true;
  if (a.once === true) return false;
  return gw.s.chapter - last.chapter > (a.cooldown ?? GW_ACT_COOLDOWN);
}

/** The scene and cast an entry runs against before anything is picked. */
function actCtx(gw: GreatWar, seat: GwSeatState, a: GwAct): SceneCtx | null {
  const scene = sceneOf(a.scene);
  if (scene === null) return null;
  const cast = castBefore(gw, seat, scene);
  return cast === null ? null : { gw, seat, cast };
}

/** Whether the entry is on the schedule now. */
function actOpen(gw: GreatWar, seat: GwSeatState, a: GwAct): boolean {
  if (!a.nation.includes(seat.tag)) return false;
  if (a.stage !== undefined && !a.stage.includes(stageOf(gw))) return false;
  if (!rested(gw, seat, a)) return false;
  const ctx = actCtx(gw, seat, a);
  if (ctx === null) return false;
  return a.when === undefined || holds(ctx, a.when);
}

/** Who a people field lists. */
function fieldPeople(
  gw: GreatWar,
  seat: GwSeatState,
  f: GwActField,
): readonly string[] {
  const self = seatPerson(seat);
  return ownPeople(gw, seat.tag)
    .filter((p) => p.status === "active" && p.id !== self)
    .filter((p) => f.people === "own" || p.office !== null)
    .filter((p) => personDef(p.id)?.unlisted !== true || p.office !== null)
    .map((p) => p.id);
}

function fieldOptions(ctx: SceneCtx, f: GwActField): readonly string[] {
  return (f.options ?? [])
    .filter((o) => o.when === undefined || holds(ctx, o.when))
    .map((o) => o.id);
}

/** The field as the screen and the order see it, or null when it can't be met. */
function fieldView(ctx: SceneCtx, f: GwActField) {
  const people = f.people === undefined ? [] : fieldPeople(ctx.gw, ctx.seat, f);
  const count = f.people === undefined ? 1 : (f.count ?? 1);
  const options = fieldOptions(ctx, f);
  const tones = f.tones ?? [];
  const size = people.length + options.length + tones.length;
  if (size < count) return null;
  const tells = Object.fromEntries(
    (f.options ?? []).flatMap((o) => (o.tell ? [[o.id, o.tell]] : [])),
  );
  return { id: f.id, options, tones, people, count, tells };
}

/** Everything on the schedule now, in content order. */
export function actViews(gw: GreatWar, seat: GwSeatState): GwActView[] {
  return (gwContent().acts ?? []).flatMap((a) => {
    if (!actOpen(gw, seat, a)) return [];
    const ctx = actCtx(gw, seat, a)!;
    const fields = (a.fields ?? []).map((f) => fieldView(ctx, f));
    if (fields.some((f) => f === null)) return [];
    return [
      {
        id: a.id,
        kind: a.kind,
        fields: fields.flatMap((f) => (f === null ? [] : [f])),
        tell: a.tell ?? [],
      },
    ];
  });
}

/** Whether `picks` are what the open fields offer. */
function picksFit(
  ctx: SceneCtx,
  a: GwAct,
  picks: Readonly<Record<string, readonly string[]>>,
): boolean {
  return (a.fields ?? []).every((f) => {
    const v = fieldView(ctx, f);
    const got = picks[f.id];
    if (v === null || got.length !== v.count) return false;
    if (new Set(got).size !== got.length) return false;
    const can: readonly string[] = [...v.options, ...v.tones, ...v.people];
    return got.every((x) => can.includes(x));
  });
}

/** The picked options: their effects run, the last scene named wins. */
function pickedOptions(
  a: GwAct,
  picks: Readonly<Record<string, readonly string[]>>,
) {
  return (a.fields ?? []).flatMap((f) =>
    (f.options ?? []).filter((o) => picks[f.id].includes(o.id)),
  );
}

/** Applies the `act` order; null when it took effect. */
export function takeAct(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  flat: readonly string[],
): GwOrderBlock | null {
  const a = (gwContent().acts ?? []).find((x) => x.id === id);
  if (a === undefined || !actOpen(gw, seat, a)) return "no_act";
  // ww193: one time pool; a trip costs two and takes the ruler away.
  const price = a.trip === true ? GW_TIME_PRICES.trip : GW_TIME_PRICES.act;
  if (timeLeft(seat) < price) return "no_slot";
  const picks = gwSplitPicks(a, flat);
  const before = actCtx(gw, seat, a)!;
  if (picks === null || !picksFit(before, a, picks)) return "bad_pick";
  const chosen = pickedOptions(a, picks);
  const scene = sceneOf(
    chosen.filter((o) => o.scene).slice(-1)[0]?.scene ?? a.scene,
  );
  if (scene === null) return "no_act";
  const row = seat.acted.length;
  seat.acted.push({ act: a.id, chapter: gw.s.chapter, picks });
  const cast = castOf(gw, seat, scene, null, row);
  if (cast === null || !inStageOrLater(gw, scene, a)) {
    seat.acted.pop();
    return "no_act";
  }
  spendTime(seat, price, "acts");
  if (a.trip === true) goAway(gw, seat);
  const ctx: SceneCtx = {
    gw,
    seat,
    cast,
    act: row,
    fx: { act: a.id, kind: a.kind },
  };
  runEffects(ctx, a.effects ?? []);
  for (const o of chosen) runEffects(ctx, o.effects ?? []);
  runEffects(ctx, actRuleEffects(gw, seat, a, picks, scene, cast));
  play(gw, seat, scene, a.wait, row);
  const c = a.caught;
  if (c !== undefined) {
    const roll = wwRoll(gw.s.seed, P_CAUGHT, idHash(a.id), gw.s.chapter) % 100;
    if (roll < c.pct) {
      seat.scheduled.push({
        scene: c.scene,
        chapter: gw.s.chapter + c.wait,
        act: row,
      });
    }
  }
  return null;
}

/** A scene played this chapter must be of this stage; a later one can't be told. */
function inStageOrLater(gw: GreatWar, scene: GwScene, a: GwAct): boolean {
  return a.wait > 0 || inStage(gw, scene);
}

function play(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
  wait: number,
  row: number,
): void {
  if (wait > 0) {
    seat.scheduled.push({
      scene: scene.id,
      chapter: gw.s.chapter + wait,
      act: row,
    });
    return;
  }
  const card = makeCard(gw, seat, scene, "summon", null, row);
  if (card !== null) placeCard(gw, seat, card);
}

/** Whether the act's own pick already reads the tone it was written in. */
function readsTone(a: GwAct): boolean {
  const seen = (x: unknown): boolean => {
    if (Array.isArray(x)) return x.some(seen);
    if (x === null || typeof x !== "object") return false;
    if ((x as GwCond).kind === "tone_fits") return true;
    return Object.values(x).some(seen);
  };
  const own = [
    a.effects ?? [],
    ...(a.fields ?? []).flatMap((f) => (f.options ?? []).map((o) => o.effects)),
  ];
  return seen(own);
}

/** The person a tone field is written to: the act's `to`, the scene's `who`, its first role. */
function toneTarget(
  a: GwAct,
  scene: GwScene,
  cast: Readonly<Record<string, string>>,
): string | null {
  const role = a.to ?? scene.who ?? Object.keys(scene.cast)[0];
  return role === undefined ? null : (cast[role] ?? null);
}

/** The house faction this person leads, if any. */
function ledBy(gw: GreatWar, seat: GwSeatState, id: string): string | null {
  const f = (seat.house?.factions ?? []).find(
    (x) => factionLeader(gw, seat, x.id) === id,
  );
  return f?.id ?? null;
}

/** How the tone lands (ActRules GW_TONE_EFFECTS, or the subject's temperament). */
function toneEffects(
  gw: GreatWar,
  seat: GwSeatState,
  a: GwAct,
  picks: Readonly<Record<string, readonly string[]>>,
  scene: GwScene,
  cast: Readonly<Record<string, string>>,
): GwEffect[] {
  // A tone list, or a list named "tone" whose choices are the stances.
  const f = (a.fields ?? []).find(
    (x) =>
      x.tones !== undefined ||
      (x.id === "tone" &&
        (x.options ?? []).every((o) => GW_STANCES.some((t) => t === o.id))),
  );
  if (f === undefined || readsTone(a)) return [];
  const tone = GW_STANCES.find((x) => x === picks[f.id]?.[0]);
  const id = toneTarget(a, scene, cast);
  const p = id === null ? null : gw.person(id);
  if (tone === undefined || p === null) return [];
  const tag = personDef(p.id)?.tag;
  const who = { person: p.id };
  if (tag === seat.tag) {
    const fit = stanceFit(p, tone, "ask");
    const out: GwEffect[] = [
      { kind: "person_trust", who, delta: fit >= 0 ? 1 : -1 },
    ];
    const faction = ledBy(gw, seat, p.id);
    if (faction !== null && fit !== 0) {
      out.push({
        kind: "world",
        of: { do: "faction", id: faction, delta: fit > 0 ? -1 : 1 },
      });
    }
    return out;
  }
  const n = tag === undefined ? null : gw.nation(tag);
  if (tag === undefined || n === null || seatsOf(gw, tag).length > 0) return [];
  const row = GW_TONE_EFFECTS[tone][n.ai];
  const out: GwEffect[] = [];
  if (row.trust !== undefined)
    out.push({ kind: "trust", tag, delta: row.trust });
  if (row.readiness !== undefined && n.side === null) {
    out.push({
      kind: "world",
      of: { do: "readiness", tag, delta: row.readiness },
    });
  }
  return out;
}

/** The option picked in a field, if it has no effects of its own. */
function plainPick(
  a: GwAct,
  picks: Readonly<Record<string, readonly string[]>>,
  field: string,
): string | null {
  const f = (a.fields ?? []).find((x) => x.id === field);
  const id = picks[field]?.[0];
  const o = f?.options?.find((x) => x.id === id);
  return o === undefined || (o.effects ?? []).length > 0 ? null : o.id;
}

/**
 * What a pick does by itself (ww169): the tone of a letter, the subject of a
 * speech, the matter of a council. A pick with effects of its own keeps them.
 */
export function actRuleEffects(
  gw: GreatWar,
  seat: GwSeatState,
  a: GwAct,
  picks: Readonly<Record<string, readonly string[]>>,
  scene: GwScene,
  cast: Readonly<Record<string, string>>,
): GwEffect[] {
  const out = toneEffects(gw, seat, a, picks, scene, cast);
  const on = a.kind === "speech" ? plainPick(a, picks, "on") : null;
  const bloc = on === null ? undefined : GW_SUBJECT_BLOCS[on];
  if (bloc !== undefined) out.push({ kind: "opinion", bloc, delta: 1 });
  const agenda = plainPick(a, picks, "agenda");
  const lead = agenda === null ? undefined : GW_AGENDA_LEADS[agenda];
  if (lead === GW_AGENDA_ALL) {
    for (const id of [...new Set(Object.values(cast))]) {
      if (personDef(id)?.tag === seat.tag) {
        out.push({ kind: "person_trust", who: { person: id }, delta: 1 });
      }
    }
  } else if (lead !== undefined) {
    const p = holderOf(gw, seat, lead);
    if (p !== null) {
      out.push({ kind: "person_trust", who: { person: p.id }, delta: 1 });
    }
  }
  return out;
}
