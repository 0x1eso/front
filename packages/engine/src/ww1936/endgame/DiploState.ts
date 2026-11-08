// World War 1936 diplomacy (ww161 Design B; ww162 L0): the state the five
// parts share — pending deals and ultimatums, kept promises, collaboration
// governments and the timers — as WwEndgame stores, snapshots, hashes and
// sends it. Every list is sorted (deals, ultimatums and promises by id,
// collaborators by smallID, timers by from, to, kind), every value an
// integer or a content id; nothing here reads a random number. The lanes
// change these lists only through WwEndgame's fields and mark dirtyDiplo.
import { DealItemSchema } from "@openfront/engine-api/Schemas";
import {
  DEAL_ITEM_KINDS,
  type DealItem,
  DIPLO_COOLDOWN_KINDS,
  type DiploCooldownKind,
  type WwDealView,
  type WwUltimatumView,
} from "@openfront/engine-api/ww1936/DiploTypes";
import type { WwEndgameData } from "@openfront/engine-api/ww1936/EndgameTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import type { WwEndgame } from "./WwEndgame";

const zIds = () => z.array(zInt());
/** D3, D4: a pending deal; ids come from WwEndgame.nextOfferId (shared with peace offers). */
export const StoredDealSchema = z.object({
  id: zInt(),
  from: zInt(),
  to: zInt(),
  give: z.array(DealItemSchema),
  take: z.array(DealItemSchema),
  sentTick: zInt(),
  /** A human target's deadline (an AI target answers on the next tick). */
  deadlineTick: zInt(),
});
export type StoredDeal = z.infer<typeof StoredDealSchema>;
/** D5: a pending ultimatum (id from nextOfferId; deal_reply answers it). */
export const StoredUltimatumSchema = z.object({
  id: zInt(),
  from: zInt(),
  to: zInt(),
  regions: zIds(),
  sentTick: zInt(),
  deadlineTick: zInt(),
});
export type StoredUltimatum = z.infer<typeof StoredUltimatumSchema>;
/** D4: a kept promise (id: the deal's); regions resolved when it was made. */
export const StoredPromiseSchema = z.object({
  id: zInt(),
  war: zInt(),
  from: zInt(),
  to: zInt(),
  target: zInt(),
  group: z.string().max(48),
  regions: zIds(),
});
export type StoredPromise = z.infer<typeof StoredPromiseSchema>;
/** D2: a collaboration government and the capitulated country it stands for. */
export const StoredCollabSchema = z.object({
  smallID: zInt(),
  creator: zInt(),
  origin: zInt(),
  sinceDay: zInt(),
});
export type StoredCollab = z.infer<typeof StoredCollabSchema>;
/** [from, to, untilDay, kind (DIPLO_COOLDOWN_KINDS index)]. */
export type DiploCooldown = [number, number, number, number];

/** WwEndgameStateSchema's diplomacy fields: optional, written only when not empty. */
export const DIPLO_STATE_FIELDS = {
  deals: z.array(StoredDealSchema).optional(),
  ultimatums: z.array(StoredUltimatumSchema).optional(),
  promises: z.array(StoredPromiseSchema).optional(),
  collabs: z.array(StoredCollabSchema).optional(),
  diploCooldowns: z.array(z.tuple([zInt(), zInt(), zInt(), zInt()])).optional(),
};

// ---- Timers ----

/** The day `from` may act on `to` again for `kind` (absent: -1). */
export function diploCooldownUntil(
  eg: WwEndgame,
  from: number,
  to: number,
  kind: DiploCooldownKind,
): number {
  const k = DIPLO_COOLDOWN_KINDS.indexOf(kind);
  for (const c of eg.diploCooldowns) {
    if (c[0] === from && c[1] === to && c[3] === k) return c[2];
  }
  return -1;
}

/** Sets (or replaces) a timer; the list stays sorted by from, to, kind. */
export function setDiploCooldown(
  eg: WwEndgame,
  from: number,
  to: number,
  kind: DiploCooldownKind,
  untilDay: number,
): void {
  const k = DIPLO_COOLDOWN_KINDS.indexOf(kind);
  const list = eg.diploCooldowns.filter(
    (c) => !(c[0] === from && c[1] === to && c[3] === k),
  );
  list.push([from, to, untilDay, k]);
  list.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[3] - b[3]);
  eg.diploCooldowns = list;
  eg.dirtyDiplo = true;
}

/** Daily (dailyCommon): drops the timers that ran out. */
export function expireDiploTimers(eg: WwEndgame, day: number): void {
  const c = eg.diploCooldowns.filter((x) => x[2] > day);
  if (c.length !== eg.diploCooldowns.length) {
    eg.diploCooldowns = c;
    eg.dirtyDiplo = true;
  }
}

// ---- The one card ----

/**
 * The human `to`'s card in front: the lowest id among the offers waiting
 * for it (peace offers, deals and ultimatums share one id counter). An
 * offer behind it keeps deadlineTick −1 and gets its full window once it
 * is in front (MAX_SAFE_INTEGER: none waits).
 */
export function cardFrontId(eg: WwEndgame, to: number): number {
  let id = Number.MAX_SAFE_INTEGER;
  for (const o of eg.peaceOffers) if (o.to === to && o.id < id) id = o.id;
  for (const o of eg.deals) if (o.to === to && o.id < id) id = o.id;
  for (const o of eg.ultimatums) if (o.to === to && o.id < id) id = o.id;
  return id;
}

// ---- Screens ----

/** The diplomacy part of takeData: everything, when first or changed; else null. */
export function diploData(
  eg: WwEndgame,
  first: boolean,
): Partial<WwEndgameData> | null {
  if (!first && !eg.dirtyDiplo) return null;
  const d: Partial<WwEndgameData> = {};
  if (eg.deals.length > 0 || !first) d.deals = eg.deals.map(dealView);
  if (eg.ultimatums.length > 0 || !first) {
    d.ultimatums = eg.ultimatums.map((u) => ultimatumView(eg, u));
  }
  if (eg.promises.length > 0 || !first) {
    d.promises = eg.promises.map((p) => ({ ...p, regions: [...p.regions] }));
  }
  if (eg.collabs.length > 0 || !first) {
    d.collabs = eg.collabs.map((c) => ({ ...c }));
  }
  if (eg.diploCooldowns.length > 0 || !first) {
    d.diploCooldowns = eg.diploCooldowns.map(
      ([a, b, u, k]): DiploCooldown => [a, b, u, k],
    );
  }
  return Object.keys(d).length > 0 ? d : null;
}

function dealView(o: StoredDeal): WwDealView {
  const copy = (items: readonly DealItem[]) => items.map((i) => ({ ...i }));
  return {
    id: o.id,
    from: o.from,
    to: o.to,
    give: copy(o.give),
    take: copy(o.take),
    sentTick: o.sentTick,
    deadlineTick: o.deadlineTick,
  };
}

function ultimatumView(eg: WwEndgame, u: StoredUltimatum): WwUltimatumView {
  const legal = eg.ww.politics.legalOwner;
  let total = 0;
  let asked = 0;
  for (const r of eg.ww.scenario.landRegions) {
    if ((legal[r.id] ?? 0) !== u.to) continue;
    total += r.vp;
    if (u.regions.includes(r.id)) asked += r.vp;
  }
  return {
    id: u.id,
    from: u.from,
    to: u.to,
    regions: [...u.regions],
    vpPm: total > 0 ? Math.floor((asked * 1000) / total) : 0,
    sentTick: u.sentTick,
    deadlineTick: u.deadlineTick,
  };
}

// ---- Hash ----

/**
 * The diplomacy state folded into WwEndgame.hash, each list only when it
 * holds something (so games without diplomacy keep their digests).
 */
export function hashDiplo(
  eg: WwEndgame,
  mix: (v: number) => void,
  text: (s: string) => void,
): void {
  const ids = (a: readonly number[]) => {
    mix(a.length);
    for (const v of a) mix(v);
  };
  if (eg.deals.length > 0) {
    mix(0x0d1);
    mix(eg.deals.length);
    for (const o of eg.deals) {
      mix(o.id);
      mix(o.from);
      mix(o.to);
      mixItems(o.give, mix, text);
      mixItems(o.take, mix, text);
      mix(o.sentTick);
      mix(o.deadlineTick);
    }
  }
  if (eg.ultimatums.length > 0) {
    mix(0x0d2);
    mix(eg.ultimatums.length);
    for (const u of eg.ultimatums) {
      mix(u.id);
      mix(u.from);
      mix(u.to);
      ids(u.regions);
      mix(u.sentTick);
      mix(u.deadlineTick);
    }
  }
  if (eg.promises.length > 0) {
    mix(0x0d3);
    mix(eg.promises.length);
    for (const p of eg.promises) {
      mix(p.id);
      mix(p.war);
      mix(p.from);
      mix(p.to);
      mix(p.target);
      text(p.group);
      ids(p.regions);
    }
  }
  if (eg.collabs.length > 0) {
    mix(0x0d4);
    mix(eg.collabs.length);
    for (const c of eg.collabs) {
      mix(c.smallID);
      mix(c.creator);
      mix(c.origin);
      mix(c.sinceDay);
    }
  }
  if (eg.diploCooldowns.length > 0) {
    mix(0x0d5);
    mix(eg.diploCooldowns.length);
    for (const [a, b, u, k] of eg.diploCooldowns) {
      mix(a);
      mix(b);
      mix(u);
      mix(k);
    }
  }
}

/**
 * A deal's items, field by field: the kind's index, then every other set
 * field in name order, its name and value (a number as is, a string by its
 * characters, a boolean as 0/1), so an appended field is hashed too and an
 * absent optional hashes the same live and restored.
 */
function mixItems(
  items: readonly DealItem[],
  mix: (v: number) => void,
  text: (s: string) => void,
): void {
  mix(items.length);
  for (const item of items) {
    mix(DEAL_ITEM_KINDS.indexOf(item.kind));
    const rec = item as Record<string, unknown>;
    for (const key of Object.keys(rec).sort()) {
      if (key === "kind") continue;
      const v = rec[key];
      if (v === undefined) continue;
      text(key);
      if (typeof v === "number") mix(v);
      else if (typeof v === "string") text(v);
      else if (typeof v === "boolean") mix(v ? 1 : 0);
    }
  }
}
