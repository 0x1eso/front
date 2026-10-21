// World War 1936 P4 — the naval and air history beats (spec §17.6). The
// type is the foundation's (plan Task 1 Step 15); lane G (Task 13) fills the
// table; the AI lane (Task 10) acts on them. Region names are the world1936
// scenario's (resolveRegionName).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";

export interface NavalBeatDef {
  id: string;
  tag: CountryTag;
  from: string;
  to?: string;
  kind: "invade" | "port_strike" | "air_campaign" | "paradrop";
  targets: string[] /* region names */;
  vs?: CountryTag[];
  zoneHint?: string;
}

export const NAVAL_BEATS: readonly NavalBeatDef[] = [];
