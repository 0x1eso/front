// World War 1936 ww237: a civil-war side carries its own name. Every form a
// side of a country may take reads differently from every other one and
// from every country's name, in both languages; no slot ever reads
// "분리 국가".
import {
  CIVIL_WAR_SLOTS,
  COUNTRY_TAGS,
  type CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { CIVIL_WAR_NAMES } from "@openfront/engine-lib/ww1936/content/endgame/names";
import {
  civilWarNameKeys,
  type CivilWarNameKind,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Tree = Record<string, unknown>;
const LANGS = ["en", "ko"].map(
  (l) =>
    [
      l,
      JSON.parse(
        readFileSync(
          new URL(`../../resources/lang/${l}.json`, import.meta.url),
          "utf8",
        ),
      ) as Tree,
    ] as const,
);
function text(tree: Tree, key: string): string {
  let v: unknown = tree;
  for (const p of key.split(".")) v = (v as Tree | undefined)?.[p];
  if (typeof v !== "string") throw new Error(`missing ${key}`);
  return v;
}

const KINDS: CivilWarNameKind[] = [
  "democratic",
  "communist",
  "fascist",
  "neutral",
  "collab",
];
const SLOTS = new Set<string>(CIVIL_WAR_SLOTS);
const NAMED = COUNTRY_TAGS.filter((t) => !SLOTS.has(t)) as CountryTag[];

describe("ww237: civil-war names", () => {
  it("every side of a country has fifteen or more forms, all different from each other and from every country", () => {
    for (const [lang, tree] of LANGS) {
      const ww = tree.ww1936 as Tree;
      const countries = new Set<string>([
        ...Object.values(ww.country as Tree).map(String),
        ...Object.values(ww.rename as Tree).map(String),
      ]);
      for (const tag of NAMED) {
        const country = text(tree, `ww1936.country.${tag}`);
        for (const kind of KINDS) {
          const keys = civilWarNameKeys(tag, kind);
          expect(new Set(keys).size).toBe(keys.length);
          expect(keys.length).toBeGreaterThanOrEqual(CIVIL_WAR_SLOTS.length);
          const names = keys.map((k) =>
            text(tree, k).replace("{country}", country),
          );
          // e.g. FRA: "프랑스국" (own) vs "프랑스 국가" (the collaborators').
          expect(new Set(names).size, `${lang} ${tag}`).toBe(names.length);
          for (const n of names) {
            expect(countries.has(n), `${lang} ${tag} ${n}`).toBe(false);
          }
        }
      }
    }
  });

  it("a country's own name comes first, the template after; Spain keeps its names", () => {
    expect(civilWarNameKeys("DEU", "communist").slice(0, 3)).toEqual([
      "ww1936.cw_name.deu_communist",
      "ww1936.cw_name.communist",
      "ww1936.cw_name.communist_2",
    ]);
    expect(civilWarNameKeys("ESN", "communist")[0]).toBe(
      "ww1936.cw_name.communist",
    );
    const tags = new Set(CIVIL_WAR_NAMES.map((n) => n.tag));
    expect(tags.has("ESN") || tags.has("ESR")).toBe(false);
    for (const t of ["DEU", "GBR", "FRA", "ITA", "USA", "SUN", "JPN", "CHN"]) {
      expect(tags.has(t as CountryTag), t).toBe(true);
    }
    for (const n of CIVIL_WAR_NAMES) {
      expect(n.key).toBe(`ww1936.cw_name.${n.tag.toLowerCase()}_${n.ideology}`);
    }
  });

  it("no slot's own text says 분리 국가 (a missed spot reads a neutral name)", () => {
    for (const [, tree] of LANGS) {
      for (const t of CIVIL_WAR_SLOTS) {
        const s = text(tree, `ww1936.country.${t}`);
        expect(s).not.toMatch(/분리 국가|Breakaway/);
      }
    }
  });
});
