// ww78 section 7, B3: with the designer off, a major's start holdings are its
// real equipment from the first minute. The wings formed at air.start() (before
// the slots existed) move onto the catalogue plane standing in for their
// generation; the first clock then moves the 1936 lines to the AI's pick, which
// needs the game's seed. A plane type whose first entry waits on a tech (the
// I-16, the Do 17, France's D.376) gets that entry in its slot all the same:
// it fights, and isn't made until the tech comes.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { histOwn } from "@openfront/engine-lib/ww1936/hist/Slots";
import { changeLine } from "../economy/Production";
import { bestOfGroups } from "./AiDesigns";
import { aiPickNewPlaneLines } from "./AiHist";
import { aiPickEntry, type PickCand, qualityLean } from "./AiPick";
import { equipCostMilli } from "./Designs";
import {
  dailyHist,
  histCountryOf,
  histPlaneSlotFor,
  openHistSlot,
  sweepHistPlanes,
} from "./Hist";
import type { WwDepth } from "./WwDepth";

/** depth.start(): every major's slots open, its stock real, its wings real. */
export function startConvert(d: WwDepth): void {
  for (let id = 1; id < d.cap; id++) {
    if (histCountryOf(d, id) === null) continue;
    dailyHist(d, id, 0);
    openFirstPlanes(d, id);
    sweepHistPlanes(d, id);
    convertStartWings(d, id);
  }
}

/** Each plane type a major holds with no slot open: its oldest entry, techs or not. */
function openFirstPlanes(d: WwDepth, id: number): void {
  const country = histCountryOf(d, id);
  const ce = d.ww.economy.country(id);
  const c = d.country(id);
  if (country === null || ce === null || c === null) return;
  const held = new Set<string>();
  for (const type of AIR_TYPES) {
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      if (ce.stock[equipKey(type, g)] > 0) held.add(type);
    }
  }
  for (const w of d.ww.air.wings.values()) {
    if (w.owner === id && w.counts.some((n) => n > 0)) {
      held.add(AIR_TYPES[w.type]);
    }
  }
  const own = histOwn(country, "plane");
  for (const type of AIR_TYPES) {
    if (!held.has(type) || histPlaneSlotFor(c, country, type, 1) !== 0) {
      continue;
    }
    let first = -1;
    own.forEach((e, i) => {
      if (e.family !== "plane" || e.type !== type) return;
      if (first < 0 || e.year < own[first].year) first = i;
    });
    if (first >= 0) openHistSlot(d, id, "plane", first + 1, own[first]);
  }
}

/** A major's wings: static planes to the slot of their generation, on the ledger too. */
function convertStartWings(d: WwDepth, id: number): void {
  const country = histCountryOf(d, id);
  const ce = d.ww.economy.country(id);
  const c = d.country(id);
  if (country === null || ce === null || c === null) return;
  const air = d.ww.air;
  for (const w of air.wings.values()) {
    if (w.owner !== id) continue;
    const type = AIR_TYPES[w.type];
    let moved = false;
    w.counts.forEach((n, i) => {
      if (n <= 0) return;
      const slot = histPlaneSlotFor(c, country, type, i + 1);
      if (slot === 0) return;
      w.counts[i] = 0;
      w.dcounts[slot - 1] += n;
      ce.planesDeployed[equipKey(type, i + 1)] -= n;
      ce.planesDeployed[equipKey("plane_design", slot)] += n;
      moved = true;
    });
    if (moved) air.markWing(w.id);
  }
}

/**
 * The first clock: a major's static plane and tank lines move to the pick, at
 * no efficiency cost, with the same share of the unit done. Human or AI: a
 * player sees real names in the preparation minute and can change them.
 */
export function startConvertLines(d: WwDepth, id: number): void {
  const ce = d.ww.economy.country(id);
  if (histCountryOf(d, id) === null || ce === null) return;
  const before = ce.lines.map((l) => ({
    l,
    key: l.key,
    effBp: l.effBp,
    progress: l.progress,
  }));
  // One line moves a call.
  for (const _ of before) aiPickNewPlaneLines(d, id, ce);
  startTankLines(d, id);
  for (const b of before) {
    if (b.l.key === b.key) continue;
    b.l.effBp = b.effBp;
    b.l.progress = Math.floor(
      (b.progress * equipCostMilli(d, id, b.l.key)) /
        Math.max(1, equipCostMilli(d, id, b.key)),
    );
  }
}

/** Static tank lines to the pick among the group's catalogue slots. */
function startTankLines(d: WwDepth, id: number): void {
  const ce = d.ww.economy.country(id);
  if (ce === null) return;
  const cands = new Map<number, PickCand[]>();
  bestOfGroups(d, id, ce, cands);
  const q = qualityLean(d, id);
  const ks = d.keyStats(id);
  for (const l of ce.lines) {
    const j = GROUND_EQUIP_KEYS.indexOf(l.key);
    if (j < 0 || j >= GROUND_STATIC_SLOTS) continue;
    const slots = (cands.get(ks.group[j]) ?? []).filter(
      (x) => GROUND_EQUIP_KEYS.indexOf(x.key) >= GROUND_STATIC_SLOTS,
    );
    if (slots.length === 0) continue;
    const [t, g] = EQUIP_KEYS[aiPickEntry(slots, q)];
    changeLine(d.ww.economy, ce, l.id, t, g);
  }
}
