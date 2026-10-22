// World War 1936 P5 lane X (plan Task 5 Steps 1–2; spec §3.3–§3.5, §6.4,
// §10.6, §16.4): waking a dormant slot or a country back from the dead,
// its first economy, army, research and politics, its name; the release /
// create_state / restore_country / set_name effects; the tags a peace
// conference may free.
import type { PolOrder } from "@openfront/engine-api/Schemas";
import {
  CountryTag,
  isDormantTag,
  NAMED_DORMANT_TAGS,
} from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ActivateOpts,
  CS_ACTIVE,
  CS_DORMANT,
  CS_GONE,
  WW_WAKE_DIV_MAX,
  WW_WAKE_EQUIP_PCT,
  WW_WAKE_FUEL_PCT,
  WW_WAKE_MANPOWER_PCT,
  WW_WAKE_TECH_LAG_YEARS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  GROUND_SLOTS,
  groundSlotOf,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dateOfDay } from "@openfront/engine-lib/ww1936/Calendar";
import { recruitableMen } from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  navalStartTechs,
  startTechs,
} from "@openfront/engine-lib/ww1936/EconomyStart";
import { fuelCap } from "@openfront/engine-lib/ww1936/FuelRules";
import { landStartTechs } from "@openfront/engine-lib/ww1936/LandStart";
import {
  genMixOf,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { drawTemplateEquip } from "../economy/Stock";
import { evictDivisions, transferRegionPeaceful } from "../land/PoliticsBridge";
import { type EffectCtx, resolveSelector } from "../politics/Dispatch";
import { factionOrder, joinFaction, leaveFaction } from "../politics/Factions";
import { setGovernment, setLeader } from "../politics/Ideology";
import { makeSubject } from "./Subjects";
import type { WwEndgame } from "./WwEndgame";

/** Spec §3.3-4: the laws a new country starts with. */
const WAKE_LAWS = {
  economy: "civilian",
  trade: "export_focus",
  conscription: "volunteer",
} as const;

/**
 * Spec §3.3 (1–10), §3.4: `tag` takes `opts.regions` (legal owner and
 * control this tick, the victory-point tiles with them) and plays. A
 * dormant slot or a gone country (not an exile) starts afresh: default
 * laws, no lines, an empty stock, half its regions' recruitable men, a
 * basic infantry army at its best region, its research, its politics (a
 * revived country keeps them, stability 50% and war support 40% at
 * base). A country that plays already only takes the regions (and the
 * name, faction and overlord given). Returns its smallID (0: not here).
 */
export function activateCountry(
  eg: WwEndgame,
  tag: CountryTag,
  opts: ActivateOpts,
  tick: number,
): number {
  const ww = eg.ww;
  const sc = ww.scenario;
  const id = sc.smallIdOf(tag);
  if (id === 0) return 0;
  const p = eg.mg.playerBySmallID(id);
  if (!p.isPlayer()) return 0;
  const was = eg.countryStateArr[id];
  // Decided before the land arrives (an actor is alive, with land).
  const fresh = !eg.isActor(id);
  const regions = [...new Set(opts.regions)]
    .filter((r) => sc.region(r) !== undefined)
    .sort((a, b) => a - b);
  // 1. The land: legal owner (its cores were there from the start), control
  // and the victory-point tile this tick; other countries' divisions out.
  for (const r of regions) {
    ww.politics.setLegalOwner(r, id);
    transferRegionPeaceful(ww.land, r, id, tick);
    const t = ww.land.divisions;
    const owners = [
      ...new Set(ww.land.rowsIn(r).map((row) => t.owner[row])),
    ].sort((a, b) => a - b);
    for (const o of owners) if (o !== id) evictDivisions(ww.land, r, o);
  }
  // Spec §3.5: the name and colour (civil-war slots, set_name).
  if (opts.nameKey !== undefined) eg.nameKey[id] = opts.nameKey;
  if (opts.nameArg !== undefined) eg.nameArg[id] = opts.nameArg;
  if (opts.color !== undefined) eg.color[id] = opts.color;
  // 2–3. Active this tick, its executions at order 8, no capitulation.
  eg.setCountryState(id, CS_ACTIVE);
  eg.dirtyCountries.add(id);
  ww.clearCapitulation(id);
  eg.wakeQueue.push(id);
  if (fresh) {
    startEconomy(eg, id, tag, regions, opts);
    startArmy(eg, id, regions, opts);
    startPolitics(eg, id, was === CS_GONE);
  }
  // 3. The faction, straight in (no P3 join rule).
  const pol = ww.politics;
  const fac = opts.faction ?? "none";
  const want =
    fac === "none"
      ? -1
      : fac === "overlord"
        ? pol.factionIdx(opts.overlord?.smallID ?? 0)
        : fac;
  if (want >= 0 && pol.factionIdx(id) !== want) {
    if (pol.factionIdx(id) >= 0) leaveFaction(pol, id, tick);
    joinFaction(pol, id, want, tick);
  }
  // Spec §9.5: a subject from its first tick (lane S). First: S gives a
  // new subject its overlord's government, which `government` then replaces.
  if (opts.overlord !== undefined) {
    makeSubject(
      eg,
      id,
      opts.overlord.smallID,
      opts.overlord.level,
      opts.overlord.neutral ?? false,
      tick,
    );
  }
  // Spec §3.3-7: a `government` changes ideology and leader (P3 §5.6).
  const g = opts.government;
  if (g !== undefined) {
    setGovernment(pol, id, IDEOLOGIES.indexOf(g.ideology), tick);
    if (g.leader !== undefined) setLeader(pol, id, g.leader, tick);
    pol.recomputeStats(id);
    pol.markCountry(id);
  }
  // 9–10. The screens and everyone hear of it.
  if (fresh) {
    eg.messageAll("ww1936_country_created", { tag });
    eg.news("news_country_created", { tag });
  }
  return id;
}

/**
 * Spec §3.4: a gone or exiled country holds land again (§5.3, an uprising,
 * a conference's leftover regions): it plays on, its executions come at
 * order 8. Nothing else is reset.
 */
export function landRegained(eg: WwEndgame, id: number, tick: number): void {
  void tick;
  eg.setCountryState(id, CS_ACTIVE);
  eg.dirtyCountries.add(id);
  eg.ww.clearCapitulation(id);
  eg.wakeQueue.push(id);
  // P5 final lane (the exile return loop, HOI4: a liberated country is not
  // surrendered again over what it had already lost): its capitulation line
  // counts from the victory points it holds now.
  const ww = eg.ww;
  let lost = 0;
  for (const r of ww.scenario.landRegions) {
    if ((ww.politics.legalOwner[r.id] ?? 0) !== id) continue;
    if (ww.land.controller[r.id] !== id) lost += r.vp;
  }
  eg.setCapitulationBase(id, lost);
}

/** Spec §3.3-4, -6: laws, lines, stock, manpower and research. */
function startEconomy(
  eg: WwEndgame,
  id: number,
  tag: CountryTag,
  regions: readonly number[],
  opts: ActivateOpts,
): void {
  const econ = eg.ww.economy;
  const sc = eg.ww.scenario;
  const ce = econ.country(id);
  if (ce === null) return;
  ce.laws = { ...WAKE_LAWS };
  ce.lines = [];
  ce.queue = [];
  ce.navalLines = [];
  ce.stock.fill(0);
  ce.planesDeployed.fill(0);
  for (const tr of [...econ.trades()]) {
    if (tr.buyer === id || tr.seller === id) econ.removeTrade(tr.id);
  }
  // Spec §3.3-6: the 1936 basics, and techFrom's (two years behind unless
  // techAll). A revived country keeps what it had (spec §5.2 "연구 남는다").
  let civ = 0;
  for (const r of regions) civ += econ.civ[r];
  const dev = sc.devOf(tag, civ);
  const coastal = regions.some((r) => sc.harborOf(r) !== 0);
  const techs = new Set<WwTechId>([
    ...startTechs(tag, civ),
    ...landStartTechs(tag, ce.major, dev),
    ...navalStartTechs(tag, dev, coastal),
  ]);
  const from = opts.techFrom === undefined ? null : econ.country(opts.techFrom);
  if (from !== null && from !== ce) {
    const day = eg.ww.inPrep(eg.mg.ticks()) ? 0 : eg.ww.day(eg.mg.ticks());
    const lastYear = dateOfDay(day).year - WW_WAKE_TECH_LAG_YEARS;
    for (const t of from.researched) {
      if (opts.techAll === true || WW_TECHS[t].year <= lastYear) techs.add(t);
    }
  }
  for (const t of techs) ce.addTech(t);
  // Spec §3.3-4: half the recruitable men of its regions (a core gives
  // its whole share, other land P1's 10%).
  const law = ce.law();
  let men = 0;
  for (const r of regions) {
    men += recruitableMen(
      sc.region(r)!.pop,
      eg.hasCore(id, r) ? 100 : 10,
      law.conscriptionPermille,
      ce.stats.recruitablePct,
    );
  }
  ce.manpower = Math.floor((men * WW_WAKE_MANPOWER_PCT) / 100);
  // Controller ruling (P5 final lane): a base fuel stock, as HOI4 gives a
  // released nation — WW_WAKE_FUEL_PCT of its capacity at waking (no oil of
  // its own yet: the base and its regions' silos). A revived country starts
  // afresh like its stock. The first daily settlement takes over from here.
  ce.fuelMilli = Math.floor(
    (fuelCap(0, econ.countryBuildings(id, "fuel_silo"), ce.stats) *
      WW_WAKE_FUEL_PCT) /
      100,
  );
  ce.fuelRatioPm = 1000;
  econ.markCountryDirty(id);
}

/**
 * Spec §3.3-5: d = clamp(floor(Σ points / 12), 1, 8) basic infantry
 * divisions (its first template: P2's "그 밖" for a dormant slot) as one
 * army at its best region (most points, ties the smaller id). Equipment
 * from equipFrom's stock by the template; what falls short of half is made
 * up to half. The men come with the divisions (not from the new pool).
 */
function startArmy(
  eg: WwEndgame,
  id: number,
  regions: readonly number[],
  opts: ActivateOpts,
): void {
  const ww = eg.ww;
  const land = ww.land;
  const sc = ww.scenario;
  const cl = land.country(id);
  const ce = ww.economy.country(id);
  if (cl === null || ce === null || regions.length === 0) return;
  let vp = 0;
  let at = 0;
  let atVp = -1;
  for (const r of regions) {
    const v = sc.region(r)!.vp;
    vp += v;
    if (v > atVp) {
      at = r;
      atVp = v;
    }
  }
  const n =
    opts.divisions ??
    Math.max(1, Math.min(WW_WAKE_DIV_MAX, Math.floor(vp / 12)));
  const tpl = cl.templates[0];
  if (n <= 0 || tpl === undefined) return;
  const from =
    opts.equipFrom === undefined ? null : ww.economy.country(opts.equipFrom);
  const army = land.newArmy(id);
  if (army === null) return;
  for (let i = 0; i < n; i++) {
    const s = templateStats(
      tpl.def,
      ce.stats,
      genMixOf(new Array<number>(GROUND_SLOTS).fill(0)),
    );
    const slots = new Array<number>(GROUND_SLOTS).fill(0);
    if (from !== null && from !== ce) {
      // The giver's static equipment only (P6: its design slots are its own).
      drawTemplateEquip(from, slots, s.need);
    }
    topUp(slots, s.need);
    const full = templateStats(tpl.def, ce.stats, genMixOf(slots));
    land.spawnDivision(id, tpl.id, at, army, s.men, slots, full.orgMilli);
  }
}

/** Spec §3.3-5: every type at least half its need (generation 1 makes up the rest). */
function topUp(slots: number[], need: readonly number[]): void {
  EQUIPMENT_TYPES.forEach((type, i) => {
    const want = Math.ceil((need[i] * WW_WAKE_EQUIP_PCT) / 100);
    if (want <= 0) return;
    let have = 0;
    let first = -1;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      const s = groundSlotOf(equipKey(type, g));
      if (s < 0) continue;
      if (first < 0) first = s;
      have += slots[s];
    }
    if (have < want && first >= 0) slots[first] += want - have;
  });
}

/**
 * Spec §3.3-7, §3.4: a dormant slot keeps P3's starting values (its row of
 * the politics table), with the generic tree and 100 political power; a
 * revived one keeps its politics, stability 50% and war support 40% at
 * base. (A `government` comes after the overlord, in activateCountry.)
 */
function startPolitics(eg: WwEndgame, id: number, revived: boolean): void {
  const pol = eg.ww.politics;
  const c = pol.country(id);
  if (c === null) return;
  if (revived) {
    c.stabBaseBp = 5000;
    c.wsBaseBp = 4000;
    c.stabBp = c.stabBaseBp;
    c.wsBp = c.wsBaseBp;
  } else {
    c.tree = "generic";
    c.focusState = new Uint8Array(pol.content.treeFocuses.generic.length);
    c.focus = null;
    c.queued = null;
    c.ppMilli = 100_000;
  }
  pol.recomputeStats(id);
  pol.markCountry(id);
}

/**
 * Spec §16.4: release, create_state, restore_country, set_name. `actor`
 * runs the effect (a decision's, focus's or event's country).
 */
export function applyActivationEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  const pol = ctx.pol;
  const eg = pol.ww.endgame;
  switch (e.kind) {
    case "release": {
      // The tag's cores (within the group) whose legal owner is `actor`.
      const t = pol.idOfTag(e.tag);
      if (t === 0 || t === actor || eg.isActor(t)) return;
      const group =
        e.regions === undefined
          ? null
          : new Set(pol.content.groupIdx.get(e.regions)?.regions ?? []);
      const regions = eg.ww.scenario.landRegions
        .map((r) => r.id)
        .filter(
          (r) =>
            eg.hasCore(t, r) &&
            pol.legalOwner[r] === actor &&
            (group === null || group.has(r)),
        );
      if (regions.length === 0) return;
      const over =
        e.as !== "puppet"
          ? 0
          : e.overlord === undefined
            ? actor
            : resolveSelector(ctx, e.overlord);
      activateCountry(
        eg,
        e.tag,
        {
          regions,
          from: [actor],
          equipFrom: actor,
          techFrom: actor,
          ...(over > 0
            ? {
                overlord: { smallID: over, level: "puppet" as const },
                faction: "overlord" as const,
              }
            : {}),
        },
        ctx.tick,
      );
      return;
    }
    case "create_state": {
      const from = resolveSelector(ctx, e.from);
      const over = resolveSelector(ctx, e.overlord);
      if (from === 0 || over === 0) return;
      const t = pol.idOfTag(e.tag);
      if (t === 0 || t === over || eg.isActor(t)) return;
      // Spec §16.4: (가) `from` is the legal owner and it or the overlord
      // holds the region; (나) the overlord holds it, at war with its legal
      // owner `from` (inside (가): the overlord holds it either way).
      const ctl = eg.ww.land.controller;
      const set = new Set<number>();
      for (const g of e.regions) {
        for (const r of pol.content.groupIdx.get(g)?.regions ?? []) {
          if (pol.legalOwner[r] !== from) continue;
          if (ctl[r] === from || ctl[r] === over) set.add(r);
        }
      }
      const regions = [...set].sort((a, b) => a - b);
      if (regions.length === 0) return;
      const neutral = e.neutral === true;
      activateCountry(
        eg,
        e.tag,
        {
          regions,
          from: [from],
          overlord: { smallID: over, level: e.level, neutral },
          government: {
            ideology: e.ideology,
            ...(e.leader === undefined ? {} : { leader: e.leader }),
          },
          equipFrom: over,
          techFrom: over,
          // Spec §3.3 neutral: Vichy does not join the overlord's wars.
          faction: neutral ? "none" : "overlord",
        },
        ctx.tick,
      );
      return;
    }
    case "restore_country": {
      const t = e.tag === "target" ? ctx.target : pol.idOfTag(e.tag);
      restoreCountry(ctx, actor, t);
      return;
    }
    case "set_name":
      eg.nameKey[actor] = e.key;
      eg.dirtyCountries.add(actor);
      return;
    default:
      return;
  }
}

/**
 * Spec §10.6 gen_restore_country: the regions `actor` controls that are
 * cores of `t` (gone, not an exile) and whose legal owner `actor` fights
 * make `t` again, free; `actor` invites it into its faction (P3's
 * faction_invite: its rules, cost and the answer are P3's).
 */
function restoreCountry(ctx: EffectCtx, actor: number, t: number): void {
  const pol = ctx.pol;
  const eg = pol.ww.endgame;
  if (t <= 0 || t === actor || eg.countryStateArr[t] !== CS_GONE) return;
  if (eg.isExile(t)) return;
  const ctl = eg.ww.land.controller;
  const regions = eg.ww.scenario.landRegions
    .map((r) => r.id)
    .filter(
      (r) =>
        ctl[r] === actor &&
        eg.hasCore(t, r) &&
        eg.ww.isAtWar(pol.legalOwner[r], actor),
    );
  if (regions.length === 0) return;
  activateCountry(
    eg,
    eg.ww.tagOf(t),
    { regions, equipFrom: actor, techFrom: actor },
    ctx.tick,
  );
  if (pol.factionIdx(actor) >= 0 && pol.factionIdx(t) < 0) {
    const invite: PolOrder = { kind: "faction_invite", target: t };
    factionOrder(pol, actor, invite, ctx.tick);
  }
}

/**
 * Spec §6.4 release / liberate: the tags a conference over `stake` may
 * free — a dormant named slot or a gone country (not an exile, not a
 * civil-war slot) with a core in the stake; in tag order. Vichy, the
 * Social Republic and Nanjing have no core and never come up.
 */
export function releasableTags(
  eg: WwEndgame,
  stake: readonly number[],
): CountryTag[] {
  const sc = eg.ww.scenario;
  const out: CountryTag[] = [];
  for (let id = 1; id < eg.size; id++) {
    const tag = sc.tagOfSmallId(id);
    if (tag === undefined) continue;
    const named = (NAMED_DORMANT_TAGS as readonly string[]).includes(tag);
    if (isDormantTag(tag) && !named) continue;
    const st = eg.countryStateArr[id];
    const ok =
      (st === CS_DORMANT && named) || (st === CS_GONE && !eg.isExile(id));
    if (ok && stake.some((r) => eg.hasCore(id, r))) out.push(tag);
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
