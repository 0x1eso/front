import { GwPack, GwPackSchema, mergeGwPacks } from "@openfront/engine-api/ww1914/GwPack";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { assetUrl } from "../AssetUrls";

/** Where a pack's JSON comes from: fetch in the browser, the disk in tests. */
export type GwPackFetch = (path: string) => Promise<unknown>;

const fetchJson: GwPackFetch = async (path) => {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

/** Common text and the seat's country, validated, as one pack. */
export async function loadGwPack(
  tag: GwTag,
  get: GwPackFetch = fetchJson,
): Promise<GwPack> {
  const files = ["common", tag].map((f) => `ww1914/ko/${f}.json`);
  const raw = await Promise.all(files.map(get));
  return mergeGwPacks(raw.map((r) => GwPackSchema.parse(r)));
}
