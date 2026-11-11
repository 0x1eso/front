// ww180: the chain of direction-finding stations at sea (engine/ww1914/
// NavalIntel), as rows of the 정보부 tab's sea section. Text in
// resources/ww1914/ko/common.sea.json.
import type { GwAct } from "@openfront/engine-api/ww1914/GwActs";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwNavalAct } from "@openfront/engine-api/ww1914/GwNaval";
import type {
  GwEffect,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/** The seats with a fleet on the sea front. */
const SEA: GwTag[] = ["DEU", "GBR"];
const money: GwEffect = { kind: "gauge", gauge: "money", delta: -1 };
const naval = (act: GwNavalAct): GwEffect => doWorld({ do: "naval", act });

export const NAVAL_ACTS: readonly GwAct[] = [
  {
    id: "gw_a_sea_df",
    nation: SEA,
    kind: "intrigue",
    stage: ["war"],
    when: world({ is: "naval", can: "build" }),
    once: true,
    scene: "gw_sea_df_r",
    wait: 1,
    tell: ["money:-1"],
    effects: [money, naval("build")],
  },
  {
    id: "gw_a_sea_use",
    nation: SEA,
    kind: "intrigue",
    stage: ["war"],
    when: world({ is: "naval", can: "use" }),
    cooldown: 2,
    scene: "gw_sea_use_r",
    wait: 0,
    fields: [
      {
        id: "how",
        options: (["listen", "fleet", "all"] as const).map((x) => ({
          id: x,
          effects: [naval(x)],
        })),
      },
    ],
  },
];

const v = (id: "listen" | "fleet"): GwVariant => ({
  id,
  when: world({ is: "naval", can: id }),
});

/** The result cards: a short wire with no chrome, laid by the schedule. */
const card = (id: string, variants: GwVariant[]): GwScene => ({
  id,
  nation: SEA,
  kind: "wire",
  scheduledOnly: true,
  silent: true,
  cast: {},
  salience: 5,
  tags: ["war"],
  variants,
});

export const NAVAL_ACT_SCENES: readonly GwScene[] = [
  card("gw_sea_df_r", [{ id: "base" }]),
  // The last is the base: "all" is what is left once the other two fail.
  card("gw_sea_use_r", [v("listen"), v("fleet"), { id: "all" }]),
];
