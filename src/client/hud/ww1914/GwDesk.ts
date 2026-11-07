import type {
  GwCardView,
  GwOptionView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { deskPapers } from "./GwBlocs";
import { budgetStrip, openLedger } from "./GwBudget";
import type { GwCtx, GwResultNote } from "./GwCtx";
import { briefLine, rich } from "./GwDict";
import { newPass, TextPass } from "./GwDictModel";
import { lawStrip } from "./GwLaws";
import {
  dangers,
  GwDanger,
  isReadOnly,
  letterThread,
  paperCards,
  talkCards,
} from "./GwModel";
import { openCard, placeChip } from "./GwPlaceSheet";
import { brokenLine } from "./GwRuler";
import { aimNudge } from "./GwSchedule";
import { BTN, BTN_ON, CHIP, GLASS, HEAD, MUTED } from "./GwStyle";
import {
  backText,
  bodyParts,
  bodyPlain,
  briefText,
  cardBody,
  cardTitle,
  fillGw,
  foldedLines,
  fullDate,
  optionMarked,
  optionSplit,
  optionText,
  personName,
  reasonText,
  tellText,
  voices,
} from "./GwText";

/** A paper quoted in the scene's narration. */
const QUOTE =
  "whitespace-pre-line border-l-2 border-amber-200/40 pl-3 text-white/80";
const PARA = "whitespace-pre-line";
/** Tight on purpose: pre-line would keep a template's own line break as a gap. */
const para = (cls: string, body: unknown) => html`<p class=${cls}>${body}</p>`;
/** The desk's head stays short; the country tab keeps every line. */
const REASONS_SHOWN = 6;

/**
 * The reasons that came with the last chapter's close, newest first. What
 * comes every month says nothing new here: the country tab keeps the whole log.
 */
export function lastReasons(c: GwCtx): string[] {
  const before = new Set(
    c.seat.log
      .filter((r) => r.chapter === c.data.chapter - 2)
      .map((r) => reasonText(c.pack, r)),
  );
  return c.seat.log
    .filter(
      (r) =>
        r.chapter >= c.data.chapter - 1 && !/^talk_(fit|clash)_/.test(r.key),
    )
    .map((r) => reasonText(c.pack, r))
    .filter((t) => !before.has(t))
    .reverse()
    .slice(0, REASONS_SHOWN);
}

function sender(c: GwCtx, card: GwCardView): string {
  const first = Object.values(card.cast)[0];
  return first === undefined ? "" : personName(c.pack, first);
}

function cardBox(c: GwCtx, card: GwCardView): TemplateResult {
  const fill = (t: string) => fillGw(t, c.pack, card, c.seat, c.data.date);
  const isTalk = card.kind === "talk";
  const read = isReadOnly(card);
  const pass = newPass();
  const brief = briefText(c.pack, card, c.seat, c.data.date);
  return html`<section
    data-gw-card=${card.scene}
    class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
  >
    <div class="flex items-center gap-2">
      <span class=${CHIP}>${translateText(`gw.ui.kind.${card.kind}`)}</span>
      ${card.stamp === null
        ? nothing
        : html`<span class=${CHIP}
            >${translateText(`gw.ui.stamp.${card.stamp}`)}</span
          >`}
      ${placeChip(c, card)}
      <span class="${MUTED} ml-auto truncate">${sender(c, card)}</span>
    </div>
    <h3 class=${HEAD}>${cardTitle(c.pack, card)}</h3>
    ${brief === null ? nothing : briefLine(c, brief, pass)}
    ${backLine(c, card, pass)}
    ${isTalk
      ? html`<p class="text-sm text-white/80">
          ${card.big === true
            ? translateText("gw.ui.big_waits")
            : translateText("gw.ui.talk_waits", {
                name: personName(c.pack, card.who ?? ""),
              })}
        </p>`
      : html`<p class="line-clamp-3 text-sm text-white/85">
          ${rich(c, bodyPlain(fill(cardBody(c.pack, card))), pass)}
        </p>`}
    <button
      class=${BTN}
      data-gw-open=${card.uid}
      @click=${() => openCard(c, card)}
    >
      ${isTalk
        ? translateText("gw.ui.talk_open")
        : read
          ? translateText("gw.ui.read_on")
          : translateText("gw.ui.read_decide")}
    </button>
  </section>`;
}

/** A paper come back: what its author did with it. */
function backLine(
  c: GwCtx,
  card: GwCardView,
  pass: TextPass,
): TemplateResult | typeof nothing {
  const text = backText(c.pack, card, c.seat, c.data.date);
  if (text === null) return nothing;
  return html`<p
    class="rounded-sm border-l-2 border-amber-300/60 bg-amber-300/10 px-2 py-1 text-[13px] leading-6 text-amber-100/90"
    data-gw-back-line
  >
    ${rich(c, text, pass)}
  </p>`;
}

/** "다시 써 오시오": beside sign and refuse, with the short list of directions. */
function backControl(
  c: GwCtx,
  card: GwCardView,
  close: () => void,
): TemplateResult | typeof nothing {
  const dirs = card.backTo ?? [];
  if (dirs.length === 0) return nothing;
  const { ui } = c;
  return html`<div
    class="space-y-1 border-t border-white/10 pt-1.5"
    data-gw-back
  >
    <button
      class="${ui.backOpen ? BTN_ON : BTN} w-full"
      data-gw-back-open
      @click=${() => {
        ui.backOpen = !ui.backOpen;
        ui.backArmed = null;
        ui.armed = null;
        c.redraw();
      }}
    >
      ${translateText("gw.back.open")}
    </button>
    ${ui.backOpen
      ? html`<p class="${MUTED} pl-1">
            ${translateText("gw.back.hint", {
              name: personName(c.pack, card.backWho ?? ""),
            })}
          </p>
          ${dirs.map(
            (d) =>
              html`<button
                class="${ui.backArmed === d ? BTN_ON : BTN} w-full"
                data-gw-back-dir=${d}
                @click=${() => {
                  ui.backArmed = ui.backArmed === d ? null : d;
                  c.redraw();
                }}
              >
                ${translateText(`gw.back.dir.${d}`)}
              </button>`,
          )}
          ${ui.backArmed === null
            ? nothing
            : html`<button
                class="w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-2 text-center text-sm font-bold text-slate-900 hover:bg-amber-200"
                data-gw-back-go
                @click=${() => {
                  const direction = ui.backArmed;
                  if (direction === null) return;
                  c.send({ kind: "send_back", card: card.uid, direction });
                  ui.backOpen = false;
                  ui.backArmed = null;
                  close();
                }}
              >
                ${translateText("gw.back.go")}
              </button>`}`
      : nothing}
  </div>`;
}

function dangerText(d: GwDanger): string {
  if (d.kind !== "gov") return translateText(`gw.ui.danger.${d.kind}`);
  return translateText("gw.ui.danger.gov", {
    name: translateText(`gw.gov.name.${d.id}`),
    word: translateText(`gw.gov.word.${d.word}`),
  });
}

/** What can end the game, on the desk where it can't be missed. */
function dangerBox(c: GwCtx): TemplateResult | typeof nothing {
  const rows = dangers(c.seat);
  if (rows.length === 0 || c.data.ended !== null) return nothing;
  return html`<div
    class="rounded border border-amber-300/60 bg-amber-300/10 p-2"
    data-gw-danger
  >
    ${rows.map(
      (d) => html`<p class="text-sm text-amber-100">${dangerText(d)}</p>`,
    )}
  </div>`;
}

/** Signed choices of this chapter and the last: what they said and cost. */
function resultsBox(c: GwCtx): TemplateResult | typeof nothing {
  const rows = c.ui.notes.filter((n) => n.chapter >= c.data.chapter - 1);
  if (rows.length === 0) return nothing;
  return html`<div
    class="space-y-1.5 rounded border border-white/10 bg-white/5 p-2"
    data-gw-results
  >
    <div class=${MUTED}>${translateText("gw.ui.results_title")}</div>
    ${rows.map(
      (n: GwResultNote) =>
        html`<div class="space-y-0.5" data-gw-result>
          <p class="text-sm text-white/90">
            <b>${n.title}</b> · ${rich(c, n.pick)}
          </p>
          ${n.rest === ""
            ? nothing
            : html`<p class="text-sm text-white/75">${rich(c, n.rest)}</p>`}
          ${n.tell.length === 0
            ? nothing
            : html`<div class="flex flex-wrap gap-1">
                ${n.tell.map(
                  (t) => html`<span class=${CHIP}>${tellText(t)}</span>`,
                )}
              </div>`}
        </div>`,
    )}
  </div>`;
}

/** The desk tab: what the last chapter left, the papers, the visitors, ready. */
export function deskTab(c: GwCtx): TemplateResult {
  const { seat, data } = c;
  const reasons = lastReasons(c);
  const papers = paperCards(seat);
  const talks = talkCards(seat);
  return html`<div class="space-y-2.5" data-gw-desk>
    ${dangerBox(c)} ${aimNudge(c)}
    ${reasons.length === 0
      ? nothing
      : html`<div class="rounded border border-white/10 bg-white/5 p-2">
          <div class=${MUTED}>${translateText("gw.ui.since_last")}</div>
          ${reasons.map(
            (r) => html`<p class="text-sm text-white/80">${rich(c, r)}</p>`,
          )}
        </div>`}
    ${resultsBox(c)} ${deskPapers(c)}
    ${papers.length + talks.length === 0
      ? html`<p class="text-sm text-white/65" data-gw-empty>
          ${translateText("gw.ui.desk_empty")}
        </p>`
      : nothing}
    ${papers.map((p) => cardBox(c, p))} ${talks.map((p) => cardBox(c, p))}
    ${data.ended !== null
      ? nothing
      : html`<div class="space-y-1 pt-1">
          <button
            class="${seat.ready ? BTN_ON : BTN} w-full text-center"
            data-gw-ready
            ?disabled=${seat.readyBlock !== null}
            @click=${() =>
              c.send({ kind: "ready", chapter: data.chapter, on: !seat.ready })}
          >
            ${translateText(
              seat.ready ? "gw.panel.not_ready" : "gw.ui.ready_chapter",
            )}
          </button>
          ${seat.readyBlock === null
            ? nothing
            : html`<p class=${MUTED} data-gw-block>
                ${translateText(`gw.ui.block.${seat.readyBlock}`)}
              </p>`}
        </div>`}
  </div>`;
}

function fillOption(c: GwCtx, card: GwCardView, id: string): string {
  return fillGw(
    optionMarked(c.pack, card, id),
    c.pack,
    card,
    c.seat,
    c.data.date,
  );
}

/** What a signed option leaves on the next desk: its rest and its price. */
export function resultNote(
  c: GwCtx,
  card: GwCardView,
  o: GwOptionView,
): GwResultNote {
  return {
    chapter: c.data.chapter,
    title: cardTitle(c.pack, card),
    pick: optionSplit(fillOption(c, card, o.id)).lead,
    rest: optionSplit(fillOption(c, card, o.id)).rest,
    tell: o.tell,
  };
}

function optionButton(
  c: GwCtx,
  card: GwCardView,
  o: GwOptionView,
  pass: TextPass,
): TemplateResult {
  const armed = c.ui.armed?.uid === card.uid && c.ui.armed.option === o.id;
  const why = o.open ? undefined : c.pack?.scenes[card.scene]?.why?.[o.id];
  return html`<div class="space-y-0.5">
    <button
      class="${armed ? BTN_ON : BTN} w-full"
      data-gw-option=${o.id}
      ?disabled=${!o.open}
      @click=${() => {
        // The ledger is worked in its own panel; the card waits for the signature.
        if (o.screen === "budget") {
          openLedger(c);
          return;
        }
        c.ui.armed = { uid: card.uid, option: o.id };
        c.redraw();
      }}
    >
      <span class="block"
        ><b
          >${rich(c, optionSplit(fillOption(c, card, o.id)).lead, pass)}</b
        ></span
      >
    </button>
    ${why === undefined
      ? nothing
      : html`<p class="${MUTED} pl-1" data-gw-why>
          ${rich(c, fillGw(why, c.pack, card, c.seat, c.data.date), pass)}
        </p>`}
  </div>`;
}

/** What a big scene leaves: the words on an empty page, and a way to go on. */
function silentPage(c: GwCtx, card: GwCardView): TemplateResult {
  const text = fillGw(
    cardBody(c.pack, card),
    c.pack,
    card,
    c.seat,
    c.data.date,
  );
  return html`<div
    class="pointer-events-auto fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-6 bg-black p-6 text-white"
    data-gw-silent=${card.scene}
  >
    <div class="max-w-[520px] space-y-3 text-[16px] leading-8 text-white/85">
      ${bodyParts(text).map(
        (p) => html`<p class=${p.quote ? QUOTE : PARA}>${p.text}</p>`,
      )}
    </div>
    <button
      class="${MUTED} px-3 py-2 hover:text-white"
      data-gw-silent-done
      @click=${() => {
        c.send({ kind: "read", card: card.uid });
        c.ui.readerUid = null;
        c.redraw();
      }}
    >
      ${translateText("gw.ui.silent_done")}
    </button>
  </div>`;
}

/** The letters so far with this ruler, what was answered under each. */
function threadBox(
  c: GwCtx,
  card: GwCardView,
  pass: TextPass,
): TemplateResult | typeof nothing {
  const rows = letterThread(c.seat, card);
  if (rows.length === 0) return nothing;
  const fill = (t: string) => fillGw(t, c.pack, card, c.seat, c.data.date);
  const answer = (scene: string | null) => {
    const taken = (c.seat.choices ?? []).filter((x) => x.scene === scene);
    const pick = taken[taken.length - 1]?.pick;
    if (scene === null || pick === undefined) return null;
    return optionText(c.pack, { ...card, scene, node: null }, pick);
  };
  return html`<div
    class="space-y-1.5 rounded border border-white/10 bg-white/5 p-2"
    data-gw-thread
  >
    <div class=${MUTED}>${translateText("gw.ui.letter_thread")}</div>
    ${rows.map((x) => {
      const said = x.out
        ? answer(x.scene)
        : x.scene === null || x.variant === null
          ? null
          : (c.pack?.scenes[x.scene]?.text[x.variant] ?? null);
      return html`<div class="space-y-0.5" data-gw-thread-row>
        <div class=${MUTED}>
          ${fullDate(x.date)} ·
          ${translateText(x.out ? "gw.ui.letter_sent" : "gw.ui.letter_came")}
        </div>
        ${said === null
          ? nothing
          : html`<p class="line-clamp-3 text-sm text-white/75">
              ${rich(c, bodyPlain(fill(said)), pass)}
            </p>`}
      </div>`;
    })}
  </div>`;
}

/** The reader: the whole document, the voices around the table, the options. */
export function reader(c: GwCtx, card: GwCardView): TemplateResult {
  if (card.silent === true) return silentPage(c, card);
  const fill = (t: string) => fillGw(t, c.pack, card, c.seat, c.data.date);
  const after = brokenLine(c, card);
  const read = isReadOnly(card);
  const body = bodyParts(fill(cardBody(c.pack, card)));
  const pass = newPass();
  const brief = briefText(c.pack, card, c.seat, c.data.date);
  const armedOpt =
    c.ui.armed?.uid === card.uid
      ? card.options.find((o) => o.id === c.ui.armed?.option)
      : undefined;
  const close = () => {
    c.ui.readerUid = null;
    c.ui.armed = null;
    c.ui.backOpen = false;
    c.ui.backArmed = null;
    c.redraw();
  };
  return html`<div
    class="pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-3"
    @click=${(e: Event) => e.target === e.currentTarget && close()}
  >
    <article
      data-gw-reader=${card.scene}
      class="${GLASS} max-h-[88vh] w-full max-w-[640px] space-y-3 overflow-y-auto rounded-md p-5 text-white shadow-2xl"
    >
      <header class="flex items-center gap-2">
        <span class=${CHIP}>${translateText(`gw.ui.kind.${card.kind}`)}</span>
        ${card.stamp === null
          ? nothing
          : html`<span class=${CHIP} data-gw-stamp
              >${translateText(`gw.ui.stamp.${card.stamp}`)}</span
            >`}
        ${placeChip(c, card, close)}
        <span class="${MUTED} ml-auto">${fullDate(c.data.date)}</span>
        <button class="${MUTED} px-1 hover:text-white" @click=${close}>
          ✕
        </button>
      </header>
      <h2 class="text-lg font-bold leading-snug">${cardTitle(c.pack, card)}</h2>
      ${brief === null ? nothing : briefLine(c, brief, pass)}
      ${backLine(c, card, pass)}
      ${card.letterFrom === undefined
        ? nothing
        : html`<div class=${MUTED} data-gw-letter-from>
            ${translateText("gw.ui.letter_from", {
              name: personName(c.pack, card.who ?? ""),
              country: translateText(`gw.country.${card.letterFrom}`),
            })}
          </div>`}
      ${card.letterFrom === undefined ? nothing : threadBox(c, card, pass)}
      <div class="space-y-2.5 text-[15px] leading-7 text-white/90">
        ${body.map((p) =>
          para(
            p.quote || card.letterFrom !== undefined ? QUOTE : PARA,
            rich(c, p.text, pass),
          ),
        )}
        ${voices(c.pack, card).map(
          (v) =>
            html`<p class="border-l-2 border-white/25 pl-3 text-white/80">
              ${rich(c, fill(v), pass)}
            </p>`,
        )}
        ${after === null
          ? nothing
          : html`<p class="text-white/70" data-gw-broken-line>${after}</p>`}
      </div>
      ${card.scene.startsWith("gw_bm_") ? budgetStrip(c) : nothing}
      ${card.scene.startsWith("gw_lv_") ? lawStrip(c, card.scene) : nothing}
      ${(card.folded ?? []).length === 0
        ? nothing
        : html`<div class="space-y-0.5" data-gw-folded>
            <div class=${MUTED}>${translateText("gw.ui.folded_title")}</div>
            ${foldedLines(c.pack, card).map(
              (l) =>
                html`<p class="text-sm text-white/75">${rich(c, l, pass)}</p>`,
            )}
          </div>`}
      ${read
        ? html`<button
            class="${BTN} w-full text-center"
            data-gw-readdone
            @click=${() => {
              c.send({ kind: "read", card: card.uid });
              close();
            }}
          >
            ${translateText("gw.ui.read_done")}
          </button>`
        : html`<div class="space-y-1.5">
            <div class=${MUTED}>${translateText("gw.ui.options")}</div>
            ${card.options.map((o) => optionButton(c, card, o, pass))}
            ${armedOpt === undefined
              ? nothing
              : html`<button
                  class="w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-2 text-center text-sm font-bold text-slate-900 hover:bg-amber-200"
                  data-gw-sign
                  @click=${() => {
                    c.ui.notes.push(resultNote(c, card, armedOpt));
                    c.send({
                      kind: "choose",
                      card: card.uid,
                      option: armedOpt.id,
                    });
                    if (armedOpt.screen === "fronts") {
                      c.ui.tab = armedOpt.screen;
                    }
                    close();
                  }}
                >
                  ${translateText("gw.ui.sign")}
                </button>`}
            ${backControl(c, card, close)}
          </div>`}
    </article>
  </div>`;
}
