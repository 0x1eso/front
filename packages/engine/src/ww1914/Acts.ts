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
import { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { inStage, makeCard, placeCard } from "./Desk";
import type { GreatWar } from "./GreatWar";
import {
  castOf,
  holds,
  personDef,
  runEffects,
  SceneCtx,
  sceneOf,
} from "./SceneRun";
import { ownPeople, seatPerson, stageOf } from "./World";

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
  return { id: f.id, options, tones, people, count };
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
  if (seat.acts <= 0) return "no_slot";
  const a = (gwContent().acts ?? []).find((x) => x.id === id);
  if (a === undefined || !actOpen(gw, seat, a)) return "no_act";
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
  seat.acts--;
  const ctx: SceneCtx = { gw, seat, cast, act: row };
  runEffects(ctx, a.effects ?? []);
  for (const o of chosen) runEffects(ctx, o.effects ?? []);
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
