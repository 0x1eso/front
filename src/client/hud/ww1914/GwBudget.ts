import {
  GW_BUDGET_DRIFTS,
  GW_BUDGET_ITEMS,
  GW_BUDGET_LINES,
  GW_BUDGET_SOURCES,
  GW_RAISE_MAX,
  GW_TAX_MAX,
  GW_TAX_MIN,
  GwBudgetItem,
  GwBudgetPlan,
  GwBudgetView,
} from "@openfront/engine-api/ww1914/GwBudget";
import {
  budgetVote,
  budgetYear,
  GW_BUDGET_BODIES,
  GwBudgetVote,
  GwBudgetYear,
  interestOf,
  loadOf,
} from "@openfront/engine-lib/ww1914/BudgetRules";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { BTN, BTN_ON, CHIP, GLASS, HEAD, MUTED } from "./GwStyle";
import { fullDate, personName, textOrNull } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const STEP =
  "rounded border border-white/25 bg-white/10 px-1.5 text-xs hover:bg-white/20 disabled:opacity-30";
/** How many reason lines each number shows. */
const NOTES_SHOWN = 3;

const unit = (tag: string) =>
  textOrNull(`gw.budget.unit.${tag}`) ?? translateText("gw.budget.unit.other");

/** Whole millions as a Korean sum: 1559 is 15억 6천만, 66 is 6,600만. */
export function moneyText(tag: string, millions: number): string {
  const v = Math.abs(millions);
  if (v === 0) return `0 ${unit(tag)}`;
  const sign = millions < 0 ? "-" : "";
  const eok = Math.floor(v / 100);
  const rest = Math.round((v % 100) / 10);
  const head =
    eok === 0
      ? `${(v * 100).toLocaleString("en-US")}만`
      : rest === 0
        ? `${eok.toLocaleString("en-US")}억`
        : rest === 10
          ? `${(eok + 1).toLocaleString("en-US")}억`
          : `${eok.toLocaleString("en-US")}억 ${rest}천만`;
  return `${sign}${head} ${unit(tag)}`;
}

/** Per mille as the player reads it, June 1914 being 100. */
export const pricesText = (prices: number) => Math.round(prices / 10);

/** Points a year as gauge steps with a sign: 120 is +1.2. */
export function stepsText(points: number): string {
  const v = Math.round(Math.abs(points) / 10) / 10;
  return `${points < 0 ? "-" : "+"}${v.toFixed(1)}`;
}

/** The plan on the screen: what is being changed, else the draft, else what runs. */
export function planOf(c: GwCtx): GwBudgetPlan {
  const v = c.seat.world.budget;
  return c.ui.budgetPlan ?? v.draft ?? v.plan;
}

export function voteOf(c: GwCtx, plan: GwBudgetPlan): GwBudgetVote {
  const v = c.seat.world.budget;
  const body = GW_BUDGET_BODIES[c.seat.world.war.regime] ?? null;
  return budgetVote(body, c.seat.inst, v.basis, plan);
}

export const sharesLeft = (plan: GwBudgetPlan) =>
  100 - plan.shares.reduce((a, x) => a + x, 0);

function lineName(tag: string, i: number): string {
  const line = GW_BUDGET_LINES[i];
  if (line !== "national") return translateText(`gw.budget.line.${line}`);
  return (
    textOrNull(`gw.budget.national.${tag}`) ??
    translateText("gw.budget.national.other")
  );
}

function change(c: GwCtx, plan: GwBudgetPlan, edit: (p: GwBudgetPlan) => void) {
  const next = { shares: [...plan.shares], mix: [...plan.mix] };
  edit(next);
  c.ui.budgetPlan = next;
  c.redraw();
}

function steps(
  c: GwCtx,
  plan: GwBudgetPlan,
  attr: string,
  value: number,
  lo: number,
  hi: number,
  set: (p: GwBudgetPlan, v: number) => void,
  live: boolean,
): TemplateResult | typeof nothing {
  if (!live) return nothing;
  const btn = (d: number) =>
    html`<button
      class=${STEP}
      data-gw-step=${`${attr}:${d}`}
      ?disabled=${value + d < lo || value + d > hi}
      @click=${() => change(c, plan, (p) => set(p, value + d))}
    >
      ${d > 0 ? `+${d}` : d}
    </button>`;
  return html`<span class="flex gap-0.5">
    ${btn(-5)}${btn(-1)}${btn(1)}${btn(5)}
  </span>`;
}

function row(
  name: string,
  now: number,
  proposed: number,
  control: TemplateResult | typeof nothing,
  attr: string,
): TemplateResult {
  const moved = proposed !== now;
  return html`<div
    class="flex items-center gap-2 text-sm"
    data-gw-budget-row=${attr}
  >
    <span class="min-w-0 flex-1 truncate text-white/75" title=${name}
      >${name}</span
    >
    <span class="w-8 text-right text-white/55">${now}</span>
    <span class="w-8 text-right font-bold ${moved ? "text-amber-200" : ""}"
      >${proposed}</span
    >
    ${control}
  </div>`;
}

function heads(): TemplateResult {
  return html`<div class="flex gap-2 ${MUTED}">
    <span class="flex-1"></span>
    <span class="w-8 text-right">${translateText("gw.budget.now")}</span>
    <span class="w-8 text-right">${translateText("gw.budget.proposed")}</span>
  </div>`;
}

function spending(
  c: GwCtx,
  v: GwBudgetView,
  plan: GwBudgetPlan,
  live: boolean,
): TemplateResult {
  const tag = c.seat.tag;
  const left = sharesLeft(plan);
  return html`<section class=${BOX} data-gw-budget-spending>
    <h3 class=${HEAD}>${translateText("gw.budget.spending")}</h3>
    ${heads()}
    ${GW_BUDGET_LINES.map((l, i) =>
      row(
        lineName(tag, i),
        v.plan.shares[i],
        plan.shares[i],
        steps(
          c,
          plan,
          l,
          plan.shares[i],
          0,
          100,
          (p, x) => (p.shares[i] = x),
          live,
        ),
        l,
      ),
    )}
    ${left === 0
      ? nothing
      : html`<p class="text-sm text-amber-200" data-gw-budget-left>
          ${translateText("gw.budget.left", { n: left })}
        </p>`}
  </section>`;
}

function sourceNote(
  c: GwCtx,
  v: GwBudgetView,
  i: number,
  plan: GwBudgetPlan,
  y: GwBudgetYear,
): TemplateResult | typeof nothing {
  const tag = c.seat.tag;
  const source = GW_BUDGET_SOURCES[i];
  if (source === "bonds") {
    return html`<p class=${MUTED}>
      ${translateText("gw.budget.bonds_note", { n: y.appetite })}
    </p>`;
  }
  if (source === "taxes") {
    const pts = stepsText(100 - plan.mix[0]);
    return html`<p class=${MUTED}>
      ${translateText("gw.budget.tax_note", { pts })}
    </p>`;
  }
  if (source === "print") {
    return html`<p class=${MUTED}>
      ${translateText("gw.budget.print_note", {
        n: `+${pricesText(y.prices - v.basis.prices)}`,
      })}
    </p>`;
  }
  if (v.lenders.length === 0) {
    return html`<p class=${MUTED}>${translateText("gw.budget.no_lender")}</p>`;
  }
  return html`${v.lenders.map(
    (l) =>
      html`<p class=${MUTED} data-gw-lender=${l.id}>
        ${translateText(
          l.open ? "gw.budget.lender_line" : "gw.budget.lender_shut",
          {
            name: translateText(`gw.budget.lender.${l.id}`),
            cap: l.cap,
            owed: moneyText(tag, l.owed),
          },
        )}
      </p>`,
  )}`;
}

function revenue(
  c: GwCtx,
  v: GwBudgetView,
  plan: GwBudgetPlan,
  y: GwBudgetYear,
  live: boolean,
): TemplateResult {
  return html`<section class=${BOX} data-gw-budget-revenue>
    <h3 class=${HEAD}>${translateText("gw.budget.revenue")}</h3>
    ${heads()}
    ${GW_BUDGET_SOURCES.map((s, i) => {
      const lo = i === 0 ? GW_TAX_MIN : 0;
      const hi = i === 0 ? GW_TAX_MAX : GW_RAISE_MAX;
      return html`${row(
        translateText(`gw.budget.source.${s}`),
        v.plan.mix[i],
        plan.mix[i],
        steps(c, plan, s, plan.mix[i], lo, hi, (p, x) => (p.mix[i] = x), live),
        s,
      )}${sourceNote(c, v, i, plan, y)}`;
    })}
  </section>`;
}

function itemValue(tag: string, v: GwBudgetView, item: GwBudgetItem): string {
  if (item === "prices") {
    return translateText("gw.budget.prices_value", {
      n: pricesText(v.basis.prices),
    });
  }
  return moneyText(tag, v.basis[item]);
}

function noteLines(tag: string, v: GwBudgetView, item: GwBudgetItem) {
  return [...v.notes]
    .filter((n) => n.item === item)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, NOTES_SHOWN)
    .map((n) => {
      const sum =
        item === "prices"
          ? `${n.delta > 0 ? "+" : ""}${pricesText(n.delta)}`
          : moneyText(tag, n.delta);
      return html`<p class=${MUTED} data-gw-budget-note=${n.key}>
        ${n.delta > 0 ? "▲" : "▼"} ${translateText(`gw.budget.note.${n.key}`)}
        ${sum}
      </p>`;
    });
}

/** Treasury, debt, prices, next year's interest: each with why it stands there. */
function numbers(c: GwCtx, v: GwBudgetView): TemplateResult {
  const tag = c.seat.tag;
  return html`<section class=${BOX} data-gw-budget-state>
    <h3 class=${HEAD}>${translateText("gw.budget.state")}</h3>
    ${GW_BUDGET_ITEMS.map(
      (item) =>
        html`<div data-gw-budget-item=${item}>
          <div class="flex justify-between text-sm">
            <span class="text-white/70"
              >${translateText(`gw.budget.item.${item}`)}</span
            >
            <span>${itemValue(tag, v, item)}</span>
          </div>
          ${noteLines(tag, v, item)}
        </div>`,
    )}
    <div class="flex justify-between text-sm" data-gw-budget-interest>
      <span class="text-white/70"
        >${translateText("gw.budget.interest_next")}</span
      >
      <span>${moneyText(tag, interestOf(v.basis))}</span>
    </div>
    <p class=${MUTED}>
      ${translateText("gw.budget.load", { n: loadOf(v.basis) })}
    </p>
  </section>`;
}

function line(name: string, value: string): TemplateResult {
  return html`<div class="flex justify-between text-sm">
    <span class="text-white/70">${translateText(name)}</span>
    <span>${value}</span>
  </div>`;
}

function driftWord(points: number): string {
  if (points >= 50) return translateText("gw.budget.rises");
  if (points <= -50) return translateText("gw.budget.falls");
  return translateText("gw.budget.holds");
}

/** The expected year, in numbers and in words, before anyone signs. */
function forecast(c: GwCtx, y: GwBudgetYear): TemplateResult {
  const tag = c.seat.tag;
  const income = y.taxes + y.bonds + y.loans + y.print;
  return html`<section class=${BOX} data-gw-budget-forecast>
    <h3 class=${HEAD}>${translateText("gw.budget.forecast")}</h3>
    ${line("gw.budget.outlay", moneyText(tag, y.outlay + y.interest))}
    ${line("gw.budget.income", moneyText(tag, income))}
    ${line("gw.budget.balance", moneyText(tag, y.balance))}
    ${line("gw.budget.treasury_end", moneyText(tag, y.treasury))}
    ${line("gw.budget.debt_end", moneyText(tag, y.debt))}
    ${line("gw.budget.prices_end", String(pricesText(y.prices)))}
    ${y.shortfall === 0
      ? nothing
      : html`<p class="text-sm text-amber-200" data-gw-budget-shortfall>
          ${translateText("gw.budget.printed_more", {
            sum: moneyText(tag, y.shortfall),
          })}
        </p>`}
    <div class=${MUTED}>${translateText("gw.budget.effects")}</div>
    <div class="flex flex-wrap gap-1" data-gw-budget-effects>
      ${GW_BUDGET_DRIFTS.map(
        (d) =>
          html`<span class=${CHIP} data-gw-drift=${d}
            >${translateText(`gw.budget.drift.${d}`)} ${stepsText(y.drift[d])}
            ${driftWord(y.drift[d])}</span
          >`,
      )}
    </div>
  </section>`;
}

function bodyLines(
  v: GwBudgetView,
  vote: GwBudgetVote,
): TemplateResult | typeof nothing {
  const b = v.body;
  if (b === null) {
    return html`<p class=${MUTED}>${translateText("gw.budget.nobody")}</p>`;
  }
  const lineOf = (inst: string, score: number, need: number) =>
    html`<p class="text-sm text-white/85" data-gw-budget-body=${inst}>
      ${translateText("gw.budget.body_line", {
        body: translateText(`gw.ui.inst_name.${inst}`),
        score,
        need,
      })}
    </p>`;
  return html`${lineOf(b.inst, vote.score, b.need)}
    ${b.second === null
      ? nothing
      : lineOf(b.second, vote.secondScore, b.secondNeed)}
    ${vote.why.map(
      (w) =>
        html`<p class=${MUTED}>${translateText(`gw.budget.vote.${w}`)}</p>`,
    )}
    <p
      class="text-sm font-bold ${vote.pass
        ? "text-emerald-300"
        : "text-red-300"}"
      data-gw-budget-pass=${vote.pass ? "yes" : "no"}
    >
      ${translateText(vote.pass ? "gw.budget.pass_yes" : "gw.budget.pass_no")}
    </p>`;
}

function send(c: GwCtx, plan: GwBudgetPlan, force: boolean, close: boolean) {
  c.send({ kind: "budget", shares: plan.shares, mix: plan.mix, force });
  if (close) {
    c.ui.budgetOpen = false;
    c.ui.budgetPlan = null;
  }
  c.redraw();
}

function actions(
  c: GwCtx,
  v: GwBudgetView,
  plan: GwBudgetPlan,
  vote: GwBudgetVote,
): TemplateResult {
  const ok = sharesLeft(plan) === 0;
  const b = v.body;
  const alone = b?.kind === "alone" && !vote.pass;
  const main = alone
    ? translateText("gw.budget.alone", { n: b.forcePrice })
    : translateText(b === null ? "gw.budget.sign" : "gw.budget.submit");
  return html`<div class="space-y-1.5">
    ${v.refused
      ? html`<p class="text-sm text-amber-200" data-gw-budget-refused>
          ${translateText("gw.budget.refused_now")}
        </p>`
      : html`<p class=${MUTED}>${translateText("gw.budget.unsigned")}</p>`}
    <button
      class="w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-2 text-center text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-40"
      data-gw-budget-sign
      ?disabled=${!ok}
      @click=${() => send(c, plan, false, vote.pass || alone)}
    >
      ${main}
    </button>
    ${b === null || vote.pass || alone
      ? nothing
      : html`<button
          class="${BTN} w-full text-center"
          data-gw-budget-force
          ?disabled=${!ok || v.authority < b.forcePrice}
          @click=${() => send(c, plan, true, true)}
        >
          ${translateText("gw.budget.force", { n: b.forcePrice })}
        </button>`}
    ${v.draft === null
      ? nothing
      : html`<button
          class="${BTN} w-full text-center"
          data-gw-budget-reset
          @click=${() => {
            c.ui.budgetPlan = null;
            c.redraw();
          }}
        >
          ${translateText("gw.budget.reset")}
        </button>`}
  </div>`;
}

function status(c: GwCtx, v: GwBudgetView): TemplateResult {
  return html`<div class="flex flex-wrap items-center gap-1.5">
    <span class=${CHIP} data-gw-budget-how=${v.last}
      >${translateText(`gw.budget.how.${v.last}`)}</span
    >
    ${v.holder === null
      ? nothing
      : html`<span class=${MUTED}
          >${translateText("gw.budget.holder", {
            name: personName(c.pack, v.holder),
          })}</span
        >`}
  </div>`;
}

/** The ledger: spending, revenue, what they make of the year, who must pass it. */
export function budgetPanel(c: GwCtx): TemplateResult {
  const v = c.seat.world.budget;
  const plan = planOf(c);
  const live = v.meeting;
  const y = budgetYear(v.basis, plan);
  const vote = voteOf(c, plan);
  const close = () => {
    c.ui.budgetOpen = false;
    c.redraw();
  };
  return html`<div
    class="pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-3"
    @click=${(e: Event) => e.target === e.currentTarget && close()}
  >
    <article
      data-gw-budget
      class="${GLASS} max-h-[92vh] w-full max-w-[920px] space-y-2.5 overflow-y-auto rounded-md p-4 text-white shadow-2xl"
    >
      <header class="flex items-center gap-2">
        <h2 class="text-lg font-bold">${translateText("gw.budget.title")}</h2>
        ${status(c, v)}
        <span class="${MUTED} ml-auto">${fullDate(c.data.date)}</span>
        <button
          class="${MUTED} px-1 hover:text-white"
          data-gw-budget-close
          title=${translateText("gw.budget.close")}
          @click=${close}
        >
          ✕
        </button>
      </header>
      <div class="grid gap-2.5 md:grid-cols-2">
        <div class="space-y-2.5">
          ${spending(c, v, plan, live)} ${revenue(c, v, plan, y, live)}
        </div>
        <div class="space-y-2.5">
          ${numbers(c, v)} ${forecast(c, y)}
          <section class=${BOX} data-gw-budget-vote>
            ${bodyLines(v, vote)}
            ${live
              ? actions(c, v, plan, vote)
              : html`<p class=${MUTED} data-gw-budget-next>
                  ${v.next === null
                    ? translateText("gw.budget.no_more")
                    : translateText("gw.budget.no_meeting", {
                        date: fullDate(v.next),
                      })}
                </p>`}
          </section>
        </div>
      </div>
    </article>
  </div>`;
}

export function openLedger(c: GwCtx) {
  c.ui.budgetOpen = true;
  c.ui.readerUid = null;
  c.ui.armed = null;
  c.redraw();
}

/** What the meeting's card adds to the reader: the draft against what runs. */
export function budgetStrip(c: GwCtx): TemplateResult {
  const v = c.seat.world.budget;
  const plan = v.draft ?? v.plan;
  const vote = voteOf(c, plan);
  return html`<div class="${BOX}" data-gw-budget-strip>
    <div class="flex flex-wrap gap-1">
      ${GW_BUDGET_LINES.map(
        (_, i) =>
          html`<span class=${CHIP}
            >${lineName(c.seat.tag, i)} ${v.plan.shares[i]} →
            ${plan.shares[i]}</span
          >`,
      )}
    </div>
    ${bodyLines(v, vote)}
  </div>`;
}

/** The country tab's way in: the numbers and the ledger's button. */
export function budgetSummary(c: GwCtx): TemplateResult {
  const v = c.seat.world.budget;
  return html`<section class=${BOX} data-gw-budget-summary>
    <h3 class=${HEAD}>${translateText("gw.budget.title")}</h3>
    ${GW_BUDGET_ITEMS.map(
      (item) =>
        html`<div class="flex justify-between text-sm">
          <span class="text-white/70"
            >${translateText(`gw.budget.item.${item}`)}</span
          >
          <span>${itemValue(c.seat.tag, v, item)}</span>
        </div>`,
    )}
    <button
      class="${v.meeting ? BTN_ON : BTN} w-full text-center"
      data-gw-budget-open
      @click=${() => openLedger(c)}
    >
      ${translateText("gw.budget.open")}
    </button>
  </section>`;
}
