import { GW_RIVAL_ROWS } from "@openfront/engine-lib/ww1914/StoryRows";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { gwRunner, order, playChapter, seat } from "./util";

const json = async (p: string): Promise<unknown> =>
  JSON.parse(fs.readFileSync(path.join("resources", p), "utf8"));

const desk = (r: GameRunner) => seat(r).desk.map((c) => c.scene);
const SARAJEVO = ["sarajevo", "sarajevo_survived", "sarajevo_failed"];

/** A game that opens on Sarajevo: the seed picks the opening. */
async function opened(config: Parameters<typeof gwRunner>[0]) {
  for (let i = 0; i < 40; i++) {
    const { runner } = await gwRunner(config, `deu_act_${i}`);
    const opening = runner.game.greatWar()!.s.opening;
    if (SARAJEVO.includes(opening)) return runner;
  }
  throw new Error("no game opened on Sarajevo");
}

function say(r: GameRunner, ...replies: string[]): void {
  for (const reply of replies) {
    const card = seat(r).desk.find((c) => c.scene === "deu_big_kiel")!;
    order(r, { kind: "reply", card: card.uid, reply });
  }
}

describe("Germany's opening", () => {
  test("a first game starts on the water, and its answer is the paper's", async () => {
    const r = await opened({ greatWar1914Played: [] });
    expect(desk(r)).toContain("deu_big_kiel");
    expect(desk(r)).not.toContain("deu_c_first_words");
    say(r, "sails", "what", "russia", "army", "decide_now", "go_vienna");
    const s = r.game.greatWar()!.s.seats[0];
    expect(s.flags).toContain("f_went_vienna");
    expect(desk(r)).toContain("deu_big_kiel_rail");
  });

  test("a later game has the wire and the paper", async () => {
    const r = await opened({ greatWar1914Played: ["DEU"] });
    expect(desk(r)).not.toContain("deu_big_kiel");
    expect(desk(r)).toContain("deu_c_first_words");
  });
});

describe("Germany's schedule", () => {
  test("a visit is on the desk at once, a letter is answered next chapter", async () => {
    const { runner: r } = await gwRunner();
    order(r, { kind: "act", act: "deu_a_krupp", picks: [] });
    expect(desk(r)).toContain("deu_a_krupp_v");
    playChapter(r);
    order(r, { kind: "act", act: "deu_a_nicky", picks: ["family", "warm"] });
    playChapter(r);
    const card = seat(r).desk.find((c) => c.scene === "deu_a_nicky_r");
    expect(card?.cast.other).toBe("rus_nicholas");
  });
});

describe("Germany's rivals", () => {
  test("every man of the row has his own words and his memoir", async () => {
    const pack = await loadGwPack("DEU", json);
    const clash = pack.scenes.deu_r_clash;
    for (const id of GW_RIVAL_ROWS.DEU!) {
      expect(clash.nodes!.n2.saysBy?.[id]?.base, id).toBeTruthy();
      expect(clash.nodes!.n3.saysBy?.[id]?.base, id).toBeTruthy();
      expect(pack.scenes.deu_r_gather_dinner.voice?.rival_man[id]).toBeTruthy();
      for (const k of ["stage1", "embrace", "broken", "prevailed"]) {
        expect(pack.rivals?.[id]?.[k], `${id} ${k}`).toBeTruthy();
      }
    }
  });
});
