// P4 Task 13 (lane G): the starting navies, ship names and fleet names
// against the real world1936 scenario and the translation files.
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import {
  SHIP_CLASSES,
  SHIP_GENS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  FLEET_NAMES,
  SHIP_NAMES,
} from "@openfront/engine-lib/ww1936/ShipNames";
import {
  START_NAVY,
  START_PLANES,
} from "@openfront/engine-lib/ww1936/StartNavy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const readJson = (rel: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const scenario = readJson("resources/maps/world1936/scenario.json");
const en = readJson("resources/lang/en.json").ww1936;
const ko = readJson("resources/lang/ko.json").ww1936;

/** StartFleetDef.counts order. */
const COUNT_ORDER = ["bb", "bc", "cv", "ca", "cl", "dd", "ss"] as const;
/** Spec §6.1 (BB BC CV CA CL DD SS). */
const SPEC_61: Record<string, readonly number[]> = {
  GBR: [12, 3, 6, 16, 33, 110, 45],
  USA: [15, 0, 3, 15, 10, 100, 55],
  JPN: [6, 4, 4, 12, 21, 95, 55],
  FRA: [5, 0, 1, 7, 6, 60, 70],
  ITA: [4, 0, 0, 7, 12, 50, 70],
  DEU: [2, 0, 0, 3, 6, 12, 18],
  SUN: [3, 0, 0, 0, 3, 18, 60],
};
/** Spec §6.5 starting dockyards. */
const START_DOCKS: Record<string, number> = {
  DEU: 8,
  ITA: 9,
  JPN: 14,
  GBR: 20,
  FRA: 10,
  USA: 16,
  SUN: 8,
  NLD: 3,
  SWE: 2,
  ESR: 2,
  ESN: 2,
  CAN: 2,
  AUS: 2,
};
/** P1 EconomyStart fighters / bombers the spec §12.4 split must sum to. */
const P1_PLANES: Record<string, readonly [number, number]> = {
  DEU: [650, 700],
  ITA: [700, 600],
  JPN: [900, 600],
  GBR: [900, 800],
  FRA: [800, 700],
  USA: [900, 600],
  SUN: [2500, 2000],
};
const BANNED_WORDS = [
  /swastika/i,
  /rising sun/i,
  /kamikaze/i,
  /kaiten/i,
  /special attack/i,
  /하켄크로이츠/,
  /욱일/,
  /가미카제/,
  /특공/,
  /회천/,
];

function resolveCoastal(name: string): { ok: boolean; why: string } {
  const hits = scenario.regions.filter(
    (r: { name: string }) => r.name === name,
  );
  if (hits.length !== 1)
    return { ok: false, why: `${hits.length} regions named "${name}"` };
  // Map v4 (P4 pre-flight §0-10): a harbour zone and a naval base, not just
  // a coast (a lake shore is coastal too).
  const r = hits[0] as { harbor?: number; navalBase?: number };
  if ((r.harbor ?? 0) === 0)
    return { ok: false, why: `"${name}" has no harbour` };
  return (r.navalBase ?? 0) >= 1
    ? { ok: true, why: "" }
    : { ok: false, why: `"${name}" has no naval base` };
}
const isNumbered = (cls: string) => cls === "dd" || cls === "ss";

describe("starting navies (spec §6)", () => {
  it("every base, fleet base and line port is a world1936 region with a harbour and a naval base", () => {
    const bad: string[] = [];
    for (const n of START_NAVY) {
      const names = [
        ...n.bases,
        ...n.fleets.map((f) => f.base),
        ...n.lines.flatMap((l) => (l.port ? [l.port] : [])),
      ];
      for (const name of names) {
        const r = resolveCoastal(name);
        if (!r.ok) bad.push(`${n.tag}: ${r.why}`);
      }
      for (const f of n.fleets)
        if (!n.bases.includes(f.base))
          bad.push(`${n.tag}: fleet base ${f.base} is not a listed base`);
    }
    expect(bad).toEqual([]);
  });

  it("no Japanese base, fleet or line sits in a Korean or Taiwanese region (controller ruling)", () => {
    const zones = (scenario.strategic as { name: string; members: number[] }[])
      .filter((z) => z.name === "Korean Peninsula" || z.name === "Taiwan")
      .flatMap((z) => z.members);
    expect(zones.length).toBe(12);
    const names = new Set(
      (scenario.regions as { id: number; name: string }[])
        .filter((r) => zones.includes(r.id))
        .map((r) => r.name),
    );
    const jpn = START_NAVY.find((n) => n.tag === "JPN")!;
    const used = [
      ...jpn.bases,
      ...jpn.fleets.map((f) => f.base),
      ...jpn.lines.flatMap((l) => (l.port ? [l.port] : [])),
    ];
    expect(used.filter((n) => names.has(n))).toEqual([]);
  });

  it("each country appears once and its fleets hold exactly its ships", () => {
    const seen = new Set<string>();
    for (const n of START_NAVY) {
      expect(COUNTRY_TAGS).toContain(n.tag);
      expect(seen.has(n.tag), n.tag).toBe(false);
      seen.add(n.tag);
      const ships = COUNT_ORDER.map(
        (c) => n.ships.filter((s) => s.cls === c).length,
      );
      const fleets = COUNT_ORDER.map((_, i) =>
        n.fleets.reduce((a, f) => a + f.counts[i], 0),
      );
      expect(fleets, n.tag).toEqual(ships);
      expect(n.ships.length, n.tag).toBe(ships.reduce((a, b) => a + b, 0));
    }
  });

  it("the majors are within 20% of the spec §6.1 table", () => {
    for (const [tag, spec] of Object.entries(SPEC_61)) {
      const n = START_NAVY.find((x) => x.tag === tag);
      expect(n, tag).toBeDefined();
      const total = n!.ships.length;
      const want = spec.reduce((a, b) => a + b, 0);
      expect(
        Math.abs(total - want) * 5,
        `${tag} ${total} vs ${want}`,
      ).toBeLessThanOrEqual(want);
      COUNT_ORDER.forEach((c, i) => {
        const got = n!.ships.filter((s) => s.cls === c).length;
        expect(
          Math.abs(got - spec[i]) * 5,
          `${tag} ${c} ${got} vs ${spec[i]}`,
        ).toBeLessThanOrEqual(spec[i]);
      });
    }
  });

  it("generations exist, capital ships and cruisers are named, destroyers and submarines numbered", () => {
    for (const n of START_NAVY) {
      for (const s of [...n.ships, ...n.lines]) {
        expect(SHIP_CLASSES).toContain(s.cls);
        expect(s.gen, `${n.tag} ${s.cls}`).toBeGreaterThanOrEqual(1);
        expect(s.gen, `${n.tag} ${s.cls}`).toBeLessThanOrEqual(
          SHIP_GENS[s.cls],
        );
      }
      for (const s of n.ships)
        expect(s.name === undefined, `${n.tag} ${s.cls} ${s.name}`).toBe(
          isNumbered(s.cls),
        );
      for (const l of n.lines) {
        expect(l.names.length, `${n.tag} ${l.cls}`).toBe(
          isNumbered(l.cls) ? 0 : l.count,
        );
        expect(l.progressPct).toBeGreaterThanOrEqual(0);
        expect(l.progressPct).toBeLessThan(100);
      }
    }
  });

  it("the starting naval lines fit in the spec §6.5 dockyards", () => {
    for (const n of START_NAVY) {
      const docks = n.lines.reduce((a, l) => a + l.docks, 0);
      expect(docks, n.tag).toBeLessThanOrEqual(START_DOCKS[n.tag] ?? 0);
    }
  });

  it("named ships are unique and never come back from the name lists", () => {
    const start = new Map<string, string>();
    for (const n of START_NAVY) {
      for (const name of [
        ...n.ships.flatMap((s) => (s.name ? [s.name] : [])),
        ...n.lines.flatMap((l) => l.names),
      ]) {
        expect(start.has(name), name).toBe(false);
        start.set(name, n.tag);
      }
    }
    for (const [tag, byClass] of Object.entries(SHIP_NAMES)) {
      const seen = new Set<string>();
      for (const [cls, list] of Object.entries(byClass ?? {})) {
        expect(isNumbered(cls), `${tag} ${cls}`).toBe(false);
        for (const name of list ?? []) {
          expect(seen.has(name), `${tag} ${name}`).toBe(false);
          seen.add(name);
          expect(
            start.has(name),
            `${tag} ${name} is already at sea or building`,
          ).toBe(false);
        }
      }
    }
  });

  it("every ship name and fleet name has English and Korean text", () => {
    const missing: string[] = [];
    const need = (group: string, id: string) => {
      if (typeof en[group]?.[id] !== "string" || en[group][id] === "")
        missing.push(`en ${group}.${id}`);
      if (typeof ko[group]?.[id] !== "string" || ko[group][id] === "")
        missing.push(`ko ${group}.${id}`);
    };
    for (const n of START_NAVY) {
      for (const s of n.ships) if (s.name) need("ship", s.name);
      for (const l of n.lines) for (const name of l.names) need("ship", name);
      for (const f of n.fleets) need("fleet", f.key);
    }
    for (const byClass of Object.values(SHIP_NAMES))
      for (const list of Object.values(byClass ?? {}))
        for (const name of list ?? []) need("ship", name);
    for (const k of FLEET_NAMES) need("fleet", k);
    expect(missing).toEqual([]);
  });

  it("FLEET_NAMES lists every starting fleet once, in table order", () => {
    expect([...FLEET_NAMES]).toEqual(
      START_NAVY.flatMap((n) => n.fleets.map((f) => f.key)),
    );
  });

  it("no naval ensign or banned word in ship and fleet names (spec §22)", () => {
    const bad: string[] = [];
    for (const group of ["ship", "fleet"])
      for (const lang of [en, ko])
        for (const [k, v] of Object.entries(lang[group] ?? {}))
          if (BANNED_WORDS.some((re) => re.test(v as string)))
            bad.push(`${group}.${k}`);
    expect(bad).toEqual([]);
  });

  it("the starting air split adds up to the P1 fighters and bombers (spec §12.4)", () => {
    for (const [tag, [fighters, bombers]] of Object.entries(P1_PLANES)) {
      const a = START_PLANES[tag as keyof typeof START_PLANES]!;
      expect(a, tag).toHaveLength(10);
      // AIR_TYPES: fighter, bomber, heavy_fighter, cas, naval_bomber,
      // strat_bomber, transport_plane, cv_fighter, cv_cas, cv_naval_bomber
      expect(a[0] + a[2] + a[7], tag).toBe(fighters);
      expect(a[1] + a[3] + a[4] + a[5] + a[6] + a[8] + a[9], tag).toBe(bombers);
    }
  });
});
