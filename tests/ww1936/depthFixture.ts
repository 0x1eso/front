// World War 1936 P6 (plan Task 1 Step 19): the test content of the depth
// game tests, over P5's endgameFixture. The deep map has regions 1–12
// only, so the endgame rows naming the end map's regions 13–20 are dropped
// (pre-flight §A20). Its keys are test-only (the content key checks skip
// it). Lanes add their own data: usePoliticsContent(depthFixture({ … })).
import type {
  DesignDef,
  FocusPackDef,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  ContentParts,
  ContentRegistry,
} from "@openfront/engine-lib/ww1936/content/registry";
import type {
  CountryPoliticsDef,
  FocusDef,
} from "@openfront/engine-lib/ww1936/content/types";
import { recommendedTank } from "@openfront/engine-lib/ww1936/DesignRules";
import { endgameFixture } from "./endgameFixture";
import { politicsFixture } from "./politicsFixture";

/** The deep map's last region (pre-flight §A20). */
const DEEP_MAX_REGION = 12;

/** Spec §5.2.3: the medium II recommended tank. */
export const TEST_TANK: DesignDef = {
  ...recommendedTank("medium_2", new Set(WW_TECH_IDS), "tank"),
  name: "Test Tank",
};

/** The pack generic focus it replaces: P3's test content has no gen_pol_claims. */
export const TEST_REPLACED = "gen_t_a";

export const TEST_PACK: FocusPackDef = { id: "spa", replaces: [TEST_REPLACED] };

/** The pack's own test focuses (columns 20+): a is Italy's, b follows a, c is another country's. */
export const TEST_PACK_FOCUSES: FocusDef[] = [
  {
    id: "spa_test_a",
    tree: "spa",
    x: 20,
    y: 0,
    days: 35,
    branch: "politics",
    icon: "flag",
    countries: ["ITA"],
    prereq: [[TEST_REPLACED]],
    effects: [{ kind: "pp", amount: 10 }],
  },
  {
    id: "spa_test_b",
    tree: "spa",
    x: 21,
    y: 1,
    days: 35,
    branch: "politics",
    icon: "flag",
    prereq: [["spa_test_a"]],
    effects: [{ kind: "pp", amount: 10 }],
  },
  {
    id: "spa_test_c",
    tree: "spa",
    x: 22,
    y: 0,
    days: 35,
    branch: "politics",
    icon: "flag",
    countries: ["ESN"],
    effects: [],
  },
];

/** Italy plays the spa pack in the test content. */
export const TEST_ITA: CountryPoliticsDef = {
  tag: "ITA",
  ruling: "fascist",
  popularity: [10, 5, 70, 15],
  stability: 55,
  warSupport: 60,
  tree: "spa",
  leaders: {},
};

const onDeepMap = (regions: readonly number[]) =>
  regions.every((r) => r <= DEEP_MAX_REGION);

/** P5's endgameFixture without the end map's rows, plus the pack content (and `extra`). */
export function depthFixture(
  extra: Partial<ContentParts> = {},
): ContentRegistry {
  const end = endgameFixture();
  const groups = end.groups.filter((g) => onDeepMap(g.regions));
  const ids = new Set(groups.map((g) => g.id));
  const base = politicsFixture();
  return endgameFixture({
    groups,
    cores: end.cores.filter((c) => c.groups.every((g) => ids.has(g))),
    peace: [],
    focuses: [...base.focuses, ...TEST_PACK_FOCUSES],
    countries: [TEST_ITA],
    packs: [TEST_PACK],
    ...extra,
  });
}
