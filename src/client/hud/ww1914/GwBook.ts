// Great War 1914: the 법전, the 의사일정 and 설득 in the 통치 tab's house group
// (ww203 §2, §4, §10). The book lists each chapter's articles, the bill in
// force and what can be brought; the agenda the bills before the house, the
// count paper's word and the call; the lobby each faction's seats, its word
// and whether he talks. Words only: no odds, no price before the pick.
import type { GwHouseView } from "@openfront/engine-api/ww1914/GwHouse";
import type {
  GwAgendaView,
  GwArticleView,
  GwBookChapter,
  GwBookView,
  GwLobbyView,
} from "@openfront/engine-api/ww1914/GwLaw";
import { GW_BOOK_CHAPTERS } from "@openfront/engine-api/ww1914/GwLaw";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwBookDraft, GwCtx } from "./GwCtx";
import { timeLeft } from "./GwDept";
import { factionName } from "./GwHouse";
import { officeTitle } from "./GwOffice";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { optionSplit, personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const SMALL = "!px-2 !py-1 max-sm:min-h-10";
const GO =
  "rounded border border-amber-300 bg-amber-300/90 px-3 py-1.5 text-center text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-40";

/** The article's name: its draft scene's title. */
export function billName(c: GwCtx, law: string): string {
  return c.pack?.scenes[`gw_law_${law}`]?.title ?? law;
}

/** A bill (a text of the article) by the lead of its option on the draft card. */
export function textName(c: GwCtx, law: string, text: string): string {
  const opt = c.pack?.scenes[`gw_law_${law}`]?.opt?.[text];
  return opt === undefined ? text : optionSplit(opt).lead;
}

function chapterName(ch: GwBookChapter | null): string {
  return ch === null
    ? translateText("gw.book.other")
    : translateText(`gw.book.${ch}`);
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

/** A chapter as the screens number it (the first is 1). */
const chapterNo = (chapter: number): number => chapter + 1;

// ---- The book ----

function articleState(c: GwCtx, a: GwArticleView): string {
  if (a.lockTo !== null && a.lockTo > c.data.chapter) {
    return translateText("gw.book.locked", { n: chapterNo(a.lockTo) });
  }
  if (a.stage === "open") {
    return a.force === null
      ? translateText("gw.book.open")
      : translateText("gw.law.stage.force");
  }
  if (a.stage === "shut") return translateText("gw.book.shut");
  return translateText("gw.book.moving");
}

/** Who drafts it: from the cabinet, or the usual minister. */
function sponsorPick(c: GwCtx, a: GwArticleView, d: GwBookDraft) {
  const submit = (sponsor?: string) => {
    d.sponsor = null;
    c.send(
      sponsor === undefined
        ? { kind: "bill_submit", law: a.id }
        : { kind: "bill_submit", law: a.id, sponsor },
    );
    c.ui.summoned = Date.now();
    c.redraw();
  };
  const cabinet = c.seat.people.filter((p) => p.office !== null);
  return html`<div class="space-y-1" data-gw-book-sponsors=${a.id}>
    <p class=${MUTED}>${translateText("gw.house.pick_sponsor")}</p>
    <div class="flex flex-wrap gap-1">
      <button
        class="${BTN} ${SMALL}"
        data-gw-book-sponsor=""
        @click=${() => submit()}
      >
        ${translateText("gw.house.sponsor_default")}
      </button>
      ${cabinet.map(
        (p) =>
          html`<button
            class="${BTN} ${SMALL}"
            data-gw-book-sponsor=${p.id}
            @click=${() => submit(p.id)}
          >
            ${personName(c.pack, p.id)}
          </button>`,
      )}
    </div>
  </div>`;
}

function submitButton(c: GwCtx, a: GwArticleView, d: GwBookDraft) {
  if (a.can === null) {
    return a.why === null
      ? nothing
      : html`<p class="${MUTED} italic" data-gw-book-why=${a.why}>
          ${translateText(`gw.book.why.${a.why}`)}
        </p>`;
  }
  if (d.sponsor === a.id && a.house) return sponsorPick(c, a, d);
  return html`<button
    class="${BTN} ${SMALL}"
    data-gw-book-submit=${a.id}
    @click=${() => {
      if (a.house) {
        d.sponsor = a.id;
        c.redraw();
        return;
      }
      c.send({ kind: "bill_submit", law: a.id });
      c.ui.summoned = Date.now();
    }}
  >
    ${translateText(a.can === "replace" ? "gw.book.replace" : "gw.book.submit")}
  </button>`;
}

function repealButton(c: GwCtx, a: GwArticleView) {
  const r = a.repeal;
  if (r === null) return nothing;
  const armed = c.ui.armedRepeal === a.id;
  return html`<button
    class="${armed ? BTN_ON : BTN} ${SMALL}"
    data-gw-book-repeal=${a.id}
    ?disabled=${!r.open}
    @click=${() => {
      if (!armed) {
        c.ui.armedRepeal = a.id;
        c.redraw();
        return;
      }
      c.ui.armedRepeal = null;
      c.ui.notes.push({
        chapter: c.data.chapter,
        title: billName(c, a.id),
        pick: translateText("gw.law.repeal"),
        rest: "",
        tell: r.tell,
      });
      c.send({ kind: "law", law: a.id, act: "repeal" });
    }}
  >
    ${translateText(armed ? "gw.law.repeal_sure" : "gw.law.repeal")}
  </button>`;
}

function article(c: GwCtx, a: GwArticleView, d: GwBookDraft): TemplateResult {
  const about = c.pack?.scenes[`gw_law_${a.id}`]?.topic ?? null;
  return html`<div
    class="space-y-1 border-l border-white/15 pl-2"
    data-gw-article=${a.id}
  >
    <div class="flex items-baseline justify-between gap-2 text-sm">
      <span class="font-bold">${billName(c, a.id)}</span>
      <span class="shrink-0 text-xs text-white/70">${articleState(c, a)}</span>
    </div>
    ${about === null ? nothing : html`<p class=${MUTED}>${about}</p>`}
    ${a.force === null
      ? html`<p class=${MUTED}>${translateText("gw.book.none_in_force")}</p>`
      : html`<p class="text-sm text-amber-100/90" data-gw-book-force>
          ${translateText("gw.book.in_force", {
            text: textName(c, a.id, a.force),
          })}
        </p>`}
    ${a.bills.length < 2
      ? nothing
      : html`<p class=${MUTED} data-gw-book-bills>
          ${translateText("gw.book.bills", {
            list: a.bills.map((t) => textName(c, a.id, t)).join(" / "),
          })}
        </p>`}
    <div class="flex flex-wrap items-center gap-1">
      ${submitButton(c, a, d)} ${repealButton(c, a)}
    </div>
  </div>`;
}

function chapterBlock(
  c: GwCtx,
  ch: GwBookChapter | null,
  rows: readonly GwArticleView[],
  d: GwBookDraft,
): TemplateResult {
  const key = ch ?? "other";
  const open = d.open.includes(key);
  const inForce = rows.filter((a) => a.force !== null).length;
  return html`<div class="space-y-1" data-gw-book-chapter=${key}>
    <button
      class="flex w-full items-center gap-2 text-left text-sm"
      data-gw-book-fold=${key}
      @click=${() => {
        d.open = open ? d.open.filter((x) => x !== key) : [...d.open, key];
        c.redraw();
      }}
    >
      <span class="text-white/90">${chapterName(ch)}</span>
      ${inForce === 0
        ? nothing
        : html`<span class=${CHIP}
            >${translateText("gw.law.stage.force")} ${inForce}</span
          >`}
      <span class="${MUTED} ml-auto">${open ? "▾" : "▸"}</span>
    </button>
    ${open ? rows.map((a) => article(c, a, d)) : nothing}
  </div>`;
}

function bookBox(c: GwCtx, b: GwBookView, d: GwBookDraft): TemplateResult {
  const chapters: (GwBookChapter | null)[] = [...GW_BOOK_CHAPTERS, null];
  return html`<div class="space-y-1.5" data-gw-book>
    <h4 class=${HEAD}>${translateText("gw.book.title")}</h4>
    <p class=${MUTED}>${translateText("gw.book.hint")}</p>
    ${chapters.map((ch) => {
      const rows = b.articles.filter((a) => a.chapter === ch);
      return rows.length === 0 ? nothing : chapterBlock(c, ch, rows, d);
    })}
  </div>`;
}

// ---- The agenda ----

function paperLine(c: GwCtx, g: GwAgendaView): TemplateResult {
  const office = g.counter === null ? "" : officeTitle(c.seat.tag, g.counter);
  return html`<p class="text-sm text-amber-100/90" data-gw-agenda-paper>
      ${g.paper === null
        ? translateText("gw.agenda.paper_none")
        : `${translateText("gw.agenda.paper", {
            word: translateText(`gw.agenda.tally.${g.paper.word}`),
            conf: translateText(`gw.ui.dept.conf.${g.paper.conf}`),
          })} · ${translateText("gw.agenda.paper_at", {
            n: chapterNo(g.paper.chapter),
          })}`}${g.counting
        ? html` ·
            <span class=${MUTED} data-gw-agenda-counting
              >${translateText("gw.agenda.counting", { office })}</span
            >`
        : nothing}
    </p>
    ${g.counter === null || g.counting
      ? nothing
      : html`<button
          class="${BTN} ${SMALL}"
          data-gw-agenda-count=${g.law}
          @click=${() => c.send({ kind: "bill_count", law: g.law })}
        >
          ${translateText("gw.agenda.count", { office })}
        </button>`}`;
}

/** A button that asks twice: 신임을 건다, 철회. */
function twice(
  c: GwCtx,
  d: GwBookDraft,
  key: string,
  label: string,
  sure: string,
  data: string,
  go: () => void,
): TemplateResult {
  const armed = d.armed === key;
  return html`<button
    class="${armed ? BTN_ON : BTN} ${SMALL}"
    data-gw-agenda-act=${data}
    @click=${() => {
      if (!armed) {
        d.armed = key;
        c.redraw();
        return;
      }
      d.armed = null;
      go();
      c.redraw();
    }}
  >
    ${translateText(armed ? sure : label)}
  </button>`;
}

function calls(c: GwCtx, g: GwAgendaView, d: GwBookDraft): TemplateResult {
  const why =
    g.callWhy === null ? null : translateText(`gw.agenda.why.${g.callWhy}`);
  return html`<div class="flex flex-wrap items-center gap-1">
      <button
        class="${GO} ${SMALL}"
        data-gw-agenda-vote=${g.law}
        ?disabled=${!g.call}
        @click=${() =>
          c.send({ kind: "bill_vote", law: g.law, confidence: false })}
      >
        ${translateText("gw.agenda.call")}
      </button>
      ${g.confidence && g.call
        ? twice(
            c,
            d,
            `confidence:${g.law}`,
            "gw.agenda.confidence",
            "gw.agenda.confidence",
            "confidence",
            () => c.send({ kind: "bill_vote", law: g.law, confidence: true }),
          )
        : nothing}
      ${g.round
        ? html`<button
            class="${BTN} ${SMALL}"
            data-gw-agenda-act="round"
            @click=${() => c.send({ kind: "bill_round", law: g.law })}
          >
            ${translateText("gw.agenda.round")}
          </button>`
        : nothing}
      ${g.withdraw
        ? twice(
            c,
            d,
            `withdraw:${g.law}`,
            "gw.agenda.withdraw",
            "gw.agenda.withdraw_sure",
            "withdraw",
            () => c.send({ kind: "bill_withdraw", law: g.law }),
          )
        : nothing}
    </div>
    ${d.armed === `confidence:${g.law}`
      ? html`<p class="text-sm text-amber-100/90" data-gw-agenda-hint>
          ${translateText("gw.agenda.confidence_hint")}
        </p>`
      : nothing}
    ${why === null
      ? nothing
      : html`<p class="${MUTED} italic" data-gw-agenda-why=${g.callWhy}>
          ${why}
        </p>`}`;
}

function seatsLine(l: GwLobbyView): string {
  return Object.entries(l.seats)
    .map(([ch, n]) =>
      translateText("gw.lobby.seats_in", {
        chamber: translateText(`gw.house.chamber.${ch}`),
        n: n ?? 0,
      }),
    )
    .join(" · ");
}

/** His words for a price: the lobby talk's `price` line for it. */
function priceSays(c: GwCtx, faction: string, want: string): string | null {
  const node = c.pack?.scenes[`gw_lb_${faction}`]?.nodes?.["price"];
  return node?.says[want] ?? null;
}

/**
 * ww204: the summoned leader's prices on this bill, each in his words with
 * 들어준다; 그냥 돌려보낸다 ends the audience. No result shows before the pick.
 */
function pricesBox(c: GwCtx, g: GwAgendaView, l: GwLobbyView): TemplateResult {
  const send = (want: string | null) => {
    c.send({ kind: "bill_price", law: g.law, faction: l.faction, want });
    c.redraw();
  };
  return html`<div
    class="space-y-1 rounded border border-amber-300/30 bg-amber-300/5 p-2"
    data-gw-lobby-prices=${l.faction}
  >
    <p class="text-xs font-bold text-amber-200">
      ${translateText("gw.lobby.price_label")}
    </p>
    ${(l.prices ?? []).length === 0
      ? html`<p class="${MUTED} italic" data-gw-lobby-no-price>
          ${translateText("gw.lobby.no_price")}
        </p>`
      : (l.prices ?? []).map((p) => {
          const says = priceSays(c, l.faction, p.id);
          return html`<div class="flex items-start gap-2" data-gw-price=${p.id}>
            <div class="min-w-0 flex-1 text-sm text-white">
              <span class=${CHIP}
                >${translateText(`gw.lobby.price.${p.kind}`)}</span
              >
              ${says === null
                ? nothing
                : html`<span class="text-white/85">${says}</span>`}
            </div>
            <button
              class="${BTN} ${SMALL} shrink-0"
              data-gw-price-take=${p.id}
              @click=${() => send(p.id)}
            >
              ${translateText("gw.lobby.take")}
            </button>
          </div>`;
        })}
    <div class="flex justify-end">
      <button
        class="${BTN} ${SMALL}"
        data-gw-price-leave=${l.faction}
        @click=${() => send(null)}
      >
        ${translateText("gw.lobby.leave")}
      </button>
    </div>
  </div>`;
}

function lobbyLine(
  c: GwCtx,
  g: GwAgendaView,
  l: GwLobbyView,
  free: number,
  d: GwBookDraft,
): TemplateResult {
  const key = `${g.law}:${l.faction}`;
  const pressing = d.press === key;
  const word =
    translateText(`gw.lobby.word.${l.word}`) +
    (l.conf === null ? "" : `(${translateText(`gw.ui.dept.conf.${l.conf}`)})`);
  return html`<div class="space-y-1" data-gw-lobby=${l.faction}>
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <div class="text-sm text-white">
          ${factionName(c, l.faction)}
          <span class=${MUTED}>${seatsLine(l)}</span>
          ${l.deal
            ? html`<span class=${CHIP} data-gw-lobby-deal
                >${translateText("gw.house.deal")}</span
              >`
            : nothing}
        </div>
        <p class=${MUTED}>
          ${[l.leader === null ? null : personName(c.pack, l.leader), word]
            .filter((x) => x !== null)
            .join(" · ")}
        </p>
        ${l.shut === null
          ? nothing
          : html`<p class="${MUTED} italic" data-gw-lobby-shut=${l.shut}>
              ${translateText(`gw.lobby.shut.${l.shut}`)}
            </p>`}
      </div>
      <div class="flex shrink-0 gap-1">
        ${l.call
          ? html`<button
              class="${BTN} ${SMALL}"
              data-gw-lobby-call=${l.faction}
              ?disabled=${free <= 0 && timeLeft(c) <= 0}
              @click=${() => {
                c.send({ kind: "bill_lobby", law: g.law, faction: l.faction });
                c.ui.summoned = Date.now();
              }}
            >
              ${translateText("gw.lobby.summon")}
            </button>`
          : nothing}
        ${l.press.length === 0
          ? nothing
          : html`<button
              class="${pressing ? BTN_ON : BTN} ${SMALL}"
              data-gw-lobby-press=${l.faction}
              @click=${() => {
                d.press = pressing ? null : key;
                c.redraw();
              }}
            >
              ${translateText("gw.lobby.press_label")}
            </button>`}
      </div>
    </div>
    ${l.prices === null ? nothing : pricesBox(c, g, l)}
    ${pressing
      ? html`<div class="flex flex-wrap gap-1 pl-2" data-gw-lobby-hows>
          ${l.press.map(
            (how) =>
              html`<button
                class="${BTN} ${SMALL}"
                data-gw-lobby-how=${how}
                @click=${() => {
                  d.press = null;
                  c.send({
                    kind: "bill_press",
                    law: g.law,
                    faction: l.faction,
                    how,
                  });
                  c.ui.summoned = Date.now();
                  c.redraw();
                }}
              >
                ${translateText(`gw.lobby.press.${how}`)}
              </button>`,
          )}
        </div>`
      : nothing}
  </div>`;
}

function agendaRow(
  c: GwCtx,
  g: GwAgendaView,
  free: number,
  d: GwBookDraft,
): TemplateResult {
  const open = d.agenda === g.law;
  const who = [
    g.by !== null
      ? translateText("gw.agenda.faction_bill", {
          faction: factionName(c, g.by),
        })
      : g.origin === "seat"
        ? translateText("gw.agenda.mine")
        : translateText(`gw.house.origin.${g.origin}`),
    g.sponsor === null
      ? null
      : translateText("gw.house.sponsor", {
          name: personName(c.pack, g.sponsor),
        }),
    translateText("gw.agenda.age", { n: Math.max(1, g.age) }),
  ].filter((x) => x !== null);
  return html`<div
    class="space-y-1 rounded border border-white/10 p-2"
    data-gw-agenda=${g.law}
  >
    <div class="flex items-baseline justify-between gap-2 text-sm">
      <span class="font-bold"
        >${billName(c, g.law)}${g.text === null
          ? nothing
          : html` ·
              <span class="font-normal"
                >${textName(c, g.law, g.text)}</span
              >`}</span
      >
      <span class="shrink-0 text-xs text-white/70"
        >${translateText(`gw.house.stage.${g.stage}`)}</span
      >
    </div>
    <p class=${MUTED}>${who.join(" · ")}</p>
    ${g.replaces === null
      ? nothing
      : html`<p class=${MUTED} data-gw-agenda-replaces>
          ${translateText("gw.agenda.replaces", {
            text: textName(c, g.law, g.replaces),
          })}
        </p>`}
    <p class=${MUTED}>
      ${translateText("gw.house.chambers", {
        list: g.chambers
          .map((x) => translateText(`gw.house.chamber.${x}`))
          .join(", "),
      })}
    </p>
    ${g.auto === null
      ? nothing
      : html`<p class=${MUTED} data-gw-agenda-auto>
          ${translateText("gw.agenda.auto", { n: chapterNo(g.auto) })}
        </p>`}
    ${g.delayTo === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.house.delay", { n: g.delayTo + 1 })}
        </p>`}
    ${paperLine(c, g)} ${g.stage === "draft" ? nothing : calls(c, g, d)}
    ${g.lobby.length === 0
      ? nothing
      : html`<button
            class="flex w-full items-center gap-2 pt-1 text-left text-sm"
            data-gw-agenda-lobby=${g.law}
            @click=${() => {
              d.agenda = open ? null : g.law;
              d.press = null;
              c.redraw();
            }}
          >
            <span class="text-white/90"
              >${translateText("gw.lobby.title")}</span
            >
            <span class="${MUTED} ml-auto">${open ? "▾" : "▸"}</span>
          </button>
          ${open
            ? html`<div class="space-y-1.5 border-l border-white/15 pl-2">
                <p class=${MUTED}>${translateText("gw.lobby.hint")}</p>
                <p class=${MUTED} data-gw-agenda-calls>
                  ${free > 0
                    ? translateText("gw.lobby.calls", { n: free })
                    : translateText("gw.lobby.calls_none")}
                </p>
                ${g.lobby.map((l) => lobbyLine(c, g, l, free, d))}
              </div>`
            : nothing}`}
  </div>`;
}

function agendaBox(c: GwCtx, b: GwBookView, d: GwBookDraft): TemplateResult {
  return html`<div class="space-y-1.5" data-gw-agenda-box>
    <h4 class=${HEAD}>
      ${translateText("gw.agenda.title", { n: b.agenda.length, max: b.max })}
    </h4>
    ${b.agenda.length === 0
      ? html`<p class=${MUTED}>${translateText("gw.agenda.empty")}</p>`
      : b.agenda.map((g) => agendaRow(c, g, b.calls, d))}
  </div>`;
}

// ---- The house's standing ----

/** What doesn't sit now, and whether every bill goes the way round (ww171). */
function sittingLines(h: GwHouseView): TemplateResult | typeof nothing {
  if (h.closed.length === 0 && !h.gone) return nothing;
  const list = h.closed
    .map((x) => translateText(`gw.house.chamber.${x}`))
    .join(", ");
  return html`${h.gone && h.around !== null
    ? html`<p class="text-sm text-amber-100/90" data-gw-house-gone>
        ${translateText(`gw.house.gone.${h.around}`)}
      </p>`
    : nothing}${h.closed.length === 0
    ? nothing
    : html`<p class=${MUTED} data-gw-house-closed>
        ${translateText("gw.house.closed", { list })}
      </p>`}`;
}

function recordLine(h: GwHouseView): TemplateResult | typeof nothing {
  if (h.record.right + h.record.wrong === 0) return nothing;
  return html`<p
    class=${MUTED}
    data-gw-house-record
    title=${translateText("gw.house.record_hint")}
  >
    ${translateText("gw.house.record", {
      right: h.record.right,
      wrong: h.record.wrong,
    })}
  </p>`;
}

/**
 * The 통치 tab's house group: the book, then the agenda with its lobby.
 * Nothing for a country with no bills and no house.
 */
export function bookSection(c: GwCtx): TemplateResult | typeof nothing {
  const b = c.seat.world.book;
  const h = c.seat.world.house ?? null;
  if (b === undefined && h === null) return nothing;
  const d = draftOf(c);
  return html`<div class=${BOX} data-gw-book-section>
    ${h === null ? nothing : sittingLines(h)}
    ${b === undefined
      ? nothing
      : html`${bookBox(c, b, d)} ${agendaBox(c, b, d)}`}
    ${h === null ? nothing : recordLine(h)}
  </div>`;
}
