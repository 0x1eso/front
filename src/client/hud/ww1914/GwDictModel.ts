// Great War 1914: the dictionary's plain logic (no DOM). A name or term in any
// text can be tapped. Everything here reads what the seat may know: an entry
// tied to a secret doesn't exist until the seat has found that secret.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";

export interface DictRef {
  kind: "term" | "person";
  id: string;
}

export interface DictIndex {
  /** Null with nothing to find. */
  re: RegExp | null;
  byText: ReadonlyMap<string, DictRef>;
}

/** Text split at the terms it holds. */
export interface DictPart {
  text: string;
  ref: DictRef | null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Names of one letter are ordinary syllables in running Korean. */
const SHORTEST = 2;

/** A name that is also a common word: 버티 is Bertie and 버티다. */
const NOT_NAMES: readonly string[] = ["버티"];
/** Titles written as names: they mean the seat's own court. */
const TITLES: readonly string[] = ["황태자", "황후", "모후"];
/** One seat's text uses the name for two people: a card would often be wrong. */
const TWO_PEOPLE: Readonly<Partial<Record<GwTag, readonly string[]>>> = {
  GBR: ["윌슨"],
};

/** What can be looked up by this seat, with what it has found so far. */
export function dictIndex(
  pack: GwPack | null,
  tag: GwTag,
  known: readonly string[],
): DictIndex {
  const byText = new Map<string, DictRef>();
  for (const [id, e] of Object.entries(pack?.dict ?? {})) {
    if (e.secret !== undefined && !known.includes(e.secret)) continue;
    if (e.tags !== undefined && !e.tags.includes(tag)) continue;
    for (const t of e.terms) byText.set(t, { kind: "term", id });
  }
  const own = `${tag.toLowerCase()}_`;
  const rank = (id: string) =>
    id.startsWith(own) ? 0 : id.startsWith("usa_") ? 1 : 2;
  const people = Object.entries(pack?.people ?? {}).sort(
    ([a], [b]) => rank(a) - rank(b),
  );
  for (const [id, p] of people) {
    if (p.name.length < SHORTEST || byText.has(p.name)) continue;
    if (NOT_NAMES.includes(p.name)) continue;
    if (TWO_PEOPLE[tag]?.includes(p.name)) continue;
    if (TITLES.includes(p.name) && !id.startsWith(own)) continue;
    byText.set(p.name, { kind: "person", id });
  }
  if (byText.size === 0) return { re: null, byText };
  const alts = [...byText.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escape);
  // A term starts a word: 사령부 isn't found inside 총사령부.
  return { re: new RegExp(`(?<![가-힣])(?:${alts.join("|")})`, "g"), byText };
}

/** Marks the first time each thing is named, so a page isn't all underlines. */
export function splitTerms(text: string, index: DictIndex): DictPart[] {
  if (index.re === null) return [{ text, ref: null }];
  const out: DictPart[] = [];
  const seen = new Set<string>();
  let at = 0;
  for (const m of text.matchAll(index.re)) {
    const ref = index.byText.get(m[0])!;
    const key = `${ref.kind}.${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (m.index > at) out.push({ text: text.slice(at, m.index), ref: null });
    out.push({ text: m[0], ref });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), ref: null });
  return out;
}

/** What the card says of a term: the entry and each line now found. */
export function dictLines(
  pack: GwPack | null,
  id: string,
  known: readonly string[],
): string[] {
  const e = pack?.dict?.[id];
  if (e === undefined) return [];
  if (e.secret !== undefined && !known.includes(e.secret)) return [];
  const more = (e.more ?? []).filter((x) => known.includes(x.secret));
  return [e.text, ...more.map((x) => x.text)];
}
