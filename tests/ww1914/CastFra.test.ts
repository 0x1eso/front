import {
  GW_OFFICES,
  GwPersonDefSchema,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwPack,
  GwPackSchema,
  gwPackOverlaps,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_VOICE_NOTES } from "@openfront/engine-lib/ww1914/content/people";
import { GW_VOICE_NOTES_COMMON } from "@openfront/engine-lib/ww1914/content/people_common";
import {
  FRA_PEOPLE,
  FRA_POSTS,
  FRA_SEAT_PERSON,
  FRA_SUMMONED,
  FRA_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/people_fra";
import { RUS_VOICE_NOTES } from "@openfront/engine-lib/ww1914/content/people_rus";
import { SPY_PEOPLE } from "@openfront/engine-lib/ww1914/content/people_spies";
import {
  FRA_PRIVATE_PEOPLE,
  FRA_PRIVATE_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/scenes/fra_private";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pack = (file: string): GwPack =>
  GwPackSchema.parse(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../resources/ww1914/ko", file),
        "utf8",
      ),
    ),
  );

const people = gwContent().people;
const ids = new Set(people.map((p) => p.id));
const french = people.filter((p) => p.tag === "FRA");
// ww173 spy chiefs and ww179 vacancy names: French, but no speaking part.
const silent = new Set(
  [...FRA_POSTS, ...SPY_PEOPLE.filter((p) => p.tag === "FRA")].map((p) => p.id),
);
const voice = (id: string) =>
  FRA_VOICE_NOTES[id] ??
  FRA_PRIVATE_VOICE_NOTES[id] ??
  GW_VOICE_NOTES_COMMON[id] ??
  GW_VOICE_NOTES[id] ??
  RUS_VOICE_NOTES[id];

describe("France's cast", () => {
  test("every person is well formed, named once, and in the game's content", () => {
    expect(ids.size).toBe(people.length);
    expect(french.length).toBe(
      FRA_PEOPLE.length + 8 + FRA_PRIVATE_PEOPLE.length + silent.size,
    );
    for (const p of FRA_PEOPLE) {
      GwPersonDefSchema.parse(p);
      expect(people, p.id).toContain(p);
    }
  });

  test("the sixteen who have talks are French and there", () => {
    expect(new Set(FRA_SUMMONED).size).toBe(16);
    for (const id of FRA_SUMMONED) {
      expect(
        french.some((p) => p.id === id),
        id,
      ).toBe(true);
    }
    expect(FRA_SUMMONED).not.toContain(FRA_SEAT_PERSON);
  });

  test("rivals and allies are real people, not themselves, never both", () => {
    for (const p of FRA_PEOPLE) {
      expect(p.rivals.length, p.id).toBeGreaterThan(0);
      for (const other of [...p.rivals, ...p.allies]) {
        expect(ids.has(other), `${p.id} -> ${other}`).toBe(true);
        expect(other, p.id).not.toBe(p.id);
      }
      expect(
        p.rivals.filter((r) => p.allies.includes(r)),
        p.id,
      ).toEqual([]);
    }
  });

  test("June 1914: one holder per office, who fits it; nobody makes munitions yet", () => {
    const held = french.flatMap((p) => (p.office === null ? [] : [p.office]));
    expect(new Set(held).size).toBe(held.length);
    expect(held).not.toContain("munitions");
    const holder = (o: string) => french.find((p) => p.office === o)?.id;
    expect(holder("chancellor")).toBe("fra_viviani");
    expect(holder("foreign")).toBe("fra_bienvenu_martin");
    expect(holder("war")).toBe("fra_messimy");
    expect(holder("navy")).toBe("fra_gauthier");
    expect(holder("interior")).toBe("fra_malvy");
    expect(holder("finance")).toBe("fra_noulens");
    expect(holder("chief_of_staff")).toBe("fra_joffre");
    for (const p of french) {
      if (p.office !== null) expect(p.fit, p.id).toContain(p.office);
      for (const o of p.fit) expect(GW_OFFICES, p.id).toContain(o);
    }
  });

  test("the offices of power have two people to fill them", () => {
    for (const office of [
      "chancellor",
      "foreign",
      "chief_of_staff",
      "war",
      "navy",
      "interior",
      "finance",
      "munitions",
      "agriculture",
    ] as const) {
      const fits = french.filter((p) => p.fit.includes(office));
      expect(fits.length, office).toBeGreaterThanOrEqual(2);
    }
  });

  test("the President can't be appointed or dismissed", () => {
    const seat = french.find((p) => p.id === FRA_SEAT_PERSON);
    expect(seat?.office).toBeNull();
    expect(seat?.fit).toEqual([]);
  });

  test("any seat can read the names", async () => {
    const res = (p: string) =>
      JSON.parse(
        fs.readFileSync(path.join(__dirname, "../../resources", p), "utf8"),
      );
    for (const tag of ["GBR", "DEU"] as const) {
      const loaded = await loadGwPack(tag, async (p) => res(p));
      for (const p of french) {
        expect(loaded.people[p.id]?.name, `${tag} ${p.id}`).toBeDefined();
      }
    }
  });

  test("everyone has a source, a voice note, a name, a lean and a bio", () => {
    const merged = mergeGwPacks(
      ["common.json", "common.people.json", "RUS.people.json"].map(pack),
    );
    const own = pack("FRA.people.json");
    for (const p of french) {
      expect(p.source.length, p.id).toBeGreaterThan(20);
      if (!silent.has(p.id)) {
        expect(voice(p.id)?.length ?? 0, p.id).toBeGreaterThan(20);
      }
      const text = own.people[p.id] ?? merged.people[p.id];
      expect(text?.name, p.id).toBeTruthy();
      expect(text?.lean, p.id).toBeTruthy();
      expect(text?.bio, p.id).toBeTruthy();
    }
    expect(Object.keys(FRA_VOICE_NOTES).sort()).toEqual(
      FRA_PEOPLE.map((p) => p.id).sort(),
    );
  });

  test("pack-only people are named, and no id is in two packs", () => {
    const own = pack("FRA.people.json");
    for (const [id, p] of Object.entries(own.people)) {
      if (!ids.has(id)) expect(id, id).toMatch(/^fra_i_/);
      expect(p.name, id).toBeTruthy();
      expect(p.lean, id).toBeTruthy();
    }
    const others = [
      "common.people.json",
      "GBR.people.json",
      "AUH.people.json",
      "RUS.people.json",
      "RUS.kin.json",
      "DEU.cast.json",
    ].map(pack);
    expect(gwPackOverlaps([own, ...others])).toEqual([]);
  });

  test("Britain's French ambassador is Paul Cambon in London, not Jules", () => {
    const casts = gwContent()
      .scenes.filter((s) => s.nation?.includes("GBR"))
      .flatMap((s) => Object.values(s.cast ?? {}));
    expect(JSON.stringify(casts)).not.toContain('"fra_cambon"');
    expect(JSON.stringify(casts)).toContain('"fra_paul_cambon"');
  });
});
