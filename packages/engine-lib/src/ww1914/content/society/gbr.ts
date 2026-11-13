import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwSocietyContent } from "../../SocietyRows";

// ww207 (W-GBR): GBR's communities (one ideal each) and its birth rows (real
// parties born by state). Text: resources/ww1914/ko/GBR.house.json
// `communities.<id>`. Ideals go on the faction rows in content/house/gbr.ts.
// See /home/eser/dev/ww207-format.md.
//
// GBR's axes: union (연합 -1 ↔ 자치 +1), class (재산 -1 ↔ 노동 +1), rule
// (통제 -1 ↔ 자유 +1).
//
// Sizes are rough shares of the 1914 kingdom (from memory, F): about four
// million trade unionists in 1914; Ireland some 4.4 million of 46, three in
// four of them Catholic; Ulster's Protestants about a million. The trust
// lines are the Liberal government's standing in mid-1914: Ulster arming
// against Home Rule, the Irish waiting for it, the City and the land still
// sore from the People's Budget, the unions in the Great Unrest of 1910-14,
// the chapels the Liberals' own.

const war: GwCond = world({ is: "war" });
const warAge = (min: number): GwCond => world({ is: "war_age", min });
const flag = (f: string): GwCond => ({ kind: "flag", flag: f });
const all = (...of: GwCond[]): GwCond => ({ kind: "all", of });
const any = (...of: GwCond[]): GwCond => ({ kind: "any", of });
const irelandAt = (min: number): GwCond => ({
  kind: "pressure",
  topic: "ireland",
  min,
});

export const GBR_SOCIETY: GwSocietyContent = {
  communities: [
    // The Ulster Protestants and the Church of England's men: the Union.
    {
      id: "gbr_ulster_church",
      tag: "GBR",
      ideal: { axis: "union", side: -1 },
      size: 2,
      trust: -2,
    },
    // Catholic Ireland, waiting for Home Rule.
    {
      id: "gbr_irish_catholics",
      tag: "GBR",
      ideal: { axis: "union", side: 1 },
      size: 2,
      trust: 1,
    },
    // The landed families and the City of London.
    {
      id: "gbr_landed_city",
      tag: "GBR",
      ideal: { axis: "class", side: -1 },
      size: 2,
      trust: -1,
    },
    // The trade unionists: miners, railwaymen, dockers, engineers.
    {
      id: "gbr_unions",
      tag: "GBR",
      ideal: { axis: "class", side: 1 },
      size: 3,
      trust: -1,
    },
    // The chapels and the Liberal state: free trade, free speech, no
    // compulsion.
    {
      id: "gbr_nonconformists",
      tag: "GBR",
      ideal: { axis: "rule", side: 1 },
      size: 3,
      trust: 1,
    },
    // The arms makers, the shipyards and the imperial firms: a state that
    // organises the war.
    {
      id: "gbr_war_industry",
      tag: "GBR",
      ideal: { axis: "rule", side: -1 },
      size: 1,
    },
  ],
  births: [
    // Sinn Féin from Catholic Ireland once Home Rule looks dead: the rising,
    // or Irish anger high (1917's by-elections, F: North Roscommon, South
    // Longford, East Clare, Kilkenny).
    {
      faction: "gbr_sinn_fein",
      tag: "GBR",
      from: "gbr_irish_catholics",
      when: any(flag("f_gbr_rising"), irelandAt(3)),
    },
    // Lloyd George's Liberals from the war economy's men, once the war is
    // a year old (the Ministry of Munitions, May 1915).
    {
      faction: "gbr_lg",
      tag: "GBR",
      from: "gbr_war_industry",
      when: all(war, warAge(12)),
    },
    // Carson's Unionist War Committee (January 1916) from the Union's men,
    // and the anti-war ILP from the unions: each the other's opposite.
    {
      faction: "gbr_uwc",
      tag: "GBR",
      from: "gbr_ulster_church",
      when: all(war, warAge(10)),
      opposite: "gbr_ilp",
    },
    {
      faction: "gbr_ilp",
      tag: "GBR",
      from: "gbr_unions",
      when: war,
      opposite: "gbr_uwc",
    },
  ],
};
