import type { FactionId } from "@openfront/engine-api/ww1936/Countries";

/**
 * World War 1936: each faction's dot colour, the same in the lobby's country
 * picker, the top band and the diplomacy drawer. A module of its own, with
 * no element in it, so the lobby modals and the game HUD both import it.
 */
export const FACTION_DOT_CLASS: Readonly<Record<FactionId, string>> = {
  axis: "bg-zinc-400",
  allies: "bg-sky-400",
  comintern: "bg-red-500",
};
