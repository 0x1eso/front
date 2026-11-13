import { gwSocietyStart } from "@openfront/engine-api/ww1914/GwSociety";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_RULERS } from "@openfront/engine-lib/ww1914/RulerRows";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { placeRow } from "@openfront/engine/ww1914/Persona";
import { changeRegime } from "@openfront/engine/ww1914/Regimes";
import { rulerStep } from "@openfront/engine/ww1914/Ruler";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

// ww208, decision 1B (lane P): a utopia the player carried through that
// removes the person brings a card: end here (the head's winning ending), or
// play on as the new head. One forced by defeat or revolution still ends.

const json = (p: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../resources", p), "utf8"),
  );

async function germany(): Promise<GreatWar> {
  const { runner } = await gwRunner();
  return runner.game.greatWar()!;
}

/** The SPD's republic, realised: the card asks (choice null). */
function realised(gw: GreatWar) {
  const st = gw.s.seats[0];
  st.society = gwSocietyStart();
  st.society.utopia = {
    faction: "deu_spd",
    chapter: gw.s.chapter,
    regime: "republic",
    head: "ebert",
    choice: null,
  };
  changeRegime(gw, "DEU", "republic");
  return st;
}

describe("the heads a utopia brings (ww208 1B)", () => {
  test("the card waits, then the seat plays on as Ebert; a later fall ends it", async () => {
    const gw = await germany();
    const st = realised(gw);
    rulerStep(gw);
    expect(gw.s.ended).toBeNull();
    expect(st.ruler.id).toBe("wilhelm");

    st.society!.utopia!.choice = "play";
    rulerStep(gw);
    expect(gw.s.ended).toBeNull();
    expect(st.ruler.id).toBe("ebert");
    expect(placeRow(gw, st)?.id).toBe("deu_pl_ebert_chancellery");

    // Forced back out of his form: his game ends with his own ending.
    gw.nation("DEU")!.regime = "empire";
    rulerStep(gw);
    expect(gw.s.ended).toBe("deu_head_ebert_out");
  });

  test("ending at the card is the head's winning ending; no utopia, the old ending", async () => {
    const gw = await germany();
    const st = realised(gw);
    st.society!.utopia!.choice = "end";
    rulerStep(gw);
    expect(gw.s.ended).toBe("deu_head_ebert_won");

    const forced = await germany();
    changeRegime(forced, "DEU", "republic");
    rulerStep(forced);
    expect(forced.s.ended).toBe("deu_end_holland");
  });

  test("every head has his persona rows, card words and endings", async () => {
    const heads = Object.entries(GW_RULERS).flatMap(([tag, rows]) =>
      (rows ?? []).filter((r) => r.head === true).map((r) => ({ tag, r })),
    );
    expect(heads.map((h) => h.r.id).sort()).toEqual([
      "ebert",
      "henderson",
      "kerensky",
      "lammasch",
      "lvov",
      "orleans",
      "renner",
    ]);
    const persona = gwContent().persona!;
    const scenes = new Set(gwContent().scenes.map((s) => s.id));
    for (const { tag, r } of heads) {
      const pack = await loadGwPack(tag as "DEU", async (p) => json(p));
      const mine = <T extends { ruler?: string }>(xs: readonly T[]) =>
        xs.filter((x) => x.ruler === r.id);
      expect(mine(persona.places ?? []).length, r.id).toBeGreaterThan(0);
      expect(mine(persona.bearers ?? []).length, r.id).toBeGreaterThan(0);
      for (const x of mine(persona.places ?? [])) {
        expect(pack.persona?.places?.[x.id], x.id).toBeTruthy();
      }
      for (const x of mine(persona.bearers ?? [])) {
        expect(pack.persona?.bearers?.[x.id], x.id).toBeTruthy();
      }
      for (const x of mine(persona.diary ?? [])) {
        expect(pack.persona?.diary?.[x.id], x.id).toBeTruthy();
      }
      expect(pack.rulers?.[r.id], r.id).toBeTruthy();
      for (const e of [r.won, r.gone?.death, r.gone?.removed, r.ends?.["*"]]) {
        expect(e, r.id).toBeTruthy();
        expect(pack.endings?.[e!], e).toBeTruthy();
      }
      for (const s of [r.doctors, r.shaken, r.broken]) {
        expect(scenes.has(s!), s!).toBe(true);
        expect(pack.scenes[s!], s!).toBeTruthy();
      }
    }
  });
});
