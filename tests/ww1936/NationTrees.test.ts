// ww229 (design ww227 §4, §10): every minor's national content. The shape is
// checked for all of them; the lint runs on each live nation (one with
// focuses). A country lane runs:
//   nice -n 15 npx vitest tests/ww1936/NationTrees.test.ts --run --maxWorkers=1 -t <TAG>
import { BOP_TAGS } from "@openfront/engine-api/ww1936/DepthTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  FocusDef,
  IDEOLOGIES,
  isNationTree,
  NATION_TAGS,
  nationTier,
  NationTier,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { NATION_CORES } from "@openfront/engine-lib/ww1936/content/nations/cores";
import { NATIONS } from "@openfront/engine-lib/ww1936/content/nations/index";
import type {
  NationCore,
  NationDef,
} from "@openfront/engine-lib/ww1936/content/nations/types";
import {
  buildRegistry,
  CONTENT,
  CONTENT_PARTS_BASE,
  joinNations,
} from "@openfront/engine-lib/ww1936/content/registry";
import { histEntry, isHistCountry } from "@openfront/engine-lib/ww1936/hist/index";
import { histKindOf } from "@openfront/engine-lib/ww1936/hist/Slots";
import { BOP_DEFS } from "@openfront/engine-lib/ww1936/MechRules";
import { en, hasKey, keyIn, ko, walkEffects } from "./contentUtil";

// ---- the bands (design ww227 §3) ----
const FOCUS_BAND: Record<NationTier, [number, number]> = {
  A: [80, 120],
  B: [45, 60],
  C: [30, 35],
};
const POLITICAL_BAND: Record<NationTier, [number, number]> = {
  A: [4, 6],
  B: [3, 4],
  C: [2, 3],
};
/** Lower bounds: events, decisions, advisors, generals. */
const MIN_COUNTS: Record<NationTier, [number, number, number, number]> = {
  A: [15, 8, 8, 4],
  B: [6, 4, 4, 2],
  C: [3, 2, 2, 1],
};
/** No minor focus gives more than this share of the largest major focus's (§4). */
const CAP_PCT = 70;
const MAJOR_TREES = ["DEU", "GBR", "SUN", "ITA", "JPN", "FRA", "USA"];
/** Exact dates in text: "1938년 3월", "March 1938", "1938-03". */
const DATE_RE = [
  /1[89]\d\d년\s*\d{1,2}월/,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2},?\s+)?1[89]\d\d\b/,
  /\b1[89]\d\d-\d\d\b/,
];
const MIN_SOURCE = 8;

const numericCaps = (() => {
  const max = new Map<string, number>();
  for (const f of CONTENT.focuses) {
    if (!MAJOR_TREES.includes(f.tree)) continue;
    walkEffects(f.effects, (e) => {
      for (const [k, v] of Object.entries(e)) {
        if (typeof v !== "number") continue;
        const key = `${e.kind}.${k}`;
        max.set(key, Math.max(max.get(key) ?? 0, Math.abs(v)));
      }
    });
  }
  return max;
})();

const ideologyChange = (e: Effect) =>
  e.kind === "civil_war" || e.kind === "set_government";

/** Every focus reachable from a root without needing two exclusive focuses. */
function unreachable(focuses: readonly FocusDef[]): string[] {
  const by = new Map(focuses.map((f) => [f.id, f]));
  const excl = (a: string, b: string) =>
    (by.get(a)?.exclusive ?? []).includes(b);
  // Some consistent ancestor set exists (backtracking over the OR groups).
  const solve = (
    need: readonly string[],
    have: ReadonlySet<string>,
    depth: number,
  ): boolean => {
    if (depth > 400) return false;
    if (need.length === 0) return true;
    const [id, ...rest] = need;
    if (have.has(id)) return solve(rest, have, depth + 1);
    const f = by.get(id);
    if (f === undefined) return false;
    for (const h of have) if (excl(id, h)) return false;
    const next = new Set(have).add(id);
    const groups = f.prereq ?? [];
    const pick = (gi: number, acc: string[]): boolean => {
      if (gi === groups.length) return solve([...rest, ...acc], next, depth + 1);
      return groups[gi].some((p) => pick(gi + 1, [...acc, p]));
    };
    return pick(0, []);
  };
  return focuses
    .filter((f) => !solve([f.id], new Set(), 0))
    .map((f) => f.id);
}

/** Focus ids other content names (focus_done, focus_in_progress, beat focus acts). */
const NAMED_FOCUS_IDS: ReadonlySet<string> = (() => {
  const out = new Set<string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o !== null && typeof o === "object") {
      const r = o as Record<string, unknown>;
      if (
        (r.kind === "focus_done" || r.kind === "focus_in_progress") &&
        typeof r.id === "string"
      ) {
        out.add(r.id);
      }
      Object.values(r).forEach(walk);
    }
  };
  walk(CONTENT_PARTS_BASE.events);
  walk(CONTENT_PARTS_BASE.decisions);
  walk(CONTENT_PARTS_BASE.beats);
  for (const b of CONTENT_PARTS_BASE.beats) {
    if (b.act.kind === "focus") out.add(b.act.id);
  }
  return out;
})();

function textKeys(n: NationDef, core: NationCore): string[] {
  const k: string[] = [];
  for (const f of n.focuses) {
    k.push(`ww1936.focus.${f.id}`, `ww1936.focus_desc.${f.id}`);
    if (f.group !== undefined) k.push(`ww1936.focusui.group.${f.group}`);
  }
  for (const e of n.events) {
    k.push(`ww1936.event_title.${e.id}`, `ww1936.event_desc.${e.id}`);
    for (const o of e.options) k.push(`ww1936.event_opt.${e.id}.${o.id}`);
  }
  for (const d of n.decisions) {
    k.push(`ww1936.decision.${d.id}`, `ww1936.decision_desc.${d.id}`);
  }
  for (const s of n.spirits) {
    k.push(`ww1936.spirit.${s.id}`, `ww1936.spirit_desc.${s.id}`);
  }
  for (const p of n.persons) k.push(p.nameKey);
  for (const g of core.generals) k.push(`ww1936.general.${g.id}`);
  for (const e of core.equipment) k.push(`ww1936.hist.${e.id}`);
  return [...new Set(k)];
}

/** The lint of design ww227 §4 and §10: every problem, as text. */
export function lintNation(n: NationDef, core: NationCore): string[] {
  const bad: string[] = [];
  const t = n.tag;
  const tier = n.tier;
  const prefix = `${t.toLowerCase()}_`;
  const check = (ok: boolean, msg: string) => {
    if (!ok) bad.push(`${t}: ${msg}`);
  };
  // The tree builds and the country plays it.
  check(CONTENT.countryIdx.get(t)?.tree === t, "the country row plays its tree");
  check(
    CONTENT.treeFocuses[t].length === n.focuses.length,
    "every focus is in the tree",
  );
  const [lo, hi] = FOCUS_BAND[tier];
  check(
    n.focuses.length >= lo && n.focuses.length <= hi,
    `${n.focuses.length} focuses, tier ${tier} wants ${lo}-${hi}`,
  );
  // Political branches: groups of politics focuses that change the government.
  const pol = new Set<string>();
  for (const f of n.focuses) {
    check(f.tree === t && f.id.startsWith(prefix), `${f.id}: tree ${t}, id ${prefix}*`);
    check(f.group !== undefined, `${f.id}: no group`);
    check(f.effects.length > 0, `${f.id}: no effects (dead focus)`);
    check(f.ai !== undefined, `${f.id}: no ai weight`);
    let changes = false;
    walkEffects(f.effects, (e) => {
      if (ideologyChange(e)) changes = true;
      for (const [k, v] of Object.entries(e)) {
        if (typeof v !== "number") continue;
        const max = numericCaps.get(`${e.kind}.${k}`);
        if (max === undefined || max === 0) continue;
        const cap = Math.ceil((max * CAP_PCT) / 100);
        check(Math.abs(v) <= cap, `${f.id}: ${e.kind}.${k} ${v} over ${cap}`);
      }
    });
    if (f.branch === "politics" && changes && f.group !== undefined) {
      pol.add(f.group);
    }
  }
  const [plo, phi] = POLITICAL_BAND[tier];
  check(
    pol.size >= plo && pol.size <= phi,
    `${pol.size} political branches, tier ${tier} wants ${plo}-${phi}`,
  );
  for (const id of unreachable(n.focuses)) check(false, `${id}: unreachable`);
  // Counts.
  const [ev, de, adv, gen] = MIN_COUNTS[tier];
  check(n.events.length >= ev, `${n.events.length} events, wants ${ev}+`);
  check(n.decisions.length >= de, `${n.decisions.length} decisions, wants ${de}+`);
  const advisors = n.persons.filter((p) => p.roles.includes("advisor"));
  check(advisors.length >= adv, `${advisors.length} advisors, wants ${adv}+`);
  check(core.generals.length >= gen, `${core.generals.length} generals, wants ${gen}+`);
  const row = CONTENT.countryIdx.get(t);
  for (const ideo of IDEOLOGIES) {
    const has =
      row?.leaders[ideo] !== undefined ||
      CONTENT.personsOf
        .get(t)
        ?.some((p) => p.roles.includes("leader") && p.ideology === ideo);
    check(has === true, `no ${ideo} leader`);
  }
  // Sources.
  for (const p of n.persons) {
    check(p.source.length >= MIN_SOURCE, `${p.id}: no source`);
  }
  for (const g of core.generals) {
    check(g.source.length >= MIN_SOURCE, `${g.id}: no source`);
  }
  for (const e of core.equipment) {
    check(e.source.length >= MIN_SOURCE, `${e.id}: no source`);
  }
  // Texts: en and ko, no exact dates.
  for (const k of textKeys(n, core)) {
    check(hasKey(k), `${k}: en and ko`);
    const text = `${keyIn(en, k) ?? ""} ${keyIn(ko, k) ?? ""}`;
    for (const re of DATE_RE) check(!re.test(text), `${k}: an exact date`);
  }
  // The sheet.
  const bps = new Set(n.branchPoints.map((b) => b.id));
  for (const d of n.sheet.dilemmas) {
    check(bps.has(d.branchPoint), `sheet dilemma ${d.branchPoint}: no branch point`);
  }
  const people = new Set([
    ...n.persons.map((p) => p.id),
    ...core.generals.map((g) => g.id),
  ]);
  for (const id of n.sheet.people) check(people.has(id), `sheet person ${id}`);
  const gear = new Set([
    ...core.equipment.map((e) => e.id),
    ...core.startArms.map((r) => r.entry),
  ]);
  for (const id of n.sheet.equipment) check(gear.has(id), `sheet equipment ${id}`);
  for (const s of n.sheet.startSpirits) {
    check(CONTENT.spiritIdx.has(s), `sheet start spirit ${s}`);
  }
  // The old tree's ids other content names: aliased or dropped.
  const old = CONTENT_PARTS_BASE.countries.find((c) => c.tag === t)?.tree;
  for (const id of NAMED_FOCUS_IDS) {
    if (old === undefined || !CONTENT.posInTree[old].has(id)) continue;
    if (CONTENT.posInTree[t].has(id)) continue;
    check(
      n.aliases[id] !== undefined || n.dropped.includes(id),
      `${id} (old tree, named elsewhere): alias or drop`,
    );
  }
  for (const [from, to] of Object.entries(n.aliases)) {
    check(CONTENT.focusIdx.has(from), `alias from ${from}: no such focus`);
    check(CONTENT.posInTree[t].has(to), `alias to ${to}: not in the tree`);
  }
  return bad;
}

/** Korean focus and event descriptions used by two countries (copy-paste). */
function sharedKorean(live: readonly NationDef[]): string[] {
  const seen = new Map<string, string>();
  const bad: string[] = [];
  for (const n of live) {
    const keys = [
      ...n.focuses.map((f) => `ww1936.focus_desc.${f.id}`),
      ...n.events.map((e) => `ww1936.event_desc.${e.id}`),
    ];
    for (const k of keys) {
      const text = keyIn(ko, k);
      if (text === undefined || text.length < 12) continue;
      const first = seen.get(text);
      if (first !== undefined && first !== n.tag) {
        bad.push(`${n.tag} ${k}: same Korean as ${first}`);
      }
      seen.set(text, n.tag);
    }
  }
  return bad;
}

const LIVE = NATIONS.filter((n) => n.focuses.length > 0);
const coreOf = (t: string) => NATION_CORES.find((c) => c.tag === t)!;

describe("ww229 national content: the shape", () => {
  it("one nation and one core per tag, NATION_TAGS order, its tier", () => {
    expect(NATIONS.map((n) => n.tag)).toEqual([...NATION_TAGS]);
    expect(NATION_CORES.map((c) => c.tag)).toEqual([...NATION_TAGS]);
    for (const n of NATIONS) expect(n.tier, n.tag).toBe(nationTier(n.tag));
  });

  it("every nation has a country row and an AI character", () => {
    for (const n of NATIONS) {
      expect(CONTENT.countryIdx.has(n.tag), n.tag).toBe(true);
      expect(CONTENT.characterIdx.get(n.tag)?.lean, n.tag).toBe(
        n.character.lean,
      );
      for (const b of Object.values(n.character.routeBias ?? {})) {
        expect(b >= 0 && b <= 3, n.tag).toBe(true);
      }
    }
  });

  it("a nation without focuses changes nothing; a live one plays its tree", () => {
    for (const n of NATIONS) {
      const base = CONTENT_PARTS_BASE.countries.find((c) => c.tag === n.tag);
      const tree = CONTENT.countryIdx.get(n.tag)?.tree;
      expect(tree, n.tag).toBe(n.focuses.length > 0 ? n.tag : base?.tree);
    }
  });

  it("core rows: generals, balance of power, equipment and start arms resolve", () => {
    for (const c of NATION_CORES) {
      for (const g of c.generals) {
        expect(g.tag, g.id).toBe(c.tag);
        expect(GENERALS.includes(g), g.id).toBe(true);
      }
      for (const b of c.bop) {
        expect(b.tag, c.tag).toBe(c.tag);
        expect((BOP_TAGS as readonly string[]).includes(b.tag)).toBe(true);
        expect(BOP_DEFS.includes(b), c.tag).toBe(true);
        expect(b.spirits).toHaveLength(5);
        for (const s of b.spirits) {
          if (s !== null) expect(CONTENT.spiritIdx.has(s), s).toBe(true);
        }
      }
      for (const e of c.equipment) {
        expect(e.country, e.id).toBe(c.tag);
        expect(e.id.startsWith(`${c.tag.toLowerCase()}_`), e.id).toBe(true);
        expect(histEntry(e.id), e.id).toBe(e);
      }
      expect(isHistCountry(c.tag), c.tag).toBe(c.equipment.length > 0);
      for (const r of c.startArms) {
        const e = histEntry(r.entry);
        expect(e, r.entry).toBeDefined();
        expect(["tank", "plane"], r.entry).toContain(histKindOf(e!));
        expect(e!.country, r.entry).not.toBe(c.tag);
        expect(r.count >= 0 && r.source.length >= MIN_SOURCE, r.entry).toBe(
          true,
        );
      }
    }
  });
});

describe("ww229 national content: the lint", () => {
  it.each(LIVE.map((n) => [n.tag, n] as const))("%s passes", (_t, n) => {
    expect(lintNation(n, coreOf(n.tag))).toEqual([]);
  });

  it("no Korean description repeated across countries", () => {
    expect(sharedKorean(LIVE)).toEqual([]);
  });

  it("finds an unreachable focus, a dead focus and a missing alias", () => {
    const f = (id: string, extra: Partial<FocusDef> = {}): FocusDef => ({
      id,
      tree: "LUX",
      x: 0,
      y: 0,
      days: 70,
      branch: "politics",
      icon: "generic",
      effects: [{ kind: "pp", amount: 10 }],
      ai: { base: 1 },
      group: "lux_test",
      ...extra,
    });
    const a = f("lux_a", { exclusive: ["lux_b"] });
    const b = f("lux_b", { x: 1, exclusive: ["lux_a"] });
    const c = f("lux_c", { y: 1, prereq: [["lux_a"], ["lux_b"]] });
    expect(unreachable([a, b, c])).toEqual(["lux_c"]);
    const lux = NATIONS.find((n) => n.tag === "LUX")!;
    const fake: NationDef = { ...lux, focuses: [a, b, f("lux_d", { y: 2, effects: [] })] };
    const parts = joinNations(CONTENT_PARTS_BASE, [fake]);
    expect(parts.countries.find((x) => x.tag === "LUX")?.tree).toBe("LUX");
    const reg = buildRegistry(parts);
    expect(reg.treeFocuses.LUX).toHaveLength(3);
    const msgs = lintNation(fake, coreOf("LUX")).join("\n");
    expect(msgs).toContain("lux_d: no effects");
    expect(msgs).toContain("focuses, tier C wants 30-35");
    expect(isNationTree("LUX")).toBe(true);
  });
});
