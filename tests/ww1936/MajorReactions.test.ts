// ww229 MR1 (design ww227 §7): Germany, Italy and the Soviet Union answer
// the minors' moves: their reaction focuses and beats, the world events, and
// the minors' new answers to the majors' old demands. Kept out of the Imjin
// content.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { IMJIN_CONTENT_PARTS } from "@openfront/engine-lib/imjin/Content";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { MR1_REACTIONS } from "@openfront/engine-lib/ww1936/content/reactions/mr1";
import {
  CONTENT,
  CONTENT_PARTS_BASE,
  inTree,
} from "@openfront/engine-lib/ww1936/content/registry";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { forceFocusNext } from "@openfront/engine/ww1936/politics/AiFocus";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { focusFinished } from "@openfront/engine/ww1936/politics/Focus";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { step, stepTo, wwGameStart } from "./util";

const opts = (
  parts: {
    events: readonly { id: string; options: readonly { id: string }[] }[];
  },
  id: string,
) => parts.events.find((e) => e.id === id)!.options.map((o) => o.id);

describe("ww229 MR1: the majors' reactions (data)", () => {
  it("each major has 4-8 reaction focuses in its own tree, every beat names one of its actor's", () => {
    for (const tag of ["DEU", "ITA", "SUN"] as const) {
      const mine = MR1_REACTIONS.focuses.filter((f) => f.tree === tag);
      expect(mine.length, tag).toBeGreaterThanOrEqual(4);
      expect(mine.length, tag).toBeLessThanOrEqual(8);
      for (const f of mine) {
        expect(f.id.startsWith(`${tag.toLowerCase()}_mr_`), f.id).toBe(true);
        expect(inTree(CONTENT, tag, f.id), f.id).toBe(true);
      }
    }
    for (const b of MR1_REACTIONS.beats) {
      expect(b.act.kind, b.id).toBe("focus");
      if (b.act.kind === "focus") {
        expect(inTree(CONTENT, b.actor as "DEU", b.act.id), b.id).toBe(true);
      }
    }
  });

  it("the minors' answers join the 1936 demands, never the base or Imjin content", () => {
    expect(opts(CONTENT, "csk_munich_dictate")).toEqual(["a", "b", "c", "d"]);
    expect(opts(CONTENT, "rou_bessarabia_ultimatum")).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(opts(CONTENT, "fin_soviet_demands")).toEqual(["a", "b", "c"]);
    expect(opts(CONTENT_PARTS_BASE, "csk_munich_dictate")).toEqual(["a", "b"]);
    expect(opts(IMJIN_CONTENT_PARTS, "csk_munich_dictate")).toEqual(["a", "b"]);
    const mr = new Set(MR1_REACTIONS.events.map((e) => e.id));
    expect(IMJIN_CONTENT_PARTS.events.some((e) => mr.has(e.id))).toBe(false);
    expect(IMJIN_CONTENT_PARTS.beats.length).toBe(0);
    // A replaced AI weight keeps the option's effects.
    const a =
      CONTENT.events[CONTENT.eventIdx.get("fin_soviet_demands")!].options[0];
    expect(a.ai.mods?.length).toBe(2);
    expect(a.effects.length).toBeGreaterThan(0);
  });
});

describe("ww229 MR1: the majors' reactions (real map and content)", () => {
  beforeEach(() => usePoliticsContent(null));

  it("a Danubian Federation reaches Berlin, Rome and Moscow; Berlin opens its Danubian question", async () => {
    const maps = new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    );
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const pol = ww.politics;
    pol.gflags.set("danubian_federation_formed", 0);
    const tags = ["DEU", "ITA", "SUN"] as const;
    const ids = tags.map((t) => pol.idOfTag(t));
    const start = ww.day(runner.game.ticks());
    const answered = () =>
      ids.every((id) => pol.country(id)!.firedOnce.has("mr_danube_hun"));
    while (!answered() && ww.day(runner.game.ticks()) < start + 120) {
      step(runner);
    }
    expect(answered()).toBe(true);
    // The beat is due from the first spring (focusBeat's date).
    const deu = pol.country(ids[0])!;
    const opened = () =>
      deu.focus?.id === "deu_mr_danubian_question" ||
      deu.queue.includes("deu_mr_danubian_question") ||
      focusFinished(pol, deu, "deu_mr_danubian_question");
    // One beat in ten is rolled away (history's 1-in-10 skip): not this one.
    const bi = pol.content.beats.findIndex((b) => b.id === "mr_deu_danube");
    pol.beats[bi].skipped = false;
    const until = dayOfDate("1936-03-01") + 25;
    while (!opened() && ww.day(runner.game.ticks()) < until) step(runner);
    expect(opened()).toBe(true);
    // A later focus beat goes first and keeps the one queued before it.
    deu.focus ??= { id: "deu_mr_danubian_question", progressMilli: 0 };
    deu.queue = ["deu_mr_southeast_oil"];
    forceFocusNext(pol, ids[0], "deu_mr_northern_ore");
    expect(deu.queue).toEqual(["deu_mr_northern_ore", "deu_mr_southeast_oil"]);
  }, 300_000);
});
