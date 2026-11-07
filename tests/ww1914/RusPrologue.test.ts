import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { GW_RIVAL_ROWS } from "@openfront/engine-lib/ww1914/StoryRows";
import {
  GW_CONTENT,
  GW_ECHOES,
} from "@openfront/engine-lib/ww1914/content/Content";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { beforeAll, describe, expect, test } from "vitest";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { MINI } from "../ww1936/util";
import { newGame, startOf } from "./sim/GwSim";

const row = GW_CONTENT.scenes
  .filter((s) => s.prologue !== undefined && s.nation.includes("RUS"))
  .sort((a, b) => a.prologue! - b.prologue!);

const flagsSet = new Set(
  row.flatMap((s) =>
    Object.values(s.nodes ?? {}).flatMap((n) =>
      n.replies.flatMap((r) =>
        r.effects.flatMap((e) => (e.kind === "flag" ? [e.flag] : [])),
      ),
    ),
  ),
);

/** Every `pro_rus_` flag a condition reads. */
function read(c: unknown): string[] {
  const text = JSON.stringify(c);
  return [...text.matchAll(/"(pro_rus_[a-z0-9_]+)"/g)].map((m) => m[1]);
}

/** One life, reply by reply, as a browser would keep it. */
const PICKS = [
  ...["go_in", "look", "ask_why", "paper"].map((r) => `rus_pro_stairs.${r}`),
  ...[
    "read_it",
    "to_father",
    "kneel",
    "not_ready",
    "between",
    "take_paper",
    "unready",
  ].map((r) => `rus_pro_livadia.${r}`),
  ...["how_many", "go_back", "not_going", "tell_amb", "dance", "uncles"].map(
    (r) => `rus_pro_khodynka.${r}`,
  ),
  ...[
    "why_not_there",
    "diary",
    "stay_in",
    "to_sea",
    "sign_it",
    "wary",
    "call_him",
    "sign",
    "forced",
  ].map((r) => `rus_pro_1905.${r}`),
  ...["to_kiev", "later", "laugh", "stay", "end_file", "go_on", "small"].map(
    (r) => `rus_pro_kiev.${r}`,
  ),
  ...[
    "upstairs",
    "no_name",
    "tomorrow",
    "leave_table",
    "sit_night",
    "go_up",
    "believed",
  ].map((r) => `rus_pro_spala.${r}`),
  ...[
    "enough",
    "drawer",
    "mama",
    "cut_short",
    "and_serbia",
    "call_war",
    "three_years",
    "not_yet",
    "to_ship",
    "stand",
  ].map((r) => `rus_pro_spring.${r}`),
];

let map: MapFiles;
beforeAll(async () => {
  map = await loadMapFiles(
    new TestDataMapLoader(MINI),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
});

const russia = async (picks: string[]) => {
  const start = startOf("rus_pro", "full", [], "RUS");
  start.config.greatWar1914Prologue = { play: false, picks };
  const runner = await newGame(map, start);
  return runner.game.greatWar()!.s.seats[0];
};

describe("Nicholas II's prologue", () => {
  test("a life replayed leaves its flags, its temper and the rival's lean", async () => {
    const st = await russia(PICKS);
    for (const f of [
      "pro_rus_stairs_paper",
      "pro_rus_liv_unready",
      "pro_rus_kho_uncles",
      "pro_rus_bjorko_wary",
      "pro_rus_oct_forced",
      "pro_rus_kiev_small",
      "pro_rus_spala_believed",
      "pro_rus_memo_drawer",
      "pro_rus_spring_stand",
    ]) {
      expect(st.flags, f).toContain(f);
    }
    expect(st.prologue!.temper).toBe("stubborn");
    expect(st.prologue!.lean.rus_nikolasha).toBe(2);
    expect(st.prologue!.lean.rus_rodzianko).toBe(2);
  });

  test("skipped with nothing kept, no memory is set", async () => {
    const st = await russia([]);
    expect(st.flags.filter((f) => f.startsWith("pro_rus_"))).toEqual([]);
    expect(st.prologue!.temper).toBeNull();
  });

  test("seven scenes, each ending on what he made of it", () => {
    expect(row.map((s) => s.prologue)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const s of row) {
      const last = Object.values(s.nodes!).flatMap((n) =>
        n.replies.filter((r) => r.next === null),
      );
      expect(last.length, s.id).toBeGreaterThanOrEqual(3);
      for (const r of last) {
        expect(
          r.effects.some((e) => e.kind === "temper"),
          r.id,
        ).toBe(true);
      }
    }
  });

  test("the past comes back: every flag is one a scene sets, and each is read", () => {
    const echoes = GW_ECHOES.filter((e) => read(e.when).length > 0);
    expect(echoes.length).toBeGreaterThanOrEqual(15);
    const used = new Set(echoes.flatMap((e) => read(e.when)));
    for (const f of used) expect(flagsSet, f).toContain(f);
    for (const f of flagsSet) {
      if (f !== "pro_rus_memo_drawer") expect(used, f).toContain(f);
    }
  });

  test("every lean is on someone of the rival row", () => {
    const leans = row.flatMap((s) =>
      Object.values(s.nodes!).flatMap((n) =>
        n.replies.flatMap((r) =>
          r.effects.flatMap((e) =>
            e.kind === "rival_lean" && "person" in e.who ? [e.who.person] : [],
          ),
        ),
      ),
    );
    expect(new Set(leans)).toEqual(new Set(GW_RIVAL_ROWS.RUS));
  });
});
