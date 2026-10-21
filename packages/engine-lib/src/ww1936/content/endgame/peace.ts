// World War 1936 P5 (spec §6.9): the history peace table. One row per
// defeated country; each line names the participant (`by`, read with self =
// the defeated country) and its first demands when the historical AI
// is on (and the AI default on a human participant's card). A demand whose
// regions are already gone is skipped and the general AI spends the rest.
// Groups used in one row do not overlap (groups.ts).
//
// Korea (owner ruling, plan decision 32): no country slot and no liberation;
// the default after Japan's defeat is the 1945 occupation line at the 38th
// parallel — control only, the legal owner is unchanged. The Korean lines do
// not wait for the Yalta flag, so the default holds in every game.
import { not, T } from "../helpers";
import type { Condition, PeaceDefaultDef } from "../types";

const NO_EXILE: Condition = not({ kind: "is_exile" });
const YALTA: Condition = { kind: "gflag", flag: "yalta_zones" };
const POTSDAM: Condition = { kind: "gflag", flag: "potsdam_lines" };

export const HISTORY_PEACE: PeaceDefaultDef[] = [
  // Ethiopia, 1936: annexed (when the P3 event has not already done it).
  {
    loser: "ETH",
    lines: [{ by: T("ITA"), demands: [{ kind: "annex_rest" }] }],
  },
  // Albania, 1939: the personal union, kept as a puppet.
  {
    loser: "ALB",
    lines: [{ by: T("ITA"), demands: [{ kind: "puppet" }] }],
  },
  // Poland with no host for an exile: the 1939-09-28 boundary treaty line.
  {
    loser: "POL",
    when: NO_EXILE,
    lines: [
      {
        by: T("DEU"),
        demands: [
          { kind: "take_group", group: "poland_german_annexed" },
          { kind: "occupation_zone", group: "poland_general_government" },
        ],
      },
      {
        by: T("SUN"),
        demands: [{ kind: "take_group", group: "poland_soviet_zone" }],
      },
    ],
  },
  // Finland after a capitulation: a little more than the Moscow Peace.
  {
    loser: "FIN",
    lines: [
      {
        by: T("SUN"),
        demands: [
          { kind: "take_group", group: "karelian_isthmus" },
          { kind: "take_group", group: "ladoga_karelia" },
          { kind: "take_group", group: "petsamo" },
        ],
      },
    ],
  },
  // China after a capitulation: occupation only; the Nanjing government comes
  // from the event, not from the conference.
  {
    loser: "CHN",
    lines: [
      {
        by: T("JPN"),
        demands: [{ kind: "occupation_zone", group: "east_china_occupied" }],
      },
    ],
  },
  // The Low Countries, Norway and Denmark with no host for an exile.
  {
    loser: "NLD",
    when: NO_EXILE,
    lines: [{ by: T("DEU"), demands: [{ kind: "puppet" }] }],
  },
  {
    loser: "BEL",
    when: NO_EXILE,
    lines: [{ by: T("DEU"), demands: [{ kind: "puppet" }] }],
  },
  {
    loser: "LUX",
    when: NO_EXILE,
    lines: [{ by: T("DEU"), demands: [{ kind: "annex_rest" }] }],
  },
  {
    loser: "NOR",
    when: NO_EXILE,
    lines: [{ by: T("DEU"), demands: [{ kind: "puppet" }] }],
  },
  {
    loser: "DNK",
    when: NO_EXILE,
    lines: [{ by: T("DEU"), demands: [{ kind: "puppet" }] }],
  },
  // Yugoslavia, April 1941.
  {
    loser: "YUG",
    lines: [
      {
        by: T("DEU"),
        demands: [{ kind: "release", tag: "HRV" }, { kind: "puppet" }],
      },
      {
        by: T("ITA"),
        demands: [
          { kind: "take_group", group: "ljubljana" },
          { kind: "take_group", group: "dalmatia" },
          { kind: "occupation_zone", group: "montenegro" },
        ],
      },
      {
        by: T("BGR"),
        demands: [{ kind: "take_group", group: "vardar_macedonia" }],
      },
    ],
  },
  // Greece with no host for an exile: the 1941 occupation zones.
  {
    loser: "GRC",
    when: NO_EXILE,
    lines: [
      {
        by: T("ITA"),
        demands: [{ kind: "occupation_zone", group: "greece_italian" }],
      },
      {
        by: T("DEU"),
        demands: [{ kind: "occupation_zone", group: "greece_german" }],
      },
      {
        by: T("BGR"),
        demands: [{ kind: "take_group", group: "greek_thrace" }],
      },
    ],
  },
  // France with no host for an exile: the 1940-06-22 armistice lines. The
  // Vichy event usually comes first; a German puppet only when Vichy was
  // never founded.
  {
    loser: "FRA",
    when: NO_EXILE,
    lines: [
      {
        by: T("DEU"),
        demands: [
          { kind: "take_group", group: "alsace_lorraine" },
          { kind: "occupation_zone", group: "france_occupied_zone" },
        ],
      },
      {
        by: T("ITA"),
        demands: [{ kind: "occupation_zone", group: "france_italian_zone" }],
      },
      {
        by: T("DEU"),
        when: { kind: "country_state", tag: "VIC", state: "dormant" },
        demands: [{ kind: "puppet" }],
      },
    ],
  },
  // Germany, 1945: the zones once Yalta has met, the Oder line and East
  // Prussia once Potsdam has met.
  {
    loser: "DEU",
    lines: [
      {
        by: T("SUN"),
        when: YALTA,
        demands: [{ kind: "occupation_zone", group: "de_soviet_zone" }],
      },
      {
        by: T("SUN"),
        when: POTSDAM,
        demands: [
          { kind: "take_group", group: "east_prussia_north" },
          {
            kind: "take_for",
            group: "german_east_of_oder",
            beneficiary: "POL",
          },
          {
            kind: "take_for",
            group: "east_prussia_south",
            beneficiary: "POL",
          },
        ],
      },
      {
        by: T("USA"),
        when: YALTA,
        demands: [{ kind: "occupation_zone", group: "de_us_zone" }],
      },
      {
        by: T("GBR"),
        when: YALTA,
        demands: [{ kind: "occupation_zone", group: "de_uk_zone" }],
      },
      {
        by: T("FRA"),
        when: YALTA,
        demands: [{ kind: "occupation_zone", group: "de_fr_zone" }],
      },
      {
        // France's core, while it is still German by law.
        by: T("FRA"),
        when: { kind: "owns_group", group: "alsace_lorraine" },
        demands: [{ kind: "take_group", group: "alsace_lorraine" }],
      },
      {
        by: { factionLeaderOf: T("GBR") },
        demands: [{ kind: "dismantle" }, { kind: "disarm" }],
      },
      { by: T("USA"), demands: [{ kind: "liberate", tag: "AUT" }] },
      { by: T("SUN"), demands: [{ kind: "liberate", tag: "CSK" }] },
    ],
  },
  // Italy after a capitulation without the armistice event: the direction of
  // the 1947 Paris treaty.
  {
    loser: "ITA",
    lines: [
      {
        by: T("GBR"),
        demands: [
          { kind: "take_group", group: "libya" },
          { kind: "liberate", tag: "ETH" },
        ],
      },
      { by: T("USA"), demands: [{ kind: "change_government" }] },
      { by: T("GRC"), demands: [{ kind: "take_group", group: "dodecanese" }] },
      { by: T("YUG"), demands: [{ kind: "take_group", group: "istria" }] },
    ],
  },
  // Japan, 1945: the surrender of August-September and the line at the 38th
  // parallel in Korea (occupation zones only).
  {
    loser: "JPN",
    lines: [
      {
        by: T("USA"),
        demands: [
          { kind: "occupation_zone", group: "japan_home" },
          { kind: "occupation_zone", group: "korea_south" },
          { kind: "take_group", group: "pacific_mandates" },
          { kind: "liberate", tag: "PHL" },
          { kind: "dismantle" },
          { kind: "disarm" },
        ],
      },
      {
        by: T("SUN"),
        demands: [
          { kind: "take_group", group: "south_sakhalin" },
          { kind: "take_group", group: "kurils" },
          { kind: "occupation_zone", group: "korea_north" },
          { kind: "occupation_zone", group: "kwantung" },
        ],
      },
      { by: T("CHN"), demands: [{ kind: "take_group", group: "taiwan" }] },
    ],
  },
  // Manchukuo, 1945: the Soviet occupation of Manchuria, the rest to China.
  {
    loser: "MCK",
    lines: [
      {
        by: T("SUN"),
        demands: [{ kind: "occupation_zone", group: "manchuria" }],
      },
      { by: T("CHN"), demands: [{ kind: "annex_rest" }] },
    ],
  },
  // Hungary, Romania and Bulgaria when they capitulate without changing
  // sides: the direction of the 1947 Paris treaties.
  {
    loser: "HUN",
    lines: [
      {
        by: T("SUN"),
        demands: [
          {
            kind: "take_for",
            group: "north_transylvania",
            beneficiary: "ROU",
          },
        ],
      },
    ],
  },
  {
    loser: "ROU",
    lines: [
      {
        by: T("SUN"),
        demands: [
          { kind: "take_group", group: "north_bukovina" },
          { kind: "take_group", group: "bessarabia" },
        ],
      },
    ],
  },
  {
    loser: "BGR",
    lines: [
      {
        by: T("GRC"),
        demands: [{ kind: "take_group", group: "greek_thrace" }],
      },
      {
        by: T("YUG"),
        demands: [{ kind: "take_group", group: "vardar_macedonia" }],
      },
    ],
  },
];
