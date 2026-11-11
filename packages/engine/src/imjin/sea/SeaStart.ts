// The Imjin War's start fleets (ww175 design §6.2, ww177 merge 1): the
// Joseon provincial navies at their bases and Japan's fleets at Nagoya,
// Tsushima and Hakata. Ming's fleet comes from 1597 by state (P4), the
// Jurchen have none. Admirals are skill rows only; P6 writes the people.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { Formation, ShipKind } from "@openfront/engine-lib/imjin/SeaRules";
import { MT } from "@openfront/engine-lib/imjin/SeaRules";
import type { WwImjin } from "../WwImjin";
import { addFleet, newAdmiral, type SeaAdmiral } from "./SeaState";

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
