// ww196 §0: FRA's ruler as a person: places, bearers, grain, diary rows
// (GwPersona.ts). The writer lane W-FRA owns this file and
// resources/ww1914/ko/FRA.persona.json.
//
// Raymond Poincaré, President of the Republic, the whole game. Facts from
// /home/eser/dev/ww196-facts.md: the Élysée's secretary-general was Félix
// Decori to his death at his desk on 18 Oct 1915, then Olivier Sainsère; the
// head of the military household has no name for 1914-18 ("대통령 군사실장");
// the government sat at the Bordeaux Préfecture from early Sep to early Dec
// 1914 (here: while `f_gov_bordeaux` holds, not by date); William Martin was
// chef du protocole [K]. His diary is his daily notes, the base of "Au service
// de la France": dry, exact, sour about ministers, cold about Clemenceau.
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwBearer,
  GwDiaryMoment,
  GwDiaryRow,
  GwPersonaContent,
  GwRulerPlace,
} from "@openfront/engine-api/ww1914/GwPersona";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { flag, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const NATION: GwRulerPlace["nation"] = ["FRA"];
const RULER = "poincare";

const war = world({ is: "war" });
const tiger = flag("f_pm_clemenceau");
const bordeaux = flag("f_gov_bordeaux");
const atSea = flag("f_at_sea");
const months = (min: number): GwCond =>
  world({ is: "war_months", own: true, min });

// ---- Where he sits (the last row that holds wins) ----

const place = (id: string, more: Partial<GwRulerPlace> = {}): GwRulerPlace => ({
  id: `fra_pl_${id}`,
  nation: NATION,
  ...more,
});

const PLACES: GwRulerPlace[] = [
  place("elysee"),
  place("elysee_war", { when: war }),
  place("victory", { when: world({ is: "armistice" }) }),
  place("sea", { when: atSea }),
  place("bordeaux", { when: bordeaux }),
  place("thann", { act: "fra_a_thann" }),
  place("dunkirk", { act: "fra_a_dunkirk" }),
];

// ---- Who brings the papers (the first row that fits wins) ----

const bearer = (id: string, more: Partial<GwBearer>): GwBearer => ({
  id: `fra_br_${id}`,
  nation: NATION,
  ...more,
});

const BEARERS: GwBearer[] = [
  bearer("henriette", { person: "fra_henriette", private: true }),
  bearer("protocol", { forms: ["honours"] }),
  bearer("military", {
    offices: ["war", "chief_of_staff", "supreme_commander", "munitions"],
  }),
  bearer("decori", { until: "1915-10-18" }),
  bearer("sainsere", { from: "1915-10-18" }),
];

// ---- Against his grain (costs nerve) ----

const GRAIN: GwPersonaContent["grain"] = [
  {
    id: "fra_gr_tiger",
    nation: NATION,
    ruler: RULER,
    lean: "gentle",
    people: ["fra_clemenceau"],
  },
  {
    id: "fra_gr_caillaux",
    nation: NATION,
    ruler: RULER,
    lean: "gentle",
    people: ["fra_caillaux"],
  },
  // The constitution gives him a pen to sign with: overstepping it once he
  // can bear, a second time it costs him.
  {
    id: "fra_gr_overstep",
    nation: NATION,
    ruler: RULER,
    lean: "bold",
    second: true,
  },
];

// ---- His daily notes ----

const note = (
  id: string,
  moment: GwDiaryMoment,
  more: Partial<GwDiaryRow> = {},
): GwDiaryRow => ({
  id: `fra_di_${id}`,
  nation: NATION,
  ruler: RULER,
  moment,
  ...more,
});
const at = (...theatre: GwTheatre[]) => ({ theatre });
const inMonths = (...m: number[]) => ({ months: m });

const DIARY: GwDiaryRow[] = [
  // A decision of the chapter ({scene}).
  note("decision_signed", "decision"),
  note("decision_faces", "decision"),
  note("decision_pen", "decision"),
  note("decision_page", "decision"),
  note("decision_short", "decision"),
  note("decision_record", "decision"),
  note("decision_front", "decision", { when: war }),
  note("decision_tiger", "decision", { when: tiger }),
  note("decision_year", "decision", { when: months(12) }),
  // A death ({who}).
  note("death_wreath", "death"),
  note("death_papers", "death"),
  note("death_rain", "death"),
  note("death_debt", "death"),
  note("death_audience", "death"),
  note("death_list", "death", { when: war }),
  // A front ({front}).
  note("front_short", "front", at("west")),
  note("front_pins", "front", at("west", "low_countries")),
  note("front_orient", "front", at("balkan", "thrace")),
  note("front_italy", "front", at("italy", "alps")),
  note("front_east", "front", at("east")),
  note("front_sea", "front", at("sea")),
  note("front_officer", "front"),
  note("front_papers", "front"),
  // An audience ({who}).
  note("audience_long", "audience"),
  note("audience_after", "audience"),
  note("audience_excellency", "audience"),
  note("audience_complaints", "audience"),
  note("audience_hid", "audience"),
  note("audience_tiger", "audience", { when: tiger }),
  // Family.
  note("family_parcels", "family", { when: war }),
  note("family_letters", "family"),
  note("family_garden", "family"),
  note("family_meuse", "family"),
  // Health.
  note("health_sleep", "health"),
  note("health_head", "health"),
  note("health_pen", "health"),
  // 알고 보니 ({who}, {topic}).
  note("hindsight_face", "hindsight"),
  note("hindsight_pencil", "hindsight"),
  note("hindsight_wishes", "hindsight"),
  note("hindsight_knew", "hindsight"),
  // Filler: who came, what they hid.
  note("filler_winter", "filler", inMonths(12, 1, 2)),
  note("filler_spring", "filler", inMonths(3, 4, 5)),
  note("filler_summer", "filler", inMonths(6, 7, 8)),
  note("filler_autumn", "filler", inMonths(9, 10, 11)),
  note("filler_council", "filler"),
  note("filler_quai", "filler"),
  note("filler_finance", "filler"),
  note("filler_premier", "filler", { when: not(tiger) }),
  note("filler_signing", "filler"),
  note("filler_academy", "filler"),
  note("filler_papers", "filler"),
  note("filler_liaison", "filler", { when: war }),
  note("filler_tiger", "filler", { when: tiger }),
  note("filler_bordeaux", "filler", { when: bordeaux }),
  note("filler_sea", "filler", { when: atSea }),
  note("filler_deputies", "filler", { when: not(war) }),
];

export const FRA_PERSONA: GwPersonaContent = {
  places: PLACES,
  bearers: BEARERS,
  grain: GRAIN,
  diary: DIARY,
};
