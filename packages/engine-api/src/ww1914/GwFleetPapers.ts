// Great War 1914 (ww221 §4, lane A): the Admiralty's papers. A fleet moves or
// sorties only when the ruler signs one of them; the navy office holder (for
// Britain the First Sea Lord's word first) says in words what he thinks of it.
// The ruler asks through the orders move_fleet and sortie_fleet; the Admiralty
// also proposes moves of its own. Engine: engine/ww1914/FleetPapers.ts.
import { z } from "zod";
import {
  GW_SEA_AREAS,
  type GwFleetBlock,
  type GwFleetKind,
  type GwFleetMission,
  type GwSeaArea,
} from "./GwFleets";

/** What a paper does: send a fleet, order a sortie, or set it a duty there. */
export const GW_FLEET_PAPER_KINDS = ["move", "sortie", "mission"] as const;
export type GwFleetPaperKind = (typeof GW_FLEET_PAPER_KINDS)[number];

/**
 * A sortie paper's picks, in words only: 주력끼리 맞붙는다, 적 함대 일부만
 * 끌어낸다, 항구에 둔다. Text gw.fleet_paper.pick.<pick>.
 */
export const GW_SORTIE_PICKS = ["full", "part", "stay"] as const;
export type GwSortiePick = (typeof GW_SORTIE_PICKS)[number];

/**
 * The admiral's word on a paper, by his temperament and the sea; text
 * gw.fleet_paper.say.<seat>.<voice>. `thin_home`: he won't thin the home sea;
 * `keep_port`: he would keep the fleet in port; `too_strong`: the foe is
 * stronger; `eager`: he asks for it himself; `repair`: it is in the yards.
 */
export const GW_FLEET_VOICES = [
  "agrees",
  "eager",
  "thin_home",
  "keep_port",
  "too_strong",
  "repair",
] as const;
export type GwFleetVoice = (typeof GW_FLEET_VOICES)[number];

/** Why the Admiralty brings a paper of its own; text gw.fleet_paper.why.<why>. */
export const GW_FLEET_PAPER_WHYS = [
  "asked", // the ruler asked for it (move_fleet, sortie_fleet)
  "dept", // the 해군 department's course (send, sortie)
  "shipping", // shipping losses: cruisers to the Atlantic
  "home_lost", // the home sea is lost: the battle fleet home
  "straits", // the straits front is open: support for the landing
] as const;
export type GwFleetPaperWhy = (typeof GW_FLEET_PAPER_WHYS)[number];

/**
 * What a seat's fleets did this chapter, for the diary's `fleet` moment and the
 * cond `fleet_now`: a battle won, lost or even, a third of the fleet gone, six
 * months in port, a ship built, a foe that came out unseen (hindsight).
 */
export const GW_FLEET_MOMENTS = [
  "won",
  "lost",
  "even",
  "third_lost",
  "idle",
  "built",
  "fooled",
] as const;
export type GwFleetMoment = (typeof GW_FLEET_MOMENTS)[number];

// GreatWarTypes imports this file (seat.fleetAsks), so the id is spelled here.
const FleetId = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(48);

/** A ruler's standing ask to the Admiralty (orders move_fleet, sortie_fleet). */
export const GwFleetAskSchema = z.object({
  fleet: FleetId,
  /** Where to; absent: a sortie. */
  to: z.enum(GW_SEA_AREAS).optional(),
  chapter: z.number().int(),
});
export type GwFleetAsk = z.infer<typeof GwFleetAskSchema>;

/** One of the Admiralty's papers, as the seat sees it. */
export interface GwFleetPaperView {
  /** `<kind>_<fleet id>`; the order fleet_paper answers by it. */
  id: string;
  kind: GwFleetPaperKind;
  fleet: string;
  fleetKind: GwFleetKind;
  /** Our ships in it (counts may show as information). */
  ships: number;
  area: GwSeaArea;
  /** A move: where, and chapters on the way (gwEtaWord words). */
  to?: GwSeaArea;
  eta?: number;
  /** A mission paper, or the duty a move takes up on arrival. */
  mission?: GwFleetMission;
  /** A sortie: the picks it offers, in words. */
  picks?: readonly GwSortiePick[];
  why: GwFleetPaperWhy;
  /** Who speaks for it (a person id) and how. */
  by: string | null;
  voice: GwFleetVoice;
  /** He is against it: signing it (a sortie: not "stay") overrules him. */
  objects: boolean;
  /** "적이 미리 알고 기다릴 수도 있습니다": the foe's chain or codes reach us. */
  warned: boolean;
  open: boolean;
  block: GwFleetBlock | null;
}
