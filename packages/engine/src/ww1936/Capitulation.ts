import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  CapitulationData,
  WW_CAPITULATION_DAYS,
  WW_TRANSFER_TILES_PER_TICK,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "../game/Game";
import type { WorldWar } from "./WorldWar";

/** Spec §7.5: a region's points go to the owner of its VP tile. Indexed by smallID. */
export function controlledVp(mg: Game, ww: WorldWar): number[] {
  const out = new Array<number>(ww.scenario.countries.length + 1).fill(0);
  for (const r of ww.scenario.landRegions) {
    const owner = mg.ownerID(ww.scenario.vpTile(r));
    if (owner > 0 && owner < out.length) out[owner] += r.vp;
  }
  return out;
}

/**
 * Of `smallID`'s regions (P3 spec §17.1: its legal ones, the 1936 regions
 * at the start), the victory points it still controls.
 */
export function heldStartVp(mg: Game, ww: WorldWar, smallID: number): number {
  const owners = ww.politics.legalOwner;
  let held = 0;
  for (const r of ww.scenario.landRegions) {
    if (owners[r.id] !== smallID) continue;
    if (mg.ownerID(ww.scenario.vpTile(r)) === smallID) held += r.vp;
  }
  return held;
}

/**
 * Who ends up with what `smallID` holds: itself, or once it has capitulated,
 * its victor (whose own capitulation passes it on again). 0: nobody. P5
 * (pre-flight §A W × X): an exile is its own heir (it fights on).
 */
function heir(
  caps: readonly CapitulationData[],
  smallID: number,
  isExile: (id: number) => boolean,
): number {
  let id = smallID;
  for (let i = 0; i <= caps.length; i++) {
    if (isExile(id)) return id;
    const cap = caps.find((c) => c.smallID === id);
    if (cap === undefined) return id;
    id = cap.victor;
    if (id === 0) return 0;
  }
  return 0;
}

/**
 * Points of `loser`'s legal regions each other country controls. What a
 * capitulated country holds counts for its victor: it is on its way there.
 */
function takenFrom(mg: Game, ww: WorldWar, loser: number): Map<number, number> {
  const owners = ww.politics.legalOwner;
  const caps = ww.data().capitulated;
  const out = new Map<number, number>();
  for (const r of ww.scenario.landRegions) {
    if (owners[r.id] !== loser) continue;
    const holder = heir(caps, mg.ownerID(ww.scenario.vpTile(r)), (id) =>
      ww.endgame.isExile(id),
    );
    if (holder === 0 || holder === loser) continue;
    out.set(holder, (out.get(holder) ?? 0) + r.vp);
  }
  return out;
}

/**
 * The enemy holding most of the loser's starting points (ties: the smaller
 * smallID); when no enemy holds any, whoever holds most; else null. Never a
 * country that has capitulated itself (see takenFrom).
 */
export function pickVictor(
  mg: Game,
  ww: WorldWar,
  loser: Player,
): Player | null {
  const taken = [...takenFrom(mg, ww, loser.smallID())].sort(
    (a, b) => a[0] - b[0],
  );
  const enemies = new Set(ww.enemiesOf(loser.smallID()));
  for (const enemiesOnly of [true, false]) {
    let best = 0;
    let bestVp = 0;
    for (const [id, vp] of taken) {
      if (enemiesOnly && !enemies.has(id)) continue;
      if (vp > bestVp) {
        best = id;
        bestVp = vp;
      }
    }
    if (best !== 0) {
      const p = mg.playerBySmallID(best);
      return p.isPlayer() ? p : null;
    }
  }
  return null;
}

/**
 * Once a day (WorldWarExecution), spec §7.5: a country at or past its
 * surrender line fills its capitulation gauge by one, and capitulates when
 * the gauge is full (WW_CAPITULATION_DAYS checks); below the line the gauge
 * empties by one. A country at war with nobody has an empty gauge.
 */
export function checkCapitulations(mg: Game, ww: WorldWar, tick: number): void {
  // P3 spec §6.4, §17.1: of each country's legal regions, the points it has
  // and still controls, as the day began: a capitulation inside this loop
  // hands its regions over (P2, P3), but the others are judged on the day's
  // start.
  const owners = ww.politics.legalOwner;
  const n = ww.scenario.countries.length + 1;
  const start = new Array<number>(n).fill(0);
  const held = new Array<number>(n).fill(0);
  for (const r of ww.scenario.landRegions) {
    const owner = owners[r.id];
    if (owner <= 0 || owner >= n) continue;
    start[owner] += r.vp;
    if (mg.ownerID(ww.scenario.vpTile(r)) === owner) held[owner] += r.vp;
  }
  for (let id = 1; id <= ww.scenario.countries.length; id++) {
    // P5 spec §1.4: an exile never capitulates (again).
    if (ww.endgame.isExile(id)) {
      ww.setCapitulationGauge(id, 0);
      continue;
    }
    if (ww.isCapitulated(id)) continue;
    const p = mg.playerBySmallID(id);
    if (!p.isPlayer() || !p.isAlive() || !ww.hasWar(id)) {
      ww.setCapitulationGauge(id, 0);
      // P5 hook (final lane): at peace its line is whole again.
      if (!ww.hasWar(id)) ww.endgame.setCapitulationBase(id, 0);
      continue;
    }
    // P5 hook (final lane, the exile return loop): a country back from
    // exile or revived counts from what it held when it came back — what it
    // had lost before is off its line (a recovery lowers that baseline).
    const base = ww.endgame.capitulationBase(id);
    let lost = start[id] - held[id];
    let line = start[id];
    if (base > 0) {
      if (lost < base) ww.endgame.setCapitulationBase(id, lost);
      const b = Math.min(base, lost);
      lost -= b;
      line -= b;
    }
    // A country whose regions are all worth 0 has no surrender line: it
    // never capitulates by points (below, 0 lost of 0 counts as past it).
    if (line === 0) continue;
    const gauge = ww.capitulationGauge(id);
    // P3 spec §6.4: the line moves with stability and war support.
    if (lost * 100 < line * ww.politics.surrenderPct(id)) {
      if (gauge > 0) ww.setCapitulationGauge(id, gauge - 1);
      continue;
    }
    if (gauge + 1 < WW_CAPITULATION_DAYS) {
      ww.setCapitulationGauge(id, gauge + 1);
      continue;
    }
    capitulate(mg, ww, p, tick);
  }
}

/**
 * Spec §7.5: the country leaves every war, its army is gone, and the rest of
 * its land goes to the victor over the next ticks. P5 (spec §16.4
 * `surrender {to}`): `receiver`, when given, is the victor instead of
 * pickVictor's.
 */
export function capitulate(
  mg: Game,
  ww: WorldWar,
  loser: Player,
  tick: number,
  receiver?: Player,
): void {
  const victor = receiver ?? pickVictor(mg, ww, loser);
  const loserID = loser.smallID();
  ww.addCapitulation(loserID, victor?.smallID() ?? 0, tick);
  ww.setCapitulationGauge(loserID, 0);
  // Its army is gone: the troops at home, its running attacks and the
  // troops at sea. An attack already retreating finishes its retreat as
  // ordered (deleted, its execution would wait for that retreat forever).
  loser.setTroops(0);
  for (const a of [...loser.outgoingAttacks()]) {
    if (!a.retreating()) a.delete();
  }
  for (const u of loser.units(UnitType.TransportShip)) u.delete(false);
  // Nobody is at war with it any more, so the attacks on it end and their
  // troops go home without losses (as when an alliance forms mid-attack).
  // From here on only the transfer takes its land, so the conquest is
  // settled exactly once, by the victor. An attack already retreating
  // conquers nothing more and finishes its retreat as ordered.
  for (const a of [...loser.incomingAttacks()]) {
    if (a.retreating()) continue;
    a.attacker().addTroops(a.troops());
    if (!a.retreating()) a.delete();
  }
  // The same for boats still sailing to its land: they turn into troops at
  // home, so no landing takes a tile from it (or from its victor later).
  for (const u of mg.units(UnitType.TransportShip)) {
    const dst = u.targetTile();
    if (dst === undefined || mg.ownerID(dst) !== loserID) continue;
    u.owner().addTroops(u.troops());
    u.delete(false);
  }
  // P5 plan decision 9: its wars, forces, land and politics — the endgame's
  // capitulation (lane W; the foundation's stub is P0–P4's order: wars,
  // forces, navy and air, control, legal owner, politics).
  ww.endgame.onCapitulated(loserID, victor?.smallID() ?? 0, tick);
  // Without a victor (nobody holds its points: unowned land) the message
  // names none, rather than "capitulated to" nobody.
  if (victor === null) {
    mg.displayMessage(
      "events_display.ww1936_capitulated_no_victor",
      MessageType.WORLD_WAR,
      null,
      undefined,
      { loserTag: ww.tagOf(loserID) },
    );
    return;
  }
  mg.displayMessage(
    "events_display.ww1936_capitulated",
    MessageType.WORLD_WAR,
    null,
    undefined,
    {
      loserTag: ww.tagOf(loserID),
      victorTag: ww.tagOf(victor.smallID()),
    },
  );
}

/**
 * Every tick: moves up to WW_TRANSFER_TILES_PER_TICK tiles of the oldest
 * transfers, skipping tiles the loser no longer owns. The conquest (gold,
 * stats, the conquest event) is settled when the loser's last tile moves,
 * and its transfer ends there. A loser still holding land when its list is
 * used up (a dying neighbour's tiles handed to it meanwhile) has that land
 * listed again, in its own tile order.
 */
export function stepTransfers(mg: Game, ww: WorldWar): void {
  const list = ww.transfers();
  let budget = WW_TRANSFER_TILES_PER_TICK;
  while (budget > 0 && list.length > 0) {
    const t = list[0];
    const from = mg.playerBySmallID(t.from);
    const to = mg.playerBySmallID(t.to);
    while (budget > 0 && t.next < t.tiles.length) {
      const tile = t.tiles[t.next++];
      if (!to.isPlayer() || mg.ownerID(tile) !== t.from) continue;
      to.conquer(tile);
      budget--;
      if (from.isPlayer() && !from.isAlive()) {
        mg.conquerPlayer(to, from);
        t.next = t.tiles.length;
      }
    }
    if (t.next < t.tiles.length) return;
    if (
      from.isPlayer() &&
      from.isAlive() &&
      to.isPlayer() &&
      ww.isCapitulated(t.from)
    ) {
      t.tiles = Uint32Array.from(from.tiles());
      t.next = 0;
      continue;
    }
    list.shift();
  }
}
