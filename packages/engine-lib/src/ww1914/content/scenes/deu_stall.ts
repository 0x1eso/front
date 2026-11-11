// Great War 1914 (ww173 phase A): DEU's scenes of a front that breaks from
// strain: its own end's collapse (`deu_w_collapse`, the four options
// `sack`, `river`, `allies`, `peace`), and the enemy's. Owned by the DEU
// writer lane; shapes and conditions in /home/eser/dev/ww173-format7a.md,
// conditions from ./stall_events. Text in resources/ww1914/ko/DEU.stall.json.
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  flag,
  inst_,
  reason,
  remember,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { collapsed, foeCollapsed } from "./stall_events";

const cmd = role("cmd");

const republic = world({ is: "regime", tag: "DEU", of: ["republic"] });
const third = flag("f_third_ohl");

/** The broken end is ours: the army's own seat card. */
const COLLAPSE: GwScene = {
  id: "deu_w_collapse",
  nation: ["DEU"],
  kind: "proposal",
  scheduledOnly: true,
  cast: {
    cmd: {
      any_of: [
        { called: true },
        { office: "chief_of_staff" },
        { office: "war" },
      ],
    },
  },
  salience: 9,
  tags: ["war", "tension_up"],
  variants: [
    { id: "republic", when: republic },
    {
      id: "west_ohl",
      when: all(third, collapsed(["west", "low_countries"])),
    },
    { id: "west", when: collapsed(["west", "low_countries"]) },
    { id: "east", when: collapsed(["east"]) },
    {
      id: "south",
      when: collapsed(["balkan", "danube", "dobruja", "italy", "alps"]),
    },
    { id: "base" },
  ],
  fallback: "river",
  options: [
    {
      id: "sack",
      tell: [],
      effects: [
        doWorld({ do: "leave", who: cmd }),
        inst_("army", -1),
        reason("deu_w_collapse_sack"),
      ],
    },
    {
      id: "river",
      tell: [],
      effects: [
        inst_("army", 1),
        remember("deu_stood_at_river"),
        reason("deu_w_collapse_river"),
      ],
    },
    {
      id: "allies",
      tell: [],
      effects: [remember("deu_asked_allies"), reason("deu_w_collapse_allies")],
    },
    {
      id: "peace",
      tell: [],
      effects: [
        doWorld({ do: "talks" }),
        inst_("reichstag", 1),
        inst_("army", -1),
        reason("deu_w_collapse_peace"),
      ],
    },
  ],
};

/** The enemy's end broke: read and laid aside, back again after a while. */
const foeWire = (
  id: string,
  when: GwScene["when"],
  variants: GwScene["variants"],
): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "wire",
  once: false,
  cooldown: 6,
  salience: 6,
  tags: ["war"],
  cast: { cos: { office: "chief_of_staff" } },
  when,
  variants,
});

export const DEU_STALL_EVENTS: readonly GwScene[] = [
  COLLAPSE,
  foeWire("deu_w_foe_east", foeCollapsed(["east"], 0), [
    {
      id: "kerensky",
      when: world({ is: "regime", tag: "RUS", of: ["provisional", "rep"] }),
    },
    { id: "base" },
  ]),
  foeWire("deu_w_foe_west", foeCollapsed(["west", "low_countries"], 0), [
    { id: "base" },
  ]),
  foeWire(
    "deu_w_foe_south",
    foeCollapsed(["italy", "alps", "balkan", "danube", "dobruja"], 0),
    [{ id: "italy", when: foeCollapsed(["italy", "alps"], 0) }, { id: "base" }],
  ),
];
