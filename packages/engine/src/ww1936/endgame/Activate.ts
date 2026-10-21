// P5 lane X fills this file (plan Task 5): waking a dormant slot, a
// country back from the dead, its name (spec §3.3–§3.5). The foundation's
// stub: the land moves (legal owner and control), the country is active
// and gets its executions; the economy, army and politics start are X's.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  ActivateOpts,
  CS_ACTIVE,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { transferRegionPeaceful } from "../land/PoliticsBridge";
import type { EffectCtx } from "../politics/Dispatch";
import type { WwEndgame } from "./WwEndgame";

/** Spec §3.3: `tag` wakes (or comes back) with `opts.regions`; its smallID (0: not in the game). */
export function activateCountry(
  eg: WwEndgame,
  tag: CountryTag,
  opts: ActivateOpts,
  tick: number,
): number {
  const id = eg.ww.scenario.smallIdOf(tag);
  if (id === 0) return 0;
  const p = eg.mg.playerBySmallID(id);
  if (!p.isPlayer()) return 0;
  for (const r of [...opts.regions].sort((a, b) => a - b)) {
    if (eg.ww.scenario.region(r) === undefined) continue;
    eg.ww.politics.setLegalOwner(r, id);
    transferRegionPeaceful(eg.ww.land, r, id, tick);
  }
  if (opts.nameKey !== undefined) eg.nameKey[id] = opts.nameKey;
  if (opts.nameArg !== undefined) eg.nameArg[id] = opts.nameArg;
  if (opts.color !== undefined) eg.color[id] = opts.color;
  eg.setCountryState(id, CS_ACTIVE);
  eg.dirtyCountries.add(id);
  eg.ww.clearCapitulation(id);
  eg.wakeQueue.push(id);
  return id;
}

/** Spec §3.4: a gone or exiled country holds land again: it plays on. */
export function landRegained(eg: WwEndgame, id: number, tick: number): void {
  void tick;
  eg.setCountryState(id, CS_ACTIVE);
  eg.ww.clearCapitulation(id);
  eg.wakeQueue.push(id);
}

/** release / create_state / restore_country / set_name effects (lane X). Stub: nothing. */
export function applyActivationEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  void ctx;
  void e;
  void actor;
}

/** Spec §6.4 release / liberate: the tags a conference over `stake` may free. Stub: none. */
export function releasableTags(
  eg: WwEndgame,
  stake: readonly number[],
): CountryTag[] {
  void eg;
  void stake;
  return [];
}
