import {
  GW_OFFICES,
  GwPersonDefSchema,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwPack,
  GwPackSchema,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_PEOPLE,
  GW_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/people";
import {
  GBR_PEOPLE,
  GBR_SEAT_PERSON,
  GBR_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/people_gbr";
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

const all = [...GW_PEOPLE, ...GBR_PEOPLE];
const british = all.filter((p) => p.tag === "GBR");
const ids = new Set(all.map((p) => p.id));

describe("Britain's cast", () => {
  test("every person is well formed, named once, and in the game's content", () => {
    expect(british.length).toBe(35);
    expect(ids.size).toBe(all.length);
    for (const p of GBR_PEOPLE) {
      GwPersonDefSchema.parse(p);
      expect(gwContent().people, p.id).toContain(p);
    }
  });

  test("the sixteen who have talks are all there", () => {
    for (const id of [
      "grey",
      "george_v",
      "carson",
      "redmond",
      "kitchener",
      "haig",
      "robertson",
      "jellicoe",
      "lloyd_george",
      "bonar_law",
      "henderson",
      "venetia",
      "mckenna",
      "balfour",
      "hankey",
      "churchill",
    ]) {
      expect(ids.has(`gbr_${id}`), id).toBe(true);
    }
  });

  test("rivals and allies are real people, not themselves, never both", () => {
    for (const p of GBR_PEOPLE) {
      if (p.id !== "gbr_venetia")
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

  test("an office has one holder, who fits it; the seat and the War Office have none", () => {
    const held = british.flatMap((p) => (p.office === null ? [] : [p.office]));
    expect(new Set(held).size).toBe(held.length);
    expect(held).not.toContain("chancellor");
    expect(held).not.toContain("war");
    for (const p of GBR_PEOPLE) {
      if (p.office !== null) expect(p.fit, p.id).toContain(p.office);
      for (const o of p.fit) expect(GW_OFFICES, p.id).toContain(o);
    }
  });

  test("the offices of power have two people to fill them", () => {
    for (const office of [
      "foreign",
      "chief_of_staff",
      "war",
      "navy",
      "interior",
      "finance",
      "munitions",
      "sea_lord",
      "ireland",
    ] as const) {
      const fits = british.filter((p) => p.fit.includes(office));
      expect(fits.length, office).toBeGreaterThanOrEqual(2);
    }
  });

  test("the person in the seat can't be appointed or dismissed", () => {
    const seat = GBR_PEOPLE.find((p) => p.id === GBR_SEAT_PERSON);
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
      for (const p of british) {
        expect(loaded.people[p.id]?.name, `${tag} ${p.id}`).toBeDefined();
      }
    }
  });

  test("everyone has a source, a voice note, a name, a lean and a bio", () => {
    const merged = mergeGwPacks([
      pack("common.json"),
      pack("GBR.json"),
      pack("GBR.people.json"),
    ]);
    for (const p of british) {
      expect(p.source.length, p.id).toBeGreaterThan(20);
      const voice = GBR_VOICE_NOTES[p.id] ?? GW_VOICE_NOTES[p.id];
      expect(voice?.length ?? 0, p.id).toBeGreaterThan(20);
      expect(merged.people[p.id]?.name, p.id).toBeDefined();
      expect(merged.people[p.id]?.lean, p.id).toBeDefined();
      expect(merged.people[p.id]?.bio, p.id).toBeDefined();
    }
    expect(Object.keys(GBR_VOICE_NOTES).length).toBe(GBR_PEOPLE.length);
  });
});
