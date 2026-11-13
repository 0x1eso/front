import { gwCountry, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwFateMark } from "@openfront/engine-api/ww1914/GwFate";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwBargainMove,
  GwTableClaimView,
  GwTableLine,
  GwTableView,
  GwTableWord,
} from "@openfront/engine-api/ww1914/GwTable";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { gwFace } from "./GwFace";
import {
  choicesFor,
  clientName,
  detailWord,
  fateChip,
  fateDo,
  fateOrder,
  landMark,
  landPlaces,
  markOf,
  markWord,
  nextDetail,
  nextFate,
  sameMark,
} from "./GwFateModel";
import { officeTitle } from "./GwOffice";
import { SIGN } from "./GwPaper";
import { BTN, BTN_ON, CHIP, GLASS, HEAD, MUTED } from "./GwStyle";
import {
  aideLines,
  answerState,
  countryName,
  downMark,
  envoyName,
  envoyPerson,
  envoyTitle,
  GW_MAP_INK,
  landsOf,
  lineText,
  paintable,
  placeName,
  proposalOf,
  stillWanted,
  tagged,
  toggleLand,
  whyText,
} from "./GwTableModel";
import { personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const FLAG = "h-4 w-6 shrink-0 rounded-sm object-cover";
const TAG =
  "pointer-events-none fixed left-0 top-0 z-[880] whitespace-nowrap rounded bg-black/70 px-1 text-[11px] leading-4 text-white";

const flag = (tag: GwTag) =>
  html`<img
    class=${FLAG}
    src=${assetUrl(`flags/${gwCountry(tag).flag}.svg`)}
    alt=""
  />`;

const ink = (name: string) => {
  const [r, g, b] = GW_MAP_INK[name];
  return `background: rgb(${r} ${g} ${b})`;
};

/** A name kept on its tile by GwMapPaint; a new state's or an ally's after it. */
function tag(p: GwPlace, mark?: GwFateMark): TemplateResult {
  const [x, y] = GW_PLACES[p].center;
  const to =
    mark?.fate === "state" || mark?.fate === "ally" ? detailWord(mark) : null;
  return html`<span class=${TAG} data-gw-tag-at="${x} ${y}"
    >${placeName(p)}${to === null ? nothing : html` → ${to}`}</span
  >`;
}

/** The names over the painted draft. */
export function paintTags(c: GwCtx): TemplateResult | typeof nothing {
  const draft = c.ui.paint;
  if (draft === null) return nothing;
  const fates = c.seat.claims?.fates;
  return html`${draft.map((p) => tag(p, fates?.[p]))}`;
}

/** The names over what is on the table. */
export function tableTags(c: GwCtx): TemplateResult | typeof nothing {
  const t = c.seat.table;
  if (t === null || t === undefined || c.ui.tab !== "table") return nothing;
  // ww205: the proposal being painted names its painted places.
  if (t.due?.kind === "propose") {
    const fates = c.seat.claims?.fates ?? {};
    return html`${t.due.places
      .filter((p) => fates[p] !== undefined)
      .map((p) => tag(p, fates[p]))}`;
  }
  return html`${tagged(t).map((x) =>
    tag(
      x.place,
      x.fate === undefined
        ? undefined
        : { fate: x.fate, for: x.for, client: x.client },
    ),
  )}`;
}

function land(c: GwCtx, group: string, draft: readonly GwPlace[]) {
  const places = paintable(c.seat.tag).filter(
    (p) => GW_PLACES[p].group === group,
  );
  const on = places.filter((p) => draft.includes(p)).length;
  return html`<button
    class="${on === 0 ? BTN : BTN_ON} !px-2 !py-1"
    data-gw-paint-land=${group}
    @click=${() => {
      c.ui.paint = toggleLand(draft, group, c.seat.tag);
      c.redraw();
    }}
  >
    ${translateText(`gw.land.${group}`)}${on === 0
      ? nothing
      : html` <span class="text-amber-200">${on}</span>`}
  </button>`;
}

function signRow(c: GwCtx, draft: readonly GwPlace[]): TemplateResult {
  const was = c.seat.claims?.places ?? [];
  const same =
    draft.length === was.length && draft.every((p) => was.includes(p));
  return html`<div class="flex gap-1.5">
    <button
      class="${BTN} flex-1 text-center"
      data-gw-paint-sign
      ?disabled=${same || draft.length > 64}
      @click=${() => {
        c.send({ kind: "claims", places: [...draft] });
        c.ui.paint = null;
        c.redraw();
      }}
    >
      ${translateText("gw.claims.sign")}
    </button>
    <button
      class="${BTN} text-center"
      data-gw-paint-cancel
      @click=${() => {
        c.ui.paint = null;
        c.redraw();
      }}
    >
      ${translateText("gw.claims.cancel")}
    </button>
  </div>`;
}

/** One land's fate: a chip that cycles the fates, a second for what it needs. */
function fateRow(
  c: GwCtx,
  group: string,
  draft: readonly GwPlace[],
): TemplateResult {
  // The places painted in this land: what the chip shows and offers.
  const places = landPlaces(c.seat.tag, group).filter((p) => draft.includes(p));
  const ch = choicesFor(c.seat, places);
  const now = landMark(c.seat.claims?.fates, places);
  const mark = now === "mixed" ? null : now;
  const more = mark === null ? null : nextDetail(mark, ch);
  const detail = mark === null ? null : detailWord(mark);
  return html`<div
    class="flex flex-wrap items-center gap-1"
    data-gw-fate-land=${group}
  >
    <span class="mr-auto text-sm text-white/85"
      >${translateText(`gw.land.${group}`)}</span
    >
    <button
      class="${mark === null ? BTN : BTN_ON} !px-2 !py-1"
      data-gw-fate-chip=${group}
      data-gw-fate=${mark?.fate ?? now ?? "none"}
      @click=${() => c.send(fateOrder({ group }, nextFate(mark, ch)))}
    >
      ${now === "mixed"
        ? translateText("gw.fate.mixed")
        : mark === null
          ? translateText("gw.fate.none")
          : fateChip(mark.fate)}
    </button>
    ${detail === null
      ? nothing
      : more === null
        ? html`<span class=${CHIP} data-gw-fate-detail=${group}
            >${detail}</span
          >`
        : html`<button
            class="${BTN} !px-2 !py-1"
            data-gw-fate-detail=${group}
            @click=${() => c.send(fateOrder({ group }, more))}
          >
            ${detail}
          </button>`}
  </div>`;
}

/** What becomes of each land painted: open while the war is on or a table sits. */
function fateBox(c: GwCtx, draft: readonly GwPlace[]) {
  if (c.seat.claims?.fatesOpen !== true || draft.length === 0) return nothing;
  const groups = landsOf(c.seat.tag).filter((g) =>
    draft.some((p) => GW_PLACES[p].group === g),
  );
  return html`<section class=${BOX} data-gw-fates>
    <h3 class=${HEAD}>${translateText("gw.ui.fate_title")}</h3>
    <p class=${MUTED}>${translateText("gw.ui.fate_how")}</p>
    ${groups.map((g) => fateRow(c, g, draft))}
  </section>`;
}

/** The drawer while the seat paints: the map does the rest. */
export function paintPane(c: GwCtx): TemplateResult {
  const draft = c.ui.paint ?? [];
  return html`<div class="space-y-2.5" data-gw-paint>
    <section class=${BOX}>
      <h3 class=${HEAD}>${translateText("gw.claims.title")}</h3>
      <p class="text-sm text-white/80">${translateText("gw.claims.how")}</p>
      ${c.seat.claims?.priced === true
        ? html`<p class=${MUTED} data-gw-paint-priced>
            ${translateText("gw.claims.priced")}
          </p>`
        : nothing}
      ${signRow(c, draft)}
    </section>
    <section class=${BOX}>
      <h3 class=${HEAD}>${translateText("gw.claims.lands")}</h3>
      <div class="flex flex-wrap gap-1">
        ${landsOf(c.seat.tag).map((g) => land(c, g, draft))}
      </div>
    </section>
    ${draft.length === 0
      ? nothing
      : html`<section class=${BOX} data-gw-paint-list>
          <h3 class=${HEAD}>
            ${translateText("gw.claims.painted", { n: draft.length })}
          </h3>
          <p class="text-sm text-white/80">
            ${draft.map(placeName).join(", ")}
          </p>
        </section>`}
    ${fateBox(c, draft)}
  </div>`;
}

/** Under the national aim: the land it stands on. */
export function claimsBox(c: GwCtx): TemplateResult | typeof nothing {
  const v = c.seat.claims;
  if (v === undefined || (!v.open && v.places.length === 0)) return nothing;
  return html`<section class=${BOX} data-gw-claims>
    <h3 class=${HEAD}>${translateText("gw.claims.title")}</h3>
    ${v.places.length === 0
      ? html`<p class="text-sm text-white/75">
          ${translateText("gw.claims.ask")}
        </p>`
      : html`<p class="text-sm text-white/85" data-gw-claims-now>
            ${v.places.map(placeName).join(", ")}
          </p>
          <p class=${MUTED}>
            ${translateText("gw.claims.held", {
              n: v.held.length,
              total: v.places.length,
            })}
          </p>`}
    ${v.open
      ? html`<button
          class="${BTN} !px-2 !py-1"
          data-gw-claims-paint
          @click=${() => {
            c.ui.paint = [...v.places];
            c.redraw();
          }}
        >
          ${translateText(
            v.places.length === 0 ? "gw.claims.paint" : "gw.claims.repaint",
          )}
        </button>`
      : nothing}
  </section>`;
}

function aides(c: GwCtx, t: GwTableView) {
  const lines = aideLines(c.pack, c.seat, t);
  if (lines.length === 0) return nothing;
  return html`<section class="${BOX} border-amber-200/30" data-gw-aides>
    ${lines.map(
      (l) =>
        html`<div data-gw-aide=${l.office}>
          <div class=${MUTED}>
            ${personName(c.pack, l.who)} · ${officeTitle(c.seat.tag, l.office)}
          </div>
          <p class="text-sm leading-6 text-white/90">“${rich(c, l.text)}”</p>
        </div>`,
    )}
  </section>`;
}

function chairs(c: GwCtx, t: GwTableView) {
  return html`<div class="flex flex-wrap items-center gap-1" data-gw-chairs>
    ${t.order.map(
      (tag) =>
        html`<span
          class="flex items-center gap-1 rounded px-1 py-0.5 ${tag === t.speaker
            ? "bg-amber-300/25"
            : ""}"
          title=${envoyName(c.pack, tag, t, c.seat)}
          data-gw-chair=${tag}
          >${flag(tag)}</span
        >`,
    )}
  </div>`;
}

function claimRow(c: GwCtx, x: GwTableClaimView): TemplateResult {
  return html`<button
    class="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm hover:bg-white/10"
    data-gw-claim=${x.id}
    data-gw-claim-state=${x.state}
    @click=${() => c.fly?.(x.place)}
  >
    <span
      class="h-2.5 w-2.5 shrink-0 rounded-sm"
      style=${ink(x.state === "dropped" ? "free" : x.state)}
    ></span>
    <span class="shrink-0 text-white/90">${placeName(x.place)}</span>
    <span class="${MUTED} ml-auto min-w-0 text-right"
      >${countryName(x.against)} → ${countryName(x.by)} ·
      ${translateText(
        x.state === "traded" && x.offer !== null
          ? `gw.table.trade.${x.offer}`
          : `gw.table.state.${x.state}`,
      )}${x.fate === undefined
        ? nothing
        : html` ·
            <span data-gw-claim-fate=${x.fate}
              >${markWord({
                fate: x.fate,
                for: x.for,
                client: x.client,
                term: x.term,
              })}</span
            >`}</span
    >
  </button>`;
}

function agenda(c: GwCtx, t: GwTableView) {
  if (t.claims.length === 0) return nothing;
  const rows = [...t.claims].reverse();
  return html`<section class=${BOX} data-gw-agenda>
    <h3 class=${HEAD}>${translateText("gw.table.agenda")}</h3>
    <div class="max-h-56 overflow-y-auto">
      ${rows.map((x) => claimRow(c, x))}
    </div>
  </section>`;
}

const WORD_KEYS: Readonly<Record<GwTableWord, string>> = {
  yes: "gw.table.word.yes",
  no: "gw.table.word.no",
  offer: "gw.table.word.offer",
  press: "gw.table.word.press",
  drop: "gw.table.word.drop",
  yield: "gw.table.word.yield",
  joint: "gw.table.word.joint",
  hold: "gw.table.word.hold",
};

function question(x: GwTableClaimView, tag: GwTag): string {
  if (x.step === "partner") {
    return translateText(
      x.partner === tag ? "gw.ui.fate_partner_ask" : "gw.ui.fate_partner_wait",
      {
        place: placeName(x.place),
        by: countryName(x.by),
        partner: x.partner === undefined ? "" : countryName(x.partner),
        fate: x.fate === undefined ? fateChip("annex") : fateChip(x.fate),
      },
    );
  }
  const mine = x.by === tag;
  const key =
    x.step === "offered"
      ? x.offerBy === tag
        ? "gw.table.ask.waiting"
        : mine
          ? "gw.table.ask.counter"
          : "gw.table.ask.their_offer"
      : mine
        ? "gw.table.ask.refused"
        : x.step === "pressed"
          ? "gw.table.ask.pressed"
          : "gw.table.ask.claim";
  return translateText(key, {
    place: placeName(x.place),
    by: countryName(x.by),
    against: countryName(x.against),
    trade: x.offer === null ? "" : translateText(`gw.table.trade.${x.offer}`),
  });
}

function wordBox(c: GwCtx, t: GwTableView) {
  const due = t.due;
  if (due?.kind !== "word") return nothing;
  const x = t.claims.find((y) => y.id === due.claim)!;
  const yes = x.step === "offered" ? "gw.table.word.take" : WORD_KEYS.yes;
  return html`<section class="${BOX} border-amber-300/50" data-gw-word-box>
    <p class="text-sm font-bold text-amber-100" data-gw-question>
      ${question(x, c.seat.tag)}
    </p>
    <div class="grid grid-cols-2 gap-1.5">
      ${due.words.map(
        (w) =>
          html`<button
            class="${w === "offer" && c.ui.tableOffer
              ? BTN_ON
              : BTN} text-center"
            data-gw-word=${w}
            @click=${() => {
              if (w === "offer") {
                c.ui.tableOffer = !c.ui.tableOffer;
                c.redraw();
                return;
              }
              c.ui.tableOffer = false;
              c.send({
                kind: "table_word",
                claim: x.id,
                word: w,
                trade: null,
              });
            }}
          >
            ${translateText(w === "yes" ? yes : WORD_KEYS[w])}
          </button>`,
      )}
    </div>
    ${c.ui.tableOffer
      ? html`<div class="space-y-1" data-gw-trades>
          ${due.trades.map(
            (trade) =>
              html`<button
                class="${BTN} w-full"
                data-gw-trade=${trade}
                @click=${() => {
                  c.ui.tableOffer = false;
                  c.send({
                    kind: "table_word",
                    claim: x.id,
                    word: "offer",
                    trade,
                  });
                }}
              >
                <b>${translateText(`gw.table.trade.${trade}`)}</b>
                <span class="block text-xs text-white/65"
                  >${translateText(`gw.table.trade_note.${trade}`, {
                    place: placeName(x.place),
                  })}</span
                >
              </button>`,
          )}
        </div>`
      : nothing}
  </section>`;
}

/** The fate picked for the armed place: this turn's pick, else what was painted. */
export function armedMark(
  c: GwCtx,
  t: GwTableView,
  armed: GwPlace,
): GwFateMark {
  const picked = c.ui.tableFate;
  if (picked !== null && picked !== undefined && picked.place === armed) {
    return picked.mark;
  }
  return t.fates?.[armed] ?? { fate: "annex" };
}

/**
 * What the armed place is to become: a row of fates, then what it needs.
 * `mark`: what it is now (null: nothing painted); `pick` takes the new one.
 */
function fateButtons(
  c: GwCtx,
  armed: GwPlace,
  mark: GwFateMark | null,
  pick: (m: GwFateMark) => void,
) {
  const ch = choicesFor(c.seat, [armed]);
  const detail = (on: boolean, label: string, m: GwFateMark, id: string) =>
    html`<button
      class="${on ? BTN_ON : BTN} !px-2 !py-1"
      data-gw-turn-detail=${id}
      @click=${() => pick(m)}
    >
      ${label}
    </button>`;
  let details: TemplateResult[] = [];
  if (mark?.fate === "state") {
    details = ch.states.map((id) =>
      detail(
        mark.client === id,
        clientName(id),
        { fate: "state", client: id },
        id,
      ),
    );
  } else if (mark?.fate === "ally") {
    details = ch.allies.map((tag) =>
      detail(
        mark.for === tag,
        countryName(tag),
        { fate: "ally", for: tag },
        tag,
      ),
    );
  } else if (mark?.fate === "occupy") {
    details = (["short", "long"] as const).map((term) =>
      detail(
        (mark.term ?? "short") === term,
        translateText(`gw.fate.term.${term}`),
        { fate: "occupy", term },
        term,
      ),
    );
  }
  return html`<div class="space-y-1" data-gw-turn-fates>
    <div class="grid grid-cols-2 gap-1">
      ${ch.fates.map(
        (f) =>
          html`<button
            class="${mark?.fate === f ? BTN_ON : BTN} !px-2 !py-1 text-center"
            data-gw-turn-fate=${f}
            @click=${() =>
              pick(mark !== null && mark.fate === f ? mark : markOf(f, ch))}
          >
            ${fateDo(f)}
          </button>`,
      )}
    </div>
    ${details.length === 0
      ? nothing
      : html`<div class="flex flex-wrap gap-1">${details}</div>`}
  </div>`;
}

function turnBox(c: GwCtx, t: GwTableView) {
  const due = t.due;
  if (due?.kind !== "turn") return nothing;
  const armed = c.ui.tableArmed;
  const wanted = stillWanted(c.seat, t);
  return html`<section class="${BOX} border-amber-300/50" data-gw-turn>
    <p class="text-sm font-bold text-amber-100">
      ${translateText("gw.table.your_turn")}
    </p>
    ${armed === null
      ? html`<p class="text-sm text-white/80">
          ${translateText("gw.table.tap")}
        </p>`
      : html`${fateButtons(c, armed, armedMark(c, t, armed), (m) => {
            c.ui.tableFate = { place: armed, mark: m };
            c.redraw();
          })}
          <button
            class="${BTN_ON} w-full text-center"
            data-gw-claim-go
            @click=${() => {
              // The fate goes with the claim: painted on the place first.
              const mark = armedMark(c, t, armed);
              if (!sameMark(t.fates?.[armed] ?? { fate: "annex" }, mark)) {
                c.send(fateOrder({ place: armed }, mark));
              }
              c.send({ kind: "table_claim", place: armed });
              c.ui.tableArmed = null;
              c.ui.tableFate = null;
            }}
          >
            ${translateText("gw.table.demand", { place: placeName(armed) })}
          </button>`}
    ${c.ui.tableBarred === null
      ? nothing
      : html`<p class=${MUTED} data-gw-barred>
          ${translateText("gw.table.barred", {
            place: placeName(c.ui.tableBarred),
          })}
        </p>`}
    ${wanted.length === 0
      ? nothing
      : html`<div class="flex flex-wrap gap-1" data-gw-wanted>
          ${wanted.slice(0, 12).map(
            (p) =>
              html`<button
                class="${p === armed ? BTN_ON : BTN} !px-2 !py-1"
                data-gw-wanted-place=${p}
                @click=${() => {
                  c.ui.tableArmed = p;
                  c.fly?.(p);
                  c.redraw();
                }}
              >
                ${placeName(p)}
              </button>`,
          )}
        </div>`}
    <button
      class="${BTN} w-full text-center"
      data-gw-table-pass
      @click=${() => {
        c.ui.tableArmed = null;
        c.send({ kind: "table_pass" });
      }}
    >
      ${translateText("gw.table.pass")}
    </button>
  </section>`;
}

// ---- ww205: a table of one beaten country, in whole proposals ----

/** The lands among `places`, west to east. */
function landsAmong(c: GwCtx, places: readonly GwPlace[]): string[] {
  return landsOf(c.seat.tag).filter((g) =>
    places.some((p) => GW_PLACES[p].group === g),
  );
}

/** The whole proposal: every place of the beaten painted, then the terms. */
function proposeBox(c: GwCtx, t: GwTableView) {
  const due = t.due;
  if (due?.kind !== "propose") return nothing;
  const beaten = t.talk?.beaten ?? null;
  const places = due.places;
  const fates = c.seat.claims?.fates ?? t.fates ?? {};
  const painted = places.filter((p) => fates[p] !== undefined).length;
  const armed =
    c.ui.tableArmed !== null && places.includes(c.ui.tableArmed)
      ? c.ui.tableArmed
      : null;
  return html`<section class="${BOX} border-amber-300/50" data-gw-propose>
    <h3 class=${HEAD}>${translateText("gw.bargain.propose_title")}</h3>
    <p class="text-sm leading-6 text-white/85">
      ${translateText("gw.bargain.propose_how", {
        country: beaten === null ? "" : countryName(beaten),
      })}
    </p>
    <p class=${MUTED}>${translateText("gw.bargain.propose_plan")}</p>
    ${armed === null
      ? html`<p class=${MUTED}>${translateText("gw.bargain.tap")}</p>`
      : html`<div
          class="space-y-1 rounded border border-amber-300/30 p-1.5"
          data-gw-propose-armed=${armed}
        >
          <p class="text-sm font-bold text-amber-100">${placeName(armed)}</p>
          ${fateButtons(c, armed, fates[armed] ?? null, (m) =>
            c.send(fateOrder({ place: armed }, m)),
          )}
        </div>`}
    ${landsAmong(c, places).map((g) => fateRow(c, g, places))}
    <div class="flex flex-wrap gap-1" data-gw-propose-places>
      ${places.slice(0, 24).map(
        (p) =>
          html`<button
            class="${p === armed ? BTN_ON : BTN} !px-2 !py-1"
            data-gw-propose-place=${p}
            @click=${() => {
              c.ui.tableArmed = p === armed ? null : p;
              c.fly?.(p);
              c.redraw();
            }}
          >
            ${placeName(p)}${fates[p] === undefined
              ? nothing
              : html` <span class="text-amber-200"
                  >${fateChip(fates[p].fate)}</span
                >`}
          </button>`,
      )}
    </div>
    <p class=${MUTED} data-gw-propose-count>
      ${translateText("gw.bargain.painted", {
        n: painted,
        total: places.length,
      })}
    </p>
    <button
      class=${SIGN}
      data-gw-propose-go
      @click=${() => {
        c.ui.tableArmed = null;
        c.send({ kind: "table_propose" });
      }}
    >
      ${translateText("gw.bargain.propose")}
    </button>
  </section>`;
}

const ANSWER_CHIP: Readonly<Record<string, string>> = {
  agreed: "bg-emerald-400/25 text-emerald-100",
  refused: "bg-red-400/30 text-red-100",
  final: "bg-red-500/30 text-red-100",
  waiting: "bg-amber-300/25 text-amber-100",
  partner: "bg-amber-300/25 text-amber-100",
  dropped: "bg-white/10 text-white/60",
};

/** The seat's move on a refused place: insist, step down, trade, let go. */
function moveRow(
  c: GwCtx,
  x: GwTableClaimView,
  places: readonly GwPlace[],
): TemplateResult {
  const picks = (c.ui.bargain ??= {});
  const now = picks[x.id] ?? { move: "insist" as const, place: null };
  const set = (move: GwBargainMove, place: GwPlace | null = null) => {
    picks[x.id] = { move, place };
    c.redraw();
  };
  const down = downMark(x);
  const btn = (move: GwBargainMove, label: string) =>
    html`<button
      class="${now.move === move ? BTN_ON : BTN} !px-2 !py-1 text-center"
      data-gw-move=${move}
      @click=${() => set(move, move === "trade" ? now.place : null)}
    >
      ${label}
    </button>`;
  return html`<div class="space-y-1" data-gw-moves=${x.id}>
    <div class="grid grid-cols-2 gap-1">
      ${btn("insist", translateText("gw.bargain.move.insist"))}
      ${down === null
        ? nothing
        : btn(
            "down",
            translateText("gw.bargain.move.down", { fate: markWord(down) }),
          )}
      ${places.length === 0
        ? nothing
        : btn("trade", translateText("gw.bargain.move.trade"))}
      ${btn("drop", translateText("gw.bargain.move.drop"))}
    </div>
    ${now.move !== "trade"
      ? nothing
      : html`<p class=${MUTED}>${translateText("gw.bargain.trade_pick")}</p>
          <div class="flex flex-wrap gap-1" data-gw-trade-places>
            ${places.slice(0, 16).map(
              (p) =>
                html`<button
                  class="${now.place === p ? BTN_ON : BTN} !px-2 !py-1"
                  data-gw-trade-place=${p}
                  @click=${() => {
                    set("trade", p);
                    c.fly?.(p);
                  }}
                >
                  ${placeName(p)}
                </button>`,
            )}
          </div>`}
  </div>`;
}

/** The beaten seat's yes or no to one place. */
function answerToggle(c: GwCtx, x: GwTableClaimView): TemplateResult {
  const said = (c.ui.answers ??= {});
  const now = said[x.id];
  const btn = (yes: boolean) =>
    html`<button
      class="${now === yes ? BTN_ON : BTN} !px-2 !py-1 text-center"
      data-gw-say=${yes ? "yes" : "no"}
      @click=${() => {
        said[x.id] = yes;
        c.redraw();
      }}
    >
      ${translateText(yes ? "gw.bargain.yes" : "gw.bargain.no")}
    </button>`;
  return html`<div class="grid grid-cols-2 gap-1">
    ${btn(true)} ${btn(false)}
  </div>`;
}

/** One place of the proposal: its fate, the answer, and the reason in words. */
function answerRow(
  c: GwCtx,
  t: GwTableView,
  x: GwTableClaimView,
): TemplateResult {
  const st = answerState(x);
  const why = whyText(x);
  const due = t.due;
  const mark = { fate: x.fate ?? "annex", for: x.for, client: x.client };
  return html`<div
    class="space-y-1 rounded border border-white/10 bg-black/20 p-1.5"
    data-gw-answer=${x.id}
    data-gw-answer-state=${st}
  >
    <div class="flex flex-wrap items-center gap-1.5">
      <button
        class="text-left text-sm font-bold text-white/90"
        @click=${() => c.fly?.(x.place)}
      >
        ${placeName(x.place)}
      </button>
      <span class=${MUTED}>${markWord({ ...mark, term: x.term })}</span>
      <span
        class="ml-auto inline-block rounded px-1.5 py-0.5 text-xs ${ANSWER_CHIP[
          st
        ]}"
        data-gw-answer-chip=${st}
        >${translateText(`gw.bargain.state.${st}`)}</span
      >
    </div>
    ${why === ""
      ? nothing
      : html`<p class="text-sm leading-6 text-white/85" data-gw-why=${x.why!}>
          “${why}”
        </p>`}
    ${due?.kind === "bargain" && due.claims.includes(x.id)
      ? moveRow(c, x, due.places)
      : nothing}
    ${due?.kind === "answer" && due.claims.includes(x.id)
      ? answerToggle(c, x)
      : nothing}
  </div>`;
}

/** The proposal on the table and its answers, then this round's controls. */
function answersBox(c: GwCtx, t: GwTableView) {
  const talk = t.talk ?? null;
  if (talk === null) return nothing;
  const rows = proposalOf(t);
  if (rows.length === 0) return nothing;
  const due = t.due;
  const by = rows[0].by;
  const beaten = talk.beaten;
  const head =
    due?.kind === "answer"
      ? translateText("gw.bargain.answer_title", { by: countryName(by) })
      : translateText("gw.bargain.answers_title", {
          country: beaten === null ? "" : countryName(beaten),
        });
  const mine = c.seat.tag === by;
  const picks = c.ui.bargain ?? {};
  const said = c.ui.answers ?? {};
  const tradeOpen =
    due?.kind === "bargain" &&
    due.claims.some(
      (id) => picks[id]?.move === "trade" && picks[id]?.place === null,
    );
  return html`<section class="${BOX} border-amber-200/40" data-gw-answers>
    <div class="flex items-center gap-2">
      <h3 class=${HEAD}>${head}</h3>
      ${talk.round === 0
        ? nothing
        : html`<span class="${CHIP} ml-auto" data-gw-round=${talk.round}
            >${translateText("gw.bargain.round", {
              n: talk.round,
              total: talk.rounds,
            })}</span
          >`}
    </div>
    ${mine && beaten !== null
      ? html`<p class=${MUTED} data-gw-mood=${talk.mood}>
          ${translateText("gw.bargain.mood", {
            mood: translateText(`gw.bargain.moods.${talk.mood}`),
          })}
        </p>`
      : nothing}
    ${due?.kind === "answer"
      ? html`<p class=${MUTED}>${translateText("gw.bargain.answer_how")}</p>`
      : nothing}
    <div class="max-h-[46vh] space-y-1 overflow-y-auto sm:max-h-none">
      ${rows.map((x) => answerRow(c, t, x))}
    </div>
    ${due?.kind === "bargain"
      ? html`${due.last
            ? html`<p class="text-sm text-amber-100" data-gw-last>
                ${translateText("gw.bargain.last")}
              </p>`
            : nothing}
          <button
            class=${SIGN}
            data-gw-bargain-go
            ?disabled=${tradeOpen}
            @click=${() => {
              const moves = due.claims.map((id) => {
                const p = picks[id] ?? { move: "insist" as const, place: null };
                return { claim: id, move: p.move, place: p.place };
              });
              c.ui.bargain = {};
              c.send({ kind: "table_bargain", moves });
            }}
          >
            ${translateText("gw.bargain.again")}
          </button>`
      : nothing}
    ${due?.kind === "answer"
      ? html`<button
            class=${SIGN}
            data-gw-answer-go
            ?disabled=${due.claims.some((id) => said[id] === undefined)}
            @click=${() => {
              const answers = due.claims.map((id) => ({
                claim: id,
                yes: said[id] === true,
              }));
              c.ui.answers = {};
              c.send({ kind: "table_answer", answers, walk: false });
            }}
          >
            ${translateText("gw.bargain.send")}
          </button>
          ${due.walk
            ? html`<button
                class="${BTN} w-full text-center"
                data-gw-walk
                @click=${() =>
                  c.send({ kind: "table_answer", answers: [], walk: true })}
              >
                ${translateText("gw.bargain.walk")}
              </button>`
            : nothing}`
      : nothing}
  </section>`;
}

/** What closes the month, or leaves the rest of it to the delegation. */
export function closeRow(c: GwCtx, t: GwTableView) {
  const { seat, data } = c;
  if (data.ended !== null) return nothing;
  // The treaty is signed: what is left of the game is the way home.
  if (t.closed) {
    return html`<button
      class="${seat.ready ? BTN_ON : BTN} w-full text-center"
      data-gw-table-end
      ?disabled=${seat.readyBlock !== null}
      @click=${() =>
        c.send({ kind: "ready", chapter: data.chapter, on: !seat.ready })}
    >
      ${translateText(seat.ready ? "gw.panel.not_ready" : "gw.table.finish")}
    </button>`;
  }
  const papers = seat.readyBlock !== null;
  return html`<div class="space-y-1" data-gw-table-close>
    ${t.done
      ? html`<p class="text-sm text-amber-100">
          ${translateText("gw.table.month_done", { n: t.session + 1 })}
        </p>`
      : nothing}
    ${papers
      ? html`<button
          class="${BTN} w-full text-center"
          data-gw-table-papers
          @click=${() => {
            c.ui.tab = "desk";
            c.redraw();
          }}
        >
          ${translateText("gw.table.papers", { n: seat.desk.length })}
        </button>`
      : html`<button
          class="${seat.ready ? BTN_ON : BTN} w-full text-center"
          data-gw-table-ready
          @click=${() =>
            c.send({ kind: "ready", chapter: data.chapter, on: !seat.ready })}
        >
          ${translateText(
            seat.ready
              ? "gw.panel.not_ready"
              : t.done
                ? "gw.table.close_month"
                : "gw.table.leave_it",
          )}
        </button>`}
  </div>`;
}

/** The places the treaty gave, each with what becomes of it (ww199). */
function treatyFates(t: GwTableView) {
  const given = t.claims.filter(
    (x) => x.state === "agreed" || x.state === "imposed",
  );
  if (given.length === 0) return nothing;
  return html`<ul class="space-y-0.5 text-sm" data-gw-treaty-fates>
    ${given.map(
      (x) =>
        html`<li class="flex gap-1.5" data-gw-treaty-fate=${x.fate ?? "annex"}>
          <span class="shrink-0 text-white/90">${placeName(x.place)}</span>
          <span class="${MUTED} ml-auto min-w-0 text-right"
            >${countryName(x.by)} ·
            ${markWord({
              fate: x.fate ?? "annex",
              for: x.for,
              client: x.client,
              term: x.term,
            })}</span
          >
        </li>`,
    )}
  </ul>`;
}

/** The treaty: who has what now. */
function treaty(c: GwCtx, t: GwTableView) {
  if (!t.closed) return nothing;
  const words = c.pack?.table?.close?.[t.role];
  const signed = t.sign?.signed ?? null;
  return html`<section class=${BOX} data-gw-treaty>
    <h3 class=${HEAD}>${translateText("gw.table.signed")}</h3>
    ${words === undefined
      ? nothing
      : html`<p class="text-sm leading-6 text-white/90">${rich(c, words)}</p>`}
    ${treatyFates(t)}
    ${signed === null
      ? nothing
      : html`<p class=${MUTED} data-gw-signed=${signed}>
          ${translateText(`gw.fate.signed.${signed}`)}
        </p>`}
  </section>`;
}

/** The ruler's hand on the treaty: how he signs, once (ww199). */
function signBox(c: GwCtx, t: GwTableView) {
  const sign = t.sign ?? null;
  if (sign === null || t.closed) return nothing;
  if (sign.signed !== null) {
    return html`<p class="${MUTED} px-1" data-gw-signed=${sign.signed}>
      ${translateText(`gw.fate.signed.${sign.signed}`)}
    </p>`;
  }
  if (sign.ways.length === 0) return nothing;
  return html`<section class=${BOX} data-gw-sign>
    <h3 class=${HEAD}>${translateText("gw.ui.fate_sign_title")}</h3>
    <div class="space-y-1">
      ${sign.ways.map(
        (how) =>
          html`<button
            class="${BTN} w-full"
            data-gw-sign-how=${how}
            @click=${() => c.send({ kind: "treaty_sign", how })}
          >
            ${translateText(`gw.fate.sign.${how}`)}
          </button>`,
      )}
    </div>
  </section>`;
}

/** The drawer at the table: who is here, what is due, what was said. */
export function tableTab(c: GwCtx): TemplateResult | typeof nothing {
  const t = c.seat.table;
  if (t === null || t === undefined) return nothing;
  const opening = c.pack?.table?.open?.[t.role];
  return html`<div class="space-y-2.5" data-gw-table data-gw-role=${t.role}>
    <section class=${BOX}>
      <div class="flex items-center gap-2">
        <h3 class=${HEAD}>${translateText("gw.table.title")}</h3>
        <span class="${CHIP} ml-auto" data-gw-session
          >${translateText("gw.table.session", {
            n: t.session + 1,
            total: t.sessions,
          })}</span
        >
      </div>
      ${chairs(c, t)}
      ${t.session === 0 && t.claims.length === 0 && opening !== undefined
        ? html`<p class="text-sm leading-6 text-white/85" data-gw-table-open>
            ${rich(c, opening)}
          </p>`
        : nothing}
    </section>
    ${treaty(c, t)} ${wordBox(c, t)} ${turnBox(c, t)} ${proposeBox(c, t)}
    ${answersBox(c, t)} ${aides(c, t)} ${closeRow(c, t)} ${signBox(c, t)}
    ${t.talk === null || t.talk === undefined ? agenda(c, t) : nothing}
  </div>`;
}

function latest(t: GwTableView): GwTableLine | undefined {
  return t.lines[t.lines.length - 1];
}

/** The speaker's 32 px face; nothing for a chair without one. */
function envoyFace(
  c: GwCtx,
  who: GwTag,
  t: GwTableView,
  name: string,
): TemplateResult | typeof nothing {
  const id = envoyPerson(who, t, c.seat);
  if (id === null) return nothing;
  return gwFace(
    c.faces,
    id,
    translateText("gw.ui.face_alt", { name }),
    "h-8 w-8",
    html``,
  );
}

/** Who is speaking now, across the bottom of the map. */
export function speech(c: GwCtx): TemplateResult | typeof nothing {
  const t = c.seat.table;
  const line = t === null || t === undefined ? undefined : latest(t);
  if (t === null || t === undefined || line === undefined || t.closed) {
    return nothing;
  }
  if (c.ui.tab !== "table") return nothing;
  const text = lineText(c.pack, t, line);
  const talking = !t.done && t.due === null;
  const name = envoyName(c.pack, line.who, t, c.seat);
  return html`<div
    class="${GLASS} pointer-events-auto fixed bottom-[calc(42vh+0.5rem)] left-2 right-14 z-[897] rounded p-2.5 text-white sm:bottom-3 sm:left-[416px] sm:right-3 sm:mx-auto sm:max-w-[720px]"
    data-gw-speech
    data-gw-line=${line.n}
    data-gw-word=${line.word}
  >
    <div class="flex items-center gap-2">
      ${envoyFace(c, line.who, t, name)} ${flag(line.who)}
      <span class="text-sm font-bold" data-gw-envoy=${line.who}>${name}</span>
      <span class=${MUTED}>${envoyTitle(c.pack, line.who, c.seat)}</span>
      ${talking
        ? html`<button
            class="${BTN} ml-auto !px-2 !py-0.5 text-xs"
            data-gw-table-next
            @click=${() => c.send({ kind: "table_next" })}
          >
            ${translateText("gw.table.next")}
          </button>`
        : nothing}
    </div>
    <p
      class="mt-1 text-[15px] leading-7 text-white/95"
      style="animation: gwfade .35s ease-out"
    >
      ${rich(c, text)}
    </p>
  </div>`;
}
