import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { describe, expect, test } from "vitest";
import { step } from "../ww1936/util";
import { gwRunner, order, seat } from "./util";

const PLAY = { greatWar1914Prologue: { play: true, picks: [] } };

/** Wilhelm's years to the end, taking `pick` at each fork it names. */
function live(r: GameRunner, take: readonly string[]): string[] {
  const seen: string[] = [];
  for (let i = 0; i < 200 && seat(r).prologue?.done === false; i++) {
    const card = seat(r).desk[0];
    if (card === undefined) {
      step(r, 2);
      continue;
    }
    if (!seen.includes(card.scene)) seen.push(card.scene);
    if (card.silent === true) {
      order(r, { kind: "read", card: card.uid });
      continue;
    }
    const ids = card.replies.map((x) => x.id);
    const pick = ids.find((x) => take.includes(x)) ?? ids[0];
    order(r, { kind: "reply", card: card.uid, reply: pick });
  }
  return seen;
}

describe("Wilhelm's prologue", () => {
  test("seven years in order, then chapter 0, with what they left", async () => {
    useGwContent(GW_CONTENT);
    const { runner: r } = await gwRunner(PLAY);
    const seen = live(r, [
      "hide",
      "england",
      "wire",
      "fleet",
      "drawer",
      "name",
    ]);
    expect(seen.filter((x) => !x.endsWith("_after")).slice(0, 3)).toEqual([
      "deu_pro_arm",
      "deu_pro_father",
      "deu_pro_father_note",
    ]);
    expect(seen).toContain("deu_pro_june_after");
    const s = r.game.greatWar()!.s.seats[0];
    expect(s.flags).toEqual(
      expect.arrayContaining([
        "pro_deu_arm_hid",
        "pro_deu_father_england",
        "pro_deu_pilot_wire",
        "pro_deu_fleet_first",
        "pro_deu_bjorko_kept",
        "pro_deu_julius_name",
      ]),
    );
    expect(s.prologue?.temper).not.toBeNull();
    step(r, 2);
    expect(seat(r).prologue?.done).toBe(true);
    expect(seat(r).desk.length).toBeGreaterThan(0);
  }, 60_000);
});
