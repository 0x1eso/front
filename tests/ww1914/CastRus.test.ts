import {
  GwPack,
  GwPackSchema,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import { GwPersonDefSchema } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import {
  RUS_PEOPLE,
  RUS_SEAT_PERSON,
  RUS_SUMMONED,
  RUS_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/people_rus";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const dir = path.join(__dirname, "../../resources");
const read = (p: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(dir, p), "utf8"));
const pack = (file: string): GwPack =>
  GwPackSchema.parse(read(`ww1914/ko/${file}`));

const ids = new Set(GW_CONTENT.people.map((p) => p.id));
const russians = RUS_PEOPLE.filter((p) => p.tag === "RUS");

describe("Russia's cast", () => {
  test("every person passes the schema and is named once in the content", () => {
    for (const p of RUS_PEOPLE) GwPersonDefSchema.parse(p);
    expect(ids.size).toBe(GW_CONTENT.people.length);
  });

  test("sixteen are summoned and the seat is not one of them", () => {
    expect(RUS_SUMMONED.length).toBe(16);
    expect(new Set(RUS_SUMMONED).size).toBe(16);
    expect(RUS_SUMMONED).not.toContain(RUS_SEAT_PERSON);
    expect(ids.has(RUS_SEAT_PERSON)).toBe(true);
    for (const id of RUS_SUMMONED) {
      expect(RUS_PEOPLE.find((p) => p.id === id)?.tag, id).toBe("RUS");
    }
  });

  test("rivals and allies are real people, not themselves, never both", () => {
    for (const p of RUS_PEOPLE) {
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

  test("an office has one holder in June 1914, who fits it", () => {
    const held = russians.flatMap((p) => (p.office === null ? [] : [p.office]));
    expect(new Set(held).size).toBe(held.length);
    expect(held).not.toContain("supreme_commander");
    for (const p of russians) {
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
      "agriculture",
      "supreme_commander",
    ] as const) {
      const fits = russians.filter((p) => p.fit.includes(office));
      expect(fits.length, office).toBeGreaterThanOrEqual(2);
    }
  });

  test("everyone has a source, a voice note, a name, a lean and a bio", () => {
    const people = pack("RUS.people.json").people;
    for (const p of RUS_PEOPLE) {
      expect(p.source.length, p.id).toBeGreaterThan(20);
      expect(RUS_VOICE_NOTES[p.id]?.length ?? 0, p.id).toBeGreaterThan(20);
      expect(people[p.id]?.name, p.id).toBeDefined();
      expect(people[p.id]?.lean, p.id).toBeDefined();
      expect(people[p.id]?.bio, p.id).toBeDefined();
    }
    expect(Object.keys(RUS_VOICE_NOTES).length).toBe(RUS_PEOPLE.length);
    expect(Object.keys(people).length).toBe(RUS_PEOPLE.length);
  });

  test("a Russian seat's pack loads with the cast in it", async () => {
    const merged = await loadGwPack("RUS", async (p) => read(p));
    const plain = mergeGwPacks([pack("common.json"), pack("RUS.people.json")]);
    expect(merged.people.rus_sazonov).toEqual(plain.people.rus_sazonov);
    expect(merged.people.rus_nicholas).toBeDefined();
  });
});
