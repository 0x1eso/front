import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  flag,
  GwCond,
  not,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

/** A task of a game: judged at the end by plain conditions, shown from start. */
export interface GwMandate {
  readonly id: string;
  /** One is drawn from each group, so three never pull the same way. */
  readonly group: "war" | "home" | "name";
  readonly met: GwCond;
}

const atWar: GwCond = world({ is: "war" });

/** Design §2.6: twelve a country, three a game. */
export const GW_MANDATES: Readonly<
  Partial<Record<GwTag, readonly GwMandate[]>>
> = {
  DEU: [
    {
      id: "deu_paris_by_winter",
      group: "war",
      met: world({ is: "front", theatre: "west", from: "aisne" }),
    },
    {
      id: "deu_east_prussia_holds",
      group: "war",
      met: world({ is: "front", theatre: "east", from: "east_prussia" }),
    },
    {
      id: "deu_keep_britain_out",
      group: "war",
      met: not(world({ is: "entered", tag: "GBR", side: "entente" })),
    },
    {
      id: "deu_no_great_war",
      group: "war",
      met: not(atWar),
    },
    {
      id: "deu_bread_for_the_winter",
      group: "home",
      met: { kind: "gauge", gauge: "bread", min: 1 },
    },
    {
      id: "deu_shells_in_store",
      group: "home",
      met: { kind: "gauge", gauge: "shells", min: 1 },
    },
    {
      id: "deu_quiet_streets",
      group: "home",
      met: world({ is: "unrest", max: 0 }),
    },
    {
      id: "deu_reichstag_with_you",
      group: "home",
      met: { kind: "inst", inst: "reichstag", min: 0 },
    },
    {
      id: "deu_master_of_the_army",
      group: "name",
      met: { kind: "inst", inst: "army", max: 1 },
    },
    {
      id: "deu_vienna_stands",
      group: "name",
      met: any(not(world({ is: "out", tag: "AUH" })), {
        kind: "trust",
        tag: "AUH",
        min: 1,
      }),
    },
    {
      id: "deu_small_butcher_bill",
      group: "name",
      met: world({ is: "casualties", max: 500 }),
    },
    {
      id: "deu_chancellor_stays",
      group: "name",
      met: all({ kind: "inst", inst: "countersign", min: 0 }),
    },
    {
      id: "deu_uboat_never",
      group: "war",
      met: world({ is: "uboat", max: 1 }),
    },
    {
      id: "deu_east_settled",
      group: "war",
      met: all(world({ is: "out", tag: "RUS" }), {
        kind: "chose",
        scene: "deu_s_brest_opens",
        pick: "kuehlmann_terms",
      }),
    },
    {
      id: "deu_franchise_given",
      group: "home",
      met: flag("f_easter_given"),
    },
    {
      id: "deu_kaiser_stays",
      group: "name",
      met: world({ is: "regime", of: ["empire"] }),
    },
  ],
  RUS: [
    {
      id: "rus_serbia_stands",
      group: "war",
      met: not(world({ is: "out", tag: "SRB" })),
    },
    {
      id: "rus_galicia_held",
      group: "war",
      met: world({ is: "front", theatre: "east", to: "east_prussia" }),
    },
    {
      id: "rus_straits_paper",
      group: "war",
      met: any(
        { kind: "chose", scene: "rus_h_straits_note" },
        world({ is: "front", theatre: "straits", from: "narrows" }),
      ),
    },
    { id: "rus_no_great_war", group: "war", met: not(atWar) },
    {
      id: "rus_bread_in_capital",
      group: "home",
      met: { kind: "gauge", gauge: "bread", min: 1 },
    },
    {
      id: "rus_streets_quiet",
      group: "home",
      met: world({ is: "unrest", max: 0 }),
    },
    {
      id: "rus_shells_in_store",
      group: "home",
      met: { kind: "gauge", gauge: "shells", min: 1 },
    },
    {
      id: "rus_duma_sits",
      group: "home",
      met: { kind: "inst", inst: "duma", min: 0 },
    },
    {
      id: "rus_heir_succeeds",
      group: "name",
      met: world({ is: "regime", of: ["tsar", "crown", "regency"] }),
    },
    {
      id: "rus_four_ears",
      group: "name",
      met: all(
        { kind: "inst", inst: "court", min: -1 },
        { kind: "inst", inst: "stavka", min: -1 },
        { kind: "inst", inst: "duma", min: -1 },
        { kind: "inst", inst: "ministers", min: -1 },
      ),
    },
    {
      id: "rus_small_lists",
      group: "name",
      met: world({ is: "casualties", max: 2500 }),
    },
    {
      id: "rus_army_is_mine",
      group: "name",
      met: any(world({ is: "command" }), {
        kind: "inst",
        inst: "stavka",
        max: 1,
      }),
    },
  ],
  AUH: [
    {
      id: "auh_serbia_punished",
      group: "war",
      met: world({ is: "front", theatre: "balkan", from: "belgrade" }),
    },
    {
      id: "auh_galicia_held",
      group: "war",
      met: world({ is: "front", theatre: "east", from: "east_prussia" }),
    },
    {
      id: "auh_no_third_front",
      group: "war",
      met: not(world({ is: "entered", tag: "ITA" })),
    },
    {
      id: "auh_romania_stays_out",
      group: "war",
      met: not(world({ is: "entered", tag: "ROU" })),
    },
    {
      id: "auh_bread_for_vienna",
      group: "home",
      met: { kind: "gauge", gauge: "bread", min: 1 },
    },
    {
      id: "auh_quiet_streets",
      group: "home",
      met: world({ is: "unrest", max: 0 }),
    },
    {
      id: "auh_hungary_with_you",
      group: "home",
      met: { kind: "inst", inst: "hungary", min: 0 },
    },
    {
      id: "auh_nations_in_the_house",
      group: "home",
      met: { kind: "inst", inst: "nations", min: 0 },
    },
    {
      id: "auh_own_commander",
      group: "name",
      met: { kind: "inst", inst: "berlin", max: 1 },
    },
    {
      id: "auh_crown_handed_on",
      group: "name",
      met: all(
        any(flag("w_auh_karl"), flag("w_auh_ff_throne")),
        not(world({ is: "out", tag: "AUH" })),
      ),
    },
    {
      id: "auh_tisza_stays",
      group: "name",
      met: { kind: "holder", office: "hun_pm", person: "auh_tisza" },
    },
    {
      id: "auh_small_lists",
      group: "name",
      met: world({ is: "casualties", max: 1500 }),
    },
  ],
  GBR: [
    {
      id: "gbr_belgium_restored",
      group: "war",
      // Never invaded, nothing to restore: a run of peace doesn't fail this.
      met: any(
        world({ is: "front", theatre: "west", to: "liege" }),
        not(world({ is: "entered", tag: "BEL" })),
      ),
    },
    {
      id: "gbr_sea_kept",
      group: "war",
      met: world({ is: "front", theatre: "sea", to: "north_sea" }),
    },
    {
      id: "gbr_america_in",
      group: "war",
      met: world({ is: "entered", tag: "USA", side: "entente" }),
    },
    {
      id: "gbr_no_war",
      group: "war",
      met: world({ is: "neutral", tag: "GBR" }),
    },
    {
      id: "gbr_ireland_settled",
      group: "home",
      met: any(flag("f_home_rule_lives"), flag("f_ireland_settled")),
    },
    {
      id: "gbr_no_draft",
      group: "home",
      met: not(flag("f_gbr_conscript")),
    },
    {
      id: "gbr_bread",
      group: "home",
      met: { kind: "gauge", gauge: "bread", min: 1 },
    },
    {
      id: "gbr_quiet_shops",
      group: "home",
      met: world({ is: "unrest", max: 0 }),
    },
    { id: "gbr_keep_the_chair", group: "name", met: not(flag("f_pm_lg")) },
    {
      id: "gbr_cabinet_whole",
      group: "name",
      met: { kind: "inst", inst: "cabinet", min: 0 },
    },
    {
      id: "gbr_small_list",
      group: "name",
      met: world({ is: "casualties", max: 700 }),
    },
    {
      id: "gbr_money_left",
      group: "name",
      met: { kind: "gauge", gauge: "money", min: 1 },
    },
  ],
  // France (ww166, lane W5). The consultations can't be counted by a
  // condition: "heard" is read as the premier still taking his word.
  FRA: [
    {
      id: "fra_alsace",
      group: "war",
      met: any(
        world({ is: "peace_side", of: ["won"] }),
        world({ is: "front", theatre: "west", to: "rhine" }),
      ),
    },
    {
      id: "fra_rhine",
      group: "war",
      met: world({ is: "front", theatre: "west", to: "rhine" }),
    },
    {
      id: "fra_paris_held",
      group: "war",
      met: not(world({ is: "front", theatre: "west", from: "paris" })),
    },
    {
      id: "fra_britain_in",
      group: "war",
      met: world({ is: "entered", tag: "GBR", side: "entente" }),
    },
    {
      id: "fra_bread",
      group: "home",
      met: { kind: "gauge", gauge: "bread", min: 1 },
    },
    {
      id: "fra_quiet_shops",
      group: "home",
      met: world({ is: "unrest", max: 0 }),
    },
    {
      id: "fra_money_left",
      group: "home",
      met: { kind: "gauge", gauge: "money", min: 1 },
    },
    { id: "fra_union_kept", group: "home", met: not(flag("f_sfio_out")) },
    {
      id: "fra_no_mutiny",
      group: "name",
      met: all(not({ kind: "seen", scene: "fra_big_mutiny" }), {
        kind: "inst",
        inst: "army",
        min: -2,
      }),
    },
    {
      id: "fra_small_list",
      group: "name",
      met: world({ is: "casualties", max: 1800 }),
    },
    {
      id: "fra_america_in",
      group: "name",
      met: world({ is: "entered", tag: "USA", side: "entente" }),
    },
    {
      id: "fra_president_heard",
      group: "name",
      met: all(not(world({ is: "regime", of: ["fra_tiger"] })), {
        kind: "inst",
        inst: "countersign",
        min: 0,
      }),
    },
  ],
};
