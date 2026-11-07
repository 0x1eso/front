import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_REPLAY_COUNTS } from "./gw_replay_counts";

/**
 * Common scenes come in every seat's games, and the lobby list remembers two
 * games: a scene that comes each game reads as seen until the bodies open to it
 * number five or more. This lays more bodies beside the ones that actually come.
 * `GW_REPLAY_COUNTS` says, per scene, how many beside which body: `base: 4` adds
 * `base_r1` to `base_r4`, each with `base`'s condition, so each is drawn exactly
 * when `base` is. Data only; the text sits with each scene in
 * resources/ww1914/ko/common*.json, and fits every seat.
 */
export function gwReplayId(like: string, n: number): string {
  return `${like}_r${n}`;
}

function withBodies(s: GwScene): GwScene {
  const counts = GW_REPLAY_COUNTS[s.id];
  if (counts === undefined) return s;
  const variants = [...s.variants];
  for (const [like, count] of Object.entries(counts)) {
    const at = variants.findIndex((v) => v.id === like);
    if (at < 0) throw new Error(`${s.id}: no body ${like}`);
    const { when } = variants[at];
    const added = Array.from({ length: count }, (_, i) => {
      const id = gwReplayId(like, i + 1);
      return when === undefined ? { id } : { id, when };
    });
    variants.splice(at, 0, ...added);
  }
  return { ...s, variants };
}

/** The scenes with the common pass laid over them. */
export function withCommonBodies(scenes: readonly GwScene[]): GwScene[] {
  return scenes.map(withBodies);
}
