// World War 1936 P5 — Japanese advisors (spec §19.5). Every Japanese
// leader, minister and advisor is a title card, never a name (spec §18.1-2,
// P3 §5.7, §8.4): these sit in the person table with a title name key, the
// same shape as the P3 German titles. Office names checked against the
// Japanese government organisation of 1936–1945: the Cabinet Planning Board
// existed 1937-10-25 to 1943-10-31, the Navy General Staff chief bore the
// title "Chief of the Navy General Staff" from 1933-10-01, the Navy
// Aviation Department dates from 1927-04 and the Army Aviation Department
// from 1925, RIKEN from 1917 (ja.wikipedia 企画院, 軍令部, 海軍航空本部,
// 理化学研究所; the Cabinet Planning Board also in the National Diet
// Library's "Modern Japan in archives", ch. 4). The cards carry no dates:
// a title has no holder.
import type { PersonDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PERSONS_JPN: PersonDef[] = [
  // source: title card (spec §19.5) — 外務大臣
  {
    id: "title_jpn_foreign_minister",
    nameKey: "ww1936.title.jpn_foreign_minister",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["diplomat"] },
    source: "title card (spec §19.5)",
  },
  // source: title card (spec §19.5) — 大蔵大臣
  {
    id: "title_jpn_finance_minister",
    nameKey: "ww1936.title.jpn_finance_minister",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["fiscal_hawk"] },
    source: "title card (spec §19.5)",
  },
  // source: title card (spec §19.5) — 企画院総裁 (1937-10-25 to 1943-10-31)
  {
    id: "title_jpn_planning_board",
    nameKey: "ww1936.title.jpn_planning_board",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "political", traits: ["planner"] },
    source: "title card (spec §19.5)",
  },
  // source: title card (spec §19.5) — 商工大臣
  {
    id: "title_jpn_commerce_minister",
    nameKey: "ww1936.title.jpn_commerce_minister",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "industry", traits: ["ind_production"] },
    source: "title card (spec §19.5)",
  },
  // source: title card (spec §19.5) — 陸軍大臣
  {
    id: "title_jpn_army_minister",
    nameKey: "ww1936.title.jpn_army_minister",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "army_chief", traits: ["chief_organizer"] },
    source: "title card (spec §19.5)",
  },
  // source: title card (spec §19.5) — 参謀総長
  {
    id: "title_jpn_chief_of_staff",
    nameKey: "ww1936.title.jpn_chief_of_staff",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "staff", traits: ["staff_planner"] },
    source: "title card (spec §19.5)",
  },
  // source: title card (spec §19.5) — 軍令部総長
  {
    id: "title_jpn_naval_staff",
    nameKey: "ww1936.title.jpn_naval_staff",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "navy_chief", traits: ["nc_fleet_battle"] },
    source: "title card (spec §19.5)",
  },
  // source: title card (spec §19.5) — 海軍航空本部長
  {
    id: "title_jpn_naval_aviation",
    nameKey: "ww1936.title.jpn_naval_aviation",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_naval"] },
    source: "title card (spec §19.5)",
  },
  // source: title card (spec §19.5) — 陸軍航空本部長
  {
    id: "title_jpn_army_aviation",
    nameKey: "ww1936.title.jpn_army_aviation",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "air_chief", traits: ["ac_ground"] },
    source: "title card (spec §19.5)",
  },
  // source: title card (spec §19.5) — 理化学研究所長
  {
    id: "title_jpn_research_institute",
    nameKey: "ww1936.title.jpn_research_institute",
    country: "JPN",
    roles: ["advisor"],
    advisor: { slot: "research", traits: ["rs_science"] },
    source: "title card (spec §19.5)",
  },
];
