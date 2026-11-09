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
/**
 * Longer words that start with a name or a term: 카를스바트 isn't Karl, 부서진
 * isn't a countersignature. They are matched so nothing inside them is.
 */
const NOT_TERMS: readonly string[] = [
  "카를스바트",
  "부서지",
  "부서진",
  "부서질",
  "부서졌",
  "황태자비",
  "알베르트",
  "알베르티나",
];
/** Titles written as names: they mean the seat's own court. */
const TITLES: readonly string[] = ["황태자", "황후", "모후"];
/** One seat's text uses the name for two people: a card would often be wrong. */
const TWO_PEOPLE: Readonly<Partial<Record<GwTag, readonly string[]>>> = {
  GBR: ["윌슨"],
  // Paul in London, Jules at the Quai d'Orsay.
  FRA: ["캉봉"],
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
  const alts = [...byText.keys(), ...NOT_TERMS]
    .sort((a, b) => b.length - a.length)
    .map(escape);
  // A term starts a word: 사령부 isn't found inside 총사령부.
  return { re: new RegExp(`(?<![가-힣])(?:${alts.join("|")})`, "g"), byText };
}

/**
 * What one card or talk has already shown: a thing is underlined the first time
 * it is named, a person gets a title the first time (design: names with titles).
 */
export interface TextPass {
  linked: Set<string>;
  titled: Set<string>;
  /** The years before 1914: nobody holds the office the game gives them yet. */
  noTitles: boolean;
}

/** A fresh pass; `titled` are people the screen has already introduced. */
export function newPass(
  titled: readonly string[] = [],
  noTitles = false,
): TextPass {
  return { linked: new Set(), titled: new Set(titled), noTitles };
}

/** Words that already make a title of what stands next to a name. */
const TITLE_BEFORE =
  /(대신|총장|대사|장관|제독|장군|원수|황제|국왕|수상|총리|사령관|백작|대령|의장|공사|차관|총재|총독|교수|박사|서기장|시종|참모|공작|대공|교황|왕|황후|왕비)\s*$/;
const TITLE_AFTER =
  /^\s?(폐하|전하|각하|대신|총장|대사|장관|제독|장군|원수|백작|대령|의장|공사|차관|총재|총독|씨|박사|교수|공작|대공|황제|국왕)/;
/** A name that already carries its rank: 조지 왕, 막스 공. */
const NAME_TITLED = /(\s(왕|공|대공|대공녀|부인)|^(황후|황태자|모후|교황))$/;

/** True when the text next to the name already says this title. */
export function alreadyTitled(
  text: string,
  at: number,
  end: number,
  title: string,
): boolean {
  const word = title.split(/\s+/).pop() ?? title;
  const before = text.slice(Math.max(0, at - 14), at);
  const after = text.slice(end, end + 10);
  return (
    before.includes(word) ||
    TITLE_BEFORE.test(before) ||
    TITLE_AFTER.test(after) ||
    after.trimStart().startsWith(word)
  );
}

const LEAN_POST =
  /(대신|장관|수상|총리|총장|사령관|대사|공사|차관|총재|총독|대통령|국왕|왕|황제|차르|지도자|대표|의장|의원|장군|제독|대령|국장|서기|주치의|교수|교황|섭정|청장|주지사|왕세자|왕비|계승자)$/;

/** A lean that reads as a post or a standing, else null: "공동 재무대신". */
export function leanTitle(lean: string): string | null {
  const first = lean
    .split(/(?<=[.!?…])\s/)[0]
    ?.trim()
    .replace(/[.!?…]+$/, "");
  if (first === undefined || first === "" || first.length > 14) return null;
  if (/[,·]/.test(first)) return null;
  if (/(다|요|나|까)$/.test(first)) return null;
  if (/^(궁정|온건|강경|호랑이|폐하의)/.test(first)) return null;
  // Only a post: "막내딸" or "눈을 깜박이는 대령" describe, they aren't titles.
  if (/[는은던의] /.test(first)) return null;
  if (!LEAN_POST.test(first)) return null;
  return first;
}

/**
 * Marks the first time each thing is named, so a page isn't all underlines.
 * With a `pass` the memory spans every call that shares it (a whole card), and
 * `titleOf` puts a person's title before their name the first time.
 */
export function splitTerms(
  text: string,
  index: DictIndex,
  pass?: TextPass,
  titleOf?: (id: string) => string | null,
): DictPart[] {
  if (index.re === null) return [{ text, ref: null }];
  const out: DictPart[] = [];
  const seen = pass?.linked ?? new Set<string>();
  let at = 0;
  for (const m of text.matchAll(index.re)) {
    const ref = index.byText.get(m[0]);
    if (ref === undefined) continue;
    const key = `${ref.kind}.${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let lead = text.slice(at, m.index);
    if (
      pass !== undefined &&
      !pass.noTitles &&
      titleOf !== undefined &&
      ref.kind === "person" &&
      !pass.titled.has(ref.id)
    ) {
      pass.titled.add(ref.id);
      const title = NAME_TITLED.test(m[0]) ? null : titleOf(ref.id);
      if (
        title !== null &&
        !alreadyTitled(text, m.index, m.index + m[0].length, title)
      ) {
        lead += `${title} `;
      }
    }
    if (lead !== "") out.push({ text: lead, ref: null });
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
