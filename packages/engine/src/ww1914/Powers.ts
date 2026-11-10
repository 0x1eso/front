// Great War 1914 (ww169, design ww168 B2-B3): the ruler's powers on the 통치
// tab. A use runs a real procedure: who must sign or consent, the cabinet's
// or the house's vote, then the effects, the world's answers (reactors) and a
// roll from the state where the row has one. Nothing shows its result before:
// afterwards come the reason lines and the row's silent card.
import type {
  GwPersonState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_TRUST_MAX,
  GW_TRUST_MIN,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type {
  GwPowerEnd,
  GwPowerState,
  GwPowerTag,
  GwPowerView,
} from "@openfront/engine-api/ww1914/GwPowers";
import type { GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_POWER_COOLDOWN,
  GW_POWER_SOUND,
  GW_REACTORS,
  GwPowerOption,
  GwPowerRow,
  GwReactorRow,
} from "@openfront/engine-lib/ww1914/PowerRows";
import { isCandid } from "@openfront/engine-lib/ww1914/TalkRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { holdVote } from "./Authority";
import { blocNow } from "./Blocs";
import { makeCard, placeCard } from "./Desk";
import type { GreatWar } from "./GreatWar";
import { factionOf, factionRow, questionCount } from "./House";
import { openLetter, trustBy } from "./People";
import {
  holderOf,
  holds,
  personDef,
  runEffects,
  SceneCtx,
  sceneOf,
} from "./SceneRun";
import {
  clampTo,
  defOf,
  ownPeople,
  reason,
  reasonOf,
  seatPerson,
} from "./World";

const P_RISK = idHash("gw_power_risk");
/** A signer's answer stands this many chapters. */
const SOUNDED_FOR = 2;
/** Readiness a neutral moves for a step of its answer. */
const READY_STEP = 5;

const rows = (): readonly GwPowerRow[] => gwContent().powers ?? [];

export function powerRow(id: string): GwPowerRow | null {
  return rows().find((r) => r.id === id) ?? null;
}

function stateOf(seat: GwSeatState): GwPowerState {
  seat.powers ??= { used: [], sounded: [] };
  return seat.powers;
}

/** Whether the row is on this seat's tab at all. */
function listed(ctx: SceneCtx, row: GwPowerRow): boolean {
  if (row.tag !== ctx.seat.tag || row.formOnly === true) return false;
  return row.shows === undefined || holds(ctx, row.shows);
}

function rested(gw: GreatWar, seat: GwSeatState, row: GwPowerRow): boolean {
  const last = (seat.powers?.used ?? [])
    .filter((u) => u.id === row.id && (u.end === "done" || u.end === "without"))
    .slice(-1)[0];
  if (last === undefined) return true;
  if (row.once === true) return false;
  return gw.s.chapter - last.chapter > (row.cooldown ?? GW_POWER_COOLDOWN);
}

/** The person who must countersign; null when none is needed or none holds it. */
function signerOf(gw: GreatWar, seat: GwSeatState, row: GwPowerRow) {
  const office = row.needs?.office;
  if (office === undefined) return { needed: false, p: null };
  const p = holderOf(gw, seat, office);
  // The head of state holding it signs for himself (Asquith at the War Office).
  if (p !== null && p.id === seatPerson(seat))
    return { needed: false, p: null };
  return { needed: true, p: p ?? null };
}

/** Greyed: why, else null. Facts only, never a price. */
function gateWhy(ctx: SceneCtx, row: GwPowerRow): string | null {
  const { gw, seat } = ctx;
  if (!rested(gw, seat, row)) return "used";
  for (const g of row.opens ?? []) if (!holds(ctx, g.when)) return g.why;
  if ((row.authority ?? 0) > (gw.nation(seat.tag)?.authority ?? 0)) {
    return "no_authority";
  }
  if (row.slot === true && seat.acts <= 0) return "no_slot";
  const s = signerOf(gw, seat, row);
  if (s.needed && s.p === null) return "no_signer";
  return null;
}

const open = (ctx: SceneCtx, o: GwPowerOption) =>
  o.when === undefined || holds(ctx, o.when);

/** What the target list holds now. */
function targetIds(ctx: SceneCtx, row: GwPowerRow): string[] {
  const t = row.target;
  if (t === undefined) return [];
  if (t.kind !== "person")
    return t.of.filter((o) => open(ctx, o)).map((o) => o.id);
  const self = seatPerson(ctx.seat);
  return ownPeople(ctx.gw, ctx.seat.tag)
    .filter((p) => p.status === "active" && p.id !== self)
    .filter((p) => t.people === "own" || p.office !== null)
    .filter((p) => t.offices === undefined || t.offices.includes(p.office!))
    .filter((p) => personDef(p.id)?.unlisted !== true || p.office !== null)
    .map((p) => p.id);
}

function lastSounded(gw: GreatWar, seat: GwSeatState, row: GwPowerRow) {
  const s = signerOf(gw, seat, row);
  if (!s.needed || s.p === null) return null;
  const x = (seat.powers?.sounded ?? [])
    .filter((y) => y.id === row.id && y.person === s.p!.id)
    .slice(-1)[0];
  if (x === undefined || gw.s.chapter - x.chapter > SOUNDED_FOR) return null;
  return x;
}

/** The tab: every power listed now, in content order. */
export function powerViews(gw: GreatWar, seat: GwSeatState): GwPowerView[] {
  const ctx: SceneCtx = { gw, seat, cast: {} };
  return rows().flatMap((row) => {
    if (!listed(ctx, row)) return [];
    const s = signerOf(gw, seat, row);
    const n = row.needs;
    const said = lastSounded(gw, seat, row);
    const ids = targetIds(ctx, row);
    const fields = (row.fields ?? []).map((f) => ({
      id: f.id,
      options: f.options.filter((o) => open(ctx, o)).map((o) => o.id),
    }));
    // A list with nothing open to pick, target or field, greys the row.
    const empty =
      (row.target !== undefined && ids.length === 0) ||
      fields.some((f) => f.options.length === 0);
    const why = gateWhy(ctx, row) ?? (empty ? "no_target" : null);
    return [
      {
        id: row.id,
        group: row.kind === "beyond" ? "beyond" : row.group,
        kind: row.kind,
        needs: {
          ...(n?.office === undefined
            ? {}
            : {
                office: n.office,
                signer: s.needed ? (s.p?.id ?? null) : null,
              }),
          ...(n?.house === undefined ? {} : { houses: n.house.houses ?? [] }),
          ...(n?.council === undefined ? {} : { council: true }),
          ...(n?.consent === undefined ? {} : { consent: n.consent }),
        },
        why,
        target:
          row.target === undefined ? null : { kind: row.target.kind, ids },
        fields,
        without: row.beyond !== undefined && s.needed,
        sounded:
          said === null ? null : { person: said.person, said: said.said },
        slot: row.slot === true,
      },
    ];
  });
}

/** Will he sign? His trust, his camp against it, custom, his temper. No dice. */
export function willSign(p: GwPersonState, row: GwPowerRow): boolean {
  let v = p.trust;
  const camps = defOf(p.id)?.camps ?? [];
  for (const c of row.against ?? []) if (camps.includes(c)) v -= 2;
  if (row.kind === "custom") v -= 1;
  if (row.kind === "beyond") v -= 3;
  if (p.temperament === "stubborn" && v !== 0) v += v > 0 ? 1 : -1;
  return v >= 0;
}

/** What he says when asked: the truth if candid, else what pleases. */
function saysHeSigns(p: GwPersonState, truth: boolean): boolean {
  return isCandid(p, 0) ? truth : true;
}

function sound(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwPowerRow,
): GwOrderBlock | null {
  const s = signerOf(gw, seat, row);
  if (!s.needed || s.p === null) return "no_signer";
  const p = s.p;
  const st = stateOf(seat);
  if (st.sounded.some((x) => x.id === row.id && x.chapter === gw.s.chapter)) {
    return "sounded";
  }
  if (seat.audiences <= 0) return "no_audience";
  const scene = sceneOf(GW_POWER_SOUND);
  if (scene === null) return "no_topic";
  const said = saysHeSigns(p, willSign(p, row));
  seat.memory = seat.memory.filter(
    (m) =>
      !(
        m.who === p.id &&
        m.chapter === gw.s.chapter &&
        m.key.startsWith("k_pw_said_")
      ),
  );
  seat.memory.push({
    key: said ? "k_pw_said_yes" : "k_pw_said_no",
    who: p.id,
    chapter: gw.s.chapter,
    weight: 0,
  });
  const card = makeCard(gw, seat, scene, "summon", p.id);
  if (card === null) return "no_topic";
  seat.audiences--;
  st.sounded.push({ id: row.id, person: p.id, said, chapter: gw.s.chapter });
  placeCard(gw, seat, card);
  return null;
}

/** The answers of one reactor row, as plain effects. */
function answers(ctx: SceneCtx, r: GwReactorRow): GwEffect[] {
  const { gw, seat } = ctx;
  const of = (r.of ?? []) as readonly string[];
  switch (r.actor) {
    case "people":
      return of.map((b) => ({
        kind: "opinion",
        bloc: b as Extract<GwEffect, { kind: "opinion" }>["bloc"],
        delta: r.delta,
      }));
    case "factions":
      return (
        (gwContent().factions ?? [])
          .filter((f) => f.tag === seat.tag && of.includes(f.bloc))
          .filter((f) => factionOf(seat, f.id)?.status === "in")
          // Heat is the other way round: a good answer cools them.
          .map((f) => ({
            kind: "world",
            of: { do: "faction", id: f.id, delta: -r.delta },
          }))
      );
    case "cabinet":
      return ownPeople(gw, seat.tag)
        .filter((p) => p.status === "active" && p.office !== null)
        .filter((p) => (defOf(p.id)?.camps ?? []).some((c) => of.includes(c)))
        .map((p) => ({
          kind: "person_trust",
          who: { person: p.id },
          delta: r.delta,
        }));
    default:
      return [];
  }
}

/** Allies' and neutrals' trust in the seat, and a neutral's readiness. */
function abroad(gw: GreatWar, seat: GwSeatState, r: GwReactorRow): boolean {
  const me = gw.nation(seat.tag);
  if (me === null) return false;
  let moved = false;
  for (const n of gw.s.nations) {
    if (n.tag === seat.tag || n.out) continue;
    const ally = me.side !== null && n.side === me.side;
    const neutral = n.side === null;
    if (r.actor === "allies" ? !ally : !neutral) continue;
    n.trust[seat.tag] = clampTo(
      (n.trust[seat.tag] ?? 0) + r.delta,
      GW_TRUST_MIN,
      GW_TRUST_MAX,
    );
    const leans = n.lean > 0 ? "entente" : n.lean < 0 ? "central" : null;
    if (neutral && me.side !== null && leans === me.side) {
      n.readiness = clampTo(n.readiness + r.delta * READY_STEP, 0, 100);
    }
    moved = true;
  }
  return moved;
}

function reactKey(r: GwReactorRow, bloc?: string): string {
  if (r.key !== undefined) return r.key;
  const way = r.delta > 0 ? "up" : "down";
  return bloc === undefined
    ? `react_${r.actor}_${way}`
    : `react_${r.actor}_${bloc}_${way}`;
}

/** The world answers what was done (design B3): one reason line each. */
export function react(ctx: SceneCtx, tags: readonly GwPowerTag[]): void {
  const { gw, seat } = ctx;
  const all = [...GW_REACTORS, ...(gwContent().reactors ?? [])];
  for (const tag of [...new Set(tags)].sort()) {
    for (const r of all) {
      if (r.tag !== tag) continue;
      if (r.nation !== undefined && r.nation !== seat.tag) continue;
      if (r.by !== undefined && !holds(ctx, r.by)) continue;
      if (r.actor === "allies" || r.actor === "neutrals") {
        if (abroad(gw, seat, r)) reason(gw, seat, reactKey(r));
      } else if (r.actor === "people") {
        runEffects(ctx, answers(ctx, r));
        for (const b of r.of ?? []) reason(gw, seat, reactKey(r, b));
      } else {
        const list = answers(ctx, r);
        runEffects(ctx, list);
        if (list.length > 0) reason(gw, seat, reactKey(r));
      }
      if (r.does !== undefined) {
        runEffects(ctx, r.does);
        if (r.actor === "other") reason(gw, seat, reactKey(r));
      }
    }
  }
}

/** Whether the consent faction lets it pass: in, not turned, its bloc not lost. */
function consents(gw: GreatWar, seat: GwSeatState, id: string): boolean {
  const st = factionOf(seat, id);
  const row = factionRow(id);
  if (st === null || row === null || st.status !== "in") return true;
  return st.step < 2 && blocNow(gw, seat, row.bloc) > -3;
}

function record(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwPowerRow,
  target: string | null,
  end: GwPowerEnd,
): void {
  stateOf(seat).used.push({ id: row.id, chapter: gw.s.chapter, target, end });
}

/** The procedure; the end it stopped at, or null when it went through. */
function procedure(ctx: SceneCtx, row: GwPowerRow): GwPowerEnd | null {
  const { gw, seat } = ctx;
  const s = signerOf(gw, seat, row);
  if (s.needed && s.p !== null && !willSign(s.p, row)) {
    trustBy(s.p, -1);
    reasonOf(gw, seat, "power_refused", s.p.id);
    if (s.p.trust <= GW_TRUST_MIN) openLetter(gw, seat, s.p);
    return "refused";
  }
  const n = row.needs;
  if (n?.consent !== undefined && !consents(gw, seat, n.consent)) {
    reason(gw, seat, "power_no_consent");
    return "no_consent";
  }
  if (n?.council !== undefined) {
    holdVote(gw, seat, n.council);
    if (!seat.flags.includes(`carried_${n.council}`)) return "council_lost";
  }
  if (n?.house !== undefined) {
    const c = questionCount(
      gw,
      seat,
      row.id,
      n.house.stance,
      n.house.houses,
      n.house.lean ?? 0,
    );
    if (c !== null && c.count < 0) {
      reason(gw, seat, "power_house_lost");
      return "house_lost";
    }
    if (c !== null) reason(gw, seat, "power_house_carried");
  }
  return null;
}

/** It goes through: price, effects, the world's answers, the roll, the card. */
function goThrough(
  ctx: SceneCtx,
  row: GwPowerRow,
  target: string | null,
  chosen: readonly GwPowerOption[],
): void {
  const { gw, seat } = ctx;
  const n = gw.nation(seat.tag);
  if (n !== null && row.authority !== undefined) {
    n.authority = Math.max(0, n.authority - row.authority);
  }
  if (row.slot === true) seat.acts--;
  runEffects(ctx, row.effects);
  for (const o of chosen) runEffects(ctx, o.effects ?? []);
  react(ctx, [...row.tags, ...chosen.flatMap((o) => o.tags ?? [])]);
  const risk = row.risk;
  if (risk !== undefined) {
    const pct =
      risk.pct +
      (risk.mods ?? [])
        .filter((m) => holds(ctx, m.when))
        .reduce((a, m) => a + m.add, 0);
    const uses = (seat.powers?.used ?? []).filter(
      (u) => u.id === row.id,
    ).length;
    const roll =
      wwRoll(gw.s.seed, P_RISK, idHash(row.id), gw.s.chapter, uses) % 100;
    if (roll < pct) runEffects(ctx, risk.then);
  }
  const scene = row.scene === undefined ? null : sceneOf(row.scene);
  if (scene !== null) {
    const who = row.target?.kind === "person" ? target : null;
    const card = makeCard(gw, seat, scene, "summon", who);
    if (card !== null) placeCard(gw, seat, card);
  }
}

/** Applies the `power` order; null when it took effect (whatever came of it). */
export function takePower(
  gw: GreatWar,
  seat: GwSeatState,
  o: {
    id: string;
    target: string | null;
    picks: readonly string[];
    without: boolean;
    sound: boolean;
  },
): GwOrderBlock | null {
  const row = powerRow(o.id);
  const base: SceneCtx = { gw, seat, cast: {} };
  if (row === null || !listed(base, row)) return "no_power";
  if (o.sound) return sound(gw, seat, row);
  if (gateWhy(base, row) !== null) return "power_closed";
  const ids = targetIds(base, row);
  if (row.target !== undefined) {
    if (o.target === null || !ids.includes(o.target)) return "no_target";
  } else if (o.target !== null) return "no_target";
  const fields = row.fields ?? [];
  if (o.picks.length !== fields.length) return "bad_pick";
  const chosen: GwPowerOption[] = [];
  for (const [i, f] of fields.entries()) {
    const opt = f.options.find((x) => x.id === o.picks[i]);
    if (opt === undefined || !open(base, opt)) return "bad_pick";
    chosen.push(opt);
  }
  if (row.target !== undefined && row.target.kind !== "person") {
    chosen.unshift(row.target.of.find((x) => x.id === o.target)!);
  }
  const s = signerOf(gw, seat, row);
  const cast: Record<string, string> = {};
  if (row.target?.kind === "person" && o.target !== null)
    cast.target = o.target;
  if (s.p !== null) cast.signer = s.p.id;
  const ctx: SceneCtx = { gw, seat, cast };
  if (o.without) {
    const form = row.beyond === undefined ? null : powerRow(row.beyond);
    if (form === null || !s.needed || s.p === null) return "no_beyond";
    // Past him: he knows, and so does everyone who reads the papers.
    trustBy(s.p, -2);
    reasonOf(gw, seat, "power_without", s.p.id);
    record(gw, seat, row, o.target, "without");
    goThrough(ctx, form, o.target, chosen);
    record(gw, seat, form, o.target, "done");
    gw.touch();
    return null;
  }
  const stopped = procedure(ctx, row);
  if (stopped !== null) {
    runEffects(ctx, row.failed ?? []);
    record(gw, seat, row, o.target, stopped);
    gw.touch();
    return null;
  }
  goThrough(ctx, row, o.target, chosen);
  record(gw, seat, row, o.target, "done");
  gw.touch();
  return null;
}
