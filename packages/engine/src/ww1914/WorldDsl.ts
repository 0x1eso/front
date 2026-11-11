import {
  GW_FIELDS,
  GW_LINES,
  GW_SEA_MAX,
  GwPersonState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
  GwWorldWho,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { tilted } from "@openfront/engine-lib/ww1914/BudgetRules";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { noteFx } from "./ActNote";
import { askEffect, askHolds } from "./Asks";
import { holdVote, voteCount } from "./Authority";
import {
  budgetFact,
  budgetItem,
  budgetRaise,
  draftOf,
  submitBudget,
} from "./Budget";
import { craftEffect, craftHolds } from "./Craft";
import { closeChain } from "./Crises";
import { fileEffect, fileHolds } from "./Dossier";
import { closeSeat, SEPARATE_PEACE } from "./Endings";
import { eraOf, hasTech } from "./Eras";
import { signChief, warScore } from "./Fronts";
import { govBeaten, govHeat, govHeatBy, govSoon, pollOf } from "./Government";
import { houseEffect, houseHolds } from "./House";
import { inspect, sendReport } from "./Intel";
import {
  ladderAnswer,
  ladderPress,
  ladderTargets,
  monthsHold,
  sendUltimatum,
} from "./Ladder";
import {
  lawCanDecree,
  lawCount,
  lawDecree,
  lawHold,
  lawPut,
  lawSign,
  lawStage,
  lawSupport,
  lawText,
  lawWithdraw,
} from "./Laws";
import { landHolds } from "./Occupation";
import {
  counterOffensive,
  foeOffensiveHolds,
  offensiveHolds,
} from "./Offensives";
import {
  declareFromTab,
  pairHolds,
  peaceAnswer,
  seatDeclares,
  seatOffersPeace,
} from "./PairWar";
import { armistice, openTalks, sue } from "./Peace";
import { keepPerson, openLetter, personLeaves, recordResult } from "./People";
import { plotEffect, plotHolds } from "./Plots";
import { changeRegime, regimeRow } from "./Regimes";
import { SceneCtx, whoIn } from "./SceneRun";
import { setUboats } from "./Sea";
import { spyEffect, spyHolds } from "./Spies";
import { collapseHolds } from "./Stalemate";
import { enter, leaveWar } from "./Wars";
import { clampTo, lastOf, moveGauge, news, reason } from "./World";

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
      if (s.chain === null || !inRange(s.chain.step, c)) return false;
      return c.short === undefined || s.chain.short === c.short;
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
    case "law": {
      const st = nation === null ? null : lawStage(nation, c.id);
      if (st === null || !c.of.includes(st.stage)) return false;
      return c.text === undefined || st.text === c.text;
    }
    case "law_count":
      return inRange(lawCount(gw, seat, c.id), c);
    case "law_decree":
      return lawCanDecree(gw, seat, c.id);
    case "gov":
      return inRange(govHeat(seat, c.id), c);
    case "poll":
      return inRange(pollOf(ctx, c.id)?.margin ?? 0, c);
    case "poll_own":
      return inRange(pollOf(ctx, c.id)?.own ?? 0, c);
    case "invention":
    case "project":
    case "footing":
    case "shortage":
      return craftHolds(ctx, c);
    case "faction":
    case "faction_temper":
    case "faction_asks":
    case "faction_want":
    case "deal":
    case "amendable":
    case "lobby":
    case "vote_band":
    case "law_origin":
    case "whip_said":
    case "around":
    case "house_sits":
    case "confidence":
      return houseHolds(ctx, c);
    case "plot_signs":
    case "plot_warned":
    case "plot_report":
      return plotHolds(ctx, c);
    case "file":
      return fileHolds(ctx, c);
    case "ask":
      return askHolds(ctx, c);
    case "war_months":
    case "peace_months":
    case "month":
    case "ladder":
      return monthsHold(gw, seat, c);
    case "ladder_target":
      return ladderTargets(gw, seat.tag).includes(c.tag);
    case "war_target":
    case "peace_target":
    case "pair_war":
    case "pair_peace":
    case "front_months":
    case "peace_offered":
      return pairHolds(gw, seat, c);
    case "land_taken":
    case "land_lost":
    case "beaten":
    case "pair_table":
      return landHolds(gw, seat, c);
    case "collapse":
      return collapseHolds(gw, seat, c);
    case "foe_offensive":
      return foeOffensiveHolds(gw, seat.tag, c);
    case "offensive":
      return offensiveHolds(gw, seat.tag, c);
    case "spy":
      return spyHolds(gw, seat, c.can, c.tag);
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
      // In the July crisis a declaration is the general war's (Crises); then
      // the seat's own war on the country named (ww171: any pair).
      if (s.warChapter === null && s.chain !== null) closeChain(gw, "war");
      if (nation === null || gw.nation(e.tag) === null) return;
      seatDeclares(gw, seat, e.tag);
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
    case "inspect":
      inspect(gw, seat, e.fact, e.tag, e.theatre ?? null);
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
        reason(gw, seat, e.key ?? "concession_made");
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
    case "law_text":
      lawText(gw, seat, e.law, e.text, e.support);
      return;
    case "law_support":
      lawSupport(gw, seat, e.law, e.delta);
      return;
    case "law_put":
      lawPut(ctx, e.law);
      return;
    case "law_decree":
      lawDecree(ctx, e.law);
      return;
    case "law_hold":
      lawHold(gw, seat, e.law);
      return;
    case "law_withdraw":
      lawWithdraw(gw, seat, e.law);
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
    case "invent":
    case "project":
    case "project_lead":
    case "footing":
    case "shortage":
      craftEffect(ctx, e);
      return;
    case "faction":
    case "faction_grow":
    case "faction_under":
    case "deal":
    case "amend":
    case "bill_answer":
    case "law_start":
      houseEffect(ctx, e);
      return;
    case "house_sign":
      lawSign(ctx, e.yes);
      return;
    case "plot_sign":
    case "plot_warn":
      plotEffect(ctx, e);
      return;
    case "file":
    case "use_file":
      fileEffect(ctx, e);
      return;
    case "ask":
      askEffect(ctx, e);
      return;
    case "stir":
      stir(ctx, e.tag, e.delta);
      return;
    case "ultimatum":
      sendUltimatum(ctx.gw, ctx.seat, e.tag);
      return;
    case "ladder_answer":
      ladderAnswer(ctx.gw, ctx.seat, e.yes);
      return;
    case "ladder_press":
      ladderPress(ctx.gw, ctx.seat, e.on);
      return;
    case "declare_war":
      declareFromTab(ctx.gw, ctx.seat, e.tag);
      return;
    case "pair_peace":
      seatOffersPeace(ctx.gw, ctx.seat, e.tag);
      return;
    case "pair_peace_answer":
      peaceAnswer(ctx.gw, ctx.seat, e.yes);
      return;
    case "counter_offensive":
      counterOffensive(ctx.gw, ctx.seat.tag, e.pick);
      return;
    case "spy":
      spyEffect(ctx.gw, ctx.seat, e.act, e.tag);
      return;
  }
}

const P_STIR = idHash("gw_stir");
/** The best odds agitation has, against a country at the end of its tether. */
const STIR_MOST = 90;

/**
 * Agitation in another country: the steadier it is, the likelier its police
 * answer first. Either way the seat is told; the country's own seat sees its
 * order fall as a gauge line.
 */
function stir(ctx: SceneCtx, tag: GwTag, delta: number): void {
  const { gw, seat } = ctx;
  const n = gw.nation(tag);
  if (n === null || n.out || tag === seat.tag) return;
  const odds = Math.min(STIR_MOST, 30 + 12 * (5 - n.gauges.order));
  const roll = wwRoll(gw.s.seed, P_STIR, gw.s.chapter, idHash(tag)) % 100;
  const worked = roll < odds && n.gauges.order > 0;
  if (worked) moveGauge(gw, tag, "order", -delta, "order_stirred");
  const key = worked ? "fx_stir" : "fx_stir_answered";
  if (ctx.fx !== undefined) noteFx(seat, gw.s.chapter, ctx.fx, key, { tag });
  else seat.log.push({ key, chapter: gw.s.chapter, tag });
}
