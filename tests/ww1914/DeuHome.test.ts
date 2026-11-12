import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { GW_PEOPLE_DEU } from "@openfront/engine-lib/ww1914/content/people_deu";
import { DEU_HOME_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/deu_home";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { gwRunner, order, playChapter, seat, view } from "./util";

// The fragment joins the DEU pack at merge, so this test reads it on its own.
const pack: GwPack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/DEU.home.json"),
    "utf8",
  ),
);

/** Set by the 1914 shares, the other 1915-18 shares, or lane Y. */
const OUTSIDE = [
  "f_third_ohl",
  "f_aims_full",
  "f_no_annex_belgium",
  "k_delb_bread",
  "k_delb_bridge",
  "k_haase_met",
  "k_bauer_triple",
  "k_bauer_press",
  "k_erz_numbers",
  "k_tirp_party",
  "rally_banned",
  "rally_allowed",
  "arrests_done",
  "haase_was_told_no_list",
  "m_nitrate",
  "m_raw_office",
];
/** Scenes of the other shares that this one reads. */
const OTHER_SHARES = [
  "deu_k_peace_resolution",
  "deu_k_easter_message",
  "deu_k_spa",
  "deu_s_papal_note",
  "deu_s_pless",
  "gw_credits",
  "gw_d_stockholm",
];
/** The plan's talks with no bargain in them. */
const NO_DEAL = [
  "deu_t2_ebert_sons",
  "deu_v2_rathenau_census",
  "deu_v2_ballin_last",
];

describe("the home share of Germany", () => {
  const scenes = DEU_HOME_SCENES;

  test("the plan's counts, and Ballin's one line", () => {
    const n = (p: string) => scenes.filter((s) => s.id.startsWith(p)).length;
    // deu_h_ballin_record went in f17a62327 (only its date stood behind it).
    expect(n("deu_h_")).toBe(27);
    expect(n("deu_t2_")).toBe(24);
    expect(n("deu_v2_")).toBe(5);
  });

  test("every scene passes its schema and the scene checks", () => {
    for (const s of scenes) {
      GwSceneSchema.parse(s);
      expect(gwSceneProblems(s)).toEqual([]);
    }
  });

  test("the pack holds every line, with no hole left unfilled", () => {
    expect(gwPackProblems(scenes, pack)).toEqual([]);
  });

  test("no reference leads nowhere, past what the merge brings", () => {
    const problems = gwContentProblems(
      scenes,
      [...GW_PEOPLE, ...GW_PEOPLE_DEU],
      OUTSIDE,
    );
    const expected = (p: string) =>
      OTHER_SHARES.some((x) => p.includes(`${x} is no scene`));
    expect(problems.filter((p) => !expected(p))).toEqual([]);
  });

  test("every talk has an ask, a push, a deal and a way to leave", () => {
    for (const s of scenes.filter((x) => x.kind === "talk")) {
      const kinds = s.nodes![s.start!].replies.map((r) => r.kind);
      expect(kinds, `${s.id}: leave`).toContain("leave");
      if (NO_DEAL.includes(s.id)) continue;
      for (const k of ["ask", "push", "deal"] as const) {
        expect(kinds, `${s.id}: ${k}`).toContain(k);
      }
    }
  });

  test("a decision has three to six options and a fallback", () => {
    for (const s of scenes.filter((x) => (x.options ?? []).length > 0)) {
      expect(s.options!.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.options!.length, s.id).toBeLessThanOrEqual(6);
      expect(s.fallback, s.id).toBeDefined();
    }
  });

  test("record cards have no option and no cast", () => {
    for (const id of ["deu_h_fleet_record", "deu_h_census_record"]) {
      const s = scenes.find((x) => x.id === id)!;
      expect(s.kind).toBe("report");
      expect(s.options ?? []).toEqual([]);
      expect(s.cast).toEqual({});
    }
  });

  test("in 1915 a German seat summons Helfferich, who takes the Treasury", async () => {
    const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
    // Those due on 1 January 1915 are there from the next chapter.
    while (view(runner).chapter < 12) playChapter(runner);
    order(runner, {
      kind: "summon",
      person: "deu_helfferich",
      topic: "deu_t2_helf_debt",
    });
    const card = seat(runner).desk.find((c) => c.scene === "deu_t2_helf_debt")!;
    expect(card.node).toBe("open");
    order(runner, { kind: "reply", card: card.uid, reply: "seat" });
    const gw = runner.game.greatWar()!;
    expect(gw.s.seats[0].memory.map((m) => m.key)).toContain("k_helf_debt");
    expect(gw.person("deu_helfferich")?.office).toBe("finance");
  });
});
