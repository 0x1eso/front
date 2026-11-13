// Great War 1914 (ww209/ww210): bargaining on the screens. Under a summoned
// leader's prices: deadlines on a promise, 빚으로 남긴다, and 내가 내놓는다 (a
// counter-offer, his answer after); the press menu's threats; a faction's
// wing met apart; the notebook's 약속과 빚 box; earmark names. Words only: no
// result shows before the pick.
import type { GwBudgetLine } from "@openfront/engine-api/ww1914/GwBudget";
import type {
  GwCounterKind,
  GwDealTerm,
  GwDealView,
} from "@openfront/engine-api/ww1914/GwDeals";
import type {
  GwAgendaView,
  GwLobbyView,
} from "@openfront/engine-api/ww1914/GwLaw";
import { GW_MONEY } from "@openfront/engine-lib/ww1914/content/money/index";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { billName } from "./GwBook";
import type { GwBookDraft, GwCtx } from "./GwCtx";
import { factionName } from "./GwHouse";
import {
  budgetLineName,
  counterAnswerLine,
  counterWord,
  dealDueWord,
  dealFateWord,
  dealKindWord,
  dealTermWord,
  earmarkName,
  leaderLine,
  threatWord,
  wingLine,
} from "./GwMoneyWords";
import { officeTitle } from "./GwOffice";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { personName } from "./GwText";

const SMALL = "!px-2 !py-1 max-sm:min-h-10";
const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

/** An earmark's name: its pack words, else whose it is and from which line. */
export function markName(
  c: GwCtx,
  id: string,
  line: GwBudgetLine,
  faction: string | null,
  community: string | null,
): string {
  const own = c.pack?.money?.mark?.[id]?.name;
  if (own !== undefined) return own;
  const who =
    community !== null
      ? (c.pack?.communities?.[community]?.name ?? community)
      : faction !== null
        ? factionName(c, faction)
        : null;
  if (who === null) return earmarkName(c.pack, c.seat.tag, { id, line });
  return translateText("gw.budget.mark_of", {
    who,
    line: budgetLineName(c.seat.tag, line),
  });
}

function draftOf(c: GwCtx): GwBookDraft {
  c.ui.book ??= {
    open: [],
    agenda: null,
    press: null,
    armed: null,
    sponsor: null,
  };
  return c.ui.book;
}

// ---- Under a price: 기한, 빚으로 남긴다 ----

/** A promise price's deadlines, and paying a price now as a favour owed. */
export function pricePlus(
  c: GwCtx,
  g: GwAgendaView,
  l: GwLobbyView,
  p: NonNullable<GwLobbyView["prices"]>[number],
): TemplateResult | typeof nothing {
  const terms = p.terms ?? [];
  const favour = l.favour?.can === true;
  if (terms.length === 0 && !favour) return nothing;
  const term = (t: GwDealTerm) =>
    html`<button
      class="${BTN} ${SMALL}"
      data-gw-price-term=${t}
      @click=${() => {
        c.send({
          kind: "bill_term",
          law: g.law,
          faction: l.faction,
          want: p.id,
          term: t,
        });
        c.redraw();
      }}
    >
      ${dealTermWord(t)}
    </button>`;
  return html`<div
    class="flex flex-wrap items-center justify-end gap-1"
    data-gw-price-plus=${p.id}
  >
    ${terms.length === 0
      ? nothing
      : html`<span class=${MUTED} data-gw-price-terms=${p.id}
            >${translateText("gw.lobby.term_label")}</span
          >${terms.map(term)}`}
    ${favour
      ? html`<button
          class="${BTN} ${SMALL}"
          data-gw-price-favour=${p.id}
          @click=${() => {
            c.send({
              kind: "bill_favour",
              law: g.law,
              faction: l.faction,
              want: p.id,
              call: false,
            });
            c.redraw();
          }}
        >
          ${translateText("gw.lobby.favour_owe")}
        </button>`
      : nothing}
  </div>`;
}

// ---- 내가 내놓는다 ----

interface Pick {
  id: string;
  name: string;
}

/** What a counter of this kind can name, or null when it names nothing. */
function picksOf(
  c: GwCtx,
  g: GwAgendaView,
  l: GwLobbyView,
  kind: GwCounterKind,
): Pick[] | null {
  if (kind === "region") {
    return GW_MONEY.earmarks
      .filter(
        (m) =>
          m.tag === c.seat.tag &&
          (m.faction === undefined || m.faction === l.faction),
      )
      .map((m) => ({
        id: m.id,
        name: markName(c, m.id, m.line, m.faction ?? null, m.community ?? null),
      }));
  }
  if (kind === "against") {
    // A rival's bill on the agenda: one another faction brought.
    return (c.seat.world.book?.agenda ?? [])
      .filter((x) => x.law !== g.law && x.by !== null && x.by !== l.faction)
      .map((x) => ({
        id: x.law,
        name: billName(c, x.law),
      }));
  }
  if (kind === "post") {
    const offices = new Set<string>();
    for (const p of c.seat.people) if (p.office !== null) offices.add(p.office);
    return [...offices].map((o) => ({
      id: o,
      name: officeTitle(c.seat.tag, o),
    }));
  }
  return null;
}

function sendCounter(
  c: GwCtx,
  g: GwAgendaView,
  l: GwLobbyView,
  counter: GwCounterKind,
  pick: string | null,
) {
  draftOf(c).counter = null;
  c.send({
    kind: "bill_counter",
    law: g.law,
    faction: l.faction,
    counter,
    pick,
  });
  c.redraw();
}

/** His answer to the seat's counter, once made, and his words on it. */
function counterAnswer(
  c: GwCtx,
  l: GwLobbyView,
): TemplateResult | typeof nothing {
  const a = l.counter ?? null;
  if (a === null) return nothing;
  const kind =
    a.more === null
      ? null
      : ((l.prices ?? []).find((p) => p.id === a.more)?.kind ?? null);
  const more = kind === null ? null : translateText(`gw.lobby.price.${kind}`);
  return html`<div class="space-y-0.5" data-gw-counter-answer=${a.answer}>
    <p class="text-sm text-white/85">
      <span class=${CHIP}>${counterWord(a.kind)}</span>
      ${counterAnswerLine(a.answer, more)}
    </p>
    <p class="${MUTED} italic">
      “${leaderLine(c.pack, l.faction, `counter_${a.answer}`)}”
    </p>
  </div>`;
}

/** 내가 내놓는다: the counter kinds he will hear now, then what it names. */
export function lobbyExtras(
  c: GwCtx,
  g: GwAgendaView,
  l: GwLobbyView,
): TemplateResult | typeof nothing {
  const kinds = l.counters ?? [];
  const answer = counterAnswer(c, l);
  if (kinds.length === 0) return answer;
  const d = draftOf(c);
  const open = (d.counter ?? "").startsWith(`${g.law}:${l.faction}:`)
    ? (d.counter!.split(":")[2] as GwCounterKind)
    : null;
  const picks = open === null ? null : picksOf(c, g, l, open);
  return html`${answer}
    <div class="space-y-1" data-gw-counters=${l.faction}>
      <p class="text-xs font-bold text-amber-200">
        ${translateText("gw.lobby.counter_label")}
      </p>
      <div class="flex flex-wrap gap-1">
        ${kinds.map(
          (k) =>
            html`<button
              class="${open === k ? BTN_ON : BTN} ${SMALL}"
              data-gw-counter=${k}
              @click=${() => {
                const list = picksOf(c, g, l, k);
                if (list === null || list.length === 0) {
                  sendCounter(c, g, l, k, null);
                  return;
                }
                d.counter = open === k ? null : `${g.law}:${l.faction}:${k}`;
                c.redraw();
              }}
            >
              ${counterWord(k)}
            </button>`,
        )}
      </div>
      ${open === null || picks === null || picks.length === 0
        ? nothing
        : html`<div class="flex flex-wrap gap-1 pl-2" data-gw-counter-picks>
            ${picks.map(
              (p) =>
                html`<button
                  class="${BTN} ${SMALL}"
                  data-gw-counter-pick=${p.id}
                  @click=${() => sendCounter(c, g, l, open, p.id)}
                >
                  ${p.name}
                </button>`,
            )}
          </div>`}
    </div>`;
}

// ---- 위협한다 ----

/** The press menu's threats: what the seat will do if his faction votes against. */
export function threatButtons(
  c: GwCtx,
  g: GwAgendaView,
  l: GwLobbyView,
  done: () => void,
): TemplateResult | typeof nothing {
  const threats = l.threats ?? [];
  if (threats.length === 0) return nothing;
  return html`<p class="${MUTED} w-full" data-gw-threat-label>
      ${translateText("gw.lobby.threat_label")}
    </p>
    ${threats.map(
      (threat) =>
        html`<button
          class="${BTN} ${SMALL}"
          data-gw-lobby-threat=${threat}
          @click=${() => {
            done();
            c.send({
              kind: "bill_threat",
              law: g.law,
              faction: l.faction,
              threat,
            });
            c.redraw();
          }}
        >
          ${threatWord(threat)}
        </button>`,
    )}`;
}

// ---- 온건파를 따로 만난다 ----

/** A faction's wing under its lobby line: its man, met apart, his prices. */
export function wingRow(
  c: GwCtx,
  g: GwAgendaView,
  l: GwLobbyView,
): TemplateResult | typeof nothing {
  const w = l.wing ?? null;
  if (w === null) return nothing;
  const peel = (want: string | null) => {
    c.send({ kind: "bill_peel", law: g.law, faction: l.faction, want });
    if (want === null) c.ui.summoned = Date.now();
    c.redraw();
  };
  return html`<div
    class="space-y-1 border-l border-amber-300/30 pl-2"
    data-gw-wing=${l.faction}
  >
    <div class="flex items-start gap-2">
      <p class="min-w-0 flex-1 text-sm text-white/85">
        ${translateText("gw.lobby.wing", {
          name: personName(c.pack, w.person),
          n: w.seats,
        })}
        ${w.peeled
          ? html`<span class=${CHIP} data-gw-wing-peeled
              >${translateText("gw.lobby.wing_peeled")}</span
            >`
          : nothing}
      </p>
      ${w.call
        ? html`<button
            class="${BTN} ${SMALL} shrink-0"
            data-gw-wing-call=${l.faction}
            @click=${() => peel(null)}
          >
            ${translateText("gw.lobby.wing_meet")}
          </button>`
        : nothing}
    </div>
    ${w.prices === null
      ? nothing
      : html`<p class="${MUTED} italic" data-gw-wing-says>
          “${wingLine(c.pack, l.faction, w.peeled ? "take" : "hello")}”
        </p>`}
    ${w.prices === null || w.peeled
      ? nothing
      : w.prices.length === 0
        ? html`<p class="${MUTED} italic">
            ${translateText("gw.lobby.no_price")}
          </p>`
        : w.prices.map(
            (p) =>
              html`<div
                class="flex items-center gap-2"
                data-gw-wing-price=${p.id}
              >
                <span class="${CHIP} min-w-0 flex-1 truncate"
                  >${translateText(`gw.lobby.price.${p.kind}`)}</span
                >
                <button
                  class="${BTN} ${SMALL} shrink-0"
                  data-gw-wing-take=${p.id}
                  @click=${() => peel(p.id)}
                >
                  ${translateText("gw.lobby.take")}
                </button>
              </div>`,
          )}
  </div>`;
}

// ---- The notebook: 약속과 빚 ----

function dueText(c: GwCtx, d: GwDealView): string | null {
  if (d.fate !== "open") return null;
  return dealDueWord(d.due, c.data.chapter);
}

function dealLine(c: GwCtx, d: GwDealView): string {
  const who =
    d.person === null
      ? factionName(c, d.faction)
      : `${personName(c.pack, d.person)} (${factionName(c, d.faction)})`;
  const law = d.law === null ? null : billName(c, d.law);
  const what =
    d.kind === "threat" && d.threat !== null
      ? threatWord(d.threat)
      : dealKindWord(d.kind);
  return [who, what, law].filter((x) => x !== null).join(" · ");
}

/** Which of the box's three groups a row sits in. */
function groupOf(d: GwDealView): "mine" | "theirs" | "threats" {
  if (d.kind === "owe") return "theirs";
  if (d.kind === "threat") return "threats";
  return "mine";
}

/**
 * 약속과 빚: what the seat owes (favours, votes, wings met), what is owed to
 * it, and the threats it made; newest first. Absent until there is a row.
 */
export function dealsBox(c: GwCtx): TemplateResult | typeof nothing {
  const rows = c.seat.world.dossier?.deals ?? [];
  if (rows.length === 0) return nothing;
  const groups = ["mine", "theirs", "threats"] as const;
  return html`<section class=${BOX} data-gw-notebook-deals>
    <h3 class=${HEAD}>${translateText("gw.ui.notebook_deals")}</h3>
    ${groups.map((gr) => {
      const list = rows.filter((d) => groupOf(d) === gr);
      if (list.length === 0) return nothing;
      return html`<div class=${MUTED}>
          ${translateText(`gw.ui.notebook_deals_${gr}`)}
        </div>
        ${list.map((d) => {
          const due = dueText(c, d);
          return html`<div class="space-y-0.5" data-gw-deal=${d.uid}>
            <div class="flex items-center gap-1.5">
              <span class="min-w-0 flex-1 text-sm text-white/85"
                >${dealLine(c, d)}</span
              >
              <span class="${CHIP} shrink-0" data-gw-deal-fate=${d.fate}
                >${dealFateWord(d.fate)}</span
              >
            </div>
            ${due === null ? nothing : html`<p class=${MUTED}>${due}</p>`}
          </div>`;
        })}`;
    })}
  </section>`;
}
