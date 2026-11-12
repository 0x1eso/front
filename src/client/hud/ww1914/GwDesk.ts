import type {
  GwAskView,
  GwCardView,
  GwOptionView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { deskPapers } from "./GwBlocs";
import { budgetStrip, openLedger } from "./GwBudget";
import type { GwCtx, GwResultNote } from "./GwCtx";
import {
  cardStamp,
  deptChips,
  deptLine,
  deptVerdicts,
  optionMarks,
  roomBox,
  signWord,
} from "./GwDept";
import {
  bearerLine,
  deskHeading,
  diaryCard,
  grainChip,
  grainLine,
} from "./GwDiary";
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
import { nowBox } from "./GwNow";
import { paperBody, paperChips, paperGist, paperTitle } from "./GwPaper";
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
/** Acts whose desk note of this chapter or the last lists their lines. */
function noted(c: GwCtx): Set<string> {
  return new Set(
    c.ui.notes
      .filter((n) => n.chapter >= c.data.chapter - 1 && n.act !== undefined)
      .map((n) => `${n.act}@${n.chapter}`),
  );
}

/** What an act did, line by line, under its note. */
function actLines(c: GwCtx, n: GwResultNote): string[] {
  if (n.act === undefined) return [];
  return c.seat.log
    .filter((r) => r.act === n.act && r.chapter === n.chapter)
    .map((r) => reasonText(c.pack, r, c.seat.tag));
}

export function lastReasons(c: GwCtx): string[] {
  const listed = noted(c);
  const before = new Set(
    c.seat.log
      .filter((r) => r.chapter === c.data.chapter - 2)
      .map((r) => reasonText(c.pack, r, c.seat.tag)),
  );
  return c.seat.log
    .filter(
      (r) =>
        r.chapter >= c.data.chapter - 1 &&
        !/^talk_(fit|clash)_/.test(r.key) &&
        (r.act === undefined ||
          r.act === null ||
          !listed.has(`${r.act}@${r.chapter}`)),
    )
    .map((r) => reasonText(c.pack, r, c.seat.tag))
    .filter((t) => !before.has(t))
    .reverse()
    .slice(0, REASONS_SHOWN);
}

function sender(c: GwCtx, card: GwCardView): string {
  const first = Object.values(card.cast)[0];
  return first === undefined ? "" : personName(c.pack, first);
}

/** The card's heading: a paper's own, else its scene's title. */
function titleOf(c: GwCtx, card: GwCardView): string {
  return paperTitle(c, card) ?? cardTitle(c.pack, card);
}

export function cardBox(c: GwCtx, card: GwCardView): TemplateResult {
  const stamp = cardStamp(card);
  const fill = (t: string) => fillGw(t, c.pack, card, c.seat, c.data.date);
  const isTalk = card.kind === "talk";
  const read = isReadOnly(card);
  const pass = newPass();
  // ww196: a department's paper says what it is about in place of a brief.
  const gist = paperGist(c, card);
  const brief =
    card.paper === undefined
      ? briefText(c.pack, card, c.seat, c.data.date)
      : null;
  return html`<section
    data-gw-card=${card.scene}
    class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
  >
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      ${card.paper === undefined
        ? html`<span class=${CHIP}
            >${translateText(`gw.ui.kind.${card.kind}`)}</span
          >`
        : nothing}
      ${stamp === null
        ? nothing
        : html`<span
            class=${CHIP}
            title=${translateText(`gw.ui.stamp_hint.${stamp}`)}
            >${translateText(`gw.ui.stamp.${stamp}`)}</span
          >`}
      ${deptChips(c, card)} ${paperChips(c, card)} ${placeChip(c, card)}
      <span class="${MUTED} ml-auto truncate">${sender(c, card)}</span>
    </div>
    <h3 class=${HEAD}>${titleOf(c, card)}</h3>
    ${bearerLine(c, card)}
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
          ${rich(c, gist ?? bodyPlain(fill(cardBody(c.pack, card))), pass)}
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

/** ww179: a project's done paper says, under its story, what changed. */
function projectDoneLine(
  c: GwCtx,
  scene: string,
): TemplateResult | typeof nothing {
  if (!scene.endsWith("_done")) return nothing;
  const done = c.pack?.craft?.[scene.slice(0, -"_done".length)]?.done;
  if (done === undefined) return nothing;
  return html`<p
    class="rounded border border-white/15 bg-white/5 p-2 text-sm text-white/85"
    data-gw-project-done
  >
    ${translateText("gw.craft.changed", { text: done })}
  </p>`;
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
            <b>${n.title}</b>${n.pick === ""
              ? nothing
              : html` · ${rich(c, n.pick)}`}
          </p>
          ${n.rest === ""
            ? nothing
            : html`<p class="text-sm text-white/75">${rich(c, n.rest)}</p>`}
          ${actLines(c, n).map(
            (t) =>
              html`<p class="text-sm text-white/75" data-gw-act-line>
                ${rich(c, t)}
              </p>`,
          )}
          ${n.tell.length === 0
            ? nothing
            : html`<div class="flex flex-wrap gap-1">
                ${n.tell.map(
                  (t) =>
                    html`<span
                      class=${CHIP}
                      title=${translateText("gw.ui.tell_hint")}
                      >${tellText(t, c.seat.tag)}</span
                    >`,
                )}
              </div>`}
        </div>`,
    )}
  </div>`;
}

/** 사사로운 것: the private papers, in the existing card style, as one group. */
function privateBox(
  c: GwCtx,
  cards: readonly GwCardView[],
): TemplateResult | typeof nothing {
  if (cards.length === 0) return nothing;
  return html`<section
    class="space-y-1.5 rounded border border-amber-200/25 bg-black/35 p-2.5"
    data-gw-private-papers
  >
    <h3 class=${HEAD}>${translateText("gw.ui.persona.private")}</h3>
    ${cards.map((p) => cardBox(c, p))}
  </section>`;
}

/** The desk tab: what the last chapter left, the papers, the visitors, ready. */
export function deskTab(c: GwCtx): TemplateResult {
  const { seat, data } = c;
  const reasons = lastReasons(c);
  // ww196: private papers come by the private bearer, grouped at the top.
  const own = seat.desk.filter((p) => p.private === true);
  const papers = paperCards(seat).filter((p) => p.private !== true);
  const talks = talkCards(seat).filter((p) => p.private !== true);
  return html`<div class="space-y-2.5" data-gw-desk>
    ${deskHeading(c)} ${diaryCard(c)} ${nowBox(c)} ${dangerBox(c)} ${roomBox(c)}
    ${aimNudge(c)}
    ${reasons.length === 0
      ? nothing
      : html`<div class="rounded border border-white/10 bg-white/5 p-2">
          <div class=${MUTED}>${translateText("gw.ui.since_last")}</div>
          ${reasons.map(
            (r) => html`<p class="text-sm text-white/80">${rich(c, r)}</p>`,
          )}
        </div>`}
    ${resultsBox(c)} ${deskPapers(c)} ${privateBox(c, own)}
    ${papers.length + talks.length + own.length === 0
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
  // ww196: shut against his grain, the person's own line is the why.
  const grain = grainLine(c, o);
  const why = o.open
    ? undefined
    : (grain ?? c.pack?.scenes[card.scene]?.why?.[o.id]);
  // The year's pick (ww179): what each project works on, never its result.
  const aim = card.scene.endsWith("_agenda")
    ? (c.pack?.craft?.[o.id]?.aim ?? null)
    : null;
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
    ${optionMarks(c, card, o.id)} ${o.open ? grainChip(o) : nothing}
    ${aim === null
      ? nothing
      : html`<p class="${MUTED} pl-1" data-gw-option-aim=${o.id}>
          ${translateText("gw.craft.aim", { text: aim })}
        </p>`}
    ${why === undefined
      ? nothing
      : html`<p class="${MUTED} pl-1" data-gw-why>
          ${rich(c, fillGw(why, c.pack, card, c.seat, c.data.date), pass)}
        </p>`}
    ${(card.asks ?? [])
      .filter((a) => a.options[0] === o.id)
      .map((a) => askButton(c, card, a))}
  </div>`;
}

/**
 * "먼저 묻는다": the talk that may open a locked option, called from here. The
 * name only: what the talk brings shows when it is over, back on this card.
 */
function askButton(c: GwCtx, card: GwCardView, a: GwAskView): TemplateResult {
  return html`<div class="space-y-0.5 pl-3">
    <button
      class="${BTN} w-full border-dashed"
      data-gw-ask=${a.topic}
      ?disabled=${!a.open}
      @click=${() => {
        c.send({ kind: "ask", card: card.uid, topic: a.topic });
        // The talk opens by itself as it comes; the card comes back after it.
        c.ui.summoned = Date.now();
        c.ui.readerUid = null;
        c.ui.armed = null;
        c.redraw();
      }}
    >
      ${translateText("gw.ui.ask_first", { name: personName(c.pack, a.who) })}
    </button>
    ${a.block === undefined
      ? nothing
      : html`<p class="${MUTED} pl-1" data-gw-ask-block>
          ${translateText(`gw.ui.block.${a.block}`)}
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

/** ww178: "외무부 해독: 저쪽은 물러설 생각이 없다 — 추정", on a note's card. */
function decryptLine(card: GwCardView): TemplateResult | typeof nothing {
  const d = card.decrypt;
  if (d === undefined) return nothing;
  return html`<p class=${MUTED} data-gw-decrypt>
    ${translateText("gw.ui.decrypt_line", {
      word: translateText(`gw.ui.decrypt_word.${d.word}`),
      stamp: translateText(`gw.ui.stamp.${d.stamp}`),
    })}
  </p>`;
}

/** The reader: the whole document, the voices around the table, the options. */
export function reader(c: GwCtx, card: GwCardView): TemplateResult {
  if (card.silent === true) return silentPage(c, card);
  const fill = (t: string) => fillGw(t, c.pack, card, c.seat, c.data.date);
  const after = brokenLine(c, card);
  const read = isReadOnly(card);
  // ww196: a paper's sections stand in for its stub scene's body.
  const body =
    card.paper === undefined ? bodyParts(fill(cardBody(c.pack, card))) : [];
  const pass = newPass();
  const brief =
    card.paper === undefined
      ? briefText(c.pack, card, c.seat, c.data.date)
      : null;
  const stamp = cardStamp(card);
  const armedOpt =
    c.ui.armed?.uid === card.uid
      ? card.options.find((o) => o.id === c.ui.armed?.option)
      : undefined;
  const close = () => {
    c.ui.readerUid = null;
    c.ui.armed = null;
    c.ui.backOpen = false;
    c.ui.backArmed = null;
    c.ui.redoArmed = null;
    c.ui.deptStaff = null;
    c.redraw();
  };
  return html`<div
    class="pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-black/25 p-3"
    @click=${(e: Event) => e.target === e.currentTarget && close()}
  >
    <article
      data-gw-reader=${card.scene}
      class="${GLASS} max-h-[88vh] w-full max-w-[640px] space-y-3 overflow-y-auto rounded-md p-5 text-white shadow-2xl"
    >
      <header class="flex items-center gap-2">
        ${card.paper === undefined
          ? html`<span class=${CHIP}
              >${translateText(`gw.ui.kind.${card.kind}`)}</span
            >`
          : paperChips(c, card)}
        ${stamp === null
          ? nothing
          : html`<span class=${CHIP} data-gw-stamp
              >${translateText(`gw.ui.stamp.${stamp}`)}</span
            >`}
        ${placeChip(c, card, close)}
        <span class="${MUTED} ml-auto">${fullDate(c.data.date)}</span>
        <button class="${MUTED} px-1 hover:text-white" @click=${close}>
          ✕
        </button>
      </header>
      <h2 class="text-lg font-bold leading-snug">${titleOf(c, card)}</h2>
      ${bearerLine(c, card, true)} ${deptLine(c, card)}
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
        ${decryptLine(card)}
      </div>
      ${card.scene.startsWith("gw_bm_") ? budgetStrip(c) : nothing}
      ${card.scene.startsWith("gw_lv_") ? lawStrip(c, card.scene) : nothing}
      ${projectDoneLine(c, card.scene)} ${paperBody(c, card, close)}
      ${(card.folded ?? []).length === 0
        ? nothing
        : html`<div class="space-y-0.5" data-gw-folded>
            <div class=${MUTED}>${translateText("gw.ui.folded_title")}</div>
            ${foldedLines(c.pack, card).map(
              (l) =>
                html`<p class="text-sm text-white/75">${rich(c, l, pass)}</p>`,
            )}
          </div>`}
      ${card.paper !== undefined && card.paper.form !== "news"
        ? deptVerdicts(c, card, close)
        : read
          ? html`<button
                class="${BTN} w-full text-center"
                data-gw-readdone
                @click=${() => {
                  c.send({ kind: "read", card: card.uid });
                  close();
                }}
              >
                ${translateText("gw.ui.read_done")}
              </button>
              ${deptVerdicts(c, card, close)}`
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
                    ${signWord(card, armedOpt.id)}
                  </button>`}
              ${backControl(c, card, close)} ${deptVerdicts(c, card, close)}
            </div>`}
    </article>
  </div>`;
}
