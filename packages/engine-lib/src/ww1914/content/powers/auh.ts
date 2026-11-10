// Great War 1914: AUH's powers on the 통치 tab (ww169). Rows here, text in
// resources/ww1914/ko/AUH.powers.json. Shapes: ../../PowerRows.ts; the format
// is /home/eser/dev/ww169-format.md. A writer lane owns this file and that one.
//
// Franz Joseph (and Karl after him) as Emperor of Austria and King of
// Hungary. Facts behind the rows (checked 2026-11-10 unless marked):
// - The crown's prerogatives in Cisleithania: war, peace, treaties (the
//   Reichsrat approves only those that burden the treasury), the supreme
//   command, naming and dismissing ministers and higher officers, calling,
//   proroguing, closing and dissolving the Reichsrat, pardon, amnesty and
//   abolition. Every non-military act needs a responsible minister's
//   countersignature (H. Hautmann, Mitteilungen der Alfred Klahr Gesellschaft
//   2/2016, citing Bernatzik 1906; the article number of the war power in
//   RGBl. 145/1867 was not found: see the report).
// - Command orders to the common army needed no countersignature
//   (C. Schmetterer, "Der Kaiser von Österreich als Oberster Kriegsherr
//   1867-1918", abstract on ceeol.com).
// - §14: emergency ordinances while the Reichsrat does not sit, signed by all
//   the ministers, lapsing if not laid before the House within four weeks of
//   its meeting; §10: the Emperor convenes it; §19: he adjourns it or
//   dissolves the House (RGBl. 141/1867, Dodd's translation via H-Net).
//   Prorogued 16 Mar 1914, met again 30 May 1917 (design ww168 B1.2).
// - The Suspension Law of 5 May 1869 let personal liberty, the home, letters,
//   assembly and the press be suspended in war; the Emperor signed the
//   exceptional ordinances of July/August 1914; civilians near the front came
//   under military courts; the War Surveillance Office sat from 27 Jul 1914
//   (Hautmann; 1914-1918-online "War Surveillance Office").
// - Thalerhof near Graz held Galician Ruthenians suspected of Russophilia from
//   1914, about 5,700 by 9 Nov 1914; Karl closed it (en.wikipedia; the 4 Sep
//   1914 first transport is in secondary sources only, so no date is written).
// - Kramář arrested 21 May 1915, sentenced to death 3 Jun 1916, freed by
//   Karl's amnesty in 1917 (en.wikipedia Karel Kramář).
// - Archduke Friedrich supreme commander from 11 Jul 1914; Karl took the
//   command himself; Karl dismissed Conrad 1 Mar 1917 (en.wikipedia).
// - The Emperor-King named both prime ministers (en.wikipedia Prime Minister
//   of Hungary); by custom the man who held the Budapest majority.
// - Partial mobilisation against Serbia decided 25 Jul 1914, general at the
//   end of July (sources differ on 30 or 31 Jul: no date is written).
// - The Sixtus channel through Zita's brothers (1917): the existing
//   auh_crown scenes and flags carry its exposure.
//
// Kept out (phase 2 `beyond`, or unchecked): dissolving Budapest for a
// non-parliamentary cabinet (Fejérváry 1905), federalising by decree.
//
// Tags left off on purpose: `decree` and `house_closed` heat every faction of
// the `parliament` bloc, and Budapest's parties share that bloc with Vienna's
// clubs. A §14 ordinance or a prorogued Reichsrat touches Vienna's half only,
// so those rows heat the Vienna clubs by their own effects.
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
  keepPromise,
  not,
  reason,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwPowerOption, GwPowerRow, GwReactorRow } from "../../PowerRows";
import { REICHSRAT_OPEN } from "../house/houses";
import { cool, heat, heatPlot, isLaw, temper } from "../house/kit";
import { gauge, inst, low, men } from "../laws/kit";

const war: GwCond = world({ is: "war" });
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const out = (tag: GwTag): GwCond => world({ is: "out", tag });
const holds = (
  office: "hun_pm" | "chief_of_staff",
  person: string,
): GwCond => ({
  kind: "holder",
  office,
  person,
});
const active = (person: string): GwCond => ({ kind: "person_active", person });
const unflag = (f: string): GwEffect => ({ kind: "unflag", flag: f });
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const appoint = (
  person: string,
  office: "hun_pm" | "chief_of_staff",
): GwEffect => ({
  kind: "appoint",
  who: { person },
  office,
});
const TISZA_IN = holds("hun_pm", "auh_tisza");
/** A country we can still go to war with: not yet at war with it, not out. */
const foe = (tag: GwTag): GwCond => all(war, not(atWar(tag)), not(out(tag)));
/** A war target: the declaration goes out in the seat's name, its allies with it. */
const declare = (tag: GwTag, when?: GwCond): GwPowerOption => ({
  id: tag,
  ...(when === undefined ? {} : { when }),
  effects: [doWorld({ do: "declare", tag })],
});

/** The monarchy's own forms; a republic or a federation has other powers. */
const CROWN = world({
  is: "regime",
  of: ["dual_monarchy", "karl", "ff_throne"],
});

const base: GwVariant = { id: "base" };
const v = (id: string, when: GwCond): GwVariant => ({ id, when });

/** The silent result card a row lays at once. */
const card = (
  id: string,
  variants: GwVariant[] = [base],
  cast: GwScene["cast"] = {},
): GwScene => ({
  id,
  nation: ["AUH"],
  kind: "wire",
  silent: true,
  scheduledOnly: true,
  cast,
  salience: 0,
  tags: ["home"],
  variants,
});

const row = (r: Omit<GwPowerRow, "tag" | "scene">): GwPowerRow => ({
  ...r,
  tag: "AUH",
  shows: r.shows ?? CROWN,
  scene: `${r.id}_r`,
});

export const AUH_POWERS: readonly GwPowerRow[] = [
  // ---- 전쟁과 평화 ----
  row({
    id: "auh_pw_war",
    group: "war",
    kind: "lawful",
    // The foreign minister signs; in July 1914 Tisza's word decided it.
    needs: { office: "foreign", consent: "auh_work" },
    against: ["moderate"],
    // Before the war only an open crisis can turn into one (no any-pair war yet).
    opens: [{ when: any(war, world({ is: "chain" })), why: "no_crisis" }],
    authority: 10,
    cooldown: 1,
    target: {
      kind: "country",
      of: [
        // Before the war, only Serbia: the crisis turns into the war. Once
        // at war with it the order changes nothing, but a list must keep one
        // row that can't close (gwPowerProblems).
        declare("SRB"),
        declare("MNE", foe("MNE")),
        declare("RUS", foe("RUS")),
        declare("BEL", foe("BEL")),
        declare("ITA", foe("ITA")),
        declare("ROU", foe("ROU")),
      ],
    },
    tags: ["war_offensive"],
    effects: [reason("auh_pw_war_signed")],
    risk: {
      // Hungary was not asked first.
      pct: 0,
      mods: [{ when: temper("auh_work", 2), add: 40 }],
      then: [inst("hungary", -1), reason("auh_pw_war_budapest")],
    },
  }),
  row({
    id: "auh_pw_mobilise",
    group: "war",
    kind: "lawful",
    needs: { office: "war" },
    opens: [{ when: world({ is: "mob", tag: "AUH", max: 1 }), why: "full" }],
    authority: 5,
    target: {
      kind: "option",
      of: [
        {
          id: "partial",
          when: world({ is: "mob", tag: "AUH", max: 0 }),
          effects: [doWorld({ do: "mobilize", tag: "AUH", level: 1 })],
        },
        {
          id: "general",
          effects: [doWorld({ do: "mobilize", tag: "AUH", level: 2 })],
        },
      ],
    },
    tags: ["mobilise"],
    effects: [men(2)],
    risk: {
      // Petersburg answers by its own state.
      pct: 30,
      mods: [
        { when: war, add: -30 },
        { when: world({ is: "mob", tag: "RUS", min: 1 }), add: -30 },
      ],
      then: [
        doWorld({ do: "mobilize", tag: "RUS", level: 1 }),
        reason("auh_pw_russia_answers"),
      ],
    },
  }),
  row({
    id: "auh_pw_peace",
    group: "war",
    kind: "lawful",
    needs: { office: "foreign" },
    against: ["hard"],
    opens: [{ when: war, why: "no_war" }],
    authority: 5,
    cooldown: 3,
    tags: ["peace_white"],
    effects: [doWorld({ do: "talks" }), reason("auh_pw_peace_sent")],
  }),
  row({
    id: "auh_pw_family",
    group: "war",
    kind: "custom",
    // Zita's brothers served the other side: a channel only Karl had.
    shows: world({ is: "regime", of: ["karl"] }),
    opens: [
      { when: war, why: "no_war" },
      { when: active("auh_zita"), why: "no_channel" },
      {
        when: not(
          any(flag("f_auh_letter_alsace"), flag("f_auh_letter_general")),
        ),
        why: "sent",
      },
    ],
    once: true,
    slot: true,
    fields: [
      {
        id: "how",
        options: [
          { id: "general", effects: [setFlag("f_auh_letter_general")] },
          {
            id: "alsace",
            effects: [
              setFlag("f_auh_letter_alsace"),
              { kind: "trust", tag: "FRA", delta: 1 },
            ],
          },
        ],
      },
    ],
    tags: [],
    effects: [
      { kind: "remember", key: "k_zita_sixtus" },
      { kind: "trust", tag: "FRA", delta: 1 },
    ],
    risk: {
      // Who else learns of it: Berlin's ears in Vienna.
      pct: 15,
      mods: [{ when: { kind: "inst", inst: "berlin", min: 3 }, add: 15 }],
      then: [
        { kind: "trust", tag: "DEU", delta: -1 },
        { kind: "rumour", delta: 1 },
        reason("auh_pw_family_heard"),
      ],
    },
  }),
  // ---- 군 ----
  row({
    id: "auh_pw_chief",
    group: "army",
    kind: "lawful",
    authority: 5,
    cooldown: 4,
    target: {
      kind: "option",
      of: [
        {
          id: "auh_conrad",
          when: all(
            active("auh_conrad"),
            not(holds("chief_of_staff", "auh_conrad")),
          ),
          effects: [appoint("auh_conrad", "chief_of_staff")],
        },
        {
          id: "auh_arz",
          when: not(holds("chief_of_staff", "auh_arz")),
          effects: [appoint("auh_arz", "chief_of_staff")],
        },
        {
          id: "auh_boroevic",
          effects: [appoint("auh_boroevic", "chief_of_staff")],
        },
      ],
    },
    tags: ["cabinet_change"],
    // The man who held it: his pride first, then the new name.
    effects: [{ kind: "pride", who: { office: "chief_of_staff" }, delta: -2 }],
  }),
  row({
    id: "auh_pw_command",
    group: "army",
    kind: "lawful",
    opens: [{ when: war, why: "no_war" }],
    authority: 10,
    cooldown: 4,
    target: {
      kind: "option",
      of: [
        {
          id: "take",
          effects: [
            doWorld({ do: "personal_command", on: true }),
            { kind: "pride", who: { office: "chief_of_staff" }, delta: -1 },
          ],
          tags: ["command_self"],
        },
        {
          id: "give",
          when: world({ is: "command" }),
          effects: [doWorld({ do: "personal_command", on: false })],
        },
      ],
    },
    tags: [],
    effects: [],
  }),
  row({
    id: "auh_pw_martial",
    group: "army",
    kind: "lawful",
    // An imperial ordinance: the minister-president answers for it.
    needs: { office: "chancellor" },
    against: ["moderate", "nations"],
    opens: [{ when: war, why: "no_war" }],
    authority: 10,
    cooldown: 4,
    target: {
      kind: "option",
      of: [
        {
          id: "bohemia",
          effects: [heat("auh_czech", 2), inst("nations", -1)],
        },
        { id: "galicia", effects: [heat("auh_poles", 1)] },
        { id: "south", effects: [heat("auh_slavs", 2)] },
      ],
    },
    tags: ["army_over_civil", "harsh_home"],
    effects: [inst("army", 1), gauge("order", 1), reason("auh_pw_martial_set")],
    risk: {
      pct: 20,
      mods: [
        { when: { kind: "inst", inst: "nations", max: -2 }, add: 20 },
        { when: low("bread", 0), add: 15 },
      ],
      then: [
        gauge("order", -2),
        heatPlot("auh_pl_nations", 2),
        reason("auh_pw_martial_backfires"),
      ],
    },
  }),
  // ---- 국내 ----
  row({
    id: "auh_pw_intern",
    group: "home",
    kind: "lawful",
    opens: [{ when: war, why: "no_war" }],
    authority: 5,
    cooldown: 6,
    tags: ["arrests", "harsh_home"],
    effects: [
      gauge("order", 1),
      inst("army", 1),
      inst("nations", -1),
      heatPlot("auh_pl_nations", 1),
      reason("auh_pw_camp_filled"),
    ],
    risk: {
      // The camps were built in haste; typhus came the first winter.
      pct: 35,
      mods: [{ when: low("bread", 0), add: 20 }],
      then: [
        { kind: "rumour", delta: 1 },
        opinion("press", -1),
        reason("auh_pw_camp_typhus"),
      ],
    },
  }),
  row({
    id: "auh_pw_amnesty",
    group: "home",
    kind: "lawful",
    needs: { office: "chancellor" },
    against: ["hard"],
    opens: [{ when: not(flag("f_auh_amnesty")), why: "done" }],
    once: true,
    authority: 10,
    tags: ["amnesty"],
    effects: [
      setFlag("f_auh_amnesty"),
      unflag("f_auh_kramar_held"),
      inst("nations", 1),
      inst("army", -1),
      cool("auh_czech", 2),
      cool("auh_slavs", 1),
      reason("auh_pw_amnesty_read"),
    ],
    risk: {
      pct: 25,
      mods: [{ when: temper("auh_aok", 2), add: 25 }],
      then: [heatPlot("auh_pl_army", 1), reason("auh_pw_amnesty_army")],
    },
  }),
  row({
    id: "auh_pw_pardon",
    group: "home",
    kind: "lawful",
    needs: { office: "chancellor" },
    opens: [
      {
        when: all(flag("f_auh_kramar_held"), not(flag("f_auh_amnesty"))),
        why: "not_held",
      },
    ],
    authority: 5,
    cooldown: 4,
    target: {
      kind: "option",
      of: [
        {
          id: "mercy",
          effects: [cool("auh_czech", 1)],
        },
        {
          id: "free",
          effects: [
            unflag("f_auh_kramar_held"),
            cool("auh_czech", 2),
            heat("auh_aok", 1),
            heat("auh_germans", 1),
          ],
          tags: ["amnesty"],
        },
      ],
    },
    tags: [],
    effects: [reason("auh_pw_pardon_signed")],
  }),
  // ---- 의회 ----
  row({
    id: "auh_pw_par14",
    group: "house",
    kind: "lawful",
    // Every minister signs; the minister-president's signature is asked here.
    needs: { office: "chancellor" },
    opens: [{ when: not(REICHSRAT_OPEN), why: "sits" }],
    authority: 10,
    cooldown: 2,
    target: {
      kind: "option",
      of: [
        {
          id: "requisition",
          effects: [gauge("bread", 1), opinion("business", -1)],
        },
        { id: "war_loan", effects: [gauge("money", 1)] },
        { id: "prices", effects: [gauge("order", 1), opinion("business", -1)] },
      ],
    },
    tags: [],
    effects: [
      inst("nations", -1),
      heat("auh_czech", 1),
      heat("auh_slavs", 1),
      heat("auh_sd", 1),
      reason("auh_pw_par14_issued"),
    ],
  }),
  row({
    id: "auh_pw_open",
    group: "house",
    kind: "lawful",
    needs: { office: "chancellor" },
    against: ["hard"],
    opens: [{ when: not(REICHSRAT_OPEN), why: "open" }],
    authority: 10,
    cooldown: 3,
    tags: ["house_opened"],
    effects: [
      setFlag("f_auh_reichsrat_open"),
      unflag("f_auh_house_shut"),
      inst("nations", 1),
      cool("auh_czech", 1),
      cool("auh_sd", 1),
      keepPromise({ person: "auh_adler" }, "adl_open"),
      reason("auh_pw_reichsrat_called"),
    ],
    risk: {
      // The nations' clubs speak first, and loudly.
      pct: 20,
      mods: [
        { when: { kind: "inst", inst: "nations", max: -2 }, add: 25 },
        { when: temper("auh_czech", 2), add: 15 },
      ],
      then: [
        inst("hungary", -1),
        heat("auh_germans", 1),
        reason("auh_pw_clubs_declare"),
      ],
    },
  }),
  row({
    id: "auh_pw_close",
    group: "house",
    kind: "lawful",
    needs: { office: "chancellor" },
    against: ["moderate"],
    opens: [
      { when: REICHSRAT_OPEN, why: "shut" },
      { when: not(isLaw("auh_reichsrat")), why: "by_law" },
    ],
    authority: 15,
    cooldown: 3,
    tags: [],
    effects: [
      unflag("f_auh_reichsrat_open"),
      unflag("f_auh_house_open"),
      setFlag("f_auh_house_shut"),
      inst("nations", -1),
      opinion("parliament", -1),
      heat("auh_czech", 2),
      heat("auh_slavs", 2),
      heat("auh_sd", 1),
      reason("auh_pw_reichsrat_prorogued"),
    ],
  }),
  // ---- 내각 ----
  row({
    id: "auh_pw_ministers",
    group: "cabinet",
    kind: "lawful",
    cooldown: 2,
    target: {
      kind: "person",
      people: "cabinet",
      offices: ["foreign", "war", "finance", "navy", "chancellor"],
    },
    tags: ["cabinet_change"],
    effects: [{ kind: "dismiss", who: { role: "target" } }],
  }),
  row({
    id: "auh_pw_hun_pm",
    group: "cabinet",
    kind: "custom",
    authority: 10,
    cooldown: 4,
    target: {
      kind: "option",
      of: [
        {
          id: "auh_tisza",
          when: all(active("auh_tisza"), not(TISZA_IN)),
          effects: [
            appoint("auh_tisza", "hun_pm"),
            cool("auh_work", 1),
            heat("auh_indep", 1),
          ],
        },
        {
          id: "auh_wekerle",
          effects: [appoint("auh_wekerle", "hun_pm"), heat("auh_work", 2)],
        },
        {
          id: "auh_andrassy",
          when: all(
            active("auh_andrassy"),
            not(holds("hun_pm", "auh_andrassy")),
          ),
          effects: [
            appoint("auh_andrassy", "hun_pm"),
            heat("auh_work", 2),
            cool("auh_const", 1),
          ],
        },
        {
          id: "auh_karolyi",
          when: all(active("auh_karolyi"), not(holds("hun_pm", "auh_karolyi"))),
          effects: [
            appoint("auh_karolyi", "hun_pm"),
            heat("auh_work", 3),
            cool("auh_karolyi", 2),
            { kind: "trust", tag: "DEU", delta: -1 },
          ],
        },
      ],
    },
    tags: ["cabinet_change"],
    effects: [],
    risk: {
      // A man without the Diet's majority meets the Party of Work.
      pct: 0,
      mods: [
        { when: not(TISZA_IN), add: 35 },
        { when: temper("auh_work", 3), add: 25 },
      ],
      then: [
        inst("hungary", -1),
        heatPlot("auh_pl_magyar", 2),
        reason("auh_pw_diet_balks"),
      ],
    },
  }),
];

/**
 * AUH's own reactors, on top of GW_REACTORS (`nation: "AUH"`): where the dual
 * monarchy answers differently from the base set.
 */
export const AUH_REACTORS: readonly GwReactorRow[] = [
  // Tisza held the army's hand off Hungary's civil government.
  {
    tag: "army_over_civil",
    nation: "AUH",
    actor: "other",
    by: TISZA_IN,
    key: "auh_react_tisza_army",
    delta: -1,
    does: [heat("auh_work", 1), inst("hungary", -1)],
  },
  // The army command and the German nationals took the amnesty badly.
  {
    tag: "amnesty",
    nation: "AUH",
    actor: "other",
    key: "auh_react_amnesty_army",
    delta: -1,
    does: [heat("auh_aok", 1), heat("auh_germans", 1)],
  },
  // A peace word from Vienna is read in Berlin first.
  {
    tag: "peace_white",
    nation: "AUH",
    actor: "other",
    by: war,
    key: "auh_react_peace_berlin",
    delta: -1,
    does: [{ kind: "trust", tag: "DEU", delta: -1 }],
  },
  // Czech reservists went unwillingly.
  {
    tag: "mobilise",
    nation: "AUH",
    actor: "other",
    key: "auh_react_mob_czech",
    delta: -1,
    does: [heat("auh_czech", 1)],
  },
];

/** Result cards and other scenes the rows call. */
export const AUH_POWER_SCENES: readonly GwScene[] = [
  card("auh_pw_war_r", [v("budapest", temper("auh_work", 2)), base]),
  card("auh_pw_mobilise_r", [
    v("russia", world({ is: "mob", tag: "RUS", min: 1 })),
    base,
  ]),
  card("auh_pw_peace_r"),
  card("auh_pw_family_r", [v("alsace", flag("f_auh_letter_alsace")), base]),
  card("auh_pw_chief_r", [
    v("conrad", holds("chief_of_staff", "auh_conrad")),
    base,
  ]),
  card("auh_pw_command_r", [v("taken", world({ is: "command" })), base]),
  card("auh_pw_martial_r", [
    v("restless", world({ is: "unrest", min: 1 })),
    base,
  ]),
  card("auh_pw_intern_r"),
  card("auh_pw_amnesty_r"),
  card("auh_pw_pardon_r", [v("free", not(flag("f_auh_kramar_held"))), base]),
  card("auh_pw_par14_r"),
  card("auh_pw_open_r", [v("loud", temper("auh_czech", 2)), base]),
  card("auh_pw_close_r"),
  card("auh_pw_ministers_r", [base], { target: { called: true } }),
  card("auh_pw_hun_pm_r", [
    v("tisza", TISZA_IN),
    v("karolyi", holds("hun_pm", "auh_karolyi")),
    base,
  ]),
];
