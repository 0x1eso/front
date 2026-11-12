// ww196 §0: AUH's ruler as a person: places, bearers, grain, diary rows
// (GwPersona.ts). The writer lane W-AUH owns this file and
// resources/ww1914/ko/AUH.persona.json.
//
// Facts (ww196-facts.md, AUH): Franz Joseph works at Schönbrunn, rising
// before dawn; he was at Bad Ischl in July 1914 and back on 30 Jul. Karl's
// court: Schönbrunn to 15 Mar 1917, Laxenburg (Blauer Hof) to early Feb 1918,
// the Kaiserhaus at Baden 6 Feb-1 Jul 1918, Eckartsau, Vienna from 27 Oct
// 1918; Wartholz in summer (the Maria Theresa ceremonies of 17 Aug 1917 and
// 1918). The AOK sat at Teschen, then at Baden from Jan 1917. Bearers:
// Ketterl the valet (to Franz Joseph's death), Bolfras of the military
// chancellery, Paar the adjutant-general, Schießl of the cabinet chancellery
// (to Feb 1917); for Karl, Polzer-Hoditz (cabinet chief 7 Feb 1917, on leave
// from 25 Nov 1917), Seidler (from 25 Jul 1918), Prince Lobkowicz
// (adjutant-general), and Zita. Franz Ferdinand, if he reigns: Bardolff of
// his military chancellery. Diary forms: Franz Joseph's desk note, now and
// then a short letter to Katharina Schratt; Karl's note written on the court
// train (no diary of his survives). Rulers are GW_RULERS ids.
import type {
  GwBearer,
  GwDiaryRow,
  GwGrain,
  GwPersonaContent,
  GwRulerPlace,
} from "@openfront/engine-api/ww1914/GwPersona";
import { any, type GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { inWar, italyIn, since } from "../scenes/auh_act";

const FJ = "franz_joseph";
const KARL = "karl";
const FF = "franz_ferdinand";

type Front = "east" | "balkan" | "italy";
const won = (theatre: Front): GwCond =>
  world({ is: "battle", theatre, of: ["advance", "break"], by: "seat" });
const lost = (theatre: Front): GwCond =>
  world({ is: "battle", theatre, of: ["advance", "break"], by: "foe" });

const place = (id: string, more: Partial<GwRulerPlace>): GwRulerPlace => ({
  id,
  nation: ["AUH"],
  ...more,
});

// The last row that holds wins: palaces first, then dated stays, then trips.
const PLACES: GwRulerPlace[] = [
  place("auh_pl_schoenbrunn", { ruler: FJ }),
  place("auh_pl_ischl", { ruler: FJ, from: "1914-07-07", until: "1914-07-29" }),
  place("auh_pl_belvedere", { ruler: FF }),
  place("auh_pl_karl_schoenbrunn", { ruler: KARL }),
  place("auh_pl_laxenburg", {
    ruler: KARL,
    from: "1917-03-15",
    until: "1918-02-05",
  }),
  place("auh_pl_baden", {
    ruler: KARL,
    from: "1918-02-06",
    until: "1918-06-30",
  }),
  place("auh_pl_eckartsau", {
    ruler: KARL,
    from: "1918-07-01",
    until: "1918-10-26",
  }),
  place("auh_pl_wartholz_17", {
    ruler: KARL,
    from: "1917-08-10",
    until: "1917-08-25",
  }),
  place("auh_pl_wartholz_18", {
    ruler: KARL,
    from: "1918-08-10",
    until: "1918-08-25",
  }),
  // Trips (acts/auh.ts): the place while the trip runs.
  place("auh_pl_trip_teschen", { act: "auh_a_hq", until: "1916-12-31" }),
  place("auh_pl_trip_baden", { act: "auh_a_hq", from: "1917-01-01" }),
  place("auh_pl_trip_przemysl", { act: "auh_a_przemysl" }),
  place("auh_pl_trip_isonzo", { act: "auh_a_isonzo" }),
];

const bearer = (id: string, more: Partial<GwBearer>): GwBearer => ({
  id,
  nation: ["AUH"],
  ...more,
});

// The first row that fits wins: private things, honours, the army's papers,
// then whoever runs the cabinet chancellery that day.
const BEARERS: GwBearer[] = [
  bearer("auh_br_ketterl", { person: "auh_ketterl", ruler: FJ, private: true }),
  bearer("auh_br_zita", { person: "auh_zita", ruler: KARL, private: true }),
  bearer("auh_br_bolfras_honours", {
    person: "auh_bolfras",
    ruler: FJ,
    forms: ["honours", "petition"],
  }),
  bearer("auh_br_bolfras", { person: "auh_bolfras", ruler: FJ, tags: ["war"] }),
  bearer("auh_br_lobkowicz_honours", {
    ruler: KARL,
    forms: ["honours", "petition"],
  }),
  bearer("auh_br_lobkowicz", { ruler: KARL, tags: ["war"] }),
  bearer("auh_br_schiessl", { ruler: FJ, tags: ["foreign", "home"] }),
  bearer("auh_br_paar", { ruler: FJ }),
  bearer("auh_br_schiessl_karl", { ruler: KARL, until: "1917-02-06" }),
  bearer("auh_br_polzer", {
    ruler: KARL,
    from: "1917-02-07",
    until: "1917-11-24",
  }),
  bearer("auh_br_cabinet", {
    ruler: KARL,
    from: "1917-11-25",
    until: "1918-07-24",
  }),
  bearer("auh_br_seidler", { ruler: KARL, from: "1918-07-25" }),
  bearer("auh_br_bardolff", { ruler: FF }),
];

const GRAIN: GwGrain[] = [
  // The old emperor does not change what has stood for sixty years.
  { id: "auh_gr_fj_bold", nation: ["AUH"], ruler: FJ, lean: "bold" },
  // Karl wants the killing over: the hard line costs him.
  { id: "auh_gr_karl_firm", nation: ["AUH"], ruler: KARL, lean: "firm" },
  // Zita's brothers serve the other side; he will not be hard on kin.
  {
    id: "auh_gr_karl_kin",
    nation: ["AUH"],
    ruler: KARL,
    lean: "firm",
    kin: true,
  },
  // Franz Ferdinand will not give way to the Magyar lords again.
  {
    id: "auh_gr_ff_magyar",
    nation: ["AUH"],
    ruler: FF,
    lean: "gentle",
    camps: ["magyar"],
  },
];

const dy = (
  id: string,
  ruler: string,
  moment: GwDiaryRow["moment"],
  more: Partial<GwDiaryRow> = {},
): GwDiaryRow => ({ id, nation: ["AUH"], ruler, moment, ...more });

const WINTER = [12, 1, 2];
const SPRING = [3, 4, 5];
const SUMMER = [6, 7, 8];
const AUTUMN = [9, 10, 11];

const DIARY: GwDiaryRow[] = [
  // Franz Joseph: the desk note; now and then a few lines to Schratt.
  dy("auh_dy_fj_dec_1", FJ, "decision"),
  dy("auh_dy_fj_dec_2", FJ, "decision"),
  dy("auh_dy_fj_dec_3", FJ, "decision"),
  dy("auh_dy_fj_dec_war", FJ, "decision", { when: inWar }),
  dy("auh_dy_fj_death_1", FJ, "death"),
  dy("auh_dy_fj_death_2", FJ, "death"),
  dy("auh_dy_fj_front_east_won", FJ, "front", {
    theatre: ["east"],
    when: won("east"),
  }),
  dy("auh_dy_fj_front_east_lost", FJ, "front", {
    theatre: ["east"],
    when: lost("east"),
  }),
  dy("auh_dy_fj_front_balkan_won", FJ, "front", {
    theatre: ["balkan"],
    when: won("balkan"),
  }),
  dy("auh_dy_fj_front_balkan_lost", FJ, "front", {
    theatre: ["balkan"],
    when: lost("balkan"),
  }),
  dy("auh_dy_fj_front_italy", FJ, "front", {
    theatre: ["italy"],
    when: italyIn,
  }),
  dy("auh_dy_fj_front", FJ, "front"),
  dy("auh_dy_fj_aud_1", FJ, "audience"),
  dy("auh_dy_fj_aud_2", FJ, "audience"),
  dy("auh_dy_fj_aud_3", FJ, "audience"),
  dy("auh_dy_fj_schratt_1", FJ, "family"),
  dy("auh_dy_fj_schratt_2", FJ, "family", { when: inWar }),
  dy("auh_dy_fj_valerie", FJ, "family"),
  dy("auh_dy_fj_karl", FJ, "family", { when: inWar }),
  dy("auh_dy_fj_health_1", FJ, "health"),
  dy("auh_dy_fj_health_2", FJ, "health"),
  dy("auh_dy_fj_health_3", FJ, "health"),
  dy("auh_dy_fj_hind_1", FJ, "hindsight"),
  dy("auh_dy_fj_hind_2", FJ, "hindsight"),
  dy("auh_dy_fj_fill_winter", FJ, "filler", { months: WINTER }),
  dy("auh_dy_fj_fill_spring", FJ, "filler", { months: SPRING }),
  dy("auh_dy_fj_fill_summer", FJ, "filler", { months: SUMMER }),
  dy("auh_dy_fj_fill_autumn", FJ, "filler", { months: AUTUMN }),
  dy("auh_dy_fj_fill_1", FJ, "filler"),
  dy("auh_dy_fj_fill_2", FJ, "filler"),
  // Karl: a note on the court train.
  dy("auh_dy_k_dec_1", KARL, "decision"),
  dy("auh_dy_k_dec_2", KARL, "decision", { when: inWar }),
  dy("auh_dy_k_dec_3", KARL, "decision"),
  dy("auh_dy_k_death_1", KARL, "death"),
  dy("auh_dy_k_death_2", KARL, "death", { when: inWar }),
  dy("auh_dy_k_front_won", KARL, "front", {
    when: any(won("east"), won("balkan"), won("italy")),
  }),
  dy("auh_dy_k_front_italy", KARL, "front", { theatre: ["italy"] }),
  dy("auh_dy_k_front_east", KARL, "front", { theatre: ["east"] }),
  dy("auh_dy_k_front", KARL, "front"),
  dy("auh_dy_k_aud_1", KARL, "audience"),
  dy("auh_dy_k_aud_2", KARL, "audience"),
  dy("auh_dy_k_family_1", KARL, "family"),
  dy("auh_dy_k_family_2", KARL, "family", { when: inWar }),
  dy("auh_dy_k_health_1", KARL, "health"),
  dy("auh_dy_k_health_2", KARL, "health"),
  dy("auh_dy_k_hind_1", KARL, "hindsight"),
  dy("auh_dy_k_hind_2", KARL, "hindsight"),
  dy("auh_dy_k_fill_winter", KARL, "filler", { months: WINTER }),
  dy("auh_dy_k_fill_spring", KARL, "filler", { months: SPRING }),
  dy("auh_dy_k_fill_summer", KARL, "filler", {
    months: [7, 8],
    when: since("1917-01"),
  }),
  dy("auh_dy_k_fill_autumn", KARL, "filler", { months: AUTUMN }),
  dy("auh_dy_k_fill_1", KARL, "filler"),
  dy("auh_dy_k_fill_bread", KARL, "filler", { when: inWar }),
  // Franz Ferdinand, if he lived to reign: the Belvedere's note.
  dy("auh_dy_ff_dec", FF, "decision"),
  dy("auh_dy_ff_death", FF, "death"),
  dy("auh_dy_ff_front", FF, "front"),
  dy("auh_dy_ff_aud", FF, "audience"),
  dy("auh_dy_ff_family", FF, "family"),
  dy("auh_dy_ff_health", FF, "health"),
  dy("auh_dy_ff_hind", FF, "hindsight"),
  dy("auh_dy_ff_fill_1", FF, "filler"),
  dy("auh_dy_ff_fill_2", FF, "filler"),
];

export const AUH_PERSONA: GwPersonaContent = {
  places: PLACES,
  bearers: BEARERS,
  grain: GRAIN,
  diary: DIARY,
};
