// Great War 1914: FRA's powers on the 통치 tab (ww169). Rows here, text in
// resources/ww1914/ko/FRA.powers.json. Shapes: ../../PowerRows.ts; the format
// is /home/eser/dev/ww169-format.md. A writer lane owns this file and that one.
//
// The seat is Raymond Poincaré, President of the Republic (design ww168 B1.5).
// Every act of his needs a minister's countersignature (law of 25 Feb 1875
// art. 3: "Chacun des actes du président de la République doit être
// contresigné par un ministre"), so every lawful row but the Vienna letter,
// the mutineers' sentences and his threat to go has a signer. (His resignation
// is common.ts's `fra_pw_resign`.) Checked this session (conseil-constitutionnel.fr,
// the 1875 laws): he disposes of the armed force and pardons (25 Feb art. 3);
// closes the session, may convene the chambers extraordinarily, and may
// adjourn them for a month at most, twice a session at most (16 Jul art. 2);
// negotiates and ratifies treaties (art. 8); can't declare war without the
// prior assent of both chambers (art. 9); the Senate can be made a court by a
// decree in the Council of Ministers to try an attentat against the safety of
// the State (art. 12; senat.fr brochure). The law of 3 April 1878: a state of
// siege only by a law, or by a decree in the Council of Ministers while the
// chambers are adjourned, and they meet of right two days later
// (fr.wikisource); the decree of 2 Aug 1914 put all France under it. Carnet B:
// the Interior's telegram of 1 Aug 1914 told the prefects not to arrest
// (1914-1918-online, Malvy). The Doumergue agreement (Feb-Mar 1917, notes of
// 14 Feb and 10 Mar) was approved by Briand and kept from the rest of his
// cabinet (en.wikipedia). Dissolution with the Senate's assent was not used
// after 1877 (design B1.5 ✓).
//
// War still joins the existing sides: `declare` against a neutral brings it in
// against France's side. Where every target would have a `when`, one stays
// open with its effect guarded by a `maybe` (gwPowerProblems).
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwCond,
  GwEffect,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  flag,
  not,
  reason,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwSide } from "../../HouseRows";
import type { GwPowerOption, GwPowerRow, GwReactorRow } from "../../PowerRows";
import { beatPlot, grow, heat, startLaw, warAge } from "../house/kit";

// ---- Words ----

const NATION: GwScene["nation"] = ["FRA"];
const ours = world({
  is: "regime",
  tag: "FRA",
  of: ["fra_republic", "fra_union", "fra_tiger"],
});
const union = world({ is: "regime", tag: "FRA", of: ["fra_union"] });
const tiger = flag("f_pm_clemenceau");
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const neutral = (tag: GwTag): GwCond => world({ is: "neutral", tag });
/** The great war has begun somewhere, France in it or not. */
const warBegun = world({ is: "war_age", min: 0 });
const war = world({ is: "war" });
const crisis = world({ is: "chain" });
const mob = (r: { min?: number; max?: number }): GwCond =>
  world({ is: "mob", tag: "FRA", ...r });
const active = (person: string): GwCond => ({ kind: "person_active", person });
const commands = (person: string): GwCond => ({
  kind: "holder",
  office: "chief_of_staff",
  person,
});

const inst = (
  i: "chamber" | "senate" | "army" | "countersign",
  delta: number,
): GwEffect => ({ kind: "inst", inst: i, delta });
const gauge = (g: "order" | "morale", delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
/** France's trust in that country. */
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const declare = (tag: GwTag): GwEffect => doWorld({ do: "declare", tag });
const maybe = (when: GwCond, then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});

/**
 * The election a dissolution brings, by the state France is in (ww171): a
 * winning war returns the right, a losing one the left, peace the Radicals.
 */
const ELECTION: readonly GwEffect[] = [
  // ww187: the Chamber is shut till its election (houses.ts DISSOLVED).
  doWorld({ do: "dissolve" }),
  maybe(world({ is: "score", min: 20 }), [
    grow("fra_fed_rep", 1),
    grow("fra_left_rep", 1),
    grow("fra_sfio", -1),
  ]),
  maybe(world({ is: "score", max: -10 }), [
    grow("fra_sfio", 1),
    grow("fra_caillaux", 1),
    grow("fra_fed_rep", -1),
  ]),
  maybe(world({ is: "unrest", min: 1 }), [grow("fra_sfio", 1)]),
  maybe(not(world({ is: "war" })), [grow("fra_radicals", 1)]),
  reason("fra_pw_dissolve_elected"),
];

/** Each faction's side, in FRA_FACTIONS' order (content/house/fra.ts). */
const sides = (
  radicals: GwSide,
  caillaux: GwSide,
  repsoc: GwSide,
  sfio: GwSide,
  minority: GwSide,
  leftRep: GwSide,
  fedRep: GwSide,
  catholics: GwSide,
  tigerSide: GwSide,
): Readonly<Record<string, GwSide>> => ({
  fra_radicals: radicals,
  fra_caillaux: caillaux,
  fra_repsoc: repsoc,
  fra_sfio: sfio,
  fra_minority: minority,
  fra_left_rep: leftRep,
  fra_fed_rep: fedRep,
  fra_catholics: catholics,
  fra_tiger: tigerSide,
});

/** A war vote: the Chamber and the Senate, both before (art. 9). */
const WAR_VOTE = {
  houses: ["chambre", "senat"],
  stance: sides(1, 0, 1, 0, -1, 1, 1, 1, 1),
} as const;

const OFFICES = [
  "foreign",
  "war",
  "navy",
  "interior",
  "finance",
  "munitions",
  "agriculture",
] as const;

/** A new commander in chief: the old one's pride, then the decree. */
const general = (person: string, when?: GwCond): GwPowerOption => ({
  id: person.replace(/^fra_/, ""),
  ...(when === undefined ? {} : { when }),
  effects: [
    maybe(not(commands(person)), [
      { kind: "pride", who: { office: "chief_of_staff" }, delta: -2 },
      { kind: "appoint", who: { person }, office: "chief_of_staff" },
      { kind: "pride", who: { person }, delta: 1 },
      inst("army", -1),
      reason("fra_pw_commander_named", { person }),
    ]),
  ],
});
const another = (person: string): GwCond =>
  all(active(person), not(commands(person)));
const gaugeAt = (
  g: "order" | "morale",
  r: { min?: number; max?: number },
): GwCond => ({ kind: "gauge", gauge: g, ...r });
const instAt = (
  i: "chamber" | "senate" | "army",
  r: { min?: number; max?: number },
): GwCond => ({ kind: "inst", inst: i, ...r });
const unrest = (min: number): GwCond => world({ is: "unrest", min });
const usaOut = neutral("USA");
const leave = (office: "chancellor" | "war"): GwEffect =>
  doWorld({ do: "leave", who: { office } });

// ---- The powers ----

export const FRA_POWERS: readonly GwPowerRow[] = [
  // 전쟁과 평화
  {
    id: "fra_pw_declare",
    tag: "FRA",
    group: "war",
    kind: "lawful",
    shows: ours,
    opens: [{ when: any(crisis, warBegun), why: "no_crisis" }],
    needs: { office: "chancellor", house: WAR_VOTE },
    against: ["moderate"],
    authority: 10,
    target: {
      kind: "country",
      of: [
        {
          id: "DEU",
          tags: ["war_offensive"],
          effects: [maybe(not(atWar("DEU")), [declare("DEU")])],
        },
        {
          id: "OTT",
          when: all(warBegun, neutral("OTT")),
          tags: ["war_offensive"],
          effects: [declare("OTT")],
        },
        {
          id: "BGR",
          when: all(warBegun, neutral("BGR")),
          tags: ["war_offensive"],
          effects: [declare("BGR")],
        },
      ],
    },
    tags: [],
    effects: [],
    scene: "fra_pw_declare_r",
  },
  {
    id: "fra_pw_mobilise",
    tag: "FRA",
    group: "war",
    kind: "lawful",
    shows: ours,
    opens: [{ when: not(war), why: "at_war" }],
    needs: { office: "war" },
    target: {
      kind: "option",
      of: [
        {
          id: "cover",
          when: mob({ max: 0 }),
          tags: ["mobilise"],
          effects: [
            doWorld({ do: "mobilize", tag: "FRA", level: 1 }),
            { kind: "temp", delta: 1 },
          ],
        },
        {
          id: "general",
          when: mob({ max: 1 }),
          tags: ["mobilise"],
          effects: [
            doWorld({ do: "mobilize", tag: "FRA", level: 2 }),
            { kind: "temp", delta: 2 },
            // Paris moved before Berlin: London reads it.
            maybe(world({ is: "mob", tag: "DEU", max: 1 }), [
              trust("GBR", -1),
              reason("fra_pw_mob_first"),
            ]),
          ],
        },
        {
          id: "stand",
          tags: ["stand_down"],
          effects: [
            maybe(mob({ min: 1 }), [
              doWorld({ do: "stand_down", tag: "FRA", level: 0 }),
              { kind: "temp", delta: -1 },
            ]),
          ],
        },
      ],
    },
    tags: [],
    effects: [],
    scene: "fra_pw_mobilise_r",
  },
  {
    id: "fra_pw_peace_talks",
    tag: "FRA",
    group: "war",
    kind: "lawful",
    shows: ours,
    opens: [{ when: war, why: "no_war" }],
    needs: { office: "chancellor", council: "peace_talks" },
    against: ["hard"],
    authority: 10,
    cooldown: 4,
    tags: ["peace_white"],
    effects: [doWorld({ do: "talks" })],
    scene: "fra_pw_peace_talks_r",
  },
  // A letter to Vienna through the family channel, past the government (the
  // Sixtus letters, 1917): custom, no signer, a found-out price.
  {
    id: "fra_pw_vienna",
    tag: "FRA",
    group: "war",
    kind: "custom",
    shows: ours,
    opens: [{ when: all(atWar("AUH"), warAge(18)), why: "no_channel" }],
    slot: true,
    cooldown: 6,
    tags: [],
    effects: [trust("AUH", 1), setFlag("f_fra_pw_vienna")],
    risk: {
      pct: 25,
      mods: [
        { when: tiger, add: 25 },
        { when: { kind: "rumour", min: 3 }, add: 15 },
      ],
      then: [
        heat("fra_tiger", 2),
        inst("countersign", -2),
        trust("ITA", -1),
        reason("fra_pw_vienna_out"),
      ],
      heats: [{ id: "fra_pl_elysee", by: 2 }],
    },
    scene: "fra_pw_vienna_r",
  },
  // 동맹과 조약: a secret agreement, which art. 8 lets him keep from the
  // chambers until "l'intérêt et la sûreté de l'État le permettent".
  {
    id: "fra_pw_treaty",
    tag: "FRA",
    group: "treaty",
    kind: "lawful",
    shows: ours,
    opens: [{ when: war, why: "no_war" }],
    needs: { office: "chancellor" },
    authority: 5,
    cooldown: 6,
    target: {
      kind: "country",
      of: [
        {
          id: "GBR",
          effects: [
            maybe(not(flag("f_fra_pw_levant")), [
              setFlag("f_fra_pw_levant"),
              trust("GBR", 1),
            ]),
          ],
        },
        {
          id: "RUS",
          when: all(
            world({ is: "regime", tag: "RUS", of: ["tsar"] }),
            not(flag("f_fra_pw_rhine")),
          ),
          effects: [setFlag("f_fra_pw_rhine"), trust("RUS", 1)],
        },
        {
          id: "ITA",
          when: neutral("ITA"),
          effects: [
            doWorld({ do: "readiness", tag: "ITA", delta: 15 }),
            trust("ITA", 1),
          ],
        },
      ],
    },
    tags: ["treaty"],
    effects: [],
    // What Petrograd kept, a new Petrograd can print.
    risk: {
      pct: 5,
      mods: [
        {
          when: all(
            flag("f_fra_pw_rhine"),
            world({
              is: "regime",
              tag: "RUS",
              of: ["provisional", "rep", "soviet"],
            }),
          ),
          add: 40,
        },
      ],
      then: [
        trust("GBR", -1),
        { kind: "opinion", bloc: "workers", delta: -1 },
        reason("fra_pw_treaty_out"),
      ],
    },
    scene: "fra_pw_treaty_r",
  },
  // 군: the commander in chief, by the government's decree.
  {
    id: "fra_pw_commander",
    tag: "FRA",
    group: "army",
    kind: "lawful",
    shows: ours,
    needs: { office: "war" },
    beyond: "fra_pw_commander_b",
    authority: 10,
    cooldown: 4,
    target: {
      kind: "option",
      of: [
        general("fra_joffre"),
        general("fra_gallieni", another("fra_gallieni")),
        general("fra_castelnau", another("fra_castelnau")),
        general("fra_foch", another("fra_foch")),
        general("fra_petain", another("fra_petain")),
        general("fra_nivelle", another("fra_nivelle")),
      ],
    },
    tags: [],
    effects: [],
    scene: "fra_pw_commander_r",
  },
  // 의회
  {
    id: "fra_pw_session",
    tag: "FRA",
    group: "house",
    kind: "lawful",
    shows: ours,
    needs: { office: "chancellor" },
    against: ["socialist"],
    authority: 5,
    cooldown: 3,
    target: {
      kind: "option",
      of: [
        {
          id: "convene",
          tags: ["house_opened"],
          effects: [inst("chamber", 1)],
        },
        {
          id: "adjourn",
          tags: ["house_closed"],
          effects: [inst("chamber", -1), inst("senate", -1)],
        },
      ],
    },
    tags: [],
    effects: [],
    scene: "fra_pw_session_r",
  },
  {
    id: "fra_pw_dissolve",
    tag: "FRA",
    group: "house",
    kind: "custom",
    shows: ours,
    needs: {
      office: "chancellor",
      house: {
        houses: ["senat"],
        stance: sides(-1, -1, -1, -1, -1, 0, 1, 1, -1),
      },
    },
    against: ["radical", "socialist"],
    beyond: "fra_pw_dissolve_b",
    authority: 20,
    cooldown: 12,
    tags: ["dissolve"],
    effects: [
      inst("chamber", -2),
      heat("fra_radicals", 1),
      heat("fra_sfio", 1),
      ...ELECTION,
    ],
    // It reads as 16 May 1877: the Élysée threat jumps.
    heats: [{ id: "fra_elysee", by: 3 }],
    scene: "fra_pw_dissolve_r",
  },
  // 내각
  {
    id: "fra_pw_minister",
    tag: "FRA",
    group: "cabinet",
    kind: "lawful",
    shows: ours,
    needs: { office: "chancellor" },
    authority: 5,
    target: { kind: "person", people: "own" },
    fields: [
      {
        id: "office",
        options: OFFICES.map(
          (o): GwPowerOption => ({
            id: o,
            effects: [{ kind: "appoint", who: { role: "target" }, office: o }],
          }),
        ),
      },
    ],
    tags: ["cabinet_change"],
    effects: [],
    scene: "fra_pw_minister_r",
  },
  {
    id: "fra_pw_dismiss",
    tag: "FRA",
    group: "cabinet",
    kind: "lawful",
    shows: ours,
    needs: { office: "chancellor" },
    authority: 5,
    target: { kind: "person", people: "cabinet", offices: [...OFFICES] },
    tags: ["cabinet_change"],
    effects: [
      trustOf({ role: "target" }, -2),
      { kind: "dismiss", who: { role: "target" } },
    ],
    scene: "fra_pw_dismiss_r",
  },
  // 국내
  {
    id: "fra_pw_siege",
    tag: "FRA",
    group: "home",
    kind: "lawful",
    shows: ours,
    opens: [
      { when: any(war, mob({ min: 1 })), why: "no_peril" },
      {
        when: not(world({ is: "law", id: "fra_law_siege", of: ["force"] })),
        why: "in_force",
      },
    ],
    needs: { office: "interior" },
    beyond: "fra_pw_siege_b",
    once: true,
    authority: 10,
    tags: ["decree", "army_over_civil"],
    effects: [
      inst("army", 1),
      gauge("order", 1),
      { kind: "censor", delta: 1 },
      setFlag("f_fra_pw_siege"),
      // The chambers meet of right and must keep it or lift it.
      startLaw("fra_law_siege", "seat"),
    ],
    scene: "fra_pw_siege_r",
  },
  {
    id: "fra_pw_carnet_b",
    tag: "FRA",
    group: "home",
    kind: "lawful",
    shows: ours,
    opens: [
      { when: any(war, mob({ min: 1 })), why: "no_peril" },
      { when: not(flag("f_carnet_b_used")), why: "done" },
    ],
    needs: { office: "interior" },
    against: ["moderate", "socialist"],
    beyond: "fra_pw_carnet_b_b",
    once: true,
    authority: 5,
    tags: ["arrests"],
    effects: [
      setFlag("f_carnet_b_used"),
      gauge("order", 1),
      gauge("morale", -1),
      heat("fra_sfio", 2),
      inst("chamber", -1),
    ],
    risk: {
      pct: 20,
      mods: [
        { when: world({ is: "unrest", min: 1 }), add: 20 },
        { when: union, add: 10 },
      ],
      then: [
        maybe(union, [
          doWorld({ do: "regime", to: "fra_republic" }),
          reason("fra_pw_carnet_union"),
        ]),
        reason("fra_pw_carnet_strike"),
      ],
      heats: [{ id: "fra_pl_cgt", by: 2 }],
    },
    scene: "fra_pw_carnet_b_r",
  },
  {
    id: "fra_pw_high_court",
    tag: "FRA",
    group: "home",
    kind: "lawful",
    shows: ours,
    opens: [
      { when: all(war, warAge(18)), why: "no_case" },
      {
        when: all(
          active("fra_caillaux"),
          not({ kind: "in_office", who: { person: "fra_caillaux" } }),
        ),
        why: "no_case",
      },
    ],
    needs: {
      office: "chancellor",
      house: {
        houses: ["senat"],
        stance: sides(0, -1, 1, 0, -1, 1, 1, 1, 1),
      },
    },
    against: ["radical"],
    once: true,
    authority: 15,
    tags: ["arrests"],
    effects: [
      beatPlot("fra_pl_caillaux"),
      heat("fra_caillaux", 2),
      heat("fra_radicals", 1),
      setFlag("f_fra_pw_caillaux_court"),
    ],
    scene: "fra_pw_high_court_r",
  },
  // He threatens to go, to the premier's face.
  {
    id: "fra_pw_threaten",
    tag: "FRA",
    group: "home",
    kind: "lawful",
    shows: ours,
    opens: [
      {
        when: not({ kind: "office_empty", office: "chancellor" }),
        why: "no_premier",
      },
    ],
    cooldown: 6,
    tags: [],
    effects: [inst("countersign", 1), trustOf({ office: "chancellor" }, -1)],
    // They may call the bluff: a President people think idle has less to lose.
    risk: {
      pct: 20,
      mods: [{ when: { kind: "ruler", side: "reputation", max: 1 }, add: 30 }],
      then: [inst("countersign", -1), reason("fra_pw_threat_called")],
    },
    scene: "fra_pw_threaten_r",
  },

  // ---- 법 밖의 일 (phase 2, design B1.5's B rows) ----
  // The MacMahon road: he sends away a premier the Chamber still trusts. No
  // minister signs his own dismissal; the act stands on nothing but the man.
  {
    id: "fra_pw_majority_b",
    tag: "FRA",
    group: "cabinet",
    kind: "beyond",
    shows: ours,
    opens: [
      {
        when: not({ kind: "office_empty", office: "chancellor" }),
        why: "no_premier",
      },
    ],
    authority: 20,
    cooldown: 12,
    tags: ["cabinet_change"],
    effects: [
      trustOf({ office: "chancellor" }, -3),
      leave("chancellor"),
      inst("chamber", -2),
      inst("countersign", -1),
      heat("fra_radicals", 2),
      heat("fra_sfio", 2),
      heat("fra_fed_rep", -1),
      reason("fra_pw_majority_sent"),
    ],
    heats: [
      { id: "fra_elysee", by: 3 },
      { id: "fra_chamber", by: 2 },
    ],
    risk: {
      pct: 30,
      mods: [
        { when: instAt("chamber", { min: 1 }), add: 20 },
        { when: tiger, add: 20 },
        { when: union, add: -10 },
      ],
      then: [
        inst("countersign", -2),
        { kind: "opinion", bloc: "parliament", delta: -1 },
        reason("fra_pw_majority_refused"),
      ],
      heats: [
        { id: "fra_elysee", by: 2 },
        { id: "fra_pl_elysee", by: 3 },
      ],
      scene: "fra_pw_majority_b_bad",
    },
    scene: "fra_pw_majority_b_r",
  },
  // He goes to the GQG and gives Joffre orders himself. The government
  // commands the armies; the President only presides over it.
  {
    id: "fra_pw_order_front_b",
    tag: "FRA",
    group: "army",
    kind: "beyond",
    shows: ours,
    opens: [{ when: war, why: "no_war" }],
    slot: true,
    authority: 10,
    cooldown: 6,
    tags: ["command_self"],
    effects: [
      { kind: "pride", who: { office: "chief_of_staff" }, delta: -2 },
      { kind: "person_trust", who: { office: "chief_of_staff" }, delta: -1 },
      trustOf({ office: "chancellor" }, -1),
      inst("army", -1),
      inst("countersign", -1),
      gauge("morale", 1),
      reason("fra_pw_front_orders"),
    ],
    heats: [
      { id: "fra_senate", by: 1 },
      { id: "fra_chamber", by: 1 },
    ],
    risk: {
      pct: 25,
      mods: [
        {
          when: { kind: "pride", who: { office: "chief_of_staff" }, min: 4 },
          add: 20,
        },
        { when: tiger, add: 15 },
        { when: instAt("army", { min: 2 }), add: 10 },
      ],
      then: [
        { kind: "person_trust", who: { office: "chief_of_staff" }, delta: -2 },
        inst("army", -1),
        {
          kind: "ruler",
          side: "reputation",
          delta: -1,
          key: "fra_pw_front_ignored",
        },
      ],
      heats: [{ id: "fra_elysee", by: 2 }],
      scene: "fra_pw_order_front_b_bad",
    },
    scene: "fra_pw_order_front_b_r",
  },
  // Carnet B past the Interior: he wires the prefects himself.
  {
    id: "fra_pw_carnet_b_b",
    tag: "FRA",
    group: "home",
    kind: "beyond",
    formOnly: true,
    shows: ours,
    once: true,
    authority: 10,
    tags: ["arrests", "harsh_home"],
    effects: [
      setFlag("f_carnet_b_used"),
      gauge("order", 1),
      gauge("morale", -1),
      heat("fra_sfio", 3),
      inst("chamber", -1),
      inst("countersign", -1),
      reason("fra_pw_carnet_wired"),
    ],
    heats: [{ id: "fra_chamber", by: 2 }],
    risk: {
      pct: 35,
      mods: [
        { when: unrest(1), add: 20 },
        { when: union, add: 10 },
      ],
      then: [
        maybe(union, [
          doWorld({ do: "regime", to: "fra_republic" }),
          reason("fra_pw_carnet_union"),
        ]),
        reason("fra_pw_carnet_strike"),
      ],
      heats: [
        { id: "fra_pl_cgt", by: 3 },
        { id: "fra_elysee", by: 1 },
      ],
      scene: "fra_pw_carnet_b_b_bad",
    },
    scene: "fra_pw_carnet_b_b_r",
  },
  // The siege by his order alone, the chambers sitting or not: the 1878 law
  // allows a decree only in the Council and only while they are adjourned.
  {
    id: "fra_pw_siege_b",
    tag: "FRA",
    group: "home",
    kind: "beyond",
    formOnly: true,
    shows: ours,
    once: true,
    authority: 15,
    tags: ["decree", "army_over_civil"],
    effects: [
      inst("army", 1),
      gauge("order", 1),
      { kind: "censor", delta: 1 },
      inst("chamber", -2),
      inst("senate", -1),
      inst("countersign", -1),
      setFlag("f_fra_pw_siege"),
      startLaw("fra_law_siege", "seat"),
      reason("fra_pw_siege_alone"),
    ],
    heats: [
      { id: "fra_chamber", by: 2 },
      { id: "fra_senate", by: 2 },
    ],
    risk: {
      pct: 30,
      mods: [
        { when: not(war), add: 25 },
        { when: instAt("chamber", { min: 1 }), add: 15 },
      ],
      then: [
        inst("chamber", -1),
        gauge("order", -1),
        reason("fra_pw_siege_contested"),
      ],
      heats: [{ id: "fra_elysee", by: 3 }],
      scene: "fra_pw_siege_b_bad",
    },
    scene: "fra_pw_siege_b_r",
  },
  // A commander in chief named with no war minister's name under the decree.
  {
    id: "fra_pw_commander_b",
    tag: "FRA",
    group: "army",
    kind: "beyond",
    formOnly: true,
    shows: ours,
    authority: 15,
    cooldown: 4,
    tags: [],
    effects: [inst("army", -1), inst("countersign", -1)],
    heats: [
      { id: "fra_chamber", by: 1 },
      { id: "fra_senate", by: 1 },
    ],
    risk: {
      pct: 20,
      mods: [
        { when: tiger, add: 20 },
        { when: not(war), add: 10 },
      ],
      then: [leave("war"), reason("fra_pw_commander_war_quits")],
      heats: [{ id: "fra_elysee", by: 2 }],
      scene: "fra_pw_commander_b_bad",
    },
    scene: "fra_pw_commander_b_r",
  },
  // Dissolution with neither the premier's name nor the Senate's vote.
  {
    id: "fra_pw_dissolve_b",
    tag: "FRA",
    group: "house",
    kind: "beyond",
    formOnly: true,
    shows: ours,
    authority: 25,
    cooldown: 12,
    tags: ["dissolve", "decree", "house_closed"],
    effects: [
      inst("chamber", -3),
      inst("senate", -2),
      inst("countersign", -2),
      heat("fra_radicals", 2),
      heat("fra_sfio", 2),
      heat("fra_caillaux", 1),
      reason("fra_pw_dissolve_alone"),
      ...ELECTION,
    ],
    heats: [
      { id: "fra_elysee", by: 4 },
      { id: "fra_chamber", by: 2 },
    ],
    risk: {
      pct: 40,
      mods: [
        { when: war, add: 10 },
        { when: unrest(1), add: 15 },
      ],
      then: [
        inst("senate", -1),
        { kind: "opinion", bloc: "parliament", delta: -1 },
        gauge("order", -1),
        reason("fra_pw_dissolve_defied"),
      ],
      heats: [{ id: "fra_pl_elysee", by: 3 }],
      scene: "fra_pw_dissolve_b_bad",
    },
    scene: "fra_pw_dissolve_b_r",
  },

  // ---- Harsh measures (phase 2): lawful as the war's law then read ----
  // Special courts martial, three judges in each regiment and no appeal: a
  // decree of the war's first weeks, signed by the President and the war
  // minister; a law of 1916 abolished them.
  {
    id: "fra_pw_special_courts",
    tag: "FRA",
    group: "army",
    kind: "lawful",
    shows: ours,
    opens: [{ when: war, why: "no_war" }],
    needs: { office: "war" },
    against: ["socialist"],
    once: true,
    authority: 5,
    tags: ["harsh_war"],
    // What the GQG wanted: fear of the court keeps men in the line.
    effects: [
      inst("army", 1),
      { kind: "pride", who: { office: "chief_of_staff" }, delta: 1 },
      doWorld({ do: "manpower", delta: 1 }),
      heat("fra_sfio", 1),
      heat("fra_minority", 1),
    ],
    risk: {
      pct: 20,
      mods: [
        { when: warAge(18), add: 20 },
        { when: gaugeAt("morale", { max: 2 }), add: 20 },
      ],
      then: [
        gauge("morale", -1),
        inst("chamber", -1),
        reason("fra_pw_courts_named"),
      ],
      heats: [{ id: "fra_chamber", by: 2 }],
      scene: "fra_pw_special_courts_bad",
    },
    scene: "fra_pw_special_courts_r",
  },
  // The mutineers' death sentences come to him: he lets them stand. Refusing a
  // pardon is no act, so no minister signs it.
  {
    id: "fra_pw_mutineers",
    tag: "FRA",
    group: "army",
    kind: "lawful",
    shows: ours,
    opens: [
      {
        when: any(
          { kind: "seen", scene: "fra_big_mutiny" },
          all(war, gaugeAt("morale", { max: 1 })),
        ),
        why: "no_mutiny",
      },
    ],
    cooldown: 6,
    tags: ["harsh_war"],
    // The divisions that refused go back up the line.
    effects: [
      inst("army", 1),
      { kind: "pride", who: { office: "chief_of_staff" }, delta: 1 },
      doWorld({ do: "manpower", delta: 1 }),
      heat("fra_sfio", 1),
      heat("fra_minority", 1),
      inst("chamber", -1),
    ],
    risk: {
      pct: 25,
      mods: [{ when: gaugeAt("morale", { max: 1 }), add: 25 }],
      then: [gauge("morale", -1), reason("fra_pw_mutineers_known")],
      heats: [{ id: "fra_chamber", by: 2 }],
      scene: "fra_pw_mutineers_bad",
    },
    scene: "fra_pw_mutineers_r",
  },
  // The enemy's subjects behind wire (August 1914): Germans, Austrians,
  // Hungarians, and Alsatians and Lorrainers the police doubted.
  {
    id: "fra_pw_intern",
    tag: "FRA",
    group: "home",
    kind: "lawful",
    shows: ours,
    opens: [{ when: any(war, mob({ min: 2 })), why: "no_peril" }],
    needs: { office: "interior" },
    once: true,
    authority: 5,
    tags: ["harsh_home"],
    // Fewer spies the police fear, and the spy fever cools.
    effects: [
      gauge("order", 1),
      { kind: "rumour", delta: -1 },
      heat("fra_af", -1),
    ],
    risk: {
      pct: 15,
      mods: [{ when: warAge(12), add: 15 }],
      then: [
        maybe(usaOut, [doWorld({ do: "readiness", tag: "USA", delta: -5 })]),
        { kind: "opinion", bloc: "press", delta: -1 },
        reason("fra_pw_intern_letters"),
      ],
      heats: [{ id: "fra_chamber", by: 1 }],
      scene: "fra_pw_intern_bad",
    },
    scene: "fra_pw_intern_r",
  },
  // Bombers over a German town behind the Rhine, in answer (Karlsruhe was
  // bombed by French aircraft in June 1915 and June 1916).
  {
    id: "fra_pw_reprisal",
    tag: "FRA",
    group: "army",
    kind: "lawful",
    shows: ours,
    opens: [{ when: atWar("DEU"), why: "no_war" }],
    needs: { office: "war" },
    against: ["socialist"],
    cooldown: 6,
    authority: 5,
    tags: ["harsh_war"],
    effects: [gauge("morale", 1), { kind: "opinion", bloc: "army", delta: 1 }],
    risk: {
      pct: 30,
      mods: [{ when: usaOut, add: 10 }],
      then: [
        maybe(usaOut, [doWorld({ do: "readiness", tag: "USA", delta: -10 })]),
        gauge("morale", -1),
        reason("fra_pw_reprisal_answered"),
      ],
      scene: "fra_pw_reprisal_bad",
    },
    scene: "fra_pw_reprisal_r",
  },
  // Mobilised workers who strike are soldiers on loan: back to the front with
  // them (the Loire, May 1918).
  {
    id: "fra_pw_strikers_front",
    tag: "FRA",
    group: "home",
    kind: "lawful",
    shows: ours,
    opens: [{ when: all(war, warAge(12), unrest(1)), why: "no_strike" }],
    needs: { office: "war" },
    against: ["socialist"],
    cooldown: 6,
    authority: 5,
    tags: ["harsh_home"],
    // Back to the front: soldiers on loan are soldiers again.
    effects: [
      gauge("order", 1),
      { kind: "gauge", gauge: "shells", delta: -1 },
      doWorld({ do: "manpower", delta: 1 }),
      heat("fra_sfio", 1),
    ],
    heats: [{ id: "fra_pl_cgt", by: -1 }],
    risk: {
      pct: 30,
      mods: [{ when: unrest(2), add: 25 }],
      then: [gauge("order", -1), reason("fra_pw_strikers_walkout")],
      heats: [{ id: "fra_pl_cgt", by: 3 }],
      scene: "fra_pw_strikers_front_bad",
    },
    scene: "fra_pw_strikers_front_r",
  },
];

/** FRA's own reactors, on top of GW_REACTORS (`nation: "FRA"`). */
export const FRA_REACTORS: readonly GwReactorRow[] = [
  // A dissolution reads as 16 May 1877 (the Élysée threat: the row's heats).
  {
    tag: "dissolve",
    nation: "FRA",
    actor: "other",
    delta: -1,
    key: "fra_react_coup",
    does: [{ kind: "opinion", bloc: "press", delta: -1 }],
  },
  // London stays out of a war France begins.
  {
    tag: "war_offensive",
    nation: "FRA",
    actor: "other",
    by: neutral("GBR"),
    delta: -1,
    key: "fra_react_london",
    does: [doWorld({ do: "readiness", tag: "GBR", delta: -10 })],
  },
  // Socialist ministers sit in the union's cabinet.
  {
    tag: "arrests",
    nation: "FRA",
    actor: "cabinet",
    of: ["socialist"],
    delta: -1,
  },
  // The union's socialist ministers answer for every harsh act at home.
  {
    tag: "harsh_home",
    nation: "FRA",
    actor: "cabinet",
    by: union,
    of: ["socialist"],
    delta: -1,
    key: "fra_react_socialist_ministers",
  },
  // Longuet's minority grows on each harsh act of war.
  {
    tag: "harsh_war",
    nation: "FRA",
    actor: "other",
    by: war,
    delta: -1,
    key: "fra_react_minority",
    does: [heat("fra_minority", 1)],
  },
];

// ---- The result cards ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

const card = (
  id: string,
  tags: GwScene["tags"],
  variants: GwVariant[],
  cast: GwScene["cast"] = {},
): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast,
  salience: 0,
  tags,
  variants,
});

/** Result cards and other scenes the rows call. */
export const FRA_POWER_SCENES: readonly GwScene[] = [
  card("fra_pw_declare_r", ["war"], [v("london", neutral("GBR")), v("base")]),
  // Read after the order: the level France now stands at.
  card(
    "fra_pw_mobilise_r",
    ["war"],
    [v("general", mob({ min: 2 })), v("cover", mob({ min: 1 })), v("base")],
  ),
  card("fra_pw_peace_talks_r", ["war"], [v("tiger", tiger), v("base")]),
  card("fra_pw_vienna_r", ["foreign"], [v("base")]),
  card("fra_pw_treaty_r", ["foreign"], [v("base")]),
  card("fra_pw_commander_r", ["war"], [v("base")], {
    cos: { office: "chief_of_staff" },
  }),
  card("fra_pw_session_r", ["home"], [v("war", war), v("base")]),
  card("fra_pw_dissolve_r", ["home"], [v("war", war), v("base")]),
  card("fra_pw_minister_r", ["people"], [v("base")], {
    target: { called: true },
  }),
  card("fra_pw_dismiss_r", ["people"], [v("base")], {
    target: { called: true },
  }),
  card("fra_pw_siege_r", ["home"], [v("war", war), v("base")]),
  card("fra_pw_carnet_b_r", ["home"], [v("war", war), v("base")]),
  card("fra_pw_high_court_r", ["home"], [v("base")]),
  card("fra_pw_threaten_r", ["home"], [v("tiger", tiger), v("base")]),
  // Phase 2: each beyond row and harsh measure, and its card when it goes wrong.
  card("fra_pw_majority_b_r", ["home"], [v("war", war), v("base")]),
  card("fra_pw_majority_b_bad", ["home"], [v("base")]),
  card("fra_pw_order_front_b_r", ["war"], [v("base")], {
    cos: { office: "chief_of_staff" },
  }),
  card("fra_pw_order_front_b_bad", ["war"], [v("base")], {
    cos: { office: "chief_of_staff" },
  }),
  card("fra_pw_carnet_b_b_r", ["home"], [v("war", war), v("base")]),
  card("fra_pw_carnet_b_b_bad", ["home"], [v("base")]),
  card("fra_pw_siege_b_r", ["home"], [v("war", war), v("base")]),
  card("fra_pw_siege_b_bad", ["home"], [v("base")]),
  card("fra_pw_commander_b_r", ["war"], [v("base")], {
    cos: { office: "chief_of_staff" },
  }),
  card("fra_pw_commander_b_bad", ["war"], [v("base")], {
    cos: { office: "chief_of_staff" },
  }),
  card("fra_pw_dissolve_b_r", ["home"], [v("war", war), v("base")]),
  card("fra_pw_dissolve_b_bad", ["home"], [v("base")]),
  card("fra_pw_special_courts_r", ["war"], [v("base")]),
  card("fra_pw_special_courts_bad", ["war"], [v("base")]),
  card("fra_pw_mutineers_r", ["war"], [v("base")]),
  card("fra_pw_mutineers_bad", ["war"], [v("base")]),
  card("fra_pw_intern_r", ["home"], [v("base")]),
  card("fra_pw_intern_bad", ["home"], [v("usa", usaOut), v("base")]),
  card("fra_pw_reprisal_r", ["war"], [v("base")]),
  card("fra_pw_reprisal_bad", ["war"], [v("usa", usaOut), v("base")]),
  card("fra_pw_strikers_front_r", ["home"], [v("base")]),
  card("fra_pw_strikers_front_bad", ["home"], [v("base")]),
];
