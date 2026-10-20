import type { FactionId } from "@openfront/engine-api/ww1936/Countries";
import type { FactionKey } from "@openfront/engine-api/ww1936/PoliticsTypes";

/**
 * World War 1936: each faction's dot colour, the same in the lobby's country
 * picker, the top band and the diplomacy drawer. A module of its own, with
 * no element in it, so the lobby modals and the game HUD both import it.
 * P3: a faction made in the game (f3, f4…) takes the grey `other`.
 */
export const FACTION_DOT_CLASS: Readonly<Record<FactionId | "other", string>> =
  {
    axis: "bg-zinc-400",
    allies: "bg-sky-400",
    comintern: "bg-red-500",
    other: "bg-stone-500",
  };

/** The dot class of any faction key (P3 plan decision 8). */
export function factionDotClass(key: FactionKey): string {
  return key in FACTION_DOT_CLASS
    ? FACTION_DOT_CLASS[key as FactionId]
    : FACTION_DOT_CLASS.other;
}
