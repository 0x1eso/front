import {
  GW_GAUGE_MAX,
  GW_INST_MAX,
  GW_INST_MIN,
  GW_TEMP_MAX,
  GW_TRUST_MAX,
  GW_TRUST_MIN,
  GwCard,
  GwOffice,
  GwPersonState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_READ_ONLY_KINDS,
  GwCond,
  GwEffect,
  GwOption,
  GwReply,
  GwScene,
  GwVariant,
  GwWho,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GreatWar } from "./GreatWar";
import { dismissPerson, onAppointed } from "./People";
import { worldEffect, worldHolds } from "./WorldDsl";

/** What conditions and effects run against. */
export interface SceneCtx {
  gw: GreatWar;
  seat: GwSeatState;
  /** role -> person id. */
  cast: Readonly<Record<string, string>>;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

export function sceneOf(id: string): GwScene | null {
  return gwContent().scenes.find((x) => x.id === id) ?? null;
}

export function holderOf(gw: GreatWar, seat: GwSeatState, o: GwOffice) {
  const mine = new Set(
    gwContent()
      .people.filter((p) => p.tag === seat.tag)
      .map((p) => p.id),
  );
  return (
    gw.s.people.find(
      (p) => p.office === o && p.status === "active" && mine.has(p.id),
    ) ?? null
  );
}

/** The scene's cast; null when a role has nobody. */
export function castOf(
  gw: GreatWar,
  seat: GwSeatState,
  scene: GwScene,
): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const [role, rule] of Object.entries(scene.cast)) {
    let p: GwPersonState | null;
    if ("office" in rule) {
      p = holderOf(gw, seat, rule.office);
    } else if ("person" in rule) {
      const named = gw.person(rule.person);
      p = named?.status === "active" ? named : null;
    } else if ("subject" in rule) {
      const id = seat.subjects[scene.id];
      p = id === undefined ? null : gw.person(id);
    } else {
      const defs = gwContent().people.filter((d) => d.tag === seat.tag);
      const ministers = gw.s.people
        .filter(
          (x) =>
            x.office !== null &&
            x.status === "active" &&
            defs.some((d) => d.id === x.id),
        )
        .sort((a, b) => a.trust - b.trust || (a.id < b.id ? -1 : 1));
      p = ministers[0] ?? null;
    }
    if (p === null) return null;
    out[role] = p.id;
  }
  return out;
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
        (m) => m.key === c.key && (c.who === undefined || m.who === id),
      );
    }
    case "seen":
      return seat.seen[c.scene] !== undefined;
    case "chapter":
      return inRange(s.chapter, c);
    case "stage":
      return gwChapters(s.calendar)[s.chapter].stage === c.stage;
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
      const def = gwContent().people.find((d) => d.id === p?.id);
      return def?.camps.includes(c.camp) === true;
    }
    case "promise": {
      const id = who(ctx, c.who)?.id;
      return seat.promises.some(
        (x) =>
          x.key === c.key &&
          x.who === id &&
          (c.kept === undefined || x.kept === c.kept),
      );
    }
    case "world":
      return worldHolds(ctx, c.of);
  }
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
      if (nation !== null) {
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
        });
      }
      return;
    }
    case "keep_promise": {
      const id = who(ctx, e.who)?.id;
      for (const x of seat.promises) {
        if (x.key === e.key && x.who === id) x.kept = true;
      }
      return;
    }
    case "schedule":
      seat.scheduled.push({ scene: e.scene, chapter: s.chapter + e.chapters });
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
      const p = who(ctx, e.who);
      if (p !== null) setOffice(ctx, p, e.office);
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
      seat.log.push({ key: e.key, chapter: s.chapter });
      return;
    case "end":
      s.ended = e.ending;
      return;
    case "maybe":
      if (holds(ctx, e.when)) runEffects(ctx, e.then);
      return;
    case "world":
      worldEffect(ctx, e.of);
      return;
  }
}

export function runEffects(ctx: SceneCtx, list: readonly GwEffect[]): void {
  for (const e of list) runEffect(ctx, e);
}

/** The first variant that holds; the base has no `when`. */
export function pickVariant(
  ctx: SceneCtx,
  variants: readonly GwVariant[],
): string {
  for (const v of variants) {
    if (v.when === undefined || holds(ctx, v.when)) return v.id;
  }
  return variants[variants.length - 1].id;
}

export function optionOpen(ctx: SceneCtx, o: GwOption | GwReply): boolean {
  return o.when === undefined || holds(ctx, o.when);
}

export function needsDecision(card: GwCard): boolean {
  const scene = sceneOf(card.scene);
  return scene !== null && !GW_READ_ONLY_KINDS.includes(scene.kind);
}

export function ctxOf(gw: GreatWar, seat: GwSeatState, card: GwCard): SceneCtx {
  return { gw, seat, cast: card.cast };
}

export function removeCard(seat: GwSeatState, uid: number): void {
  seat.desk = seat.desk.filter((c) => c.uid !== uid);
}

/**
 * Closes a chapter's cards. A decision left open takes its fallback, or the
 * first open option; a talk just ends. `late` writes the proxy line (대행).
 */
export function closeUndecided(
  gw: GreatWar,
  seat: GwSeatState,
  late: boolean,
): void {
  for (const card of [...seat.desk]) {
    removeCard(seat, card.uid);
    const scene = sceneOf(card.scene);
    if (scene === null || scene.options === undefined) continue;
    if (scene.options.length === 0) continue;
    const ctx = ctxOf(gw, seat, card);
    const open = scene.options.filter((o) => optionOpen(ctx, o));
    const pick = open.find((o) => o.id === scene.fallback) ?? open[0];
    if (pick === undefined) continue;
    runEffects(ctx, pick.effects);
    if (late) seat.log.push({ key: "proxy_signed", chapter: gw.s.chapter });
  }
}
