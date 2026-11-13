// ww196 §0: RUS's ruler as a person: places, bearers, diary rows
// (GwPersona.ts). The writer lane W-RUS owns this file and
// resources/ww1914/ko/RUS.persona.json.
//
// Facts (ww196-facts.md, RUS): the Alexander Palace at Tsarskoye Selo; the
// Stavka at Baranovichi Aug 1914-Aug 1915, at Mogilev from 21 Aug 1915 N.S.;
// Nicholas took command 5 Sep 1915 N.S. and lived in the governor's house.
// Fredericks, minister of the court to 28 Feb 1917 O.S. (13 Mar N.S.);
// Voeikov, palace commandant 1913-17; Mordvinov, aide-de-camp; Alekseev,
// chief of staff from Aug 1915; Chemodurov, the Tsar's valet from 1908
// (en.wikipedia Terenty Ivanovich Chemodurov). He kept a terse diary every
// day; from the Stavka a daily letter to Alexandra. Dates are N.S.
import type {
  GwBearer,
  GwDiaryRow,
  GwPersonaContent,
  GwRulerPlace,
} from "@openfront/engine-api/ww1914/GwPersona";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const war = world({ is: "war" });
const command = world({ is: "command" });
const month = (...of: number[]): GwCond => world({ is: "month", of });
const active = (person: string): GwCond => ({ kind: "person_active", person });
const months = (min: number): GwCond =>
  world({ is: "war_months", own: true, min });
const battle = (by: "seat" | "foe"): GwCond =>
  world({ is: "battle", theatre: "east", of: ["break", "advance"], by });

// ---- Where he sits (the last that holds wins) ----

const place = (id: string, more: Partial<GwRulerPlace> = {}): GwRulerPlace => ({
  id: `rus_pl_${id}`,
  nation: ["RUS"],
  ...more,
});

const PLACES: GwRulerPlace[] = [
  place("tsarskoe"),
  // Spring in the Crimea (1914: March to June), summer at Peterhof.
  place("livadia", { when: all(not(war), month(4, 5)) }),
  place("peterhof", { when: all(not(war), month(6, 7, 8)) }),
  // At the Stavka once he commands: in its trains at Baranovichi, then the
  // governor's house at Mogilev.
  place("baranovichi", { when: all(war, command), until: "1915-08-20" }),
  place("mogilev", { when: all(war, command), from: "1915-08-21" }),
  // The far trips (acts/rus.ts): the imperial train's stops.
  place("train_northwest", { act: "rus_a_v_northwest" }),
  place("lvov", { act: "rus_a_v_galicia" }),
  place("tiflis", { act: "rus_a_v_caucasus" }),
];

// ---- Who hands him the paper (the first that fits wins) ----

const bearer = (id: string, more: Partial<GwBearer> = {}): GwBearer => ({
  id: `rus_br_${id}`,
  nation: ["RUS"],
  ...more,
});

const BEARERS: GwBearer[] = [
  // Private things: her letters by her own hand; the rest by the valet.
  bearer("empress", {
    person: "rus_alexandra",
    private: true,
    kinds: ["letter"],
    when: active("rus_alexandra"),
  }),
  bearer("valet", { private: true }),
  // At the Stavka the war comes by the chief of staff.
  bearer("alekseev", {
    person: "rus_alekseev",
    tags: ["war"],
    when: all(command, active("rus_alekseev")),
    from: "1915-08-21",
  }),
  // The court ministry: honours, petitions, the household, people.
  bearer("fredericks", {
    person: "rus_fredericks",
    forms: ["honours", "petition"],
    until: "1917-03-13",
  }),
  bearer("fredericks_court", {
    person: "rus_fredericks",
    offices: ["court"],
    until: "1917-03-13",
  }),
  bearer("fredericks_people", {
    person: "rus_fredericks",
    tags: ["people"],
    until: "1917-03-13",
  }),
  // The palace commandant: the police, the streets, the guard.
  bearer("voeikov", {
    person: "rus_voeikov",
    offices: ["interior"],
    until: "1917-03-15",
  }),
  // The aide-de-camp on duty brings the rest.
  bearer("mordvinov"),
];

// ---- The diary: terse; weather, a walk, the reports, whom he received ----

const day = (
  id: string,
  moment: GwDiaryRow["moment"],
  more: Partial<GwDiaryRow> = {},
): GwDiaryRow => ({ id: `rus_dy_${id}`, nation: ["RUS"], moment, ...more });

const DIARY: GwDiaryRow[] = [
  // Fillers: the weather by month.
  day("jan", "filler", { months: [1] }),
  day("feb", "filler", { months: [2] }),
  day("mar", "filler", { months: [3] }),
  day("apr", "filler", { months: [4] }),
  day("may", "filler", { months: [5] }),
  day("jun", "filler", { months: [6] }),
  day("jul", "filler", { months: [7] }),
  day("aug", "filler", { months: [8] }),
  day("sep", "filler", { months: [9] }),
  day("oct", "filler", { months: [10] }),
  day("nov", "filler", { months: [11] }),
  day("dec", "filler", { months: [12] }),
  day("livadia", "filler", { months: [4, 5], when: not(war) }),
  day("peterhof", "filler", { months: [6, 7, 8], when: not(war) }),
  // At the Stavka: the walk, the letter to Alix, the evening films.
  day("stavka_walk", "filler", { when: all(war, command) }),
  day("stavka_letter", "filler", { when: all(war, command) }),
  day("stavka_film", "filler", { when: all(war, command) }),
  day("war_church", "filler", { when: war }),
  // A decision.
  day("decided", "decision"),
  day("decided_signed", "decision"),
  day("decided_late", "decision"),
  day("decided_war", "decision", { when: war }),
  day("decided_heavy", "decision", { when: months(12) }),
  day("decided_alix", "decision", { when: active("rus_alexandra") }),
  // A death.
  day("death", "death"),
  day("death_war", "death", { when: war }),
  day("death_old", "death"),
  day("death_service", "death", { when: war }),
  // The front.
  day("front", "front"),
  day("front_won", "front", { theatre: ["east"], when: battle("seat") }),
  day("front_lost", "front", { theatre: ["east"], when: battle("foe") }),
  day("front_east", "front", { theatre: ["east"] }),
  day("front_caucasus", "front", { theatre: ["caucasus"] }),
  day("front_long", "front", { when: months(18) }),
  // An audience.
  day("audience", "audience"),
  day("audience_long", "audience"),
  day("audience_tea", "audience"),
  day("audience_stavka", "audience", { when: all(war, command) }),
  day("audience_dull", "audience", { when: months(12) }),
  // The family.
  day("family", "family"),
  day("family_baby", "family"),
  day("family_girls", "family", { when: war }),
  day("family_letter", "family", {
    when: all(war, command, active("rus_rasputin")),
  }),
  day("family_alexei_stavka", "family", {
    when: all(war, command),
    from: "1915-10-01",
  }),
  day("family_mama", "family", { when: active("rus_maria") }),
  // Health.
  day("health", "health"),
  day("health_tired", "health", { when: months(12) }),
  day("health_sleep", "health"),
  // "알고 보니".
  day("hindsight", "hindsight"),
  day("hindsight_war", "hindsight", { when: war }),
];

export const RUS_PERSONA: GwPersonaContent = {
  places: PLACES,
  bearers: BEARERS,
  diary: DIARY,
};
