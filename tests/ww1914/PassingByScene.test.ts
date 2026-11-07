import { describe, expect, it } from "vitest";
import { gwRunner, playChapter } from "./util";

describe("a card that reports a death", () => {
  it("takes the person off the cast the chapter after it came", async () => {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const p = gw.person("auh_sturgkh")!;
    expect(p.office).toBe("chancellor");
    playChapter(runner);
    expect(p.status).not.toBe("dead");

    gw.s.seats[0].seen.auh_h_sturgkh_shot = gw.s.chapter;
    playChapter(runner);
    expect(p.status).toBe("dead");
    expect(p.office).toBeNull();
  });
});
