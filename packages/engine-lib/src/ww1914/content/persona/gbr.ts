// ww196 §0: GBR's ruler as a person: places, bearers, grain, diary rows
// (GwPersona.ts). The writer lane W-GBR owns this file and
// resources/ww1914/ko/GBR.persona.json.
//
// The seat is the Prime Minister: Asquith, then Lloyd George if the seat
// passes (ruler rows "asquith", "lloyd_george" in RulerRows). Facts from
// ww196-facts.md: Bonham Carter was Asquith's private secretary to Dec 1916;
// Hankey the War Council's secretary from 25 Nov 1914 and the War Cabinet's
// from 9 Dec 1916; the letters to Venetia Stanley ran to 12 May 1915, then
// to her sister Sylvia Henley; until Dec 1916 the PM's letter to the King
// after each cabinet was its only record. BEF GHQ: Saint-Omer, then
// Montreuil from 30 Mar 1916 (checked). Dates are New Style.
import type {
  GwBearer,
  GwDiaryMoment,
  GwDiaryRow,
  GwGrain,
  GwPersonaContent,
  GwRulerPlace,
} from "@openfront/engine-api/ww1914/GwPersona";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: ["GBR"] = ["GBR"];
const ASQUITH = "asquith";
const LG = "lloyd_george";

const war = world({ is: "war" });
const peace = not(war);
const month = (...of: number[]): GwCond => world({ is: "month", of });
const active = (person: string): GwCond => ({ kind: "person_active", person });

// ---- Where he sits (§0.1): the last row that holds wins ----

const place = (
  id: string,
  more: Omit<GwRulerPlace, "id" | "nation"> = {},
): GwRulerPlace => ({ id: `gbr_pl_${id}`, nation: NATION, ...more });

const PLACES: GwRulerPlace[] = [
  place("downing"),
  // Asquith's weekends at the Wharf, Sutton Courtenay, in a quiet summer.
  place("wharf", { ruler: ASQUITH, when: all(peace, month(8, 9)) }),
  place("cabinet_room", { ruler: ASQUITH, when: war }),
  // Walmer Castle, his wartime weekend house: weekends there are on record in
  // Mar 1915 and Feb 1916 (checked), so a spring and a summer month stand in.
  place("walmer", { ruler: ASQUITH, when: all(war, month(3, 8)) }),
  place("war_cabinet", { ruler: LG, when: war }),
  // The Walton Heath house Riddell built him in 1913; wartime weekends there
  // (he heard the Messines mines from it in June 1917).
  place("walton", { ruler: LG, when: month(6, 8) }),
  // The trips: GHQ in France, Dublin.
  // GHQ moved from St Omer to Montreuil on 30 Mar 1916 (checked).
  place("st_omer", { act: "gbr_a_gq", until: "1916-03-30" }),
  place("montreuil", { act: "gbr_a_gq", from: "1916-03-30" }),
  place("dublin", { act: "gbr_a_dublin" }),
];

// ---- Who brings the papers (§0.2): the first row that fits wins ----

const bearer = (
  id: string,
  more: Omit<GwBearer, "id" | "nation"> = {},
): GwBearer => ({ id: `gbr_br_${id}`, nation: NATION, ...more });

const BEARERS: GwBearer[] = [
  // Private things come by the household.
  bearer("margot", { ruler: ASQUITH, person: "gbr_margot", private: true }),
  bearer("stevenson", { ruler: LG, private: true }),
  // The King's papers, by his private secretary.
  bearer("stamfordham", { person: "gbr_stamfordham", offices: ["court"] }),
  // The honours lists and petitions, by the Patronage Secretary.
  bearer("whip", { forms: ["honours", "petition"] }),
  // Lloyd George's garden suburb, from Jan 1917: Kerr on the foreign papers.
  bearer("kerr", { ruler: LG, tags: ["foreign"], from: "1917-01-01" }),
  // The war's papers: Hankey, the War Council's secretary, then the War
  // Cabinet's.
  bearer("hankey", { person: "gbr_hankey", tags: ["war"], from: "1914-11-25" }),
  // The Foreign Office's red boxes.
  bearer("box", { tags: ["foreign"] }),
  // Everything else: the private secretary (J. T. Davies was Lloyd George's
  // from 1912 to 1922, checked).
  bearer("bonham_carter", { ruler: ASQUITH }),
  bearer("davies", { ruler: LG }),
];

// ---- What goes against the grain (§0.4): costs nerve ----

const GRAIN: GwGrain[] = [
  // "Wait and see": the big leap.
  { id: "gbr_gr_bold", nation: NATION, ruler: ASQUITH, lean: "bold" },
  // Coercing Ireland, against Redmond and his own Home Rule.
  {
    id: "gbr_gr_irish",
    nation: NATION,
    ruler: ASQUITH,
    lean: "firm",
    camps: ["irish"],
  },
  // Lloyd George: waiting, and giving way to the generals.
  { id: "gbr_gr_lg_wait", nation: NATION, ruler: LG, lean: "wait" },
  {
    id: "gbr_gr_lg_generals",
    nation: NATION,
    ruler: LG,
    lean: "gentle",
    camps: ["military"],
  },
];

// ---- His diary (§0.6): Asquith's letters, Lloyd George's notes ----

const VENETIA = { until: "1915-05-11" };
const SYLVIA = { from: "1915-05-12" };

const diary = (
  id: string,
  ruler: string,
  moment: GwDiaryMoment,
  more: Omit<GwDiaryRow, "id" | "nation" | "ruler" | "moment"> = {},
): GwDiaryRow => ({
  id: `gbr_di_${id}`,
  nation: NATION,
  ruler,
  moment,
  ...more,
});

const DIARY: GwDiaryRow[] = [
  // To Venetia Stanley, to 12 May 1915.
  diary("v_decision1", ASQUITH, "decision", VENETIA),
  diary("v_decision2", ASQUITH, "decision", VENETIA),
  diary("v_death", ASQUITH, "death", VENETIA),
  diary("v_front_west", ASQUITH, "front", {
    ...VENETIA,
    theatre: ["west"],
    when: all(active("gbr_kitchener"), active("gbr_churchill")),
  }),
  diary("v_front_sea", ASQUITH, "front", {
    ...VENETIA,
    theatre: ["sea"],
    when: active("gbr_churchill"),
  }),
  diary("v_front_straits", ASQUITH, "front", {
    ...VENETIA,
    theatre: ["straits"],
    when: all(active("gbr_churchill"), active("gbr_fisher")),
  }),
  diary("v_front", ASQUITH, "front", VENETIA),
  diary("v_audience1", ASQUITH, "audience", VENETIA),
  diary("v_audience2", ASQUITH, "audience", VENETIA),
  diary("v_family", ASQUITH, "family", VENETIA),
  diary("v_health", ASQUITH, "health", VENETIA),
  diary("v_hindsight", ASQUITH, "hindsight", VENETIA),
  diary("v_fill_summer", ASQUITH, "filler", { ...VENETIA, months: [6, 7, 8] }),
  diary("v_fill_autumn", ASQUITH, "filler", {
    ...VENETIA,
    months: [9, 10, 11],
  }),
  diary("v_fill_winter", ASQUITH, "filler", { ...VENETIA, months: [12, 1, 2] }),
  diary("v_fill_spring", ASQUITH, "filler", { ...VENETIA, months: [3, 4, 5] }),
  diary("v_fill_bridge", ASQUITH, "filler", VENETIA),
  diary("v_fill_book", ASQUITH, "filler", VENETIA),
  // The PM's letter to the King after cabinet: the only record, to Dec 1916.
  diary("k_decision1", ASQUITH, "decision"),
  diary("k_decision2", ASQUITH, "decision", { when: war }),
  diary("k_front", ASQUITH, "front", { when: war }),
  // To Sylvia Henley, from 12 May 1915.
  diary("s_decision1", ASQUITH, "decision", SYLVIA),
  diary("s_decision2", ASQUITH, "decision", SYLVIA),
  diary("s_death", ASQUITH, "death", SYLVIA),
  diary("s_front", ASQUITH, "front", SYLVIA),
  diary("s_front_west", ASQUITH, "front", { ...SYLVIA, theatre: ["west"] }),
  diary("s_audience", ASQUITH, "audience", SYLVIA),
  diary("s_family", ASQUITH, "family", SYLVIA),
  diary("s_health", ASQUITH, "health", SYLVIA),
  diary("s_hindsight", ASQUITH, "hindsight", SYLVIA),
  diary("s_fill_summer", ASQUITH, "filler", { ...SYLVIA, months: [6, 7, 8] }),
  diary("s_fill_autumn", ASQUITH, "filler", {
    ...SYLVIA,
    months: [9, 10, 11],
  }),
  diary("s_fill_winter", ASQUITH, "filler", { ...SYLVIA, months: [12, 1, 2] }),
  diary("s_fill_spring", ASQUITH, "filler", { ...SYLVIA, months: [3, 4, 5] }),
  diary("s_fill_bridge", ASQUITH, "filler", SYLVIA),
  // Lloyd George's own notes, at night in Downing Street.
  diary("l_decision1", LG, "decision"),
  diary("l_decision2", LG, "decision"),
  diary("l_death", LG, "death"),
  diary("l_front", LG, "front"),
  diary("l_front_west", LG, "front", { theatre: ["west"] }),
  diary("l_front_palestine", LG, "front", { theatre: ["palestine"] }),
  diary("l_audience1", LG, "audience"),
  diary("l_audience2", LG, "audience"),
  diary("l_family", LG, "family"),
  diary("l_health", LG, "health"),
  diary("l_hindsight", LG, "hindsight"),
  diary("l_fill_summer", LG, "filler", { months: [6, 7, 8] }),
  diary("l_fill_autumn", LG, "filler", { months: [9, 10, 11] }),
  diary("l_fill_winter", LG, "filler", { months: [12, 1, 2] }),
  diary("l_fill_spring", LG, "filler", { months: [3, 4, 5] }),
  diary("l_fill_wales", LG, "filler"),
];

export const GBR_PERSONA: GwPersonaContent = {
  places: PLACES,
  bearers: BEARERS,
  grain: GRAIN,
  diary: DIARY,
};
