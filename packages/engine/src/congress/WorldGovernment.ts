import { WORLD_GOV_STEP_TICKS } from "@openfront/engine-lib/congress/CongressBalance";
import type { Game, Player } from "../game/Game";
import type { Congress, ItemResult } from "./Congress";

/**
 * One-shot effects of an adopted item. World government (spec §10.1):
 * approval moves the proclamation 600 ticks ahead and ratifies it,
 * rejection moves it 600 back (never past the start) and unratifies it.
 */
export function applyAdoption(mg: Game, c: Congress, result: ItemResult): void {
  if (result.item.resolution !== "world_government") return;
  if (result.adopted === null) return;
  const owner = mg.playerBySmallID(result.item.targets[0]);
  if (!owner.isPlayer()) return;
  const d = owner.domestic();
  const project = d?.victoryProject() ?? null;
  const host = Number(result.item.param);
  if (
    d === null ||
    project === null ||
    project.kind !== "political" ||
    project.hostUnitId !== host
  ) {
    return;
  }
  const ratified = result.adopted === "A";
  d.shiftVictoryProject(
    ratified ? -WORLD_GOV_STEP_TICKS : WORLD_GOV_STEP_TICKS,
  );
  c.setVerdict(owner.smallID(), { host, ratified });
}

/** A complete proclamation whose latest decision isn't an approval of this host: it waits (spec §10.1 step 6). */
export function awaitsRatification(mg: Game, player: Player): boolean {
  const c = mg.congress();
  if (c === null) return false;
  const project = player.domestic()?.victoryProject() ?? null;
  if (project === null || project.kind !== "political") return false;
  if (project.ticksLeft > 0) return false;
  const v = c.verdict(player.smallID());
  return !(v !== undefined && v.host === project.hostUnitId && v.ratified);
}

/**
 * Spec §10.3: whether nations may single out `player`'s victory project —
 * always without a congress; with one, only a science project under world
 * heritage B, or a proclamation whose latest decision was a rejection.
 */
export function isProjectCondemned(mg: Game, player: Player): boolean {
  const c = mg.congress();
  if (c === null) return true;
  const project = player.domestic()?.victoryProject() ?? null;
  if (project === null) return false;
  if (project.kind === "science") {
    return c
      .active()
      .some(
        (r) =>
          r.resolution === "world_heritage" &&
          r.option === "B" &&
          r.targets[0] === player.smallID(),
      );
  }
  const v = c.verdict(player.smallID());
  return v !== undefined && v.host === project.hostUnitId && !v.ratified;
}
