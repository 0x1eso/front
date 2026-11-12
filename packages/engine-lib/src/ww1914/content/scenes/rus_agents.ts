import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { any } from "@openfront/engine-api/ww1914/SceneDsl";
import { dw, held, inst, men, o, rusScene, trust, v, w } from "./rus_years";

/**
 * RUS's scenes: named agents (ww190 §8, `rus_ag_*`), by the GW_AGENTS rows S2
 * appends: `ignatiev` (Colonel Pavel Ignatiev's bureau in Paris, eyes on
 * Germany) and `druzhina` (the Czech Druzhina's scouts, eyes and papers on
 * Austria). Hiring, the work, the loss. Text: resources/ww1914/ko/RUS.agents.json.
 */

const agent = (can: "hire" | "working" | "lost", id: string): GwCond =>
  w({ is: "agent", can, id });

const SPY = { spy: held("intelligence") };
const COS = { cos: held("chief_of_staff") };

export const RUS_AGENTS_SCENES: readonly GwScene[] = [
  rusScene("rus_ag_hire", {
    kind: "proposal",
    when: any(agent("hire", "ignatiev"), agent("hire", "druzhina")),
    cast: { ...SPY },
    salience: 5,
    tags: ["war", "foreign"],
    cooldown: 4,
    variants: [v("base")],
    options: [
      o(
        "ignatiev",
        [dw({ do: "agent", id: "ignatiev" })],
        agent("hire", "ignatiev"),
      ),
      o(
        "druzhina",
        [dw({ do: "agent", id: "druzhina" })],
        agent("hire", "druzhina"),
      ),
      o("later", [inst("stavka", -1)]),
    ],
  }),
  rusScene("rus_ag_ignatiev_report", {
    kind: "proposal",
    when: agent("working", "ignatiev"),
    cast: { ...SPY, ...COS },
    salience: 5,
    tags: ["war", "foreign"],
    cooldown: 4,
    variants: [v("base")],
    options: [
      o("stavka", [inst("stavka", 1)]),
      o("paris", [trust("FRA", 1)]),
      o("drawer", [inst("stavka", -1)]),
    ],
  }),
  rusScene("rus_ag_ignatiev_lost", {
    kind: "wire",
    when: agent("lost", "ignatiev"),
    cast: { ...SPY },
    salience: 5,
    tags: ["war"],
    once: true,
    variants: [v("base")],
  }),
  rusScene("rus_ag_druzhina_work", {
    kind: "proposal",
    when: agent("working", "druzhina"),
    cast: { ...COS },
    salience: 5,
    tags: ["war"],
    cooldown: 4,
    variants: [v("base")],
    options: [
      o("leaflets", [dw({ do: "stir", tag: "AUH", delta: 1 })]),
      o("scouts", [inst("stavka", 1)]),
      o("legion", [men(1), inst("court", -1)]),
    ],
  }),
  rusScene("rus_ag_druzhina_lost", {
    kind: "wire",
    when: agent("lost", "druzhina"),
    cast: { ...COS },
    salience: 5,
    tags: ["war"],
    once: true,
    variants: [v("base")],
  }),
];
