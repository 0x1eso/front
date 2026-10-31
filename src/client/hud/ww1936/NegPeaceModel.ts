// World War 1936: negotiated peace on the screens (owner request "7번",
// 2026-10-30). The drawer's [평화 제안] opens a composer under my war's
// row: what I give and what I demand — regions picked on the map (the
// panel steps aside; PeaceMapPass draws the pick mode, WwLandController
// hands the taps to negPeaceMapTap), a reparations level each way, my or
// their subjects set free — the engine-lib checks with their reason, and
// a live "chance they accept" from the engine-lib judge (the engine's
// facts of the war, my terms' value). No terms: a white peace, as before.
// The target's card lists the terms (negPeaceTermsLines).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  WW_NEG_PEACE_MAX_REGIONS,
  WW_NEG_REPARATIONS_DAYS,
  WW_NEG_REPARATIONS_MAX_LEVEL,
  WW_NEG_REPARATIONS_STEP_PCT,
  WwPeaceOfferView,
  WwPeaceTerms,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { regionBaseValue } from "@openfront/engine-lib/ww1936/EndgameRules";
import {
  hasPeaceTerms,
  negPeaceChance,
  NegPeaceFacts,
  negPeaceHint,
  negPeaceRepK,
  negPeaceTermsBlock,
  negPeaceValue,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import {
  PEACE_FREE,
  PEACE_MINE,
  PEACE_SELECTED,
  type PeaceMapRegion,
  type PeaceMapSource,
} from "../../render/gl/passes/PeaceMapPass";
import { translateText } from "../../Utils";
import { BLOCK_KEYS } from "./EconomyModel";
import { countryText } from "./EndgameNames";
import {
  peaceColor,
  peaceMapSource,
  peaceRegionName,
  type PeaceGame,
} from "./PeaceModel";
import type { WhitePeaceGame } from "./WhitePeaceModel";

export type NegPeaceGame = WhitePeaceGame & PeaceGame;

// ---- The client state: my draft and the map pick mode (one per game) ----

export class NegPeaceUi {
  /** The war whose composer is open (0: none) and its target. */
  war = 0;
  target = 0;
  map = false;
  give: number[] = [];
  take: number[] = [];
  pay = 0;
  demand = 0;
  free: number[] = [];
  /** The region tapped last in the pick mode (0: none) and why it was refused (a text; null: it wasn't). */
  region = 0;
  note: string | null = null;
  /** Bumped on every change (the composer, the band and the map redraw on it). */
  version = 0;

  /** Opens the composer for `war` (a new war starts a new draft). */
  open(war: number, target: number): void {
    if (war !== this.war || target !== this.target) this.clear();
    this.war = war;
    this.target = target;
    this.version++;
  }

  /** Closes the composer (and the pick mode); the draft goes. */
  close(): void {
    this.clear();
    this.war = 0;
    this.target = 0;
    this.version++;
  }

  private clear(): void {
    this.map = false;
    this.give = [];
    this.take = [];
    this.pay = 0;
    this.demand = 0;
    this.free = [];
    this.region = 0;
    this.note = null;
  }

  terms(): WwPeaceTerms {
    return {
      give: [...this.give],
      take: [...this.take],
      pay: this.pay,
      demand: this.demand,
      free: [...this.free],
    };
  }

  openMap(): void {
    if (this.war === 0) return;
    this.map = true;
    this.region = 0;
    this.note = null;
    this.version++;
  }

  closeMap(): void {
    if (!this.map) return;
    this.map = false;
    this.region = 0;
    this.note = null;
    this.version++;
  }

  /** Takes `region` out of either list. */
  remove(region: number): void {
    this.give = this.give.filter((r) => r !== region);
    this.take = this.take.filter((r) => r !== region);
    this.version++;
  }

  /** My reparations level (it clears theirs: one way only). */
  setPay(level: number): void {
    this.pay = clampLevel(level);
    if (this.pay > 0) this.demand = 0;
    this.version++;
  }

  /** Their reparations level (it clears mine). */
  setDemand(level: number): void {
    this.demand = clampLevel(level);
    if (this.demand > 0) this.pay = 0;
    this.version++;
  }

  toggleFree(id: number): void {
    this.free = this.free.includes(id)
      ? this.free.filter((x) => x !== id)
      : [...this.free, id];
    this.version++;
  }
}

const clampLevel = (n: number) =>
  Math.max(0, Math.min(WW_NEG_REPARATIONS_MAX_LEVEL, Math.floor(n)));

const uis = new WeakMap<object, NegPeaceUi>();
/** One negotiated peace client state per game view. */
export function negPeaceUiOf(game: object): NegPeaceUi {
  let u = uis.get(game);
  if (u === undefined) uis.set(game, (u = new NegPeaceUi()));
  return u;
}

// ---- The world from the game's views ----

/** NegPeaceRules' facts from the land, politics, economy and endgame views. */
export function negPeaceFactsOf(game: NegPeaceGame): NegPeaceFacts | null {
  const sc = game.worldWarScenario();
  if (sc === null) return null;
  const land = game.wwLand?.() ?? null;
  const pol = game.wwPolitics?.() ?? null;
  const econ = game.wwEconomy?.() ?? null;
  const eg = game.wwEndgame?.() ?? null;
  const owners = sc.ownerByRegion();
  const legal = (r: number) => pol?.legalOwner[r] ?? owners[r] ?? 0;
  const base = (r: number) => {
    const reg = sc.region(r);
    if (reg === undefined) return 0;
    const e = econ?.region(r);
    const f = e === undefined ? (reg.civ ?? 0) : e.civ + e.mil + (e.dock ?? 0);
    return regionBaseValue(reg.vp, f, reg.tiles);
  };
  let sums: { vp: Map<number, number>; base: Map<number, number> } | null =
    null;
  const totals = () => {
    if (sums === null) {
      const vp = new Map<number, number>();
      const bs = new Map<number, number>();
      for (const r of sc.landRegions) {
        const l = legal(r.id);
        if (l <= 0) continue;
        vp.set(l, (vp.get(l) ?? 0) + r.vp);
        bs.set(l, (bs.get(l) ?? 0) + base(r.id));
      }
      sums = { vp, base: bs };
    }
    return sums;
  };
  return {
    legalOwner: legal,
    controller: (r) =>
      land?.controller[r] ?? econ?.controller[r] ?? owners[r] ?? 0,
    vp: (r) => sc.region(r)?.vp ?? 0,
    base,
    capital: (id) => {
      const tag = sc.tagOfSmallId(id);
      const tile = tag === undefined ? null : sc.capitalTileOrNull(tag);
      return tile === null ? 0 : sc.regionAt(tile);
    },
    legalVp: (id) => totals().vp.get(id) ?? 0,
    legalBase: (id) => totals().base.get(id) ?? 0,
    civs: (id) => econ?.summary(id)?.civ ?? 0,
    overlordOf: (id) => eg?.subjectOf(id)?.overlord ?? 0,
    isZone: (r) => eg?.zones.some((z) => z.region === r) ?? false,
  };
}

/** A refusal's text (the order block's). */
function blockText(block: string): string {
  return translateText(BLOCK_KEYS[block as keyof typeof BLOCK_KEYS] ?? block);
}

// ---- The composer ----

/** The proposer's group and the target's side in war `w` (as the engine's proposerGroup). */
function sidesOf(
  game: NegPeaceGame,
  w: WwWarSummary,
  me: number,
): { mine: Set<number>; theirs: Set<number>; whole: boolean } | null {
  const s = w.sides.findIndex((x) => x.members.some((m) => m.id === me));
  if (s < 0) return null;
  const eg = game.wwEndgame?.() ?? null;
  const whole = w.sides[s].leader === me;
  const side = w.sides[s].members.map((m) => m.id);
  const mine = whole
    ? side
    : [
        me,
        ...side.filter((x) => {
          const sub = eg?.subjectOf(x) ?? null;
          return (
            sub !== null &&
            sub.overlord === me &&
            (sub.level === "puppet" || sub.level === "integrated")
          );
        }),
      ];
  return {
    mine: new Set(mine),
    theirs: new Set(w.sides[1 - s].members.map((m) => m.id)),
    whole,
  };
}

export interface NegPeaceRegionRow {
  region: number;
  name: string;
}

export interface NegPeaceFreeRow {
  id: number;
  name: string;
  /** My subject (false: theirs). */
  mine: boolean;
  on: boolean;
}

export interface NegPeaceComposerView {
  war: number;
  target: number;
  title: string;
  give: NegPeaceRegionRow[];
  take: NegPeaceRegionRow[];
  pay: number;
  demand: number;
  /** The reparations line of each level, mine and theirs ("20% of factories (3 a day, 365 days)"). */
  payLines: string[];
  demandLines: string[];
  free: NegPeaceFreeRow[];
  /** "Poland cedes 13% of its victory points (at most 40%)" for each giver with land in the terms. */
  vpLines: string[];
  /** The engine's refusal of these terms, as text (null: they may go). */
  block: string | null;
  /** "No terms: a white peace" when empty. */
  white: string | null;
  /** "Chance they accept: high" — or "A human player decides". */
  hint: string;
  /** The level in words (null: a human target, or no judge yet). */
  hintLevel: "low" | "medium" | "high" | null;
  order: WwOrder;
}

/** The composer of my war `w` (null: no composer open for it, or not mine). */
export function negPeaceComposer(
  game: NegPeaceGame,
  me: number,
  w: WwWarSummary,
): NegPeaceComposerView | null {
  const ui = negPeaceUiOf(game);
  if (ui.war !== w.id || me <= 0) return null;
  const sc = game.worldWarScenario();
  const f = negPeaceFactsOf(game);
  const sides = sidesOf(game, w, me);
  if (sc === null || f === null || sides === null) return null;
  const eg = game.wwEndgame?.() ?? null;
  const target = ui.target;
  const t = ui.terms();
  const row = (r: number): NegPeaceRegionRow => ({
    region: r,
    name: peaceRegionName(sc, r),
  });
  const repLines = (id: number) =>
    Array.from({ length: WW_NEG_REPARATIONS_MAX_LEVEL + 1 }, (_, lv) =>
      lv === 0
        ? translateText("ww1936.npeace.rep_none")
        : translateText("ww1936.npeace.rep_line", {
            pct: lv * WW_NEG_REPARATIONS_STEP_PCT,
            k: negPeaceRepK(f.civs(id), lv),
          }),
    );
  // Subjects either of us may set free.
  const free: NegPeaceFreeRow[] = (eg?.subjects ?? [])
    .filter((s) => s.overlord === me || s.overlord === target)
    .map((s) => ({
      id: s.subject,
      name: countryText(game, s.subject),
      mine: s.overlord === me,
      on: t.free.includes(s.subject),
    }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.id - b.id);
  const vpLines: string[] = [];
  for (const [regs, giver] of [
    [t.give, me],
    [t.take, target],
  ] as const) {
    if (regs.length === 0) continue;
    let vp = 0;
    for (const r of regs) vp += f.vp(r);
    const total = f.legalVp(giver);
    vpLines.push(
      translateText("ww1936.npeace.vp", {
        country: countryText(game, giver),
        pct: total > 0 ? Math.floor((vp * 100) / total) : 0,
      }),
    );
  }
  const any = hasPeaceTerms(t);
  const b = any ? negPeaceTermsBlock(f, t, me, target) : null;
  // The hint: the engine's facts of the war, my terms' value (engine-lib).
  let hint: string;
  let hintLevel: NegPeaceComposerView["hintLevel"] = null;
  const human = isHuman(game, target);
  const j = eg?.judgeFor(me, w.id) ?? null;
  if (human) hint = translateText("ww1936.npeace.chance_human");
  else if (j === null || j.to !== target) hint = "";
  else {
    const v = any
      ? negPeaceValue(
          f,
          t,
          me,
          target,
          (x) => sides.mine.has(x),
          (x) => sides.theirs.has(x),
        )
      : 0;
    hintLevel = negPeaceHint(negPeaceChance(j, v));
    hint = translateText("ww1936.npeace.chance", {
      level: translateText(`ww1936.npeace.chance_${hintLevel}`),
    });
  }
  return {
    war: w.id,
    target,
    title: translateText("ww1936.npeace.title", {
      country: countryText(game, target),
    }),
    give: t.give.map(row),
    take: t.take.map(row),
    pay: t.pay,
    demand: t.demand,
    payLines: repLines(me),
    demandLines: repLines(target),
    free,
    vpLines,
    block: b === null ? null : blockText(b),
    white: any ? null : translateText("ww1936.npeace.white"),
    hint,
    hintLevel,
    order: any
      ? { kind: "peace_offer", war: w.id, target, terms: t }
      : { kind: "peace_offer", war: w.id, target },
  };
}

/** A country a human controls now (the endgame's controllers). */
function isHuman(game: NegPeaceGame, id: number): boolean {
  const eg = game.wwEndgame?.() ?? null;
  return eg?.controllers.some(([, x]) => x === id) ?? false;
}

// ---- The map pick mode ----

/**
 * The land tap flow asks this first (WwLandController): while the pick
 * mode is on, a tap on my legal region toggles it in what I give, on the
 * target's in what I demand (refused with the reason when the rules say
 * no — Korea, Taiwan, a capital, 40%); anywhere else nothing. False when
 * the mode is off.
 */
export function negPeaceMapTap(game: NegPeaceGame, region: number): boolean {
  const ui = negPeaceUiOf(game);
  if (!ui.map) return false;
  const me = game.myPlayer()?.smallID() ?? 0;
  const f = negPeaceFactsOf(game);
  if (f === null || me <= 0 || ui.war === 0) {
    ui.closeMap();
    return false;
  }
  ui.region = region;
  ui.note = null;
  if (region <= 0) {
    ui.version++;
    return true;
  }
  const owner = f.legalOwner(region);
  const list = owner === me ? ui.give : owner === ui.target ? ui.take : null;
  if (list === null) {
    ui.version++;
    return true;
  }
  if (list.includes(region)) {
    ui.remove(region);
    return true;
  }
  if (list.length >= WW_NEG_PEACE_MAX_REGIONS) {
    ui.note = blockText("peace_bad_terms");
    ui.version++;
    return true;
  }
  list.push(region);
  const b = negPeaceTermsBlock(f, ui.terms(), me, ui.target);
  // Only this region's refusal stops it (not, say, both reparations).
  if (
    b === "peace_capital" ||
    b === "peace_too_much" ||
    (b === "peace_bad_terms" && f.isZone(region))
  ) {
    list.pop();
    ui.note = blockText(b);
  }
  ui.version++;
  return true;
}

/** The pick mode's regions: my and the target's legal land, the picked ones in the receiver's colour. */
export function negPeaceMapRegions(game: NegPeaceGame): PeaceMapRegion[] {
  const ui = negPeaceUiOf(game);
  const sc = game.worldWarScenario();
  const f = sc === null ? null : negPeaceFactsOf(game);
  const me = game.myPlayer()?.smallID() ?? 0;
  if (!ui.map || sc === null || f === null || me <= 0) return [];
  const w = sc.width;
  const out: PeaceMapRegion[] = [];
  for (const r of sc.landRegions) {
    const owner = f.legalOwner(r.id);
    if (owner !== me && owner !== ui.target) continue;
    let state = PEACE_FREE;
    let rgb = 0xffffff;
    if (ui.give.includes(r.id)) {
      state = PEACE_MINE;
      rgb = peaceColor(game, ui.target);
    } else if (ui.take.includes(r.id)) {
      state = PEACE_MINE;
      rgb = peaceColor(game, me);
    }
    if (r.id === ui.region) state |= PEACE_SELECTED;
    const t = sc.centerTile(r.id);
    out.push({
      region: r.id,
      state,
      rgb,
      value: r.vp,
      x: t % w,
      y: Math.floor(t / w),
    });
  }
  return out;
}

/**
 * What PeaceMapPass reads: the negotiated peace's pick mode while it is
 * on, else the conference's map mode (PeaceModel.peaceMapSource).
 */
export function wwPeaceMapSource(game: NegPeaceGame): PeaceMapSource {
  const conf = peaceMapSource(game);
  let seen = "";
  let key = "";
  return {
    key: () => {
      const ui = negPeaceUiOf(game);
      if (!ui.map) return conf.key();
      const k = [
        ui.version,
        game.wwLand?.()?.version ?? 0,
        game.wwPolitics?.()?.version ?? 0,
        game.myPlayer()?.smallID() ?? 0,
      ].join(":");
      if (k !== seen) {
        seen = k;
        key = `neg:${k}`;
      }
      return key;
    },
    regions: () =>
      negPeaceUiOf(game).map ? negPeaceMapRegions(game) : conf.regions(),
  };
}

/** The band of the pick mode: how many regions are picked, the last tap's region and refusal. */
export function negPeaceBand(
  game: NegPeaceGame,
): { line: string; region: string; note: string | null } | null {
  const ui = negPeaceUiOf(game);
  const sc = game.worldWarScenario();
  if (!ui.map || sc === null) return null;
  return {
    line: translateText("ww1936.npeace.band", {
      n: ui.give.length + ui.take.length,
    }),
    region: ui.region > 0 ? peaceRegionName(sc, ui.region) : "",
    note: ui.note,
  };
}

// ---- The target's card ----

/** The terms of an offer as the card's lines (none: a white peace). */
export function negPeaceTermsLines(
  game: WhitePeaceGame,
  o: WwPeaceOfferView,
): string[] {
  const t = o.terms;
  const sc = game.worldWarScenario();
  if (t === null || t === undefined || sc === null) return [];
  const names = (regs: readonly number[]) =>
    regs.map((r) => peaceRegionName(sc, r)).join(", ");
  const out: string[] = [];
  const cedes = (regs: readonly number[], who: number) => {
    if (regs.length === 0) return;
    out.push(
      translateText("ww1936.wpeace.card_cedes", {
        country: countryText(game, who),
        regions: names(regs),
      }),
    );
  };
  cedes(t.give, o.from);
  cedes(t.take, o.to);
  const pays = (level: number, k: number, who: number) => {
    if (level <= 0) return;
    out.push(
      translateText("ww1936.wpeace.card_pays", {
        country: countryText(game, who),
        pct: level * WW_NEG_REPARATIONS_STEP_PCT,
        k,
        days: WW_NEG_REPARATIONS_DAYS,
      }),
    );
  };
  pays(t.pay, t.payK, o.from);
  pays(t.demand, t.demandK, o.to);
  const eg = game.wwEndgame?.() ?? null;
  for (const x of t.free) {
    out.push(
      translateText("ww1936.wpeace.card_frees", {
        country: countryText(game, eg?.subjectOf(x)?.overlord ?? 0),
        subject: countryText(game, x),
      }),
    );
  }
  return out;
}
