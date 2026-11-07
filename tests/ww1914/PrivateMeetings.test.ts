import {
  GwPackSchema,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  GW_CALENDARS,
  gwChapters,
} from "@openfront/engine-lib/ww1914/Calendars";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { gwRunner, order, playChapter, seat, view } from "./util";

const TOPIC = "deu_pv_bet_piano";
const person = (
  r: Awaited<ReturnType<typeof gwRunner>>["runner"],
  id: string,
) => seat(r).people.find((p) => p.id === id);
const json = async (f: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../resources", f), "utf8"),
  ) as unknown;

describe("the private meeting", () => {
  test("every playing chapter of every row has one, the closing has none", () => {
    for (const id of Object.keys(
      GW_CALENDARS,
    ) as (keyof typeof GW_CALENDARS)[]) {
      for (const ch of gwChapters(id)) {
        expect(ch.privates, `${id} ${ch.index}`).toBe(
          ch.stage === "closing" ? 0 : 1,
        );
      }
    }
  });

  test("it is apart from summons: its own list, its own count", async () => {
    const { runner } = await gwRunner();
    expect(seat(runner).privates).toBe(1);
    const p = person(runner, "deu_bethmann")!;
    expect(p.privateTopics).toContain(TOPIC);
    expect(p.topics).not.toContain(TOPIC);
    const summons = seat(runner).audiences;
    order(runner, { kind: "summon", person: "deu_bethmann", topic: TOPIC });
    expect(seat(runner).privates).toBe(0);
    expect(seat(runner).audiences).toBe(summons);
    expect(seat(runner).desk.some((c) => c.scene === TOPIC)).toBe(true);
  });

  test("a second is refused, and the next chapter brings one back", async () => {
    const { runner } = await gwRunner();
    order(runner, { kind: "summon", person: "deu_bethmann", topic: TOPIC });
    const desk = seat(runner).desk.length;
    order(runner, {
      kind: "summon",
      person: "deu_moltke",
      topic: "deu_pv_mol_julius",
    });
    expect(seat(runner).desk.length).toBe(desk);
    const chapter = view(runner).chapter;
    playChapter(runner);
    expect(view(runner).chapter).toBe(chapter + 1);
    expect(seat(runner).privates).toBe(1);
  });

  test("a work summons spends no private meeting", async () => {
    const { runner } = await gwRunner();
    const p = seat(runner).people.find((x) => x.topics.length > 0)!;
    order(runner, { kind: "summon", person: p.id, topic: p.topics[0] });
    expect(seat(runner).privates).toBe(1);
  });

  test("the private cast stays off the people tab until they come up", async () => {
    const { runner } = await gwRunner();
    for (const id of [
      "deu_eulenburg",
      "deu_margaret",
      "deu_eliza",
      "deu_cecilie",
    ]) {
      expect(person(runner, id), id).toBeUndefined();
    }
  });
});

describe("Germany's private lines", () => {
  const lines = new Map<string, string[]>();
  for (const s of GW_CONTENT.scenes) {
    const m = /^deu_pv_([a-z]+)_/.exec(s.id);
    if (m !== null) lines.set(m[1], [...(lines.get(m[1]) ?? []), s.id]);
  }

  test("ten lines of four to six scenes, all tagged private", () => {
    expect(lines.size).toBe(10);
    for (const [line, ids] of lines) {
      expect(ids.length, line).toBeGreaterThanOrEqual(4);
      expect(ids.length, line).toBeLessThanOrEqual(6);
    }
    for (const s of GW_CONTENT.scenes) {
      if (s.id.startsWith("deu_pv_")) expect(s.tags).toContain("private");
    }
  });

  test("the lines laid into work scenes reach their text", async () => {
    const pack = await loadGwPack("DEU", (p) => json(p));
    const scene = GW_CONTENT.scenes.find((s) => s.id === "deu_t_beth_son")!;
    expect(scene.variants[0].id).toBe("kept_after");
    expect(pack.scenes.deu_t_beth_son.text.kept_after).toBeTruthy();
    expect(pack.scenes.deu_t_beth_son.text.after).toBeTruthy();
    const open = pack.scenes.deu_t_beth_son.nodes!.open;
    expect(open.says.kept_loss).toBeTruthy();
    expect(open.says.loss).toBeTruthy();
    expect(open.replies.how_long).toBeTruthy();
  });

  test("a pack can lay lines over a scene it doesn't own", () => {
    const owner = GwPackSchema.parse({
      version: 1,
      scenes: {
        x: {
          title: "t",
          text: { base: "a" },
          nodes: { open: { says: { base: "b" }, replies: { r: "c" } } },
        },
      },
      people: {},
    });
    const later = GwPackSchema.parse({
      version: 1,
      scenes: {},
      people: {},
      over: {
        x: {
          text: { more: "d" },
          nodes: { open: { says: { warm: "e" }, replies: {} } },
        },
      },
    });
    const merged = mergeGwPacks([later, owner]).scenes.x;
    expect(merged.text).toEqual({ base: "a", more: "d" });
    expect(merged.nodes!.open.says).toEqual({ base: "b", warm: "e" });
    expect(merged.nodes!.open.replies).toEqual({ r: "c" });
  });
});
