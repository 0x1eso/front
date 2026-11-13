// Great War 1914 (ww209/ww210, lane C): the money bills' and the bargaining's
// words, for the ledger, the pinned rows, the lobby, the notebook's 약속과 빚
// box, the vote's `defy` line and the settlement table (U1 draws them). Words,
// never numbers: deadlines and due dates come out as words. A leader's line
// falls back to a common one when his pack has none. See
// /home/eser/dev/ww209-format.md.
import type {
  GwBudgetLine,
  GwCreditsBy,
  GwCreditsView,
  GwEarmarkView,
  GwMoneyBill,
  GwMoneyFail,
  GwTaxKind,
} from "@openfront/engine-api/ww1914/GwBudget";
import type {
  GwCounterAnswer,
  GwCounterKind,
  GwDealFate,
  GwDealKind,
  GwDealTerm,
  GwThreatKind,
} from "@openfront/engine-api/ww1914/GwDeals";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type { GwBargainMove } from "@openfront/engine-api/ww1914/GwTable";
import { moneyBillOf } from "@openfront/engine-lib/ww1914/MoneyRows";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { textOrNull } from "./GwText";

/** Chapters ahead that still read as "soon". */
const SOON = 2;

/** A tax kind's name on its chip: 소비세, 소득세, 재산세와 상속세, 전시 이득세. */
export function taxKindWord(tax: GwTaxKind): string {
  return translateText(`gw.budget.tax.${tax}`);
}

/** Who a tax kind falls on, in one line (the chip's note). */
export function taxKindNote(tax: GwTaxKind): string {
  return translateText(`gw.budget.tax_who.${tax}`);
}

/** The chip row's label: 누가 내나. */
export function taxKindLabel(): string {
  return translateText("gw.budget.tax_label");
}

/** A money bill's kind in a word: 예산, 전쟁 공채. */
export function moneyKindWord(kind: GwMoneyBill): string {
  return translateText(`gw.money.bill.${kind}`);
}

/**
 * A money bill's name: "1916년도 예산안", "제5차 전쟁 공채안", or the
 * country's own form (`gw.money.name_of.<TAG>.<kind>`): Britain's votes of
 * credit, France's provisional twelfths, Vienna's budget with Hungary's quota.
 */
export function moneyBillName(m: {
  kind: GwMoneyBill;
  n: number;
  year: number;
  tag?: string;
}): string {
  const params = { year: m.year, n: m.n };
  return (
    (m.tag === undefined
      ? null
      : textOrNull(`gw.money.name_of.${m.tag}.${m.kind}`, params)) ??
    translateText(`gw.money.name.${m.kind}`, params)
  );
}

/**
 * ww213: any bill's name by its law id, wherever one shows (the agenda, the
 * count paper, the vote, the lobby, reports): a money bill by its own name
 * (the year its pinned row, else the ledger, gives), any other by its draft
 * scene's title. The raw id only when nothing knows it.
 */
export function lawTitle(c: GwCtx, law: string): string {
  const m = moneyBillOf(law);
  if (m === null) return c.pack?.scenes[`gw_law_${law}`]?.title ?? law;
  const row = c.seat.world.book?.pinned?.find((g) => g.law === law);
  const year =
    row?.money?.year ??
    c.seat.world.budget?.year ??
    Number(c.data.date.slice(0, 4));
  return moneyBillName({ kind: m.kind, n: m.n, year, tag: m.tag });
}

/** How the war credits come: the house votes them, by command, by decree. */
export function creditsByLine(by: GwCreditsBy): string {
  return translateText(`gw.money.by.${by}`);
}

/** What losing the money bill does, in one line. */
export function moneyFailLine(
  fail: GwMoneyFail,
  kind: GwMoneyBill = "budget",
  by: GwCreditsBy | null = null,
): string {
  if (kind === "budget") return translateText(`gw.money.fail.${fail}`);
  // ww213: refused credits stop the borrowing (by command: nothing legal).
  if (by === "command") return translateText("gw.money.fail.credits_command");
  const stops = translateText("gw.money.fail.credits");
  return fail === "confidence"
    ? `${translateText("gw.money.fail.confidence")} ${stops}`
    : stops;
}

/**
 * The credits' state in one line, at `chapter`: borrowing stopped (refused
 * credits) first; else when the next are due, in words.
 */
export function creditsLine(v: GwCreditsView, chapter: number): string {
  if (v.stopTo !== null && v.stopTo > chapter) {
    return translateText("gw.money.stopped");
  }
  const left = v.due - chapter;
  const key = left <= 0 ? "now" : left <= SOON ? "soon" : "later";
  return translateText(`gw.money.due.${key}`);
}

/** A budget line's name; the national line is the country's own. */
export function budgetLineName(tag: string, line: GwBudgetLine): string {
  if (line !== "national") return translateText(`gw.budget.line.${line}`);
  return (
    textOrNull(`gw.budget.national.${tag}`) ??
    translateText("gw.budget.national.other")
  );
}

/** An earmark's name: its pack words (money.mark.<id>), else "식량과 구호에서 떼어 둔 몫". */
export function earmarkName(
  pack: GwPack | null,
  tag: string,
  m: Pick<GwEarmarkView, "id" | "line">,
): string {
  return (
    pack?.money?.mark?.[m.id]?.name ??
    translateText("gw.money.mark_plain", { line: budgetLineName(tag, m.line) })
  );
}

/** A promise's deadline chip: 이번 회기 안에, 반년 안에, 전쟁이 끝나면. */
export function dealTermWord(term: GwDealTerm): string {
  return translateText(`gw.deal.term.${term}`);
}

/** A counter-offer's chip (내가 내놓는다). */
export function counterWord(kind: GwCounterKind): string {
  return translateText(`gw.deal.counter.${kind}`);
}

/** His answer to a counter; `more` names the price he adds. */
export function counterAnswerLine(
  answer: GwCounterAnswer,
  more: string | null = null,
): string {
  return translateText(`gw.deal.answer.${answer}`, { price: more ?? "" });
}

/** A threat's chip: what the seat will do if his faction votes against. */
export function threatWord(kind: GwThreatKind): string {
  return translateText(`gw.deal.threat.${kind}`);
}

/** A ledger row's kind (약속과 빚): 그가 진 빚, 내가 진 빚, 위협... */
export function dealKindWord(kind: GwDealKind): string {
  return translateText(`gw.deal.kind.${kind}`);
}

/** How a ledger row ended: 지켰다, 어겼다, 허세로 드러났다... */
export function dealFateWord(fate: GwDealFate): string {
  return translateText(`gw.deal.fate.${fate}`);
}

/** When a ledger row falls due, in words, at `chapter` (-1 none, -2 the armistice). */
export function dealDueWord(due: number, chapter: number): string {
  if (due === -1) return translateText("gw.deal.due.none");
  if (due === -2) return translateText("gw.deal.due.war_end");
  const left = due - chapter;
  const key = left <= 0 ? "now" : left <= SOON ? "soon" : "later";
  return translateText(`gw.deal.due.${key}`);
}

/**
 * A faction leader's line in the lobby: `counter_<answer>` or
 * `threat_<kind>`, from his pack (factions.<id>.says), else the common one.
 */
export function leaderLine(
  pack: GwPack | null,
  faction: string,
  key: `counter_${GwCounterAnswer}` | `threat_${GwThreatKind}`,
): string {
  return (
    pack?.factions?.[faction]?.says?.[key] ??
    translateText(`gw.deal.says.${key}`)
  );
}

/** The wing man's talk (온건파): his pack's line, else the common one. */
export function wingLine(
  pack: GwPack | null,
  faction: string,
  key: "hello" | "take" | "leave",
): string {
  return (
    pack?.factions?.[faction]?.wing?.[key] ??
    translateText(`gw.deal.wing.${key}`)
  );
}

/** The vote log's `defy` line: "리프크네히트, 반대"; with no man named, the beat's word. */
export function defyLine(name: string | null): string {
  return name === null
    ? translateText("gw.vote.beat.defy")
    : translateText("gw.vote.beat.defy_by", { name });
}

/** A settlement-table move's chip; `counter` and `down` name the fate. */
export function bargainMoveWord(move: GwBargainMove, fate = ""): string {
  return translateText(`gw.bargain.move.${move}`, { fate });
}
