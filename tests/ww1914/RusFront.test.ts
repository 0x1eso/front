import { GW_INSTITUTIONS } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  GwSceneSchema,
  gwSceneProblems,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_PEOPLE } from "@openfront/engine-lib/ww1914/content/people";
import { RUS_PEOPLE } from "@openfront/engine-lib/ww1914/content/people_rus";
import {
  RUS_FRONT_SCENES,
  RUS_FRONT_STOOD_IN,
} from "@openfront/engine-lib/ww1914/content/scenes/rus_front";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// The fragment joins RUS.json at merge, so this test reads it on its own.
const pack: GwPack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/RUS.front.json"),
    "utf8",
  ),
);

/** Keys and flags the other shares or the world set. */
const OUTSIDE = [
  "k_alex_self",
  "k_bark_gold",
  "k_ker_depots",
  "k_nik_friend",
  "k_nik_retreat",
  "k_paleo_plea",
  "k_rodz_shells",
  "k_saz_poland",
  "k_saz_straits",
  "k_sukh_wife",
  "w_warsaw_lost",
];
/** Scenes of the other shares that this one reads. */
const OTHER_SHARES = [
  "rus_h_heir_stavka",
  "rus_h_keys",
  "rus_h_wagons",
  "rus_h_war_industry",
];
/** Secrets lane Y adds to GW_SECRETS. */
const NEW_SECRETS = [
  "rus_garrison_rotten",
  "rus_myasoedov_spy",
  "rus_palace_plot",
];

describe("the 전선 share of 러시아", () => {
  const scenes = RUS_FRONT_SCENES;

  test("the plan's counts", () => {
    const n = (p: string) => scenes.filter((s) => s.id.startsWith(p)).length;
    // Twenty-eight, and the train back that clears f_rus_in_capital.
    expect(n("rus_w_")).toBe(29);
    expect(n("rus_t_")).toBe(24);
    expect(n("rus_v_")).toBe(5);
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
      [...GW_PEOPLE, ...RUS_PEOPLE],
      OUTSIDE,
    );
    const expected = (p: string) =>
      OTHER_SHARES.some((x) => p.includes(`${x} is no scene`)) ||
      NEW_SECRETS.some((x) => p.includes(`secret ${x} is not in GW_SECRETS`));
    expect(problems.filter((p) => !expected(p))).toEqual([]);
  });

  test("every talk opens with an ask, a deal and a way to leave", () => {
    for (const s of scenes.filter((x) => x.kind === "talk")) {
      const kinds = s.nodes![s.start!].replies.map((r) => r.kind);
      for (const k of ["ask", "deal", "leave"] as const) {
        expect(kinds, `${s.id}: ${k}`).toContain(k);
      }
    }
  });

  test("the record cards stand alone: no option, no price, no other scene", () => {
    const cards = ["rus_w_record_front", "rus_w_record_prisoners"];
    for (const s of scenes) {
      if (cards.includes(s.id)) {
        expect(s.options ?? []).toEqual([]);
        expect(s.nodes).toBeUndefined();
        continue;
      }
      const lines = JSON.stringify(pack.scenes[s.id]);
      for (const word of ["추방", "노역"]) {
        expect(lines.includes(word), `${s.id}: ${word}`).toBe(false);
      }
    }
  });

  test("once lane Y is here, nothing stands in but w130-gw's two forms", () => {
    if (!(GW_INSTITUTIONS as readonly string[]).includes("stavka")) return;
    const left = RUS_FRONT_STOOD_IN.filter((x) => !x.includes("sign_chief"));
    expect(left).toEqual([]);
  });
});
