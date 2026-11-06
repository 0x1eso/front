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
  DEU: ["crisis", "war", "people"],
  AUH: ["people", "crisis", "war", "realm", "crown"],
};

/** A share not written yet is no share: only the files that are there count. */
async function fragment(path: string, get: GwPackFetch): Promise<unknown> {
  try {
    return await get(path);
  } catch (e) {
    console.warn(`Great War text: no ${path}`, e);
    return null;
  }
}

/** Common text, the seat's country and its shares, validated, as one pack. */
export async function loadGwPack(
  tag: GwTag,
  get: GwPackFetch = fetchJson,
): Promise<GwPack> {
  const file = (f: string) => `ww1914/ko/${f}.json`;
  const shares = (GW_PACK_SHARES[tag] ?? []).map((x) => `${tag}.${x}`);
  const [main, parts] = await Promise.all([
    Promise.all(["common", tag].map((f) => get(file(f)))),
    Promise.all(shares.map((f) => fragment(file(f), get))),
  ]);
  const found = parts.filter((r) => r !== null);
  return mergeGwPacks([...main, ...found].map((r) => GwPackSchema.parse(r)));
}
