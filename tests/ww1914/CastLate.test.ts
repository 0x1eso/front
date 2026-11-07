import {
  GwPackSchema,
  gwPackOverlaps,
} from "@openfront/engine-api/ww1914/GwPack";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import {
  GW_PEOPLE_COMMON,
  GW_VOICE_NOTES_COMMON,
} from "@openfront/engine-lib/ww1914/content/people_common";
import {
  GW_PEOPLE_DEU,
  GW_VOICE_NOTES_DEU,
} from "@openfront/engine-lib/ww1914/content/people_deu";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { step } from "../ww1936/util";
import { gwRunner, seat, view } from "./util";

const file = (f: string) =>
  GwPackSchema.parse(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../resources/ww1914/ko", f),
        "utf8",
      ),
    ),
  );

describe("the cast from 1915, and foreign figures", () => {
  const known = new Set(GW_CONTENT.people.map((p) => p.id));

  test("each is named once, rivals and allies exist and don't overlap", () => {
    expect(known.size).toBe(GW_CONTENT.people.length);
    for (const p of [...GW_PEOPLE_DEU, ...GW_PEOPLE_COMMON]) {
      for (const other of [...p.rivals, ...p.allies]) {
        expect(known.has(other), `${p.id} -> ${other}`).toBe(true);
        expect(other, p.id).not.toBe(p.id);
      }
      expect(p.rivals.filter((r) => p.allies.includes(r))).toEqual([]);
    }
  });

  test("each has a source, a voice note and a name, lean and bio", () => {
    for (const [list, notes, pack] of [
      [GW_PEOPLE_DEU, GW_VOICE_NOTES_DEU, file("DEU.cast.json")],
      [GW_PEOPLE_COMMON, GW_VOICE_NOTES_COMMON, file("common.people.json")],
    ] as const) {
      expect(Object.keys(notes).length).toBe(list.length);
      for (const p of list) {
        expect(p.source.length, p.id).toBeGreaterThan(20);
        expect(notes[p.id]?.length ?? 0, p.id).toBeGreaterThan(20);
        expect(pack.people[p.id]?.lean, p.id).toBeTruthy();
        expect(pack.people[p.id]?.bio, p.id).toBeTruthy();
      }
    }
  });

  test("the new packs hold no id another pack holds", () => {
    const packs = ["DEU.json", "DEU.cast.json", "common.people.json"].map(file);
    // common.json's endings are a fallback a country's own text replaces.
    const common = { ...file("common.json"), endings: {} };
    expect(gwPackOverlaps([common, ...packs])).toEqual([]);
  });

  test("only Germans who come later wait; the 1914 cast is untouched", () => {
    for (const p of GW_PEOPLE) expect(p.arrives, p.id).toBeUndefined();
    for (const p of GW_PEOPLE_DEU) {
      expect(p.arrives, p.id).toBeDefined();
      expect(p.office, p.id).toBeNull();
    }
  });
});

describe("arrivals", () => {
  test("someone waiting is off the people screen until the day, then on it", async () => {
    const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
    const on = () => seat(runner).people.some((p) => p.id === "deu_groener");
    expect(on()).toBe(false);
    const gw = runner.game.greatWar()!;
    expect(gw.person("deu_groener")?.status).toBe("waiting");
    // The clock is the chapter's date: only that needs to move.
    gw.s.day += 365;
    gw.s.deadlineTick = runner.game.ticks() + 1;
    step(runner, 3);
    expect(view(runner).chapter).toBe(1);
    expect(gw.person("deu_groener")?.status).toBe("active");
    expect(on()).toBe(true);
  });
});
