// Great War 1914 (ww190 §8): Austria-Hungary's named agents. Data only; the
// text is in resources/ww1914/ko/AUH.agents.json. The agent ids are S2's
// GW_AGENTS rows: `zurich_net`, `svu`, `pow_polish`.
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import { atWar, card, gauge, inst, office, pick, trust, w } from "./auh_years";

const INTEL = office("intelligence");
const FM = office("foreign");
const NAVY = office("navy");

const working = (id: string) => w({ is: "agent", can: "working", id });

export const AUH_AGENTS_SCENES: readonly GwScene[] = [
  card({
    id: "auh_ag_zurich",
    when: all(atWar("ITA"), working("zurich_net")),
    cast: { navy: NAVY },
    vs: [["long", w({ is: "war_months", own: true, min: 18 })], ["base"]],
    picks: [
      pick("ships", gauge("money", -1), trust("CHE", -1)),
      pick("eyes", inst("army", -1)),
    ],
    tags: ["war"],
    cooldown: 6,
    max: 2,
  }),
  card({
    id: "auh_ag_zurich_lost",
    when: all(w({ is: "agent", can: "lost", id: "zurich_net" }), {
      kind: "seen",
      scene: "auh_ag_zurich",
    }),
    cast: { fm: FM },
    vs: [["base"]],
    picks: [
      pick("deny", trust("CHE", -1)),
      pick("recall", gauge("money", -1), trust("CHE", 1)),
    ],
    tags: ["war", "foreign"],
    once: true,
  }),
  card({
    id: "auh_ag_svu",
    when: all(atWar("RUS"), working("svu")),
    cast: { fm: FM },
    vs: [
      ["prisoners", w({ is: "prisoners", held: "ours", tag: "RUS", min: 100 })],
      ["base"],
    ],
    picks: [
      pick("camp", trust("RUS", -1), inst("nations", 1)),
      pick("stop", inst("nations", -1)),
    ],
    tags: ["war", "foreign"],
    once: true,
  }),
  card({
    id: "auh_ag_polish_pow",
    when: all(atWar("RUS"), working("pow_polish")),
    cast: { intel: INTEL },
    vs: [["kingdom", w({ is: "rule", client: "poland" })], ["base"]],
    picks: [
      pick("trust_them", inst("nations", 1), trust("DEU", -1)),
      pick("watch_them", inst("army", 1), inst("nations", -1)),
    ],
    tags: ["war"],
    once: true,
  }),
  card({
    id: "auh_ag_hire",
    when: all(w({ is: "war" }), w({ is: "agent", can: "hire" })),
    cast: { intel: INTEL },
    vs: [["italy", atWar("ITA")], ["base"]],
    picks: [
      pick("hire", doWorld({ do: "agent" }), gauge("money", -1)),
      pick("not_now"),
    ],
    tags: ["war"],
    cooldown: 6,
    max: 2,
  }),
];
