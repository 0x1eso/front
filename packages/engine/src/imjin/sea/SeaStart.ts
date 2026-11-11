// The Imjin War's start fleets (ww175 design §6.2, ww177 merge 1): the
// Joseon provincial navies at their bases and Japan's fleets at Nagoya,
// Tsushima and Hakata. Ming's fleet comes by state (mingFleetByState, lane
// I5b), the Jurchen have none. Admirals are skill rows only; P6 writes the
// people.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { IMJIN_GFLAGS } from "@openfront/engine-lib/imjin/CourtScenes";
import type { Formation, ShipKind } from "@openfront/engine-lib/imjin/SeaRules";
import { MT } from "@openfront/engine-lib/imjin/SeaRules";
import { navalPortsOf } from "../../ww1936/navy/Ports";
import type { WwImjin } from "../WwImjin";
import {
  addFleet,
  fleetStrength,
  newAdmiral,
  type SeaAdmiral,
} from "./SeaState";

interface StartFleet {
  tag: CountryTag;
  /** The base region's English name in the map's scenario. */
  base: string;
  admiral: Partial<SeaAdmiral>;
  formation: Formation;
  ships: readonly (readonly [ShipKind, number])[];
}

export const SEA_START: readonly StartFleet[] = [
  {
    tag: "JOS",
    base: "Yeosu",
    admiral: { gunnery: 5, tactics: 5, boarding: 2, nerve: 5 },
    formation: "line",
    ships: [
      ["panokseon", 24],
      ["turtle", 2],
      ["hyeopseon", 6],
    ],
  },
  {
    tag: "JOS",
    base: "Haenam",
    admiral: { gunnery: 3, tactics: 3, boarding: 2, nerve: 3 },
    formation: "line",
    ships: [
      ["panokseon", 18],
      ["hyeopseon", 4],
    ],
  },
  {
    tag: "JOS",
    base: "Geoje",
    admiral: { gunnery: 2, tactics: 1, boarding: 2, nerve: 2 },
    formation: "line",
    ships: [
      ["panokseon", 12],
      ["hyeopseon", 4],
    ],
  },
  {
    tag: "JOS",
    base: "Dongnae",
    admiral: { gunnery: 1, tactics: 1, boarding: 1, nerve: 1 },
    formation: "line",
    ships: [["panokseon", 8]],
  },
  {
    tag: "JPN",
    base: "Nagoya",
    admiral: { gunnery: 2, tactics: 3, boarding: 4, nerve: 4 },
    formation: "wedge",
    ships: [
      ["atakebune", 4],
      ["sekibune", 22],
      ["kobaya", 10],
    ],
  },
  {
    tag: "JPN",
    base: "Tsushima",
    admiral: { gunnery: 2, tactics: 3, boarding: 4, nerve: 3 },
    formation: "wedge",
    ships: [
      ["atakebune", 2],
      ["sekibune", 20],
      ["kobaya", 10],
    ],
  },
  {
    tag: "JPN",
    base: "Hakata",
    admiral: { gunnery: 1, tactics: 2, boarding: 5, nerve: 2 },
    formation: "column",
    ships: [
      ["atakebune", 2],
      ["sekibune", 24],
      ["kobaya", 10],
    ],
  },
];

/** Puts the start fleets at their bases' berths (a base the map lacks is skipped). */
export function seedSeaStart(im: WwImjin): void {
  const sc = im.ww.scenario;
  const map = im.mg.map();
  for (const f of SEA_START) {
    const owner = im.idOf(f.tag);
    const region = sc.landRegions.find((r) => r.name === f.base);
    if (owner <= 0 || region === undefined) continue;
    const t = im.portTile(region.id);
    if (t < 0) continue;
    const kinds: ShipKind[] = [];
    for (const [k, n] of f.ships) for (let i = 0; i < n; i++) kinds.push(k);
    addFleet(
      im.st.sea,
      owner,
      map.x(t) * MT + (MT >> 1),
      map.y(t) * MT + (MT >> 1),
      kinds,
      { admiral: newAdmiral(f.admiral), formation: f.formation },
    );
  }
}

/** Ming's fleet (design §7, "later a fleet, all by state"): the war junks and the fast boats. */
export const MING_FLEET: Omit<StartFleet, "base"> = {
  tag: "MIN",
  admiral: { gunnery: 3, tactics: 3, boarding: 3, nerve: 3 },
  formation: "line",
  ships: [
    ["fuchuan", 8],
    ["shachuan", 16],
  ],
};
/** Days of Ming's war after which its fleet sails on its own account. */
export const MING_FLEET_WAR_DAYS = 720;
/** Joseon's navy is failing when Japan's ships outweigh it by this (%). */
export const MING_FLEET_FAILING_PCT = 125;

/**
 * Once a day, while Ming is at war with Japan: Ming sends its fleet when a
 * truce has broken, when its war has lasted MING_FLEET_WAR_DAYS, or when
 * its relief army is in and Joseon's navy is failing. It sails from the
 * Ming port nearest Joseon's main fleet, once a game.
 */
export function mingFleetByState(im: WwImjin, day: number): boolean {
  const sea = im.st.sea;
  if (sea.mingFleet !== undefined || im.st.mingDay < 0) return false;
  const ww = im.ww;
  const min = im.idOf("MIN");
  const jpn = im.idOf("JPN");
  const jos = im.idOf("JOS");
  if (min <= 0 || jpn <= 0 || !ww.isAtWar(min, jpn)) return false;
  const flags = ww.politics.gflags;
  let joseon = 0;
  let japan = 0;
  let aim: { x: number; y: number; s: number } | null = null;
  for (const f of sea.fleets) {
    const s = fleetStrength(sea, f);
    if (f.owner === jos) {
      joseon += s;
      if (aim === null || s > aim.s) aim = { x: f.x, y: f.y, s };
    } else if (f.owner === jpn) japan += s;
  }
  const called =
    flags.has(IMJIN_GFLAGS.truceBroken) ||
    day - im.st.mingDay >= MING_FLEET_WAR_DAYS ||
    (flags.has(IMJIN_GFLAGS.mingRelief) &&
      joseon * MING_FLEET_FAILING_PCT < japan * 100);
  if (!called) return false;
  const map = im.mg.map();
  let berth = -1;
  let bd = Infinity;
  for (const r of navalPortsOf(ww, min)) {
    const t = im.portTile(r);
    if (t < 0) continue;
    const dx = aim === null ? 0 : map.x(t) * MT - aim.x;
    const dy = aim === null ? 0 : map.y(t) * MT - aim.y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      berth = t;
    }
  }
  if (berth < 0) return false;
  const kinds: ShipKind[] = [];
  for (const [k, n] of MING_FLEET.ships)
    for (let i = 0; i < n; i++) kinds.push(k);
  addFleet(
    sea,
    min,
    map.x(berth) * MT + (MT >> 1),
    map.y(berth) * MT + (MT >> 1),
    kinds,
    {
      admiral: newAdmiral(MING_FLEET.admiral),
      formation: MING_FLEET.formation,
    },
  );
  sea.mingFleet = day;
  return true;
}
