// Great War 1914: the house's tables and the talks made from them (ww158). A
// later country adds its file's exports here, one line each. A house comes
// into play only once its country has factions.
import type {
  GwCastRule,
  GwNode,
  GwReply,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  decide,
  flag,
  moody,
  not,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GwBillRow,
  GwFactionRow,
  GwHouseContent,
  houseIds,
} from "../../HouseRows";
import type { GwLawRow } from "../../LawRows";
import {
  AUH_ASKS,
  AUH_BILLS,
  AUH_FACTIONS,
  AUH_HOUSE_LAWS,
  AUH_HOUSE_SCENES,
  AUH_PLOT_SCENES,
  AUH_PLOTS,
  AUH_WEAK,
} from "../house/auh";
import {
  DEU_ASKS,
  DEU_BILLS,
  DEU_FACTIONS,
  DEU_HOUSE_LAWS,
  DEU_HOUSE_SCENES,
  DEU_PLOT_SCENES,
  DEU_PLOTS,
  DEU_WEAK,
} from "../house/deu";
import {
  GBR_ASKS,
  GBR_BILLS,
  GBR_FACTIONS,
  GBR_HOUSE_LAWS,
  GBR_HOUSE_SCENES,
  GBR_PLOT_SCENES,
  GBR_PLOTS,
  GBR_WEAK,
} from "../house/gbr";
import { GW_HOUSE_ROWS } from "../house/houses";
import {
  RUS_ASKS,
  RUS_BILLS,
  RUS_FACTIONS,
  RUS_HOUSE_LAWS,
  RUS_HOUSE_SCENES,
  RUS_PLOT_SCENES,
  RUS_PLOTS,
  RUS_WEAK,
} from "../house/rus";

/** The factions' own bills, joined to GW_LAWS. */
export const GW_HOUSE_LAWS: readonly GwLawRow[] = [
  ...DEU_HOUSE_LAWS,
  ...GBR_HOUSE_LAWS,
  ...AUH_HOUSE_LAWS,
  ...RUS_HOUSE_LAWS,
];

const factions: readonly GwFactionRow[] = [
  ...DEU_FACTIONS,
  ...GBR_FACTIONS,
  ...AUH_FACTIONS,
  ...RUS_FACTIONS,
];

/** Every house row, its factions, bills and S2 rows. */
export const GW_HOUSE_CONTENT: GwHouseContent = {
  houses: GW_HOUSE_ROWS.filter((h) => factions.some((f) => f.tag === h.tag)),
  factions,
  bills: [...DEU_BILLS, ...GBR_BILLS, ...AUH_BILLS, ...RUS_BILLS],
  plots: [...DEU_PLOTS, ...GBR_PLOTS, ...AUH_PLOTS, ...RUS_PLOTS],
  weak: [...DEU_WEAK, ...GBR_WEAK, ...AUH_WEAK, ...RUS_WEAK],
  asks: [...DEU_ASKS, ...GBR_ASKS, ...AUH_ASKS, ...RUS_ASKS],
};

/** Scenes written by hand in the house files. */
export const HOUSE_WRITTEN_SCENES: readonly GwScene[] = [
  ...DEU_HOUSE_SCENES,
  ...GBR_HOUSE_SCENES,
  ...AUH_HOUSE_SCENES,
  ...RUS_HOUSE_SCENES,
  ...DEU_PLOT_SCENES,
  ...GBR_PLOT_SCENES,
  ...AUH_PLOT_SCENES,
  ...RUS_PLOT_SCENES,
];

/** Never drawn: the engine calls these (engine/ww1914/House). */
const onlyCalled = flag("gw_world_called_only");
const who = role("who");
const moving = (law: string) =>
  world({ is: "law", id: law, of: ["persuade", "vote"] });

const reply = (
  id: string,
  stance: GwReply["stance"],
  kind: GwReply["kind"],
  next: string | null,
  rest: Partial<GwReply> = {},
): GwReply => ({ id, stance, kind, tell: [], effects: [], next, ...rest });

/** The cast rule that drafts a bill: the minister named, else the row's. */
function sponsorRule(bill: GwBillRow, law: GwLawRow): GwCastRule {
  const own = bill.sponsor ?? Object.values(law.cast)[0];
  const list = own === undefined ? [] : "any_of" in own ? own.any_of : [own];
  return { any_of: [{ called: true }, ...list] };
}

/**
 * The draft talk with the sponsor: who will fight it, what the army or the
 * other chamber will say, then a text. No text shows what it does.
 */
function draftTalk(bill: GwBillRow, law: GwLawRow): GwScene {
  const foesSay: GwVariant[] = [
    { id: "anxious", when: moody(who, "anxious") },
    { id: "arrogant", when: moody(who, "arrogant") },
    { id: "hard", when: world({ is: "law_count", id: law.id, max: -1 }) },
    { id: "base" },
  ];
  const pick: GwReply[] = law.draft.map((d) => {
    const r = decide(d.id, null, [
      doWorld({ do: "law_text", law: law.id, text: d.id, support: d.support }),
      ...d.effects,
    ]);
    return d.when === undefined ? r : { ...r, when: d.when };
  });
  const nodes: Record<string, GwNode> = {
    open: {
      says: [{ id: "base" }],
      replies: [
        reply("foes", "frank", "ask", "foes"),
        reply("army", "cold", "ask", "army"),
        reply("pick", "warm", "ask", "pick"),
      ],
    },
    foes: {
      says: foesSay,
      replies: [
        reply("army", "cold", "ask", "army"),
        reply("pick", "warm", "ask", "pick"),
      ],
    },
    army: {
      says: [
        { id: "cold", when: { kind: "inst", inst: "army", max: -1 } },
        { id: "base" },
      ],
      replies: [
        reply("foes", "frank", "ask", "foes"),
        reply("pick", "warm", "ask", "pick"),
      ],
    },
    pick: { says: [{ id: "base" }], replies: pick },
  };
  return {
    id: houseIds.draft(law.id),
    nation: [law.tag],
    kind: "talk",
    when: onlyCalled,
    cast: { who: sponsorRule(bill, law) },
    salience: 6,
    tags: ["home", "people"],
    who: "who",
    variants: [{ id: "base" }],
    start: "open",
    nodes,
  };
}

/** A faction's lobby talk: what he wants for the moving bill, a deal, a text. */
function lobbyTalk(f: GwFactionRow, bills: readonly GwBillRow[]): GwScene {
  const on = bills.filter((b) => b.stance[f.id] !== undefined);
  const wants = f.wants ?? [];
  const nodes: Record<string, GwNode> = {
    open: {
      says: [
        ...on.map((b) => ({ id: b.law, when: moving(b.law) })),
        { id: "base" },
      ],
      replies: [
        reply("ask", "warm", "ask", "price"),
        reply("hold", "cold", "push", "held", {
          when: world({ is: "file", who }),
          effects: [doWorld({ do: "use_file", who })],
        }),
        reply("leave", "warm", "leave", null),
      ],
    },
    price: {
      says: [
        ...wants.map((w) => ({
          id: w.id,
          when: world({ is: "faction_want", id: f.id, want: w.id }),
        })),
        { id: "base" },
      ],
      replies: [
        reply("take", "frank", "deal", "took", {
          when: world({ is: "faction_want", id: f.id, want: "any" }),
          effects: [doWorld({ do: "deal", id: f.id })],
        }),
        reply("amend", "frank", "deal", "amended", {
          when: world({ is: "amendable", id: f.id }),
          effects: [doWorld({ do: "amend", id: f.id })],
        }),
        reply("refuse", "cold", "leave", null),
      ],
    },
    took: {
      says: [{ id: "base" }],
      replies: [reply("end", "warm", "leave", null)],
    },
    amended: {
      says: [{ id: "base" }],
      replies: [reply("end", "warm", "leave", null)],
    },
    held: {
      says: [{ id: "base" }],
      replies: [reply("end", "cold", "leave", null)],
    },
  };
  return {
    id: houseIds.lobby(f.id),
    nation: [f.tag],
    kind: "talk",
    when: world({ is: "lobby", id: f.id }),
    cast: { who: { faction_leader: f.id } },
    salience: 2,
    tags: ["people", "home"],
    who: "who",
    variants: [{ id: "base" }],
    start: "open",
    nodes,
    summon: true,
    cooldown: 0,
  };
}

/** A leader comes to ask for his faction's bill. */
function visitTalk(f: GwFactionRow): GwScene {
  const answer = (yes: boolean) => [
    doWorld({ do: "bill_answer", id: f.id, yes }),
  ];
  return {
    id: houseIds.visit(f.id),
    nation: [f.tag],
    kind: "talk",
    scheduledOnly: true,
    cast: { who: { faction_leader: f.id } },
    salience: 6,
    tags: ["people", "home"],
    who: "who",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [
          ...(f.bills ?? []).map((law) => ({
            id: law,
            when: world({ is: "faction_asks", id: f.id, law }),
          })),
          { id: "base" },
        ],
        replies: [
          reply("yes", "warm", "deal", null, { effects: answer(true) }),
          reply("later", "frank", "leave", null, { effects: answer(false) }),
          reply("no", "cold", "leave", null, { effects: answer(false) }),
        ],
      },
    },
  };
}

/** How the vote went: a silent card laid at once. */
function resultCard(tag: GwScene["nation"][number]): GwScene {
  const band = (b: "wide" | "narrow" | "lost_narrow" | "lost_wide") => ({
    id: b,
    when: world({ is: "vote_band", of: [b] }),
  });
  return {
    id: houseIds.result(tag),
    nation: [tag],
    kind: "wire",
    silent: true,
    scheduledOnly: true,
    cast: {},
    salience: 0,
    tags: ["home"],
    variants: [
      band("wide"),
      band("narrow"),
      band("lost_narrow"),
      band("lost_wide"),
      { id: "base" },
    ],
  };
}

/**
 * The bill the house passed, for the sovereign to sign or refuse (RUS, AUH).
 * One paper a country: its text is the common pack's, a country's file may
 * lay its own over it. No price shows; the timer signs.
 */
function signCard(tag: GwScene["nation"][number]): GwScene {
  return {
    id: houseIds.sign(tag),
    nation: [tag],
    kind: "proposal",
    scheduledOnly: true,
    cast: {},
    salience: 7,
    tags: ["home"],
    variants: [
      { id: "wide", when: world({ is: "vote_band", of: ["wide"] }) },
      { id: "base" },
    ],
    fallback: "sign",
    options: [
      {
        id: "sign",
        tell: [],
        effects: [doWorld({ do: "house_sign", yes: true })],
      },
      {
        id: "refuse",
        tell: [],
        effects: [doWorld({ do: "house_sign", yes: false })],
      },
    ],
  };
}

/** The scenes the house makes from its rows. */
export function gwHouseScenes(
  rows: GwHouseContent,
  laws: readonly GwLawRow[],
): GwScene[] {
  const houses = rows.houses ?? [];
  const tags = new Set(houses.map((h) => h.tag));
  const bills = (rows.bills ?? []).filter((b) =>
    laws.some((l) => l.id === b.law && tags.has(l.tag)),
  );
  const fs = (rows.factions ?? []).filter((f) => tags.has(f.tag));
  return [
    ...bills.map((b) => draftTalk(b, laws.find((l) => l.id === b.law)!)),
    // A split's seats go only to a row that has seats; a join pools them.
    ...fs
      .filter(
        (f) =>
          Object.values(f.seats).some((n) => (n ?? 0) > 0) ||
          fs.some((x) => x.joins?.into === f.id),
      )
      .map((f) => lobbyTalk(f, bills)),
    ...fs.filter((f) => (f.bills ?? []).length > 0).map(visitTalk),
    ...houses.map((h) => resultCard(h.tag)),
    ...houses.filter((h) => h.signs === true).map((h) => signCard(h.tag)),
  ];
}

/** Bills the house runs, for the day card: no tells there. */
export function houseBill(law: string): GwBillRow | null {
  return GW_HOUSE_CONTENT.bills?.find((b) => b.law === law) ?? null;
}

/**
 * Every chamber the bill meets can be closed (Vienna's bills: the Reichsrat
 * sits only once called back), so a day may come with no chamber to vote.
 */
export function houseMayNotSit(row: GwLawRow): boolean {
  const bill = houseBill(row.id);
  const house = GW_HOUSE_CONTENT.houses?.find((h) => h.tag === row.tag);
  if (bill === null || house === undefined) return false;
  const meets = house.chambers.filter((c) =>
    bill.houses === undefined
      ? c.optional !== true
      : bill.houses.includes(c.id),
  );
  return meets.length > 0 && meets.every((c) => c.sits !== undefined);
}

export const NOT_HOUSE_BROUGHT = (law: string) =>
  not(world({ is: "law_origin", id: law, of: ["house"] }));
