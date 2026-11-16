// ww234: which minors play their own national tree. registry.ts's
// joinNations joins exactly these; the lobby's country picker marks them.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { NATIONS } from "./index";
import type { NationDef } from "./types";

/** A nation is live once it has focuses (types.ts): it plays its own tree. */
export function isLiveNation(n: NationDef): boolean {
  return n.focuses.length > 0;
}

/** The tags of the live nations, NATIONS order. */
export function liveNationTags(
  nations: readonly NationDef[] = NATIONS,
): CountryTag[] {
  return nations.filter(isLiveNation).map((n) => n.tag as CountryTag);
}
