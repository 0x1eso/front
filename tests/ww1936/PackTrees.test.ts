// World War 1936 P6 (spec §11.1, plan decision 28, pre-flight §0-1): a pack
// country plays the generic tree less the pack's replaced focuses plus the
// pack's own; a replaced focus counts as bypassed; a pack focus may be one
// country's; a pack's history path skips what the country cannot take.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  inTree,
  replacedInTree,
  treePosIn,
} from "@openfront/engine-lib/ww1936/content/registry";
import { historyPath } from "@openfront/engine/ww1936/politics/AiFocus";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  focusBlock,
  startFocus,
} from "@openfront/engine/ww1936/politics/Focus";
import { DEEP } from "./deepFixture";
import { depthFixture, TEST_REPLACED } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

afterEach(() => usePoliticsContent(null));

describe("World War 1936 P6: pack trees", () => {
  it("a pack tree is the generic tree minus replaced focuses plus the pack's own", async () => {
    const content = depthFixture();
    usePoliticsContent(content);
    const generic = content.treeFocuses.generic.map(
      (i) => content.focuses[i].id,
    );
    const spa = content.treeFocuses.spa.map((i) => content.focuses[i].id);
    expect(spa).toEqual([
      ...generic.filter((id) => id !== TEST_REPLACED),
      "spa_test_a",
      "spa_test_b",
      "spa_test_c",
    ]);
    expect(inTree(content, "spa", TEST_REPLACED)).toBe(false);
    expect(replacedInTree(content, "spa", TEST_REPLACED)).toBe(true);
    // A generic focus keeps its own position list in each tree.
    expect(treePosIn(content, "spa", "spa_test_a")).toBe(generic.length - 1);
    const runner = await wwRunner({}, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const pol = runner.game.worldWar()!.politics;
    const ita = pol.country(DEEP.tag.ITA)!;
    expect(ita.tree).toBe("spa");
    expect(ita.focusState.length).toBe(spa.length);
    // Italy's own pack focus; another country's is unavailable; the
    // replaced generic focus is not in Italy's tree.
    expect(focusBlock(pol, DEEP.tag.ITA, "spa_test_a", false)).toBeNull();
    expect(focusBlock(pol, DEEP.tag.ITA, "spa_test_c", false)).toBe(
      "focus_unavailable",
    );
    expect(focusBlock(pol, DEEP.tag.ITA, TEST_REPLACED, false)).toBe(
      "focus_unavailable",
    );
    // A generic country cannot take a pack focus.
    expect(focusBlock(pol, DEEP.tag.DEU, "spa_test_a", false)).toBe(
      "focus_unavailable",
    );
  });

  it("a replaced prerequisite counts as bypassed", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner({}, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const pol = runner.game.worldWar()!.politics;
    // (The AI has started a focus by now: none runs for this check.)
    pol.country(DEEP.tag.ITA)!.focus = null;
    pol.country(DEEP.tag.DEU)!.focus = null;
    pol.country(DEEP.tag.ITA)!.queued = null;
    pol.country(DEEP.tag.DEU)!.queued = null;
    // gen_t_b needs gen_t_a: open for Italy (replaced = bypassed), not for Germany.
    expect(focusBlock(pol, DEEP.tag.ITA, "gen_t_b", false)).toBeNull();
    expect(focusBlock(pol, DEEP.tag.DEU, "gen_t_b", false)).toBe(
      "focus_prereq",
    );
    // A pack focus done is written at its pack position.
    const ita = pol.country(DEEP.tag.ITA)!;
    if (ita.focus !== null) ita.focus = null;
    expect(
      startFocus(pol, DEEP.tag.ITA, "spa_test_a", runner.game.ticks()),
    ).toBeNull();
  });

  it("a pack's history path skips the focuses its country cannot take", async () => {
    usePoliticsContent(
      depthFixture({
        paths: {
          generic: ["gen_t_a"],
          spa: ["spa_test_c", "spa_test_a", "spa_test_b"],
        },
      }),
    );
    const runner = await wwRunner({}, [], DEEP.map);
    const pol = runner.game.worldWar()!.politics;
    expect(historyPath(pol, pol.country(DEEP.tag.ITA)!)).toEqual([
      "spa_test_a",
      "spa_test_b",
    ]);
  });
});
