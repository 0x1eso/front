import {
  GW_FIELDS,
  GW_LINES,
  GW_SEA_MAX,
  GwPersonState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwWorldCond,
  GwWorldEffect,
  GwWorldWho,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { tilted } from "@openfront/engine-lib/ww1914/BudgetRules";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { holdVote, voteCount } from "./Authority";
import {
  budgetFact,
  budgetItem,
  budgetRaise,
  draftOf,
  submitBudget,
} from "./Budget";
import { closeChain } from "./Crises";
import { closeSeat, SEPARATE_PEACE } from "./Endings";
import { eraOf, hasTech } from "./Eras";
import { signChief, warScore } from "./Fronts";
import { govBeaten, govHeat, govHeatBy, govSoon, pollOf } from "./Government";
import { sendReport } from "./Intel";
import { armistice, openTalks, sue } from "./Peace";
import { keepPerson, openLetter, personLeaves, recordResult } from "./People";
import { changeRegime, regimeRow } from "./Regimes";
import { SceneCtx, whoIn } from "./SceneRun";
import { setUboats } from "./Sea";
import { enter, leaveWar } from "./Wars";
import { clampTo, lastOf, news, other, reason } from "./World";

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

const person = (ctx: SceneCtx, w: GwWorldWho): GwPersonState | null =>
  whoIn(ctx, w);

/** Exhaustive: a new kind fails to compile until it runs. */
export function worldHolds(ctx: SceneCtx, c: GwWorldCond): boolean {
  const { gw, seat } = ctx;
  const s = gw.s;
  const nation = gw.nation(seat.tag);
  switch (c.is) {
    case "thread":
      return s.threads.includes(c.id);
    case "mandate":
      return seat.mandates.includes(c.id);
    case "known":
      return seat.known.includes(c.id);
    case "chain":
      return s.chain !== null && inRange(s.chain.step, c);
    case "chain_end":
      return s.chains.some((x) => c.of.includes(x.outcome));
    case "war":
      return (nation?.atWar.length ?? 0) > 0;
    case "entered": {
      const side = gw.nation(c.tag)?.side ?? null;
      return side !== null && (c.side === undefined || c.side === side);
    }
    case "out":
      return gw.nation(c.tag)?.out === true;
    case "front": {
      const t = s.theatres.find((x) => x.id === c.theatre)!;
      const lines = GW_LINES[c.theatre];
      const from = c.from === undefined ? 0 : lines.indexOf(c.from);
      const to = c.to === undefined ? lines.length - 1 : lines.indexOf(c.to);
      return t.since !== null && t.line >= from && t.line <= to;
    }
    case "open":
      return s.theatres.find((x) => x.id === c.theatre)!.open;
    case "battle": {
      const last = lastOf(s.battles.filter((b) => b.theatre === c.theatre));
      if (last === undefined || !c.of.includes(last.result)) return false;
      if (c.by === undefined) return true;
      const mine = nation?.side ?? null;
      if (c.by === "seat") return last.by !== null && last.by === mine;
      if (c.by === "foe") return last.by !== null && last.by !== mine;
      return last.by === c.by;
    }
    case "plan":
      return s.plan !== null && c.of.includes(s.plan);
    case "aside":
      return s.aside;
    case "mob":
      return inRange(gw.nation(c.tag)?.mob ?? 0, c);
    case "unrest":
      return inRange(nation?.unrest ?? 0, c);
    case "authority":
      return inRange(nation?.authority ?? 0, c);
    case "casualties":
      return inRange(nation?.casualties ?? 0, c);
    case "manpower":
      return inRange(nation?.manpower ?? 0, c);
    case "uboat":
      return inRange(s.uboat, c);
    case "war_age":
      return s.warChapter !== null && inRange(s.chapter - s.warChapter, c);
    case "score":
      return (
        nation !== null &&
        nation.side !== null &&
        inRange(warScore(gw, nation.side), c)
      );
    case "plan_signed":
      return seat.signed === s.chapter;
    case "main":
      return c.of.includes(seat.alloc.main);
    case "letter":
      return (person(ctx, c.who)?.letter ?? null) !== null;
    case "ailing":
      return (person(ctx, c.who)?.ailing ?? null) !== null;
    case "wins": {
      const p = person(ctx, c.who);
      return p !== null && inRange(p.wins, c);
    }
    case "losses": {
      const p = person(ctx, c.who);
      return p !== null && inRange(p.losses, c);
    }
    case "ai": {
      const n = gw.nation(c.tag);
      return n !== null && c.of.includes(n.ai);
    }
    case "lean":
      return inRange(gw.nation(c.tag)?.lean ?? 0, c);
    case "force":
      return inRange(gw.nation(c.tag)?.strength[c.theatre] ?? 0, c);
    case "competence": {
      const p = person(ctx, c.who);
      const f = GW_FIELDS.indexOf(c.field);
      return p !== null && inRange(p.competence[f], c);
    }
    case "report_wrong": {
      const r = lastOf(
        s.reports.filter(
          (x) => x.source === c.source && x.smallID === seat.smallID,
        ),
      );
      return r !== undefined && r.claim !== r.truth;
    }
    case "source_record": {
      const src = s.sources.find((x) => x.id === c.source);
      return src !== undefined && inRange(src.right - src.wrong, c);
    }
    case "regime":
      return c.of.includes(gw.nation(c.tag ?? seat.tag)?.regime ?? "");
    case "era":
      return c.of.includes(eraOf(gw).id);
    case "tech": {
      const n = gw.nation(c.tag ?? seat.tag);
      return n !== null && hasTech(n, c.id);
    }
    case "blockade":
      return inRange(s.blockade, c);
    case "shipping":
      return inRange(s.shipping, c);
    case "america":
      return inRange(gw.nation("USA")?.readiness ?? 0, c);
    case "armistice":
      return (
        s.armistice !== null &&
        (c.of === undefined || c.of.includes(s.armistice.kind))
      );
    case "peace_side":
      return c.of.includes(peaceSide(ctx));
    case "votes":
      return inRange(voteCount(gw, seat, c.issue), c);
    case "carried":
      return seat.flags.includes(`carried_${c.issue}`);
    case "command":
      return nation?.command === true;
    case "in_war": {
      const n = gw.nation(c.tag ?? seat.tag);
      return (
        n !== null && n.entered !== null && inRange(s.chapter - n.entered, c)
      );
    }
    case "neutral":
      return gw.nation(c.tag)?.side === null;
    case "side":
      return c.of.includes(nation?.side ?? "neutral");
    case "date": {
      const d = civilFromDays(s.day);
      const now = `${d.year}-${String(d.month).padStart(2, "0")}`;
      return now >= (c.from ?? "") && now <= (c.to ?? "9");
    }
    case "offered": {
      const side = nation?.side ?? "central";
      return inRange(gw.nation(c.tag)?.offers[side] ?? 0, c);
    }
    case "budget":
      return nation !== null && inRange(budgetFact(gw, nation, c.what), c);
    case "gov":
      return inRange(govHeat(seat, c.id), c);
    case "poll":
      return inRange(pollOf(ctx, c.id)?.margin ?? 0, c);
    case "poll_own":
      return inRange(pollOf(ctx, c.id)?.own ?? 0, c);
  }
}

/** How the war came out for the seat, from the armistice. */
function peaceSide(ctx: SceneCtx): "won" | "lost" | "even" {
  const a = ctx.gw.s.armistice;
  const side = ctx.gw.nation(ctx.seat.tag)?.side ?? null;
  if (a === null || a.kind === "compromise" || side === null) return "even";
  return (a.kind === "central_lost") === (side === "central") ? "lost" : "won";
}

/** Exhaustive. An effect on nobody does nothing. */
export function worldEffect(ctx: SceneCtx, e: GwWorldEffect): void {
  const { gw, seat } = ctx;
  const s = gw.s;
  const nation = gw.nation(seat.tag);
  switch (e.do) {
    case "plan":
      s.plan = e.plan;
      return;
    case "aside":
      s.aside = true;
      return;
    case "hold":
      if (s.chain !== null) s.chain.hold++;
      return;
    case "close_chain":
      closeChain(gw, e.outcome);
      return;
    case "mobilize": {
      const n = gw.nation(e.tag);
      if (n !== null) n.mob = Math.max(n.mob, e.level);
      return;
    }
    case "stand_down": {
      const n = gw.nation(e.tag);
      if (n !== null) n.mob = Math.min(n.mob, e.level);
      return;
    }
    case "declare": {
      if (s.warChapter === null) closeChain(gw, "war");
      const foe = gw.nation(e.tag);
      if (foe === null || nation === null) return;
      if (foe.side === null && nation.side !== null) {
        enter(gw, e.tag, other(nation.side), "war_declared");
      } else if (foe.side !== null && nation.side === null) {
        // A neutral seat comes in against a country already at war.
        enter(gw, seat.tag, other(foe.side), "war_declared");
      }
      return;
    }
    case "offer": {
      const n = gw.nation(e.tag);
      const side = nation?.side ?? "central";
      if (n !== null) {
        n.offers[side] = Math.max(n.offers[side] ?? 0, e.value);
      }
      return;
    }
    case "readiness": {
      const n = gw.nation(e.tag);
      if (n !== null) n.readiness = clampTo(n.readiness + e.delta, 0, 100);
      return;
    }
    case "reveal":
      if (!seat.known.includes(e.id)) seat.known.push(e.id);
      return;
    case "report":
      sendReport(gw, seat, e.fact, e.tag, e.theatre ?? null, e.source);
      return;
    case "thread":
      if (!s.threads.includes(e.id)) s.threads.push(e.id);
      return;
    case "command": {
      const p = person(ctx, e.who);
      const t = s.theatres.find((x) => x.id === e.theatre);
      if (p !== null && t !== undefined) t.commander = p.id;
      return;
    }
    case "uboat":
      setUboats(gw, e.level);
      return;
    case "force": {
      const n = gw.nation(e.tag);
      if (n !== null) {
        n.strength[e.theatre] = clampTo(
          (n.strength[e.theatre] ?? 1) + e.delta,
          1,
          5,
        );
      }
      return;
    }
    case "authority":
      if (nation !== null) {
        nation.authority = clampTo(nation.authority + e.delta, 0, 100);
      }
      return;
    case "manpower":
      if (nation !== null) {
        nation.manpower = clampTo(nation.manpower + e.delta, 0, 100);
      }
      return;
    case "letter": {
      const p = person(ctx, e.who);
      if (p !== null) openLetter(gw, seat, p);
      return;
    }
    case "keep": {
      const p = person(ctx, e.who);
      if (p !== null) keepPerson(p);
      return;
    }
    case "leave": {
      const p = person(ctx, e.who);
      if (p !== null) personLeaves(gw, seat, p, "resigned");
      return;
    }
    case "calm":
      if (nation !== null) {
        nation.unrest = Math.max(0, nation.unrest - 1);
        nation.lowOrder = Math.max(0, nation.lowOrder - 2);
        nation.gauges.order = Math.min(5, nation.gauges.order + 1);
        reason(gw, seat, "concession_made");
      }
      return;
    case "result": {
      const p = person(ctx, e.who);
      if (p !== null) recordResult(gw, p.id, e.won);
      return;
    }
    case "news":
      news(gw, e.key, e.a ?? null, e.b ?? null, e.theatre ?? null);
      return;
    case "sign_chief":
      signChief(gw, seat);
      return;
    case "join":
      enter(gw, seat.tag, e.side, "war_declared");
      return;
    case "regime":
      changeRegime(gw, seat.tag, e.to);
      return;
    case "next_regime": {
      const next = nation === null ? null : (regimeRow(nation)?.next ?? null);
      if (next === null) {
        closeSeat(gw, seat, "home_collapse");
        return;
      }
      changeRegime(gw, seat.tag, next);
      if (regimeRow(nation!)?.seeksPeace === true) sue(gw, seat.tag);
      return;
    }
    case "close_seat":
      closeSeat(gw, seat, "home_collapse");
      return;
    case "personal_command":
      if (nation !== null) nation.command = e.on;
      return;
    case "blockade":
      s.blockade = clampTo(s.blockade + e.delta, 0, GW_SEA_MAX);
      return;
    case "shipping":
      s.shipping = clampTo(s.shipping + e.delta, 0, GW_SEA_MAX);
      return;
    case "vote":
      holdVote(gw, seat, e.issue);
      return;
    case "talks":
      openTalks(gw, seat);
      return;
    case "sue":
      sue(gw, seat.tag);
      return;
    case "armistice":
      armistice(gw, e.kind, seat.tag);
      return;
    case "separate_peace":
      if (!seat.flags.includes(SEPARATE_PEACE)) seat.flags.push(SEPARATE_PEACE);
      leaveWar(gw, seat.tag, "sued_for_peace");
      return;
    case "passes": {
      const p = person(ctx, e.who);
      if (p !== null) {
        personLeaves(gw, seat, p, "person_passed");
        p.status = "dead";
      }
      return;
    }
    case "budget_sign":
      if (nation !== null && nation.budget.meeting !== null) {
        submitBudget(gw, nation, draftOf(nation));
      }
      return;
    case "budget_tilt":
      if (nation !== null && nation.budget.draft !== null) {
        const d = nation.budget.draft;
        d.shares = tilted(d.shares, e.line, e.delta);
      }
      return;
    case "budget_mix":
      if (nation !== null && nation.budget.draft !== null) {
        budgetRaise(nation.budget.draft, e.source, e.delta);
      }
      return;
    case "budget_item":
      if (nation !== null) budgetItem(gw, nation, e.item, e.pct);
      return;
    case "budget_rate":
      if (nation !== null) {
        nation.budget.rate = e.pct;
        nation.budget.shutUntil = s.chapter + e.shut;
      }
      return;
    case "gov_heat":
      govHeatBy(gw, seat, e.id, e.delta);
      return;
    case "gov_beaten":
      govBeaten(gw, seat, e.id);
      return;
    case "gov_soon":
      govSoon(gw, seat, e.id);
      return;
  }
}
