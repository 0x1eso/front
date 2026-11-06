import {
  GW_OFFICES,
  GwPersonDefSchema,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwPackSchema } from "@openfront/engine-api/ww1914/GwPack";
import {
  GW_PEOPLE,
  GW_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/people";
import {
  AUH_PEOPLE,
  AUH_PRINCIPALS,
  AUH_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/people_auh";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const res = (p: string) => path.join(__dirname, "../../resources", p);
const json = (p: string): unknown =>
  JSON.parse(fs.readFileSync(res(p), "utf8"));

const everyone = [...GW_PEOPLE, ...AUH_PEOPLE];
const ids = new Set(everyone.map((p) => p.id));
const austrians = everyone.filter((p) => p.tag === "AUH");

describe("the Austro-Hungarian cast", () => {
  test("each person fits the schema and is named once", () => {
    for (const p of AUH_PEOPLE) GwPersonDefSchema.parse(p);
    expect(ids.size).toBe(everyone.length);
    expect(austrians.length).toBe(32);
  });

  test("sixteen principals, all of the empire", () => {
    expect(new Set(AUH_PRINCIPALS).size).toBe(16);
    for (const id of AUH_PRINCIPALS) {
      expect(
        austrians.some((p) => p.id === id),
        id,
      ).toBe(true);
    }
  });

  test("rivals and allies are real people, not themselves, never both", () => {
    for (const p of AUH_PEOPLE) {
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

  test("an office has one holder who fits it, and nobody holds interior", () => {
    const held = austrians.flatMap((p) =>
      p.office === null ? [] : [p.office],
    );
    expect(new Set(held).size).toBe(held.length);
    expect(held).not.toContain("interior");
    for (const p of austrians) {
      if (p.office !== null) expect(p.fit, p.id).toContain(p.office);
      for (const o of p.fit) expect(GW_OFFICES).toContain(o);
    }
  });

  test("a dismissal leaves a successor for the offices of power", () => {
    for (const office of [
      "chancellor",
      "hun_pm",
      "foreign",
      "chief_of_staff",
      "war",
      "navy",
      "finance",
      "court",
    ] as const) {
      const fits = austrians.filter((p) => p.fit.includes(office));
      expect(fits.length, office).toBeGreaterThanOrEqual(2);
    }
  });

  test("every Austrian has a source, a voice, a name, a lean and a bio", async () => {
    const pack = await loadGwPack("AUH", async (p) => json(p));
    for (const p of austrians) {
      expect(p.source.length, p.id).toBeGreaterThan(20);
      const voice = AUH_VOICE_NOTES[p.id] ?? GW_VOICE_NOTES[p.id] ?? "";
      expect(voice.length, p.id).toBeGreaterThan(20);
      expect(pack.people[p.id]?.name, p.id).toBeDefined();
      expect(pack.people[p.id]?.lean, p.id).toBeDefined();
      expect(pack.people[p.id]?.bio, p.id).toBeDefined();
    }
    expect(Object.keys(AUH_VOICE_NOTES).length).toBe(AUH_PEOPLE.length);
  });

  test("the seat's pack names the Germans its desk meets", async () => {
    const pack = await loadGwPack("AUH", async (p) => json(p));
    for (const id of ["deu_tschirschky", "deu_falkenhayn", "deu_ludendorff"]) {
      expect(pack.people[id]?.name, id).toBeDefined();
    }
  });

  test("the pack files parse and hold no id of common.json", () => {
    const common = GwPackSchema.parse(json("ww1914/ko/common.json"));
    const own = GwPackSchema.parse(json("ww1914/ko/AUH.people.json"));
    GwPackSchema.parse(json("ww1914/ko/AUH.json"));
    const both = Object.keys(own.people).filter((id) => common.people[id]);
    expect(both).toEqual([]);
  });
});
