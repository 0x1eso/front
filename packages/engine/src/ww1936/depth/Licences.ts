// P6 lane M (plan Task 4): production licences (spec §7.1). A licence is
// [from = the licensor, to = the licensee]; a request waiting for a human
// licensor's answer is a pending card [from = the requester, to = the
// asked]. Outside a faction the licensee hands the licensor one civilian
// factory while the licence lives (the foundation's civFlow counts the
// records). A design licence copies the design into the licensee's slots
// as "licensed" (lane E's copyDesignTo, the one path); a static one stands
// in for the generation's techs (P1's line judge reads licenceKeys).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  DesignKind,
  LICENCE_CARD_TICKS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EquipmentType,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { NON_TRANSFERABLE } from "@openfront/engine-lib/ww1936/DepthRules";
import { licenceCostPct } from "@openfront/engine-lib/ww1936/DesignRules";
import { payableCivs } from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  equipmentBuildable,
  isDesignType,
  PROJECT_TYPES,
} from "@openfront/engine-lib/ww1936/Equipment";
import {
  licenceBlock,
  newestStaticYear,
  staticGenResearched,
  staticKeyYear,
} from "@openfront/engine-lib/ww1936/MarketRules";
import { tradePaidCivs } from "../economy/Trade";
import { opinionOf } from "../politics/Treaties";
import { copyDesignTo } from "./DesignCopy";
import type { WwDepth } from "./WwDepth";

/** Spec §7.1: an AI licensor outside the faction wants at least this opinion of the requester. */
export const AI_LICENCE_OPINION = 25;
/** Spec §7.1: …and the requester not among its top threats. */
export const AI_LICENCE_TOP_THREATS = 3;

type Licence = WwDepth["market"]["licences"][number];
type Pending = WwDepth["market"]["pending"][number];

const EMPTY_TECHS: ReadonlySet<WwTechId> = new Set();
const AIR: ReadonlySet<string> = new Set<string>(AIR_TYPES);
const TANK_LINE: ReadonlySet<EquipmentType> = new Set<EquipmentType>([
  "light_tank",
  "medium_tank",
  "tank_design",
]);

/** The design kind of a design key's type, null for a static type. */
export function designKindOf(type: EquipmentType): DesignKind | null {
  return type === "tank_design"
    ? "tank"
    : type === "plane_design"
      ? "plane"
      : null;
}

/** A design's year (its stats'); 1936 without one. */
function designYear(
  d: WwDepth,
  id: number,
  kind: DesignKind,
  slot: number,
): number {
  const s = d.designStatsOf(id, kind, slot);
  return s !== null && "year" in s ? s.year : 1936;
}

/** The P4 type a plane design flies as ("" unknown). */
function planeTypeOf(d: WwDepth, id: number, slot: number): string {
  const s = d.designStatsOf(id, "plane", slot);
  return s !== null && s.kind === "plane" ? s.type : "";
}

/** The year of an EQUIP_KEYS item of `id` (a design slot's own year). */
export function keyYear(d: WwDepth, id: number, key: number): number {
  const [type, gen] = EQUIP_KEYS[key];
  const kind = designKindOf(type);
  return kind === null
    ? staticKeyYear(type, gen)
    : designYear(d, id, kind, gen);
}

/**
 * Spec §7.1–§7.2: the newest year of the line `key` belongs to that `id`
 * makes itself (the techs it has researched, its own designs): tanks one
 * line, an aircraft its P4 type, anything else its type. 1936 at least.
 */
export function lineNewestYear(d: WwDepth, id: number, key: number): number {
  const [type, gen] = EQUIP_KEYS[key];
  const researched = d.ww.economy.country(id)?.researched ?? EMPTY_TECHS;
  const c = d.country(id);
  let y = 1936;
  if (TANK_LINE.has(type)) {
    y = Math.max(
      y,
      newestStaticYear("light_tank", researched),
      newestStaticYear("medium_tank", researched),
    );
    c?.des.tank.forEach((s, i) => {
      if (s !== null && s.origin === "own") {
        y = Math.max(y, designYear(d, id, "tank", i + 1));
      }
    });
    return y;
  }
  const air =
    type === "plane_design"
      ? planeTypeOf(d, id, gen)
      : AIR.has(type)
        ? (type as string)
        : "";
  if (air !== "") {
    if (AIR.has(air)) {
      y = Math.max(y, newestStaticYear(air as EquipmentType, researched));
    }
    c?.des.plane.forEach((s, i) => {
      if (
        s !== null &&
        s.origin === "own" &&
        planeTypeOf(d, id, i + 1) === air
      ) {
        y = Math.max(y, designYear(d, id, "plane", i + 1));
      }
    });
    return y;
  }
  if (type === "plane_design") return y;
  return Math.max(y, newestStaticYear(type, researched));
}

/** Spec §7.1: civilian factories `id` can still hand over (its own after consumer goods, less what its deals pay, with what comes in). */
export function freeCivsOf(d: WwDepth, id: number): number {
  const econ = d.ww.economy;
  const ce = econ.country(id);
  if (ce === null) return 0;
  let paid = 0;
  for (const tr of econ.trades()) {
    if (tr.buyer === id) paid += tradePaidCivs(econ, tr);
  }
  return (
    payableCivs(ce.totals.civ, ce.totals.cgMilli) -
    paid -
    d.civsOut(id) +
    d.civsIn(id)
  );
}

/** Countries by the tension they made, most first (smallID on a tie), `self` left out, at most `n`. */
export function topThreats(d: WwDepth, self: number, n: number): number[] {
  const t = d.ww.politics.threatBp;
  const out: number[] = [];
  for (let id = 1; id < t.length; id++) {
    if (id !== self && (t[id] ?? 0) > 0) out.push(id);
  }
  out.sort((a, b) => t[b] - t[a] || a - b);
  return out.slice(0, n);
}

/** What the licensor has of the item (spec §7.1): a static generation's techs, an own design not obsolete. */
interface Offer {
  has: boolean;
  obsolete: boolean;
  transferable: boolean;
  /** The design copied ("ship", "tank", "plane") and the licensor's slot; null: a static generation. */
  kind: DesignKind | null;
  slot: number;
}

function offerOf(
  d: WwDepth,
  from: number,
  key: number,
  ship: number,
): Offer | null {
  if (ship > 0) {
    const s = d.designSlot(from, "ship", ship);
    return {
      has: s !== null && s.origin === "own",
      obsolete: s?.obsolete ?? false,
      transferable: true,
      kind: "ship",
      slot: ship,
    };
  }
  const k = EQUIP_KEYS[key];
  if (k === undefined) return null;
  const [type, gen] = k;
  const kind = designKindOf(type);
  if (kind !== null) {
    const s = d.designSlot(from, kind, gen);
    return {
      has: s !== null && s.origin === "own",
      obsolete: s?.obsolete ?? false,
      transferable: true,
      kind,
      slot: gen,
    };
  }
  const ce = d.ww.economy.country(from);
  return {
    has: ce !== null && staticGenResearched(type, gen, ce.researched),
    obsolete: false,
    transferable:
      !NON_TRANSFERABLE.includes(type) &&
      equipmentBuildable(type) &&
      PROJECT_TYPES[type] === undefined &&
      !isDesignType(type),
    kind: null,
    slot: 0,
  };
}

const sameItem = (
  a: { key: number; ship: number },
  key: number,
  ship: number,
): boolean => (ship > 0 ? a.ship === ship : a.ship === 0 && a.key === key);

/** Why `to` may not license `key` (or ship design `ship`) from `from` now; null when it may. */
export function licenceRequestBlock(
  d: WwDepth,
  to: number,
  from: number,
  key: number,
  ship: number,
): WwOrderBlock | null {
  if (from === to || !(from > 0 && from < d.cap)) return "no_partner";
  if (d.country(from) === null || !d.ww.isActor(from)) return "no_partner";
  const offer = offerOf(d, from, key, ship);
  if (offer === null) return "bad_index";
  const m = d.market;
  return licenceBlock({
    atWar: d.ww.isAtWar(from, to),
    embargoed: d.embargoed(from, to),
    senderHas: offer.has,
    exists:
      m.licences.some(
        (l) => l.from === from && l.to === to && sameItem(l, key, ship),
      ) ||
      m.pending.some(
        (p) => p.from === to && p.to === from && sameItem(p, key, ship),
      ),
    count:
      m.licences.filter((l) => l.to === to).length +
      m.pending.filter((p) => p.from === to).length,
    obsolete: offer.obsolete,
    transferable: offer.transferable,
    civsShort: !d.ww.sameFaction(from, to) && freeCivsOf(d, to) < 1,
  });
}

/** Spec §7.1: an AI licensor's answer — its faction always, else opinion ≥ 25 and the requester not a top-3 threat. */
export function aiAcceptsLicence(
  d: WwDepth,
  licensor: number,
  requester: number,
): boolean {
  if (d.ww.sameFaction(licensor, requester)) return true;
  if (opinionOf(d.ww.politics, licensor, requester) < AI_LICENCE_OPINION) {
    return false;
  }
  return !topThreats(d, licensor, AI_LICENCE_TOP_THREATS).includes(requester);
}

/** The notice params of a licence's item: the other country, and the design's name or the equipment's id. */
function itemParams(
  d: WwDepth,
  other: number,
  from: number,
  key: number,
  ship: number,
): Record<string, string | number> {
  const p: Record<string, string | number> = {
    countryTag: d.ww.tagOf(other),
  };
  if (ship > 0) {
    p.design = d.designSlot(from, "ship", ship)?.def.name ?? "";
    return p;
  }
  const k = EQUIP_KEYS[key];
  if (k === undefined) return p;
  const kind = designKindOf(k[0]);
  p.design =
    kind === null ? k[0] : (d.designSlot(from, kind, k[1])?.def.name ?? k[0]);
  p.item = k[0];
  p.gen = k[1];
  return p;
}

function deny(
  d: WwDepth,
  requester: number,
  licensor: number,
  key: number,
  ship: number,
): void {
  const p = itemParams(d, licensor, licensor, key, ship);
  d.message(requester, "ww1936_licence_denied", p);
  d.message(
    licensor,
    "ww1936_licence_denied",
    itemParams(d, requester, licensor, key, ship),
  );
}

/**
 * Spec §7.1 acceptance: a design is copied into the licensee's slots
 * ("licensed"); the record starts the fee. Refused (nothing changes) when
 * the copy finds no slot.
 */
export function grantLicence(
  d: WwDepth,
  from: number,
  to: number,
  key: number,
  ship: number,
  day: number,
): WwOrderBlock | null {
  const offer = offerOf(d, from, key, ship);
  if (offer === null) return "bad_index";
  let slot = 0;
  if (offer.kind !== null) {
    const got = copyDesignTo(d, from, offer.slot, offer.kind, to, "licensed");
    if (got === null) return "design_slots_full";
    slot = got;
  }
  d.market.licences.push({
    id: d.uid(),
    from,
    to,
    key,
    ship,
    slot,
    sinceDay: day,
  });
  d.message(to, "ww1936_licence_granted", itemParams(d, from, from, key, ship));
  d.message(from, "ww1936_licence_granted", itemParams(d, to, from, key, ship));
  d.markGlobal();
  d.markCountry(from);
  d.markCountry(to);
  return null;
}

/**
 * licence_request (spec §7.1): a human licensor gets a card for
 * LICENCE_CARD_TICKS (no answer: refused); an AI answers at once.
 */
export function requestLicence(
  d: WwDepth,
  to: number,
  from: number,
  key: number,
  ship: number,
  tick: number,
): WwOrderBlock | null {
  const block = licenceRequestBlock(d, to, from, key, ship);
  if (block !== null) return block;
  if (d.ww.isHumanControlled(from)) {
    d.market.pending.push({
      id: d.uid(),
      from: to,
      to: from,
      key,
      ship,
      deadlineTick: tick + LICENCE_CARD_TICKS,
    });
    d.markGlobal();
    return null;
  }
  if (!aiAcceptsLicence(d, from, to)) {
    deny(d, to, from, key, ship);
    return null;
  }
  const r = grantLicence(d, from, to, key, ship, d.ww.day(tick));
  if (r !== null) deny(d, to, from, key, ship);
  return null;
}

/** The licensee's lines that only the licence let it build stop (spec §7.1: kept, factories 0). */
function stopLines(d: WwDepth, to: number, key: number): void {
  const ce = d.ww.economy.country(to);
  if (ce === null) return;
  let stopped = false;
  for (const line of ce.lines) {
    if (line.key !== key || line.factories === 0) continue;
    line.factories = 0;
    line.active = 0;
    stopped = true;
  }
  if (stopped) d.ww.economy.markCountryDirty(to);
}

/**
 * Spec §7.1 end (cancel, war, embargo, the licensor gone): the record and
 * its fee go; the licensee keeps what it built. A design copy becomes
 * "received" (usable, not produced); the lines that need the licence stop.
 */
export function endLicence(d: WwDepth, l: Licence): void {
  const m = d.market;
  const i = m.licences.indexOf(l);
  if (i < 0) return;
  m.licences.splice(i, 1);
  const [type, gen] = EQUIP_KEYS[l.key] ?? EQUIP_KEYS[0];
  const designKind = l.ship > 0 ? "ship" : designKindOf(type);
  if (designKind !== null) {
    const s = d.designSlot(l.to, designKind, l.slot);
    if (s !== null && s.origin === "licensed" && s.from === l.from) {
      s.origin = "received";
      d.markDesign(l.to, designKind, l.slot);
    }
    if (designKind !== "ship") stopLines(d, l.to, equipKey(type, l.slot));
  } else {
    const ce = d.ww.economy.country(l.to);
    const own = ce !== null && staticGenResearched(type, gen, ce.researched);
    const still = m.licences.some(
      (x) => x.to === l.to && x.ship === 0 && x.key === l.key,
    );
    if (!own && !still) stopLines(d, l.to, l.key);
  }
  d.message(
    l.to,
    "ww1936_licence_ended",
    itemParams(d, l.from, l.from, l.key, l.ship),
  );
  d.message(
    l.from,
    "ww1936_licence_ended",
    itemParams(d, l.to, l.from, l.key, l.ship),
  );
  d.markGlobal();
  d.markCountry(l.from);
  d.markCountry(l.to);
}

/** Every licence and request between `a` and `b` ends (an embargo, a war). */
export function endLicencesBetween(d: WwDepth, a: number, b: number): void {
  const pair = (x: number, y: number) =>
    (x === a && y === b) || (x === b && y === a);
  for (const l of d.market.licences.filter((x) => pair(x.from, x.to))) {
    endLicence(d, l);
  }
  for (const p of d.market.pending.filter((x) => pair(x.from, x.to))) {
    dropPending(d, p);
  }
}

function dropPending(d: WwDepth, p: Pending): void {
  const i = d.market.pending.indexOf(p);
  if (i < 0) return;
  d.market.pending.splice(i, 1);
  deny(d, p.from, p.to, p.key, p.ship);
  d.markGlobal();
}

/** licence_request, licence_answer, licence_cancel. */
export function issueLicence(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  switch (o.kind) {
    case "licence_request":
      return requestLicence(d, id, o.from, o.key, o.ship ?? 0, tick);
    case "licence_answer": {
      const p = d.market.pending.find((x) => x.id === o.request);
      if (p === undefined || p.to !== id) return "bad_index";
      if (!o.accept) {
        dropPending(d, p);
        return null;
      }
      // The request is judged again (a war or an embargo since): a
      // refusal changes nothing, the card times out.
      const pending = d.market.pending;
      pending.splice(pending.indexOf(p), 1);
      const block =
        licenceRequestBlock(d, p.from, p.to, p.key, p.ship) ??
        grantLicence(d, p.to, p.from, p.key, p.ship, d.ww.day(tick));
      if (block !== null) {
        pending.push(p);
        pending.sort((a, b) => a.id - b.id);
        return block;
      }
      d.markGlobal();
      return null;
    }
    case "licence_cancel": {
      const l = d.market.licences.find((x) => x.id === o.licence);
      if (l === undefined || (l.to !== id && l.from !== id)) {
        return "bad_index";
      }
      endLicence(d, l);
      return null;
    }
    default:
      return "bad_index";
  }
}

/**
 * The day's common step (spec §7.1): a request past its card's time is
 * refused, and one whose partners fell out too; a licence ends when the two
 * fight, an embargo stands, or either is gone.
 */
export function dayLicences(d: WwDepth, day: number, tick: number): void {
  void day;
  const m = d.market;
  if (m.pending.length > 0) {
    for (const p of [...m.pending]) {
      const broken =
        !d.ww.isActor(p.from) ||
        !d.ww.isActor(p.to) ||
        d.ww.isAtWar(p.from, p.to) ||
        d.embargoed(p.from, p.to);
      if (broken || tick >= p.deadlineTick) dropPending(d, p);
    }
  }
  if (m.licences.length > 0) {
    for (const l of [...m.licences]) {
      if (
        !d.ww.isActor(l.from) ||
        !d.ww.isActor(l.to) ||
        d.ww.isAtWar(l.from, l.to) ||
        d.embargoed(l.from, l.to)
      ) {
        endLicence(d, l);
      }
    }
  }
}

/** Spec §7.1: the licence's extra cost on `key`, percent (0: not produced under licence). */
export function licenceCostPctFor(d: WwDepth, id: number, key: number): number {
  const k = EQUIP_KEYS[key];
  if (k === undefined) return 0;
  const [type, gen] = k;
  const kind = designKindOf(type);
  if (kind !== null) {
    const s = d.designSlot(id, kind, gen);
    if (s === null || s.origin !== "licensed") return 0;
  } else {
    const held = d.market.licences.some(
      (l) => l.to === id && l.ship === 0 && l.key === key,
    );
    if (!held) return 0;
    // Its own research makes it its own (HOI4: the licence goes unused).
    const ce = d.ww.economy.country(id);
    if (ce !== null && staticGenResearched(type, gen, ce.researched)) return 0;
  }
  return licenceCostPct(keyYear(d, id, key) - lineNewestYear(d, id, key));
}

/** The EQUIP_KEYS indices the country holds a licence for (a design licence by its own slot), ascending. */
export function licenceKeys(d: WwDepth, id: number): number[] {
  const out = new Set<number>();
  for (const l of d.market.licences) {
    if (l.to !== id || l.ship > 0) continue;
    const k = EQUIP_KEYS[l.key];
    if (k === undefined) continue;
    if (isDesignType(k[0])) {
      if (l.slot > 0) out.add(equipKey(k[0], l.slot));
    } else {
      out.add(l.key);
    }
  }
  return [...out].filter((k) => k >= 0).sort((a, b) => a - b);
}
