import type {
  GwCardView,
  GwOptionView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { deskPapers } from "./GwBlocs";
import { budgetStrip, openLedger } from "./GwBudget";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { lawStrip } from "./GwLaws";
import { isReadOnly, paperCards, talkCards } from "./GwModel";
import { brokenLine } from "./GwRuler";
import { BTN, BTN_ON, CHIP, GLASS, HEAD, MUTED } from "./GwStyle";
import {
  bodyParts,
  bodyPlain,
  boldParts,
  cardBody,
  cardTitle,
  fillGw,
  foldedLines,
  fullDate,
  optionMarked,
  personName,
  reasonText,
  tellText,
  voices,
} from "./GwText";

/** A paper quoted in the scene's narration. */
const QUOTE =
  "whitespace-pre-line border-l-2 border-amber-200/40 pl-3 text-white/80";
const PARA = "whitespace-pre-line";
/** The desk's head stays short; the country tab keeps every line. */
const REASONS_SHOWN = 6;

/** The reasons that came with the last chapter's close, newest first. */
function lastReasons(c: GwCtx): string[] {
  return c.seat.log
    .filter(
      (r) =>
        r.chapter >= c.data.chapter - 1 && !/^talk_(fit|clash)_/.test(r.key),
    )
    .map((r) => reasonText(c.pack, r))
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
      <span class="${MUTED} ml-auto truncate">${sender(c, card)}</span>
    </div>
    <h3 class=${HEAD}>${cardTitle(c.pack, card)}</h3>
    ${isTalk
      ? html`<p class="text-sm text-white/80">
          ${translateText("gw.ui.talk_waits", {
            name: personName(c.pack, card.who ?? ""),
          })}
        </p>`
      : html`<p class="line-clamp-3 text-sm text-white/85">
          ${rich(c, bodyPlain(fill(cardBody(c.pack, card))))}
        </p>`}
    <button
      class=${BTN}
      data-gw-open=${card.uid}
      @click=${() => {
        if (isTalk) c.ui.talkUid = card.uid;
        else {
          c.ui.readerUid = card.uid;
          c.ui.armed = null;
        }
        c.redraw();
      }}
    >
      ${isTalk
        ? translateText("gw.ui.talk_open")
        : read
          ? translateText("gw.ui.read_on")
          : translateText("gw.ui.read_decide")}
    </button>
  </section>`;
}

/** The desk tab: what the last chapter left, the papers, the visitors, ready. */
export function deskTab(c: GwCtx): TemplateResult {
  const { seat, data } = c;
  const reasons = lastReasons(c);
  const papers = paperCards(seat);
  const talks = talkCards(seat);
  return html`<div class="space-y-2.5" data-gw-desk>
    ${reasons.length === 0
      ? nothing
      : html`<div class="rounded border border-white/10 bg-white/5 p-2">
          <div class=${MUTED}>${translateText("gw.ui.since_last")}</div>
          ${reasons.map(
            (r) => html`<p class="text-sm text-white/80">${rich(c, r)}</p>`,
          )}
        </div>`}
    ${deskPapers(c)}
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

function optionButton(
  c: GwCtx,
  card: GwCardView,
  o: GwOptionView,
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
        >${boldParts(
          fillGw(
            optionMarked(c.pack, card, o.id),
            c.pack,
            card,
            c.seat,
            c.data.date,
          ),
        ).map((p) =>
          p.bold ? html`<b>${rich(c, p.text)}</b>` : rich(c, p.text),
        )}</span
      >
      ${o.tell.length === 0
        ? nothing
        : html`<span class="mt-0.5 flex flex-wrap gap-1"
            >${o.tell.map(
              (t) => html`<span class=${CHIP}>${tellText(t)}</span>`,
            )}</span
          >`}
    </button>
    ${why === undefined
      ? nothing
      : html`<p class="${MUTED} pl-1" data-gw-why>
          ${rich(c, fillGw(why, c.pack, card, c.seat, c.data.date))}
        </p>`}
  </div>`;
}

/** The reader: the whole document, the voices around the table, the options. */
export function reader(c: GwCtx, card: GwCardView): TemplateResult {
  const fill = (t: string) => fillGw(t, c.pack, card, c.seat, c.data.date);
  const after = brokenLine(c, card);
  const read = isReadOnly(card);
  const body = bodyParts(fill(cardBody(c.pack, card)));
  const armedOpt =
    c.ui.armed?.uid === card.uid
      ? card.options.find((o) => o.id === c.ui.armed?.option)
      : undefined;
  const close = () => {
    c.ui.readerUid = null;
    c.ui.armed = null;
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
        <span class="${MUTED} ml-auto">${fullDate(c.data.date)}</span>
        <button class="${MUTED} px-1 hover:text-white" @click=${close}>
          ✕
        </button>
      </header>
      <h2 class="text-lg font-bold leading-snug">${cardTitle(c.pack, card)}</h2>
      <div class="space-y-2.5 text-[15px] leading-7 text-white/90">
        ${body.map(
          (p) =>
            html`<p class=${p.quote ? QUOTE : PARA}>${rich(c, p.text)}</p>`,
        )}
        ${voices(c.pack, card).map(
          (v) =>
            html`<p class="border-l-2 border-white/25 pl-3 text-white/80">
              ${rich(c, fill(v))}
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
              (l) => html`<p class="text-sm text-white/75">${l}</p>`,
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
            ${card.options.map((o) => optionButton(c, card, o))}
            ${armedOpt === undefined
              ? nothing
              : html`<button
                  class="w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-2 text-center text-sm font-bold text-slate-900 hover:bg-amber-200"
                  data-gw-sign
                  @click=${() => {
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
          </div>`}
    </article>
  </div>`;
}
