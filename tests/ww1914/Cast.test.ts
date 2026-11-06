import {
  GwPack,
  GwPackSchema,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  GW_PEOPLE,
  GW_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/people";
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

const german = GW_PEOPLE.filter((p) => p.tag === "DEU");
const foreign = GW_PEOPLE.filter((p) => p.tag !== "DEU");
const ids = new Set(GW_PEOPLE.map((p) => p.id));

describe("the cast of the test build", () => {
  test("16 Germans and 8 foreigners, each named once", () => {
    expect(german.length).toBe(16);
    expect(foreign.length).toBe(8);
    expect(ids.size).toBe(GW_PEOPLE.length);
  });

  test("rivals and allies are real people, not themselves, never both", () => {
    for (const p of GW_PEOPLE) {
      expect(p.rivals.length, p.id).toBeGreaterThan(0);
      for (const other of [...p.rivals, ...p.allies]) {
        expect(ids.has(other), `${p.id} -> ${other}`).toBe(true);
        expect(other, p.id).not.toBe(p.id);
      }
      expect(p.rivals.filter((r) => p.allies.includes(r)), p.id).toEqual([]);
    }
  });

  test("a German office has one holder, who fits it", () => {
    const held = german.flatMap((p) => (p.office === null ? [] : [p.office]));
    expect(new Set(held).size).toBe(held.length);
    for (const p of GW_PEOPLE) {
      if (p.office !== null) expect(p.fit, p.id).toContain(p.office);
    }
  });

  test("a dismissal leaves a successor for the offices of power", () => {
    for (const office of [
      "chancellor",
      "foreign",
      "chief_of_staff",
      "war",
      "navy",
      "interior",
      "finance",
    ] as const) {
      const fits = german.filter((p) => p.fit.includes(office));
      expect(fits.length, office).toBeGreaterThanOrEqual(2);
    }
  });

  test("everyone has a source, a voice note, a name, a lean and a bio", () => {
    // Foreigners sit in common.json so that any seat can read them.
    const common = pack("common.json");
    const merged = mergeGwPacks([common, pack("DEU.json")]);
    for (const p of GW_PEOPLE) {
      expect(p.source.length, p.id).toBeGreaterThan(20);
      expect(GW_VOICE_NOTES[p.id]?.length ?? 0, p.id).toBeGreaterThan(20);
      expect(merged.people[p.id]?.name, p.id).toBeDefined();
      expect(merged.people[p.id]?.bio, p.id).toBeDefined();
    }
    for (const p of foreign) expect(common.people[p.id], p.id).toBeDefined();
    expect(Object.keys(GW_VOICE_NOTES).length).toBe(GW_PEOPLE.length);
  });
});
