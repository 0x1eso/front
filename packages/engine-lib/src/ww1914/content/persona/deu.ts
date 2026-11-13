// ww196 §0: DEU's ruler as a person: places, bearers, diary rows
// (GwPersona.ts). The writer lane W-DEU owns this file and
// resources/ww1914/ko/DEU.persona.json. Facts: ww196-facts.md (DEU): the GHQ
// moves, the cabinet chiefs by date, the Kaiser's marginalia.
import type {
  GwBearer,
  GwDiaryRow,
  GwPersonaContent,
  GwRulerPlace,
} from "@openfront/engine-api/ww1914/GwPersona";
import { GwCond, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

const DEU: ["DEU"] = ["DEU"];
const war: GwCond = world({ is: "war" });
const months = (min: number): GwCond => world({ is: "war_months", min });

/** A war headquarters row: only while the war is on. */
const hq = (id: string, from: string, until?: string): GwRulerPlace => ({
  id: `deu_pl_${id}`,
  nation: DEU,
  from,
  ...(until === undefined ? {} : { until }),
  when: war,
});

// The last row that holds wins: the palace, the summer of 1914, the GHQ moves
// (Großes Hauptquartier), then the trips.
const PLACES: GwRulerPlace[] = [
  { id: "deu_pl_potsdam", nation: DEU },
  { id: "deu_pl_kiel", nation: DEU, until: "1914-07-01" },
  { id: "deu_pl_norway", nation: DEU, from: "1914-07-06", until: "1914-07-27" },
  hq("berlin", "1914-08-02", "1914-08-16"),
  hq("koblenz", "1914-08-16", "1914-08-30"),
  hq("luxembourg", "1914-08-30", "1914-09-25"),
  hq("charleville", "1914-09-25", "1915-04-15"),
  hq("pless", "1915-04-15", "1916-02-01"),
  hq("charleville_again", "1916-02-01", "1916-08-29"),
  hq("pless_ohl", "1916-08-29", "1917-01-02"),
  // The OHL at Bad Kreuznach; the Kaiser lived at Bad Homburg.
  hq("homburg", "1917-01-02", "1918-03-08"),
  hq("spa", "1918-03-08"),
  { id: "deu_pl_trip_west", nation: DEU, act: "deu_a_west" },
  { id: "deu_pl_trip_east", nation: DEU, act: "deu_a_east" },
  { id: "deu_pl_trip_heir", nation: DEU, act: "deu_a_heir" },
];

// The first row that fits wins. Civil cabinet: Valentini to 17 Jan 1918,
// then Berg; military cabinet: Lyncker; naval cabinet: Müller; the HQ
// commandant: Plessen; private things: the Empress.
const VALENTINI_UNTIL = "1918-01-17";
const BEARERS: GwBearer[] = [
  { id: "deu_br_empress", nation: DEU, person: "deu_empress", private: true },
  { id: "deu_br_muller", nation: DEU, person: "deu_muller", offices: ["navy"] },
  { id: "deu_br_lyncker_petition", nation: DEU, forms: ["petition"] },
  {
    id: "deu_br_valentini_honours",
    nation: DEU,
    person: "deu_valentini",
    forms: ["honours"],
    until: VALENTINI_UNTIL,
  },
  {
    id: "deu_br_berg_honours",
    nation: DEU,
    forms: ["honours"],
    from: VALENTINI_UNTIL,
  },
  {
    id: "deu_br_lyncker",
    nation: DEU,
    offices: ["war", "chief_of_staff", "intelligence"],
  },
  { id: "deu_br_plessen", nation: DEU, tags: ["war"], when: war },
  {
    id: "deu_br_valentini",
    nation: DEU,
    person: "deu_valentini",
    until: VALENTINI_UNTIL,
  },
  { id: "deu_br_berg", nation: DEU, from: VALENTINI_UNTIL },
];

const d = (
  id: string,
  moment: GwDiaryRow["moment"],
  more: Partial<GwDiaryRow> = {},
): GwDiaryRow => ({
  id: `deu_di_${id}`,
  nation: DEU,
  ruler: "wilhelm",
  moment,
  ...more,
});

// §0.6: the Kaiser's marginalia on the chapter's key paper.
const DIARY: GwDiaryRow[] = [
  d("dec_yes", "decision"),
  d("dec_right", "decision"),
  d("dec_late", "decision"),
  d("dec_mine", "decision"),
  d("dec_cowards", "decision", { when: war }),
  d("dec_sword", "decision", { when: war }),
  d("dec_heavy", "decision", { when: months(18) }),
  d("dec_alone", "decision", { when: months(24) }),
  d("dec_peace", "decision", { when: not(war), from: "1914-08-09" }),
  d("dec_crisis", "decision", { until: "1914-08-02" }),
  d("dec_vienna", "decision", { until: "1914-08-02" }),
  d("dec_tired", "decision", { from: "1918-03-08", when: war }),
  d("death_officer", "death", { when: war }),
  d("death_old", "death"),
  d("death_sons", "death", { when: war }),
  d("death_minister", "death"),
  d("death_quiet", "death", { from: "1917-01-01" }),
  d("front_west_good", "front", { theatre: ["west"] }),
  d("front_west_hard", "front", { theatre: ["west"], when: months(12) }),
  d("front_east_good", "front", { theatre: ["east"] }),
  d("front_east_hard", "front", { theatre: ["east"], when: months(12) }),
  d("front_sea", "front", { theatre: ["sea"] }),
  d("front_balkan", "front", { theatre: ["balkan", "danube", "dobruja"] }),
  d("front_italy", "front", { theatre: ["italy", "alps"] }),
  d("front_far", "front", {
    theatre: ["straits", "caucasus", "mesopotamia", "palestine", "persia"],
  }),
  d("front_colonies", "front", { theatre: ["colonies"] }),
  d("front_any", "front"),
  d("front_spa", "front", { from: "1918-03-08" }),
  d("aud_long", "audience"),
  d("aud_short", "audience"),
  d("aud_liked", "audience"),
  d("aud_general", "audience", { when: war }),
  d("aud_asked", "audience"),
  d("fam_empress", "family"),
  d("fam_heir", "family"),
  d("fam_sons", "family", { when: war }),
  d("fam_cousins", "family", { when: war }),
  d("fam_daughter", "family"),
  d("health_arm", "health"),
  d("health_sleep", "health"),
  d("health_nerves", "health", { when: war }),
  d("health_doctor", "health"),
  d("hind_wrong", "hindsight"),
  d("hind_lied", "hindsight"),
  d("hind_knew", "hindsight"),
  d("fill_january", "filler", { months: [1] }),
  d("fill_spring", "filler", { months: [3, 4, 5] }),
  d("fill_summer", "filler", { months: [6, 7, 8] }),
  d("fill_autumn", "filler", { months: [9, 10, 11] }),
  d("fill_december", "filler", { months: [12] }),
  d("fill_files", "filler"),
  d("fill_read", "filler"),
  d("fill_hq", "filler", { when: war }),
];

export const DEU_PERSONA: GwPersonaContent = {
  places: PLACES,
  bearers: BEARERS,
  diary: DIARY,
};
