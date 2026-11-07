import {
  GW_FIELDS,
  GW_GAUGE_MAX,
  GW_INST_MAX,
  GW_INST_MIN,
  GW_TEMP_MAX,
  GW_TRUST_MAX,
  GW_TRUST_MIN,
  GwBack,
  GwCard,
  GwEnding,
  GwOffice,
  GwPersonDef,
  GwPersonState,
  GwPromise,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_READ_ONLY_KINDS,
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwReply,
  GwScene,
  GwStance,
  GwVariant,
  GwWho,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GwContent,
  gwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import {
  fadedWeight,
  GW_MOOD_MOVES_TRUST,
  isCandid,
  stanceFit,
} from "@openfront/engine-lib/ww1914/TalkRules";
import { reworkEffects } from "@openfront/engine-lib/ww1914/SendBackRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { blocNow } from "./Blocs";
import { moveMoney } from "./Budget";
import { closeSeat } from "./Endings";
import type { GreatWar } from "./GreatWar";
import { dismissPerson, onAppointed } from "./People";
import { moveCensor, moveOpinion, moveRumour } from "./Press";
import { moveRuler, rulerHolds } from "./Ruler";
import { lastOf, stageOf } from "./World";
import { worldEffect, worldHolds } from "./WorldDsl";

const P_CAST = idHash("gw_cast");
const P_VARIANT = idHash("gw_variant");
const P_EFFECT_ROLL = idHash("gw_effect_roll");

/** What conditions and effects run against. */
export interface SceneCtx {
  gw: GreatWar;
  seat: GwSeatState;
  /** role -> person id. */
  cast: Readonly<Record<string, string>>;
  /** The card it runs for: a talk's mood lives there. */
  card?: GwCard;
  /** Before a card exists: the `seat.acted` row it is played from. */
  act?: number | null;
  /** Before a card exists: how a paper sent back comes again. */
  back?: GwBack | null;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

interface ContentIndex {
  scenes: Map<string, GwScene>;
  people: Map<string, GwPersonDef>;
}
const indexes = new WeakMap<GwContent, ContentIndex>();

/** Lookups by id; derived from the content object, so never state. */
function index(): ContentIndex {
  const c = gwContent();
  let i = indexes.get(c);
  if (i === undefined) {
    i = {
      scenes: new Map(c.scenes.map((x) => [x.id, x])),
      people: new Map(c.people.map((x) => [x.id, x])),
    };
    indexes.set(c, i);
  }
  return i;
}

export function sceneOf(id: string): GwScene | null {
  return index().scenes.get(id) ?? null;
}

export function personDef(id: string): GwPersonDef | null {
  return index().people.get(id) ?? null;
}

export function holderOf(gw: GreatWar, seat: GwSeatState, o: GwOffice) {
  return holderIn(gw, seat.tag, o);
}

function holderIn(gw: GreatWar, tag: GwTag, o: GwOffice) {
  return (
    gw.s.people.find(
      (p) =>
        p.office === o && p.status === "active" && personDef(p.id)?.tag === tag,
    ) ?? null
  );
}

/** The seat's people in office, in content order. */
function ministers(gw: GreatWar, seat: GwSeatState): GwPersonState[] {
  return gw.s.people.filter(
    (x) =>
      x.office !== null &&
      x.status === "active" &&
      personDef(x.id)?.tag === seat.tag,
  );
}

/** A seeded pick, the same all chapter, so the view and the deal agree. */
function pickOne(
  gw: GreatWar,
  scene: GwScene,
  role: string,
  from: readonly GwPersonState[],
): GwPersonState | null {
  if (from.length === 0) return null;
  const roll = wwRoll(
    gw.s.seed,
    P_CAST,
    gw.s.chapter,
    idHash(scene.id),
    idHash(role),
  );
  return from[roll % from.length];
}

/** The people `id` names as rivals or allies, or who name `id` so. */
function linked(
  gw: GreatWar,
  id: string,
  link: "rivals" | "allies",
): GwPersonState[] {
  const own = personDef(id)?.[link] ?? [];
  return gw.s.people.filter(
    (p) =>
      p.status === "active" &&
      (own.includes(p.id) || personDef(p.id)?.[link].includes(id) === true),
  );
}

type BaseCastRule = Exclude<GwCastRule, { any_of: unknown }>;

/** Fixed roles: who they are doesn't depend on the rest of the cast. */
function isFixed(rule: GwCastRule): boolean {
  if ("any_of" in rule) return rule.any_of.every(isFixed);
  return (
    "office" in rule ||
    "person" in rule ||
    "called" in rule ||
    "subject" in rule ||
    "picked" in rule
  );
}

/** The person a rule finds, skipping whoever `taken` holds. */
function fill(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
  role: string,
  rule: BaseCastRule,
  cast: Readonly<Record<string, string>>,
  called: string | null,
  act: number | null,
): GwPersonState | null {
  const free = (p: GwPersonState) => !Object.values(cast).includes(p.id);
  if ("office" in rule) {
    return holderIn(gw, "tag" in rule ? rule.tag : seat.tag, rule.office);
  }
  if ("person" in rule) {
    const named = gw.person(rule.person);
    return named?.status === "active" ? named : null;
  }
  if ("called" in rule) {
    const p = called === null ? null : gw.person(called);
    return p?.status === "active" ? p : null;
  }
  if ("picked" in rule) {
    const row = act === null ? undefined : seat.acted[act];
    const id = row?.picks[rule.picked]?.[rule.nth ?? 0];
    const p = id === undefined ? null : gw.person(id);
    return p?.status === "active" ? p : null;
  }
  // Whoever the world scene is about: they may have left, that's the news.
  if ("subject" in rule) {
    const id = seat.subjects[scene.id];
    return id === undefined ? null : gw.person(id);
  }
  if ("rival" in rule || "favourite" in rule) {
    const sign = "rival" in rule ? 1 : -1;
    const list = ministers(gw, seat)
      .filter(free)
      .sort((a, b) => sign * (a.trust - b.trust) || (a.id < b.id ? -1 : 1));
    return list[0] ?? null;
  }
  if ("camp" in rule) {
    const inCamp = (p: GwPersonState) =>
      personDef(p.id)?.camps.includes(rule.camp) === true && free(p);
    const inOffice = ministers(gw, seat).filter(inCamp);
    if (inOffice.length > 0) return pickOne(gw, scene, role, inOffice);
    const others = gw.s.people.filter(
      (p) =>
        p.status === "active" && personDef(p.id)?.tag === seat.tag && inCamp(p),
    );
    return pickOne(gw, scene, role, others);
  }
  const to = "rival_of" in rule ? rule.rival_of : rule.ally_of;
  const id = cast[to];
  if (id === undefined) return null;
  const list = linked(gw, id, "rival_of" in rule ? "rivals" : "allies").filter(
    free,
  );
  const inOffice = list.filter((p) => p.office !== null);
  return pickOne(gw, scene, role, inOffice.length > 0 ? inOffice : list);
}

/**
 * The scene's cast; null when a role has nobody. `called` is who fills a
 * `called` role. Fixed roles first; the rest skip whoever is in the scene.
 */
export function castOf(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
  called: string | null = null,
  act: number | null = null,
): Record<string, string> | null {
  const out: Record<string, string> = {};
  const roles = Object.entries(scene.cast);
  const ordered = [
    ...roles.filter(([, rule]) => isFixed(rule)),
    ...roles.filter(([, rule]) => !isFixed(rule)),
  ];
  // The chain role of rival_of comes before it, whatever the order written.
  ordered.sort(([, a], [, b]) => linkDepth(a) - linkDepth(b));
  for (const [role, rule] of ordered) {
    let p: GwPersonState | null = null;
    for (const r of "any_of" in rule ? rule.any_of : [rule]) {
      p = fill(gw, seat, scene, role, r, out, called, act);
      if (p !== null) break;
    }
    if (p === null) return null;
    out[role] = p.id;
  }
  // Cast order as written: the pack's voices read in this order.
  return Object.fromEntries(roles.map(([role]) => [role, out[role]]));
}

function linkDepth(rule: GwCastRule): number {
  const list = "any_of" in rule ? rule.any_of : [rule];
  return list.some((r) => "rival_of" in r || "ally_of" in r) ? 1 : 0;
}

function who(ctx: SceneCtx, w: GwWho): GwPersonState | null {
  if ("role" in w) {
    const id = ctx.cast[w.role];
    return id === undefined ? null : ctx.gw.person(id);
  }
  if ("office" in w) return holderOf(ctx.gw, ctx.seat, w.office);
  return ctx.gw.person(w.person);
}

export const whoIn = who;

/** On the scene, or named and on the way. */
const about = (p: GwPersonState) =>
  p.status === "active" || p.status === "waiting";

/** Exhaustive: a new kind in the DSL fails to compile here until it runs. */
export function holds(ctx: SceneCtx, c: GwCond): boolean {
  const { gw, seat } = ctx;
  const s = gw.s;
  const nation = gw.nation(seat.tag);
  switch (c.kind) {
    case "all":
      return c.of.every((x) => holds(ctx, x));
    case "any":
      return c.of.some((x) => holds(ctx, x));
    case "not":
      return !holds(ctx, c.of);
    case "flag":
      return seat.flags.includes(c.flag);
    case "memory": {
      const id = c.who === undefined ? null : (who(ctx, c.who)?.id ?? null);
      return seat.memory.some(
        (m) =>
          m.key === c.key &&
          (c.who === undefined || m.who === id) &&
          (c.within === undefined || s.chapter - m.chapter <= c.within),
      );
    }
    case "seen":
      return seat.seen[c.scene] !== undefined;
    case "chapter":
      return inRange(s.chapter, c);
    case "stage":
      return stageOf(gw) === c.stage;
    case "opening":
      return c.of.includes(s.opening);
    case "secret":
      return s.secrets.includes(c.id);
    case "crisis":
      return s.crisis === c.topic;
    case "pressure":
      return inRange(s.pressure[c.topic], c);
    case "temp":
      return inRange(s.temp, c);
    case "gauge":
      return nation !== null && inRange(nation.gauges[c.gauge], c);
    case "inst":
      return inRange(nation?.inst[c.inst] ?? 0, c);
    case "trust":
      return inRange(nation?.trust[c.tag] ?? 0, c);
    case "at_war":
      return nation?.atWar.includes(c.tag) === true;
    case "line":
      return inRange(s.theatres.find((t) => t.id === c.theatre)!.line, c);
    case "trench":
      return inRange(s.theatres.find((t) => t.id === c.theatre)!.trench, c);
    case "holder":
      return holderOf(gw, seat, c.office)?.id === c.person;
    case "person_trust": {
      const p = who(ctx, c.who);
      return p !== null && inRange(p.trust, c);
    }
    case "pride": {
      const p = who(ctx, c.who);
      return p !== null && inRange(p.pride, c);
    }
    case "temperament": {
      const p = who(ctx, c.who);
      return p !== null && c.of.includes(p.temperament);
    }
    case "leans": {
      const p = who(ctx, c.who);
      if (p === null) return false;
      return personDef(p.id)?.camps.includes(c.camp) === true;
    }
    case "promise": {
      const id = who(ctx, c.who)?.id;
      return seat.promises.some(
        (x) =>
          x.key === c.key &&
          x.who === id &&
          (c.kept === undefined || x.kept === c.kept) &&
          (c.broken === undefined || x.broken === c.broken),
      );
    }
    case "span":
      return inRange(gwChapters(s.calendar)[s.chapter].spanDays, c);
    case "tension":
      return inRange(seat.tension, c);
    case "chose":
      return seat.choices.some(
        (x) =>
          x.scene === c.scene &&
          (c.pick === undefined || x.pick === c.pick) &&
          (c.within === undefined || s.chapter - x.chapter <= c.within),
      );
    case "grudge": {
      const p = who(ctx, c.who);
      return p !== null && inRange(grudgeOf(p, s.chapter), c);
    }
    case "competence": {
      const p = who(ctx, c.who);
      const band = p?.competence[GW_FIELDS.indexOf(c.field)];
      return band !== undefined && inRange(band, c);
    }
    case "health": {
      const p = who(ctx, c.who);
      return p !== null && inRange(p.health, c);
    }
    case "source_band": {
      const src = s.sources.find((x) => x.id === c.source);
      return src !== undefined && inRange(src.band, c);
    }
    case "source_record": {
      const src = s.sources.find((x) => x.id === c.source);
      return src !== undefined && inRange(src.right - src.wrong, c);
    }
    case "strength": {
      const band = gw.nation(c.tag)?.strength[c.theatre];
      return band !== undefined && inRange(band, c);
    }
    case "candid": {
      const p = who(ctx, c.who);
      return p !== null && isCandid(p, ctx.card?.mood ?? 0);
    }
    case "mood":
      return inRange(ctx.card?.mood ?? 0, c);
    case "in_office": {
      const p = who(ctx, c.who);
      return p !== null && p.office !== null && p.status === "active";
    }
    case "person_active": {
      const p = gw.person(c.person);
      return p !== null && about(p);
    }
    case "office_empty":
      return holderOf(gw, seat, c.office) === null;
    case "rival_in_office": {
      const p = who(ctx, c.who);
      if (p === null) return false;
      return linked(gw, p.id, "rivals").some((x) => x.office !== null);
    }
    case "ai": {
      const n = gw.nation(c.tag);
      return n !== null && c.of.includes(n.ai);
    }
    case "nation_gauge": {
      const n = gw.nation(c.tag);
      return n !== null && inRange(n.gauges[c.gauge], c);
    }
    case "world":
      return worldHolds(ctx, c.of);
    case "ruler":
    case "ruler_is":
    case "ruler_broken":
    case "ruler_failing":
    case "ruler_shaken":
      return rulerHolds(gw, seat, c);
    case "bloc":
      return inRange(blocNow(gw, seat, c.bloc), c);
    case "rumour":
      return inRange(seat.press.rumour, c);
    case "censor":
      return inRange(seat.press.censor, c);
    case "picked": {
      const row = actRow(ctx, c.act);
      return (row?.picks[c.field] ?? []).some((x) => c.of.includes(x));
    }
    case "acted":
      return seat.acted.some(
        (x) =>
          x.act === c.act &&
          (c.within === undefined || s.chapter - x.chapter <= c.within),
      );
    case "tone_fits": {
      const p = who(ctx, c.who);
      const tone = actRow(ctx)?.picks[c.field ?? "tone"]?.[0] as
        | GwStance
        | undefined;
      return p !== null && tone !== undefined && stanceFit(p, tone, "ask") >= 0;
    }
    case "returned":
      return sentBack(ctx, c);
    case "aim":
      return seat.aim !== null && c.of.includes(seat.aim);
    case "aim_met": {
      const aim = (gwContent().aims ?? []).find((x) => x.id === seat.aim);
      return aim !== undefined && holds({ gw, seat, cast: {} }, aim.met);
    }
    case "aim_changed":
      return inRange(seat.aimsDropped.length, c);
  }
}

/** The act a card was played from, or the last taking of `act`. */
function actRow(ctx: SceneCtx, act?: string) {
  const { seat } = ctx;
  if (act !== undefined) return lastOf(seat.acted.filter((x) => x.act === act));
  const row = ctx.card?.act ?? ctx.act ?? null;
  return row === null ? undefined : seat.acted[row];
}

function sentBack(
  ctx: SceneCtx,
  c: Extract<GwCond, { kind: "returned" }>,
): boolean {
  const fits = (x: GwBack) =>
    (c.of === undefined || c.of.includes(x.direction)) &&
    (c.changed === undefined || x.changed === c.changed);
  if (c.scene === undefined) {
    const here = ctx.card?.back ?? ctx.back ?? null;
    return here !== null && fits(here);
  }
  return ctx.seat.returns.some(
    (x) =>
      x.scene === c.scene &&
      fits(x) &&
      (c.within === undefined || ctx.gw.s.chapter - x.chapter <= c.within),
  );
}

/** What a person holds for or against the seat now, faded. */
export function grudgeOf(p: GwPersonState, chapter: number): number {
  let sum = 0;
  for (const m of p.memory) sum += fadedWeight(m.weight, chapter - m.chapter);
  return sum;
}

/** Gives `person` the office; whoever held it loses it. */
export function setOffice(
  ctx: SceneCtx,
  person: GwPersonState,
  office: GwOffice,
): void {
  const old = holderOf(ctx.gw, ctx.seat, office);
  if (old !== null) old.office = null;
  person.office = office;
  // Named before their day: the office brings them on.
  if (person.status === "waiting") person.status = "active";
  onAppointed(ctx.gw, person.id);
}

/** Exhaustive, as `holds` is. An effect on nobody does nothing. */
export function runEffect(ctx: SceneCtx, e: GwEffect): void {
  const { gw, seat } = ctx;
  const s = gw.s;
  const nation = gw.nation(seat.tag);
  switch (e.kind) {
    case "flag":
      if (!seat.flags.includes(e.flag)) seat.flags.push(e.flag);
      return;
    case "unflag":
      seat.flags = seat.flags.filter((f) => f !== e.flag);
      return;
    case "gauge":
      if (nation !== null && e.gauge === "money") {
        moveMoney(gw, nation, e.delta, "money_scene");
      } else if (nation !== null) {
        nation.gauges[e.gauge] = clamp(
          nation.gauges[e.gauge] + e.delta,
          0,
          GW_GAUGE_MAX[e.gauge],
        );
      }
      return;
    case "inst": {
      const v = nation?.inst[e.inst];
      if (nation !== null && v !== undefined) {
        nation.inst[e.inst] = clamp(v + e.delta, GW_INST_MIN, GW_INST_MAX);
      }
      return;
    }
    case "temp":
      s.temp = clamp(s.temp + e.delta, 0, GW_TEMP_MAX);
      return;
    case "pressure":
      s.pressure[e.topic] = Math.max(0, s.pressure[e.topic] + e.delta);
      return;
    case "trust":
      if (nation !== null) {
        nation.trust[e.tag] = clamp(
          (nation.trust[e.tag] ?? 0) + e.delta,
          GW_TRUST_MIN,
          GW_TRUST_MAX,
        );
      }
      return;
    case "person_trust": {
      const p = who(ctx, e.who);
      if (p !== null) {
        p.trust = clamp(p.trust + e.delta, GW_TRUST_MIN, GW_TRUST_MAX);
      }
      return;
    }
    case "pride": {
      const p = who(ctx, e.who);
      if (p !== null) p.pride = clamp(p.pride + e.delta, 0, 5);
      return;
    }
    case "remember": {
      const p = e.who === undefined ? null : who(ctx, e.who);
      const m = {
        key: e.key,
        who: p?.id ?? null,
        chapter: s.chapter,
        weight: e.weight ?? 0,
      };
      seat.memory.push(m);
      if (p !== null) p.memory.push({ ...m });
      return;
    }
    case "promise": {
      const p = who(ctx, e.who);
      if (p !== null) {
        seat.promises.push({
          key: e.key,
          who: p.id,
          due: s.chapter + e.chapters,
          kept: false,
          broken: false,
          keep: e.keep === undefined ? null : JSON.stringify(e.keep),
          back: e.back ?? null,
        });
      }
      return;
    }
    case "keep_promise": {
      const id = who(ctx, e.who)?.id;
      for (const x of seat.promises) {
        if (x.key === e.key && x.who === id) keepPromise(gw, seat, x);
      }
      return;
    }
    case "drop_card":
      seat.desk = seat.desk.filter((c) => c.scene !== e.scene);
      seat.scheduled = seat.scheduled.filter((q) => q.scene !== e.scene);
      return;
    case "schedule":
      seat.scheduled.push({
        scene: e.scene,
        chapter: s.chapter + e.chapters,
        who: e.who === undefined ? null : (who(ctx, e.who)?.id ?? null),
      });
      return;
    case "delay":
      s.dayShift += e.days;
      return;
    case "audiences":
      seat.audiences = Math.max(0, seat.audiences + e.delta);
      return;
    case "dismiss": {
      const p = who(ctx, e.who);
      if (p !== null) dismissPerson(ctx.gw, ctx.seat, p);
      return;
    }
    case "appoint": {
      // A named paper can outlive the person: the office stays empty for a successor.
      const p = who(ctx, e.who);
      if (p !== null && about(p)) setOffice(ctx, p, e.office);
      return;
    }
    case "source": {
      const src = s.sources.find((x) => x.id === e.source);
      if (src !== undefined) {
        if (e.right) src.right++;
        else src.wrong++;
      }
      return;
    }
    case "reason":
      seat.log.push({
        key: e.key,
        chapter: s.chapter,
        who: e.who === undefined ? null : (who(ctx, e.who)?.id ?? null),
      });
      return;
    case "end":
      // With friends a seat's peace is its own; alone it ends the game.
      if (s.seats.length > 1) closeSeat(gw, seat, e.ending as GwEnding);
      else s.ended = e.ending;
      return;
    case "maybe":
      if (holds(ctx, e.when)) runEffects(ctx, e.then);
      return;
    case "forget": {
      const id = e.who === undefined ? null : (who(ctx, e.who)?.id ?? null);
      const stays = (m: { key: string; who: string | null }) =>
        m.key !== e.key || (e.who !== undefined && m.who !== id);
      seat.memory = seat.memory.filter(stays);
      for (const p of s.people) p.memory = p.memory.filter(stays);
      return;
    }
    case "roll": {
      const roll = wwRoll(s.seed, P_EFFECT_ROLL, idHash(e.key), s.chapter);
      runEffects(ctx, roll % 100 < e.pct ? e.then : (e.otherwise ?? []));
      return;
    }
    case "mood":
      if (ctx.card !== undefined) ctx.card.mood += e.delta;
      return;
    case "world":
      worldEffect(ctx, e.of);
      return;
    case "ruler":
      moveRuler(gw, seat, e.side, e.delta, e.key);
      return;
    case "opinion":
      moveOpinion(seat, e.bloc, e.delta);
      return;
    case "rumour":
      moveRumour(seat, e.delta);
      return;
    case "censor":
      moveCensor(gw, seat, e.delta);
      return;
  }
}

/** A promise made good: once, and the person is told. */
export function keepPromise(
  gw: GreatWar,
  seat: GwSeatState,
  x: GwPromise,
): void {
  if (x.kept || x.broken) return;
  x.kept = true;
  const ctx: SceneCtx = { gw, seat, cast: { who: x.who } };
  const w: GwWho = { role: "who" };
  runEffects(ctx, [
    { kind: "person_trust", who: w, delta: 1 },
    { kind: "remember", key: `kept_${x.key}`, who: w, weight: 1 },
    { kind: "reason", key: "promise_kept", who: w },
  ]);
}

export function runEffects(ctx: SceneCtx, list: readonly GwEffect[]): void {
  for (const e of list) runEffect(ctx, e);
}

/** More than any body's condition counts for. */
const BROKEN_OUTRANKS = 99;

/** How much a condition asks: more leaves, more specific. */
export function specificity(c: GwCond | undefined): number {
  if (c === undefined) return 0;
  if (c.kind === "all") return c.of.reduce((n, x) => n + specificity(x), 0);
  if (c.kind === "any") {
    return c.of.reduce((n, x) => Math.min(n, specificity(x)), 9);
  }
  if (c.kind === "not") return specificity(c.of);
  // A conscience that gave out changes how everything reads.
  if (c.kind === "ruler_broken") return BROKEN_OUTRANKS;
  return 1;
}

/**
 * The variant to use: the most specific that holds. Equals take turns: first
 * those `stale` doesn't name, then a roll by `salt`. Stateless, so the view
 * can ask again and get the same line.
 */
export function pickVariant(
  ctx: SceneCtx,
  variants: readonly GwVariant[],
  salt = 0,
  stale: (id: string) => number = () => 0,
): string {
  const open = variants.filter(
    (v) => v.when === undefined || holds(ctx, v.when),
  );
  if (open.length === 0) return variants[variants.length - 1].id;
  const best = Math.max(...open.map((v) => specificity(v.when)));
  const top = open.filter((v) => specificity(v.when) === best);
  const freshest = Math.min(...top.map((v) => stale(v.id)));
  const fresh = top.filter((v) => stale(v.id) === freshest);
  const roll = wwRoll(ctx.gw.s.seed, P_VARIANT, salt, ctx.gw.s.chapter);
  return fresh[roll % fresh.length].id;
}

export function optionOpen(ctx: SceneCtx, o: GwOption | GwReply): boolean {
  return o.when === undefined || holds(ctx, o.when);
}

export function needsDecision(card: GwCard): boolean {
  const scene = sceneOf(card.scene);
  return scene !== null && !GW_READ_ONLY_KINDS.includes(scene.kind);
}

export function ctxOf(gw: GreatWar, seat: GwSeatState, card: GwCard): SceneCtx {
  return { gw, seat, cast: card.cast, card };
}

export function removeCard(seat: GwSeatState, uid: number): void {
  seat.desk = seat.desk.filter((c) => c.uid !== uid);
}

/** Runs an option and writes it down (design §5.4). */
export function takeOption(
  ctx: SceneCtx,
  scene: GwScene,
  o: GwOption,
  proxy: boolean,
): void {
  ctx.seat.choices.push({
    scene: scene.id,
    pick: o.id,
    chapter: ctx.gw.s.chapter,
    proxy,
    cast: { ...ctx.cast },
  });
  const back = ctx.card?.back ?? null;
  runEffects(
    ctx,
    back?.changed === true
      ? reworkEffects(o.effects, back.direction)
      : o.effects,
  );
}

/** The person a talk is with. */
export function talkerOf(ctx: SceneCtx, scene: GwScene): GwPersonState | null {
  const id = scene.who === undefined ? undefined : ctx.cast[scene.who];
  return id === undefined ? null : ctx.gw.person(id);
}

export function rememberTalk(
  ctx: SceneCtx,
  scene: GwScene,
  key: string,
  weight: number,
): void {
  const w: GwWho | undefined =
    scene.who === undefined ? undefined : { role: scene.who };
  runEffect(ctx, { kind: "remember", key, who: w, weight });
}

/** Closes a talk: its mood moves trust, its reasons reach the log. */
export function endTalk(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
): void {
  removeCard(seat, card.uid);
  const ctx = ctxOf(gw, seat, card);
  const p = talkerOf(ctx, scene);
  const m = card.mood;
  const sign = m > 0 ? 1 : -1;
  if (m !== 0) rememberTalk(ctx, scene, m > 0 ? "talk_well" : "talk_ill", sign);
  if (p !== null && Math.abs(m) >= GW_MOOD_MOVES_TRUST) {
    p.trust = clamp(p.trust + sign, GW_TRUST_MIN, GW_TRUST_MAX);
  }
  // A note says why trust moved: with no move there is nothing to explain.
  if (p !== null && Math.abs(m) >= GW_MOOD_MOVES_TRUST) {
    const kind = m > 0 ? "talk_fit" : "talk_clash";
    const key = card.notes.filter((k) => k.startsWith(kind)).pop();
    if (key !== undefined) {
      seat.log.push({ key, chapter: gw.s.chapter, who: p.id });
    }
  }
  card.notes = [];
}

/**
 * Closes a chapter's cards. A decision left open takes its fallback, or the
 * first open option; a talk ends, and a visitor left waiting remembers it.
 * `late` writes the proxy line (대행).
 */
export function closeUndecided(
  gw: GreatWar,
  seat: GwSeatState,
  late: boolean,
): void {
  for (const card of [...seat.desk]) {
    const scene = sceneOf(card.scene);
    if (scene === null) {
      removeCard(seat, card.uid);
      continue;
    }
    const ctx = ctxOf(gw, seat, card);
    if (scene.kind === "talk") {
      rememberTalk(ctx, scene, "talk_left", card.origin === "summon" ? 0 : -1);
      endTalk(gw, seat, card, scene);
      continue;
    }
    removeCard(seat, card.uid);
    const open = (scene.options ?? []).filter((o) => optionOpen(ctx, o));
    const pick = open.find((o) => o.id === scene.fallback) ?? open[0];
    if (pick === undefined) continue;
    takeOption(ctx, scene, pick, late);
    if (late) seat.log.push({ key: "proxy_signed", chapter: gw.s.chapter });
  }
}
