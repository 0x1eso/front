// World War 1936 diplomacy D2 (ww161 Design B §2; lane L5, moved here at the
// integration): which regions of a capitulated country a collaboration
// government may be set up on. The engine checks an order with it
// (endgame/Collab.ts collabBlock) and the composer pre-picks with it, so
// both read one rule. Regions by id, countries by smallID.

/** The state the region rule reads (the engine its state; the client its views). */
export interface CollabRegionFacts {
  legalOwner(region: number): number;
  controller(region: number): number;
  hasCore(id: number, region: number): boolean;
  /** `region` lies in one of `id`'s claim groups. */
  claims(id: number, region: number): boolean;
  /** In the stake of a peace conference still to settle. */
  inOpenStake(region: number): boolean;
}

/**
 * `from` may hand `region` of `target` to its collaborators: `target`'s
 * legal land that `from` controls, not `from`'s core or claim, and not at
 * stake in a conference still to settle.
 */
export function collabRegionOk(
  f: CollabRegionFacts,
  from: number,
  target: number,
  region: number,
): boolean {
  return (
    f.legalOwner(region) === target &&
    f.controller(region) === from &&
    !f.hasCore(from, region) &&
    !f.claims(from, region) &&
    !f.inOpenStake(region)
  );
}
