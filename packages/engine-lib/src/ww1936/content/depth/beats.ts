// World War 1936 P6 (spec §19.6, §16.4, §16.6, §15.3, §14.1): history beats
// for the depth systems. HistoryBeat acts cannot start a project, build a
// facility, raid or turn on a faction rule (those are orders), so each beat
// sets a country flag on its actor and the depth AI of that system acts on
// it: the projects lane (atomic, rockets, jet, radar, fuze), the sea-and-air
// lane (night bombing), the world lane (the Dnipro dam, the floating harbour,
// the dam raid) and the mechanisms lane (intelligence sharing). Like every
// beat they move an AI country only; a human country is never moved.
//
// Not beats here: the 1938-06-30 treaty escalation, the 1939-10-21 uranium
// committee and the 1943-08-19 Quebec agreement are date events
// (content/depth/world.ts) so a human receiver gets the card too, and the
// American embargo on Japan is P5's beat b19410726_usa_oil_embargo (decision
// usa_oil_embargo). The lend_lease flag is the P3 base flag.
import type { HistoryBeat } from "../types";

export const DEPTH_BEATS: readonly HistoryBeat[] = [
  // Germany builds its rocket test range in 1939 (spec §19.6).
  {
    id: "b19390101_deu_rocket_site",
    date: "1939-01-01",
    actor: "DEU",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_deu_rocket_site" }],
    },
    windowDays: 365,
  },
  // Germany starts a small atomic project: one facility, no scientist (spec §19.6).
  {
    id: "b19390901_deu_atomic",
    date: "1939-09-01",
    actor: "DEU",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_deu_atomic" }],
    },
    windowDays: 365,
  },
  // Germany starts the jet engine project in 1940 (spec §19.6).
  {
    id: "b19400101_deu_jet",
    date: "1940-01-01",
    actor: "DEU",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_deu_jet" }],
    },
    windowDays: 365,
  },
  // Britain starts the microwave radar project: the first cavity magnetron ran on 1940-02-21 (spec §19.6).
  {
    id: "b19400221_gbr_magnetron",
    date: "1940-02-21",
    actor: "GBR",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_gbr_magnetron" }],
    },
    windowDays: 365,
  },
  // The Allies' leader turns on the faction rule fr_shared_intel (spec §14.1: 1940-06, month only).
  {
    id: "b19400601_gbr_shared_intel",
    date: "1940-06-01",
    actor: "GBR",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_allied_shared_intel" }],
    },
    windowDays: 30,
  },
  // The United States builds two nuclear research institutes (spec §19.6:
  // 1942-06). Final balance: from the NDRC's founding, 1940-06-27 — by
  // 1942 the AI had filled every US region with infrastructure 3+ with
  // factories, so the sites never found a slot and no bomb was ever made.
  // The project still starts with the 1942-08-13 beat below.
  {
    id: "b19420601_usa_atomic_sites",
    date: "1940-06-27",
    actor: "USA",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_usa_atomic_sites" }],
    },
    windowDays: 60,
  },
  // British strategic bombers fly at night from 1940-09 (spec §15.3).
  {
    id: "b19400901_gbr_night_bombing",
    date: "1940-09-01",
    actor: "GBR",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_gbr_night_bombing" }],
    },
    windowDays: 30,
  },
  // Germany starts the flying bomb project in 1941 (spec §19.6).
  {
    id: "b19410101_deu_flying_bomb",
    date: "1941-01-01",
    actor: "DEU",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_deu_flying_bomb" }],
    },
    windowDays: 365,
  },
  // Japan starts a small atomic project: the army's request of April 1941 (spec §19.6).
  {
    id: "b19410401_jpn_atomic",
    date: "1941-04-01",
    actor: "JPN",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_jpn_atomic" }],
    },
    windowDays: 365,
  },
  // The Soviet Union scorches the Dnipro dam, only when Germany borders Zaporizhzhia (spec §16.4; the world lane checks).
  {
    id: "b19410818_sun_dnipro_dam",
    date: "1941-08-18",
    actor: "SUN",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_sun_dnipro_dam" }],
    },
    windowDays: 30,
  },
  // Germany starts the ballistic rocket project in 1942 (spec §19.6).
  {
    id: "b19420101_deu_ballistic",
    date: "1942-01-01",
    actor: "DEU",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_deu_ballistic" }],
    },
    windowDays: 365,
  },
  // The United States starts the proximity fuze project in 1942 (spec §19.6).
  {
    id: "b19420101_usa_proximity_fuze",
    date: "1942-01-01",
    actor: "USA",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_usa_proximity_fuze" }],
    },
    windowDays: 365,
  },
  // The United States starts sp_atomic with its nuclear scientist: the Manhattan District was created on 1942-08-13 (spec §19.6).
  {
    id: "b19420813_usa_atomic_start",
    date: "1942-08-13",
    actor: "USA",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_usa_atomic_start" }],
    },
    windowDays: 60,
  },
  // The Soviet Union starts sp_atomic: the State Defence Committee decree of 1943-02-11 (spec §19.6).
  {
    id: "b19430211_sun_atomic",
    date: "1943-02-11",
    actor: "SUN",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_sun_atomic" }],
    },
    windowDays: 365,
  },
  // Britain's precision raid on the Möhne and Eder dams, the night of 16-17 May 1943: raid_bomb weight ×5 when the conditions hold (spec §16.4).
  {
    id: "b19430517_gbr_dam_raid",
    date: "1943-05-17",
    actor: "GBR",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_gbr_dam_raid" }],
    },
    windowDays: 30,
  },
  // Britain deploys a floating harbour after a successful landing: the Normandy harbours were sunk into place from 1944-06-09 (spec §16.6).
  {
    id: "b19440609_gbr_floating_harbor",
    date: "1944-06-09",
    actor: "GBR",
    act: {
      kind: "effects",
      effects: [{ kind: "set_flag", flag: "hist_gbr_floating_harbor" }],
    },
    windowDays: 30,
  },
];

/** Every flag the depth content sets: the country flags above, then the
 * global flags of the treaty escalation and the Quebec agreement events. */
export const DEPTH_FLAGS: readonly string[] = [
  "hist_deu_rocket_site",
  "hist_deu_atomic",
  "hist_deu_jet",
  "hist_gbr_magnetron",
  "hist_allied_shared_intel",
  "hist_gbr_night_bombing",
  "hist_deu_flying_bomb",
  "hist_jpn_atomic",
  "hist_sun_dnipro_dam",
  "hist_deu_ballistic",
  "hist_usa_proximity_fuze",
  "hist_usa_atomic_sites",
  "hist_usa_atomic_start",
  "hist_sun_atomic",
  "hist_gbr_dam_raid",
  "hist_gbr_floating_harbor",
  "treaty_escalated",
  "quebec_agreement",
];
