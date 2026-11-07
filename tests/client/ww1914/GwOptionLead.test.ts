import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { optionSplit } from "../../../src/client/hud/ww1914/GwText";

describe("an option before the choice", () => {
  test("a bold lead is the action and the rest is the result", () => {
    expect(optionSplit("**서명한다.** 공채로 간다. 의회가 좋아한다.")).toEqual({
      lead: "서명한다.",
      rest: "공채로 간다. 의회가 좋아한다.",
    });
  });

  test("a plain option shows its first sentence", () => {
    expect(
      optionSplit(
        "규정대로 한다. 공의 안에 서명한다. 황족 몇이 불만을 삼킨다.",
      ),
    ).toEqual({
      lead: "규정대로 한다.",
      rest: "공의 안에 서명한다. 황족 몇이 불만을 삼킨다.",
    });
    expect(optionSplit("지켜본다.")).toEqual({ lead: "지켜본다.", rest: "" });
  });

  test("a quoted line keeps its quote; a hole is left for the filler", () => {
    expect(optionSplit("'옳다, 침착하게'라고 적는다. 빈이 듣는다.").lead).toBe(
      "'옳다, 침착하게'라고 적는다.",
    );
    expect(optionSplit("{fm}을(를) 보낸다. 길이 멀다.").lead).toBe(
      "{fm}을(를) 보낸다.",
    );
  });

  test("every shipped option has a lead that is one clean sentence", () => {
    const dir = "resources/ww1914/ko";
    let n = 0;
    for (const f of readdirSync(dir)) {
      const pack = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
      for (const s of Object.values<any>(pack.scenes ?? {})) {
        const maps = [s.opt, ...Object.values<any>(s.optBy ?? {})];
        for (const m of maps.filter(Boolean)) {
          for (const v of Object.values<string>(m)) {
            const { lead } = optionSplit(v);
            n++;
            expect(lead, v).not.toBe("");
            expect(lead, v).toMatch(/[.!?…]$/);
            expect((lead.match(/["“]/g) ?? []).length % 2, v).toBe(0);
          }
        }
      }
    }
    expect(n).toBeGreaterThan(2000);
  });
});
