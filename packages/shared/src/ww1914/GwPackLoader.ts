import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GwPack,
  GwPackSchema,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import { assetUrl } from "../AssetUrls";

/** Where a pack's JSON comes from: fetch in the browser, the disk in tests. */
export type GwPackFetch = (path: string) => Promise<unknown>;

const fetchJson: GwPackFetch = async (path) => {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

/**
 * Writing shares of a country's text: `<TAG>.<share>.json` beside `<TAG>.json`.
 * Each writer owns a file; the loader joins them into the one pack.
 */
export const GW_PACK_SHARES: Readonly<
  Partial<Record<GwTag, readonly string[]>>
> = {
  DEU: [
    "crisis",
    "war",
    "people",
    "back",
    "peace",
    "front",
    "sea",
    "home",
    "court",
    "budget",
    "laws",
    "ruler",
    "gov",
    "private",
    "press",
    "acts",
    "act",
  ],
  GBR: [
    "crisis",
    "war",
    "home",
    "world",
    "budget",
    "laws",
    "ruler",
    "gov",
    "private",
    "press",
    "acts",
  ],
  AUH: [
    "crisis",
    "war",
    "realm",
    "crown",
    "budget",
    "laws",
    "ruler",
    "gov",
    "private",
    "press",
    "acts",
  ],
  RUS: [
    "crisis",
    "front",
    "home",
    "fall",
    "budget",
    "laws",
    "ruler",
    "gov",
    "private",
    "press",
    "acts",
  ],
};

/** The same for `common.json`: every seat loads these. */
export const GW_COMMON_SHARES: readonly string[] = [
  "war",
  "people",
  "dip",
  "neutral",
  "world",
  "frame",
  "budget",
  "laws",
  "ruler",
  "dict",
  "acts",
];
/**
 * Casts in files of their own. Every seat loads them: a scene can cast another
 * country's minister, and a name is all it needs.
 */
export const GW_PEOPLE_PACKS: readonly string[] = [
  "DEU.cast",
  "GBR.people",
  "AUH.people",
  "RUS.people",
  "RUS.kin",
];

/** A share not written yet is no share: only the files that are there count. */
async function fragment(path: string, get: GwPackFetch): Promise<unknown> {
  try {
    return await get(path);
  } catch (e) {
    console.warn(`Great War text: no ${path}`, e);
    return null;
  }
}

/** Common text, the seat's country, its shares and the casts, as one pack. */
export async function loadGwPack(
  tag: GwTag,
  get: GwPackFetch = fetchJson,
): Promise<GwPack> {
  const file = (f: string) => `ww1914/ko/${f}.json`;
  const shares = [
    ...GW_COMMON_SHARES.map((x) => `common.${x}`),
    ...(GW_PACK_SHARES[tag] ?? []).map((x) => `${tag}.${x}`),
    ...GW_PEOPLE_PACKS,
  ];
  const [main, parts] = await Promise.all([
    Promise.all(["common", tag].map((f) => get(file(f)))),
    Promise.all(shares.map((f) => fragment(file(f), get))),
  ]);
  const found = parts.filter((r) => r !== null && r !== undefined);
  return mergeGwPacks([...main, ...found].map((r) => GwPackSchema.parse(r)));
}
