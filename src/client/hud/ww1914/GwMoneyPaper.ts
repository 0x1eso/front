// Great War 1914 (ww214): one paper for a money bill. The budget's meeting
// card, the credits' paper, or a bill come back after a lost vote is where
// it is decided: the plan, the count office's word on each faction, the
// lobby and the call, all on the paper that arrived. The 통치 tab's pinned
// row only says it waits and opens the same paper. Words only: no odds, no
// price before the pick.
import type { GwAgendaView } from "@openfront/engine-api/ww1914/GwLaw";
import type { GwCardView } from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { billName, draftOf, lobbyLine, paperLine, twice } from "./GwBook";
import { budgetStrip, planOf } from "./GwBudget";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import {
  creditsByLine,
  moneyDueLine,
  moneyFailLine,
  pinnedRow,
} from "./GwMoneyWords";
import { BTN, BTN_ON, CHIP, GLASS, HEAD, MUTED } from "./GwStyle";
import { fillGw, fullDate, optionMarked, optionSplit } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const GO =
  "w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-2 text-center text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-40";

/** The plan option armed on the meeting's card; its fallback when none is. */
function armedOf(c: GwCtx, card: GwCardView | null): string | null {
  if (card === null) return null;
  const armed = c.ui.armed?.uid === card.uid ? c.ui.armed.option : null;
  if (armed !== null) return armed;
  return (
    card.options.find((o) => o.id === "draft" || o.id === "keep")?.id ??
    card.options[0]?.id ??
    null
  );
}

/** The versions of the year's plan the meeting's card offers (not the ledger). */
function versions(c: GwCtx, card: GwCardView): TemplateResult | typeof nothing {
  const rows = card.options.filter(
    (o) => o.screen !== "budget" && o.id !== "keep",
  );
  if (rows.length < 2) return nothing;
  const armed = armedOf(c, card);
  const fill = (id: string) =>
    fillGw(optionMarked(c.pack, card, id), c.pack, card, c.seat, c.data.date);
  return html`<div class="space-y-1" data-gw-money-versions>
    <div class=${MUTED}>${translateText("gw.money.paper.versions")}</div>
    ${rows.map((o) => {
      const why = o.open ? undefined : c.pack?.scenes[card.scene]?.why?.[o.id];
      return html`<button
          class="${armed === o.id ? BTN_ON : BTN} w-full text-left"
          data-gw-money-version=${o.id}
          ?disabled=${!o.open}
          @click=${() => {
            c.ui.armed = { uid: card.uid, option: o.id };
            c.redraw();
          }}
        >
          <b>${rich(c, optionSplit(fill(o.id)).lead)}</b>
        </button>
        ${why === undefined
          ? nothing
          : html`<p class="${MUTED} pl-1" data-gw-why>
              ${rich(c, fillGw(why, c.pack, card, c.seat, c.data.date))}
            </p>`}`;
    })}
  </div>`;
}

function planBox(
  c: GwCtx,
  g: GwAgendaView,
  card: GwCardView | null,
): TemplateResult {
  const kind = g.money?.kind ?? "budget";
  const fail = g.money?.fail ?? "runs_on";
  const by = c.seat.world.budget?.credits?.by ?? null;
  return html`<section class=${BOX} data-gw-money-plan=${kind}>
    <h4 class=${HEAD}>${translateText("gw.money.paper.plan")}</h4>
    ${kind === "budget"
      ? budgetStrip(c)
      : by === null
        ? nothing
        : html`<p class=${MUTED} data-gw-credits-by=${by}>
            ${creditsByLine(by)}
          </p>`}
    ${card === null ? nothing : versions(c, card)}
    <p class="text-sm text-amber-100/90" data-gw-agenda-money-fail>
      ${moneyFailLine(fail, kind, by)}
    </p>
  </section>`;
}

function countBox(c: GwCtx, g: GwAgendaView): TemplateResult {
  return html`<section class=${BOX} data-gw-money-count>
    <h4 class=${HEAD}>${translateText("gw.money.paper.count")}</h4>
    ${paperLine(c, g)}
  </section>`;
}

function lobbyBox(c: GwCtx, g: GwAgendaView): TemplateResult | typeof nothing {
  if (g.lobby.length === 0) return nothing;
  const free = c.seat.world.book?.calls ?? 0;
  const d = draftOf(c);
  return html`<section class=${BOX} data-gw-money-lobby>
    <h4 class=${HEAD}>${translateText("gw.lobby.title")}</h4>
    <p class=${MUTED}>${translateText("gw.lobby.hint")}</p>
    <p class=${MUTED} data-gw-agenda-calls>
      ${free > 0
        ? translateText("gw.lobby.calls", { n: free })
        : translateText("gw.lobby.calls_none")}
    </p>
    ${g.lobby.map((l) => lobbyLine(c, g, l, free, d))}
  </section>`;
}

/**
 * The paper's choices. Each from the card first takes its pick (the plan
 * version armed, or `keep`): the card is decided, then the order follows.
 */
function choicesBox(
  c: GwCtx,
  g: GwAgendaView,
  card: GwCardView | null,
  close: () => void,
): TemplateResult {
  const kind = g.money?.kind ?? "budget";
  const name = billName(c, g.law);
  const v = c.seat.world.budget;
  const body = v.body;
  const take = (word: string) => {
    if (card === null) return;
    const option = armedOf(c, card);
    if (option === null) return;
    c.ui.notes.push({
      chapter: c.data.chapter,
      title: name,
      pick: word,
      rest: "",
      tell: [],
    });
    c.send({ kind: "choose", card: card.uid, option });
  };
  const go = (word: string, after: () => void) => {
    take(word);
    after();
    c.ui.armed = null;
    close();
  };
  const why =
    g.callWhy === null ? null : translateText(`gw.agenda.why.${g.callWhy}`);
  const callWord = translateText("gw.agenda.call");
  const force =
    kind === "budget" && !g.round && body !== null
      ? {
          word: translateText(
            body.kind === "alone"
              ? "gw.money.paper.alone"
              : "gw.money.paper.force",
          ),
          ok: v.authority >= body.forcePrice,
        }
      : null;
  return html`<section class=${BOX} data-gw-money-choices>
    <h4 class=${HEAD}>${translateText("gw.money.paper.choices")}</h4>
    <button
      class=${GO}
      data-gw-money-vote=${g.law}
      ?disabled=${!g.call}
      @click=${() =>
        go(callWord, () =>
          c.send({ kind: "bill_vote", law: g.law, confidence: false }),
        )}
    >
      ${callWord}
    </button>
    ${why === null
      ? nothing
      : html`<p class="${MUTED} italic" data-gw-agenda-why=${g.callWhy}>
          ${why}
        </p>`}
    ${g.confidence && g.call
      ? html`<div class="flex flex-wrap gap-1">
          ${twice(
            c,
            draftOf(c),
            `confidence:${g.law}`,
            "gw.agenda.confidence",
            "gw.agenda.confidence",
            "confidence",
            () =>
              go(translateText("gw.agenda.confidence"), () =>
                c.send({ kind: "bill_vote", law: g.law, confidence: true }),
              ),
          )}
        </div>`
      : nothing}
    ${kind === "budget"
      ? html`<button
            class="${BTN} w-full text-center"
            data-gw-money-amend
            @click=${() => {
              c.ui.budgetPlan = null;
              c.ui.budgetOpen = true;
              c.redraw();
            }}
          >
            ${translateText("gw.money.paper.amend")}
          </button>
          <p class="${MUTED} pl-1">
            ${translateText("gw.money.paper.amend_hint")}
          </p>`
      : nothing}
    ${card === null
      ? nothing
      : html`<button
          class="${BTN} w-full text-center"
          data-gw-money-hold
          @click=${() =>
            go(translateText("gw.money.paper.hold"), () => undefined)}
        >
          ${translateText("gw.money.paper.hold")}
        </button>`}
    <p class="${MUTED} pl-1" data-gw-money-due>
      ${moneyDueLine(g, c.data.chapter)}
    </p>
    ${g.round
      ? html`<button
          class="${BTN} w-full text-center"
          data-gw-money-round=${g.law}
          @click=${() =>
            go(translateText("gw.agenda.round"), () =>
              c.send({ kind: "bill_round", law: g.law }),
            )}
        >
          ${translateText("gw.agenda.round")}
        </button>`
      : nothing}
    ${force === null
      ? nothing
      : html`<button
            class="${BTN} w-full text-center"
            data-gw-money-force
            ?disabled=${!force.ok}
            @click=${() =>
              go(force.word, () => {
                const plan = planOf(c);
                c.send({
                  kind: "budget",
                  shares: plan.shares,
                  mix: plan.mix,
                  force: true,
                });
              })}
          >
            ${force.word}
          </button>
          ${force.ok
            ? nothing
            : html`<p class="${MUTED} pl-1">
                ${translateText("gw.money.paper.short")}
              </p>`}`}
  </section>`;
}

/**
 * ww214: the bill on its paper, under the card's own story: the plan (and
 * the meeting's versions of it), the count, the lobby, the choices.
 */
export function moneyPaperBody(
  c: GwCtx,
  law: string,
  card: GwCardView | null,
  close: () => void,
): TemplateResult | typeof nothing {
  const g = pinnedRow(c, law);
  if (g === null) return nothing;
  return html`<div class="space-y-2" data-gw-money-paper=${law}>
    ${planBox(c, g, card)} ${countBox(c, g)} ${lobbyBox(c, g)}
    ${choicesBox(c, g, card, close)}
  </div>`;
}

/** The paper opened from the 통치 tab with no card of it on the desk. */
export function moneyReader(c: GwCtx): TemplateResult | typeof nothing {
  const law = c.ui.moneyPaper ?? null;
  if (law === null) return nothing;
  if (pinnedRow(c, law) === null) return nothing;
  const close = () => {
    c.ui.moneyPaper = null;
    c.redraw();
  };
  return html`<div
    class="pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-black/25 p-3"
    @click=${(e: Event) => e.target === e.currentTarget && close()}
  >
    <article
      data-gw-money-reader=${law}
      class="${GLASS} max-h-[88vh] w-full max-w-[640px] space-y-3 overflow-y-auto rounded-md p-5 text-white shadow-2xl"
    >
      <header class="flex items-center gap-2">
        <span class=${CHIP}>${translateText("gw.ui.kind.ledger")}</span>
        <span class="${MUTED} ml-auto">${fullDate(c.data.date)}</span>
        <button class="${MUTED} px-1 hover:text-white" @click=${close}>
          ✕
        </button>
      </header>
      <h2 class="text-lg font-bold leading-snug">${billName(c, law)}</h2>
      ${moneyPaperBody(c, law, null, close)}
    </article>
  </div>`;
}
