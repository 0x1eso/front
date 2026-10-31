// P4 Task 13 (lane G): the admirals and the navy/air chief advisors.
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { ADMIRAL_TRAITS } from "@openfront/engine-api/ww1936/NavyTypes";
import { ADMIRALS } from "@openfront/engine-lib/ww1936/Admirals";
import { P4_PERSONS } from "@openfront/engine-lib/ww1936/AirChiefs";
import { SPIRITS_P4 } from "@openfront/engine-lib/ww1936/content/spirits/p4";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const readJson = (rel: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const en = readJson("resources/lang/en.json").ww1936;
const ko = readJson("resources/lang/ko.json").ww1936;

/** The old exclusion list was abolished 2026-10-31; only the two still without a card stay. */
const BANNED_NAMES = ["abrial", "frinovsky", "alksnis"] as const;
const DATE = /^19[34]\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const nameParts = (id: string) => id.split("_");

describe("admirals (spec §7.4)", () => {
  it("ids are unique, tagged and never a banned person", () => {
    const seen = new Set<string>();
    for (const a of ADMIRALS) {
      expect(seen.has(a.id), a.id).toBe(false);
      seen.add(a.id);
      expect(COUNTRY_TAGS).toContain(a.tag);
      expect(a.id.startsWith(`${a.tag.toLowerCase()}_`), a.id).toBe(true);
      for (const b of BANNED_NAMES)
        expect(nameParts(a.id), a.id).not.toContain(b);
    }
  });

  it("skills are 0-5, traits 0-2 known traits, dates ISO and ordered, a source on each row", () => {
    for (const a of ADMIRALS) {
      for (const v of [a.atk, a.def, a.man, a.coord]) {
        expect(Number.isInteger(v) && v >= 0 && v <= 5, a.id).toBe(true);
      }
      expect(a.traits.length, a.id).toBeLessThanOrEqual(2);
      for (const t of a.traits) expect(ADMIRAL_TRAITS).toContain(t);
      for (const d of [a.from, a.until])
        if (d !== undefined) expect(d, a.id).toMatch(DATE);
      if (a.from && a.until) expect(a.from < a.until, a.id).toBe(true);
      expect(a.source.length, a.id).toBeGreaterThan(0);
    }
  });

  it("Japan's admirals carry real names, not office titles", () => {
    for (const a of ADMIRALS.filter((x) => x.tag === "JPN")) {
      expect(en.admiral[a.id], a.id).not.toMatch(/^Commander/);
      expect(ko.admiral[a.id], a.id).not.toMatch(/사령(장)?관$/);
    }
  });

  it("every admiral and admiral trait has English and Korean text", () => {
    for (const a of ADMIRALS) {
      expect(typeof en.admiral?.[a.id], a.id).toBe("string");
      expect(typeof ko.admiral?.[a.id], a.id).toBe("string");
    }
    for (const t of ADMIRAL_TRAITS) {
      for (const g of ["admiral_trait", "admiral_trait_desc"]) {
        expect(typeof en[g]?.[t], `${g}.${t}`).toBe("string");
        expect(typeof ko[g]?.[t], `${g}.${t}`).toBe("string");
      }
    }
  });

  it("an admiral who is also a chief points at that person, with the same name", () => {
    for (const a of ADMIRALS.filter((x) => x.alsoPerson !== undefined)) {
      const p = P4_PERSONS.find((x) => x.id === a.alsoPerson);
      expect(p, a.id).toBeDefined();
      expect(p!.country, a.id).toBe(a.tag);
      expect(en.person[p!.id], a.id).toBe(en.admiral[a.id]);
      expect(ko.person[p!.id], a.id).toBe(ko.admiral[a.id]);
    }
  });
});

describe("navy and air chiefs (spec §16.3)", () => {
  it("real people only for Germany, Britain and the Soviet Union, in the new slots", () => {
    const seen = new Set<string>();
    for (const p of P4_PERSONS) {
      expect(seen.has(p.id), p.id).toBe(false);
      seen.add(p.id);
      expect(["DEU", "GBR", "SUN"]).toContain(p.country);
      expect(p.nameKey).toBe(`ww1936.person.${p.id}`);
      expect(p.roles).toEqual(["advisor"]);
      const slot = p.advisor!.slot;
      expect(["navy_chief", "air_chief"]).toContain(slot);
      for (const t of p.advisor!.traits)
        expect(
          t.startsWith(slot === "navy_chief" ? "nc_" : "ac_"),
          `${p.id} ${t}`,
        ).toBe(true);
      for (const d of [p.from, p.until])
        if (d !== undefined) expect(d, p.id).toMatch(DATE);
      if (p.from && p.until) expect(p.from < p.until, p.id).toBe(true);
      for (const b of BANNED_NAMES)
        expect(nameParts(p.id), p.id).not.toContain(b);
      expect(typeof en.person?.[p.id], p.id).toBe("string");
      expect(typeof ko.person?.[p.id], p.id).toBe("string");
      expect(p.source.length, p.id).toBeGreaterThan(0);
    }
  });

  it("the p4 spirits are the spec §16.4 ones and have their texts", () => {
    for (const s of SPIRITS_P4) {
      expect(s.id.startsWith("p4_"), s.id).toBe(true);
      for (const g of ["spirit", "spirit_desc"]) {
        expect(typeof en[g]?.[s.id], `${g}.${s.id}`).toBe("string");
        expect(typeof ko[g]?.[s.id], `${g}.${s.id}`).toBe("string");
      }
    }
    expect(SPIRITS_P4.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        "p4_dispersal",
        "p4_dive_bombing",
        "p4_uboat_priority",
        "p4_high_seas_fleet",
        "p4_fighter_command",
        "p4_bomber_command",
        "p4_convoy_system",
        "p4_shturmovik",
      ]),
    );
  });
});
