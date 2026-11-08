import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, TemplateResult } from "lit";

/**
 * Period photographs of the cast: `resources/ww1914/faces/<person id>.webp`,
 * one row each in `faces/sources.json` (where it came from, its licence, the
 * crop). Only listed ids get a face, so a person without a photograph keeps
 * the monogram and nothing asks for a file that is not there.
 */
export const GW_FACES_INDEX = "ww1914/faces/sources.json";

export interface GwFaceRow {
  id: string;
}

/** The ids with a face, or an empty set when the index can't be had. */
export async function loadGwFaces(
  get: (path: string) => Promise<unknown> = async (path) => {
    const res = await fetch(assetUrl(path));
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json();
  },
): Promise<ReadonlySet<string>> {
  try {
    const d = (await get(GW_FACES_INDEX)) as { faces?: GwFaceRow[] };
    return new Set((d.faces ?? []).map((r) => r.id));
  } catch (e) {
    console.warn("Great War faces: no index", e);
    return new Set();
  }
}

export function faceUrl(id: string): string {
  return assetUrl(`ww1914/faces/${id}.webp`);
}

/**
 * A round face, or `fallback` (the monogram) for someone without one. `size`
 * and the other classes are the caller's, so each place keeps its look.
 */
export function gwFace(
  faces: ReadonlySet<string> | undefined,
  id: string,
  alt: string,
  cls: string,
  fallback: TemplateResult,
): TemplateResult {
  if (faces?.has(id) !== true) return fallback;
  return html`<img
    class="${cls} shrink-0 rounded-full border border-white/30 bg-white/10 object-cover"
    src=${faceUrl(id)}
    alt=${alt}
    loading="lazy"
    decoding="async"
    draggable="false"
    data-gw-face=${id}
  />`;
}
