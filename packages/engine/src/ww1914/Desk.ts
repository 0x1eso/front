import {
  GwCard,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GreatWar } from "./GreatWar";
import { castOf, holds, pickVariant, SceneCtx } from "./SceneRun";

export const GW_DESK_MAX = 4;

/** A card for `scene`, or null when a cast role has nobody. */
export function makeCard(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
  origin: GwCard["origin"],
): GwCard | null {
  const cast = castOf(gw, seat, scene);
  if (cast === null) return null;
  const ctx: SceneCtx = { gw, seat, cast };
  return {
    uid: gw.s.nextCard++,
    scene: scene.id,
    variant: pickVariant(ctx, scene.variants),
    cast,
    origin,
    node: scene.kind === "talk" ? (scene.start ?? null) : null,
    chapter: gw.s.chapter,
  };
}

/** Whether the desk may deal `scene` now: everything but its `when`. */
function dealable(gw: GreatWar, seat: GwSeatState, scene: GwScene): boolean {
  if (scene.summon === true || !scene.nation.includes(seat.tag)) return false;
  const stage = gwChapters(gw.s.calendar)[gw.s.chapter].stage;
  if (scene.stage !== undefined && !scene.stage.includes(stage)) return false;
  const last = seat.seen[scene.id];
  if (last === undefined) return true;
  if (scene.once === true) return false;
  return gw.s.chapter - last > (scene.cooldown ?? 0);
}

/**
 * The plain deal: what is scheduled, then the most salient scenes that hold,
 * by id on a tie. The narrative lane replaces this function (design §5.2):
 * tags, the tension curve, seeded ties, recent games.
 */
export function dealDesk(gw: GreatWar, seat: GwSeatState): void {
  const scenes = gwContent().scenes;
  const byId = new Map(scenes.map((x) => [x.id, x]));
  const due: GwScene[] = [];
  seat.scheduled = seat.scheduled.filter((q) => {
    if (q.chapter > gw.s.chapter) return true;
    const scene = byId.get(q.scene);
    if (scene !== undefined) due.push(scene);
    return false;
  });
  const drawn = scenes
    .filter((x) => dealable(gw, seat, x))
    .filter((x) => {
      const cast = castOf(gw, seat, x);
      if (cast === null) return false;
      return x.when === undefined || holds({ gw, seat, cast }, x.when);
    })
    .sort((a, b) => b.salience - a.salience || (a.id < b.id ? -1 : 1));
  const room = Math.max(0, GW_DESK_MAX - due.length);
  const picked = [...due, ...drawn.slice(0, room)];
  const origin = (x: GwScene) => (due.includes(x) ? "scheduled" : "desk");
  for (const scene of picked) {
    const card = makeCard(gw, seat, scene, origin(scene));
    if (card === null) continue;
    seat.desk.push(card);
    seat.seen[scene.id] = gw.s.chapter;
  }
}
