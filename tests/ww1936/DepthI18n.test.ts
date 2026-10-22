// World War 1936 P6 (plan Task 21): the depth screens' texts exist in en and
// ko with the same keys and the same ICU arguments, and the Korean text keeps
// its arguments clear of a following Hangul particle.
import IntlMessageFormat from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { en, hasKey, keyIn, ko } from "./contentUtil";

// The screen namespaces lane T owns (under "ww1936.").
const SCREEN_NS = [
  "doctrine",
  "command",
  "ag",
  "design",
  "mio",
  "market",
  "licence",
  "intel",
  "crypto",
  // "fog" went in batch P6-2: no screen read it (the fog's "?" and "~"
  // are engine-lib fogCountLabel's language-neutral glyphs).
  "project_ui",
  "nuke",
  "rocket",
  "raid_ui",
  "congress",
  "bop",
  "treaty",
  "faction_ui",
  "energy",
  "region_status",
  "cfocus_ui",
];

// Decision 35: the 27 notification keys, and the three world-news keys.
const EVENTS = [
  "mastery_level",
  "design_saved",
  "mio_size",
  "licence_granted",
  "licence_denied",
  "licence_ended",
  "market_sale",
  "operative_captured",
  "operation_done",
  "operation_failed",
  "decrypted",
  "codes_broken",
  "project_milestone",
  "project_done",
  "nuke_dropped",
  "nuke_intercepted",
  "rocket_strike",
  "raid_result",
  "dam_destroyed",
  "scorched",
  "ace",
  "energy_shortage",
  "congress_threshold",
  "faction_goal",
  "trait_unlocked",
  "fm_promoted",
  "operative_released",
].map((k) => `events_display.ww1936_${k}`);
const NEWS = [
  "news_atomic_test",
  "news_nuke_dropped",
  "news_dam_destroyed",
].map((k) => `ww1936.news.${k}`);

// Arguments that stand for numbers: a unit may follow them directly in Korean
// ("{n}개", "{days}일"). Every other argument is a name or a phrase and needs
// a space before Hangul (a particle after a name is wrong half the time).
const NUMERIC = new Set([
  "n",
  "x",
  "days",
  "pct",
  "pp",
  "cp",
  "xp",
  "cost",
  "have",
  "need",
  "max",
  "min",
  "level",
  "size",
  "gain",
  "count",
  "gen",
  "year",
  "price",
  "line",
  "stock",
  "divisions",
  "factories",
  "destroyed",
  "stopped",
  "total",
  "coal",
  "hydro",
  "plants",
  "demand",
  "value",
  "amount",
  "band",
  "fee",
  "free",
  "atk",
  "def",
  "plan",
  "log",
]);
// The brief gives this Korean frame verbatim: "{base} {gun}형" (a type suffix).
const HANGUL_AFTER_ARG_OK = new Set(["ww1936.design.auto_gun"]);

function flatten(o: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof o === "string") {
    out.set(prefix, o);
    return;
  }
  if (o !== null && typeof o === "object") {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      flatten(v, prefix === "" ? k : `${prefix}.${k}`, out);
    }
  }
}

function allKeys(json: unknown): Map<string, string> {
  const out = new Map<string, string>();
  flatten(json, "", out);
  return out;
}

const ENK = allKeys(en);
const KOK = allKeys(ko);
const ownKeys = (m: Map<string, string>): string[] =>
  [...m.keys()].filter(
    (k) =>
      SCREEN_NS.some((ns) => k.startsWith(`ww1936.${ns}.`)) ||
      EVENTS.includes(k) ||
      NEWS.includes(k),
  );

interface AstEl {
  type: number;
  value?: string;
  options?: Record<string, { value: AstEl[] }>;
}
/** Names of the arguments of an ICU message (plural and select branches included). */
function args(msg: string): string[] {
  const names = new Set<string>();
  const walk = (els: AstEl[]): void => {
    for (const e of els) {
      // 1 argument, 2 number, 3 date, 4 time, 5 select, 6 plural
      if (e.type >= 1 && e.type <= 6 && e.value !== undefined) {
        names.add(e.value);
      }
      if (e.options !== undefined) {
        for (const o of Object.values(e.options)) walk(o.value);
      }
    }
  };
  walk(new IntlMessageFormat(msg, "en").getAst() as unknown as AstEl[]);
  return [...names].sort();
}

/** `}` followed directly by Hangul, with the text inside the braces. */
function hangulAfterArg(msg: string): string[] {
  const bad: string[] = [];
  for (let i = 0; i < msg.length - 1; i++) {
    if (msg[i] !== "}" || !/[가-힣]/.test(msg[i + 1])) continue;
    let depth = 0;
    let j = i;
    for (; j >= 0; j--) {
      if (msg[j] === "}") depth++;
      else if (msg[j] === "{") {
        depth--;
        if (depth === 0) break;
      }
    }
    const inner = msg.slice(j + 1, i);
    const name = inner.split(",")[0].trim();
    if (/^\w+(\s*,\s*number\b.*)?$/.test(inner) && NUMERIC.has(name)) continue;
    bad.push(inner);
  }
  return bad;
}

describe("P6 depth screen texts", () => {
  it("has the screen namespaces in both languages", () => {
    for (const ns of SCREEN_NS) {
      const e = [...ENK.keys()].filter((k) => k.startsWith(`ww1936.${ns}.`));
      expect(e.length, `en ww1936.${ns}`).toBeGreaterThan(0);
      expect(
        [...KOK.keys()].filter((k) => k.startsWith(`ww1936.${ns}.`)).length,
        `ko ww1936.${ns}`,
      ).toBe(e.length);
    }
  });

  it("has the same keys in en and ko", () => {
    const e = ownKeys(ENK).sort();
    const k = ownKeys(KOK).sort();
    expect(k).toEqual(e);
    // 316 after batch P6-2 dropped the keys no screen reads (was 437).
    expect(e.length).toBeGreaterThanOrEqual(316);
  });

  it("has every text non-empty, and ko actually translated", () => {
    for (const key of ownKeys(ENK)) {
      const e = ENK.get(key) ?? "";
      const k = KOK.get(key) ?? "";
      expect(e.length, key).toBeGreaterThan(0);
      expect(k.length, key).toBeGreaterThan(0);
      if (k === e) {
        // Only argument-and-symbol frames may match.
        const plain = e.replace(/\{[^}]*\}/g, "").replace(/[^A-Za-z]/g, "");
        expect(plain.length, `${key} is untranslated`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("uses the same ICU arguments in en and ko, and both parse", () => {
    for (const key of ownKeys(ENK)) {
      const a = args(ENK.get(key) ?? "");
      const b = args(KOK.get(key) ?? "");
      expect(b, key).toEqual(a);
    }
  });

  it("keeps a space between a Korean argument and the Hangul after it", () => {
    for (const key of ownKeys(KOK)) {
      if (HANGUL_AFTER_ARG_OK.has(key)) continue;
      expect(hangulAfterArg(KOK.get(key) ?? ""), key).toEqual([]);
    }
  });

  it("has the brief's verbatim frames", () => {
    expect(keyIn(ko, "ww1936.doctrine.days")).toBe("약 {days}일");
    expect(keyIn(ko, "ww1936.doctrine.per_day")).toBe("+{x}/일");
    expect(keyIn(ko, "ww1936.doctrine.next")).toMatch(/^다음: /);
    expect(keyIn(en, "ww1936.design.auto")).toBe("{base} {role}");
    expect(keyIn(ko, "ww1936.design.auto")).toBe("{base} {role}");
    expect(keyIn(ko, "ww1936.design.auto_gun")).toBe("{base} {gun}형");
  });

  it("has the 27 notification keys and the world news in both languages", () => {
    expect(EVENTS).toHaveLength(27);
    for (const key of [...EVENTS, ...NEWS]) {
      expect(hasKey(key), key).toBe(true);
    }
  });

  it("leaves the content-name namespaces to K5", () => {
    for (const ns of [
      "gd",
      "subdoc",
      "module",
      "codename",
      "track",
      "mio_trait",
    ]) {
      const mine = [...ENK.keys()].filter((k) => k.startsWith(`ww1936.${ns}.`));
      // Whatever K5 added is theirs; lane T never lists these in SCREEN_NS.
      expect(SCREEN_NS).not.toContain(ns);
      expect(mine.every((k) => KOK.has(k))).toBe(true);
    }
  });
});
