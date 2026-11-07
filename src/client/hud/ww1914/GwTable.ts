import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwTableClaimView,
  GwTableLine,
  GwTableView,
  GwTableWord,
} from "@openfront/engine-api/ww1914/GwTable";
import { gwCountry, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { BTN, BTN_ON, CHIP, GLASS, HEAD, MUTED } from "./GwStyle";
import {
  aideLines,
  countryName,
  envoyName,
  envoyTitle,
  GW_MAP_INK,
  landsOf,
  lineText,
  paintable,
  placeName,
  stillWanted,
  tagged,
  toggleLand,
} from "./GwTableModel";
import { personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const FLAG = "h-4 w-6 shrink-0 rounded-sm object-cover";
const TAG =
  "pointer-events-none fixed left-0 top-0 z-[880] whitespace-nowrap rounded bg-black/70 px-1 text-[11px] leading-4 text-white";

const flag = (tag: GwTag) =>
  html`<img class=${FLAG} src=${assetUrl(`flags/${gwCountry(tag).flag}.svg`)} alt="" />`;

const ink = (name: string) => {
  const [r, g, b] = GW_MAP_INK[name];
  return `background: rgb(${r} ${g} ${b})`;
};

/** A name kept on its tile by GwMapPaint. */
function tag(p: GwPlace, extra = ""): TemplateResult {
  const [x, y] = GW_PLACES[p].center;
  return html`<span class="${TAG} ${extra}" data-gw-tag-at="${x} ${y}"
    >${placeName(p)}</span
  >`;
}

/** The names over the painted draft. */
export function paintTags(c: GwCtx): TemplateResult | typeof nothing {
  const draft = c.ui.paint;
  if (draft === null) return nothing;
  return html`${draft.map((p) => tag(p))}`;
}

/** The names over what is on the table. */
export function tableTags(c: GwCtx): TemplateResult | typeof nothing {
  const t = c.seat.table;
  if (t === null || t === undefined || c.ui.tab !== "table") return nothing;
  return html`${tagged(t).map((x) => tag(x.place))}`;
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
      (l) => html`<div data-gw-aide=${l.office}>
        <div class=${MUTED}>
          ${personName(c.pack, l.who)} ·
          ${translateText(`gw.office.${l.office}`)}
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
    <span class="truncate text-white/90">${placeName(x.place)}</span>
    <span class="${MUTED} ml-auto shrink-0"
      >${countryName(x.against)} → ${countryName(x.by)} ·
      ${translateText(
        x.state === "traded" && x.offer !== null
          ? `gw.table.trade.${x.offer}`
          : `gw.table.state.${x.state}`,
      )}</span
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
};

function question(x: GwTableClaimView, tag: GwTag): string {
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
    trade:
      x.offer === null ? "" : translateText(`gw.table.trade.${x.offer}`),
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
            class="${w === "offer" && c.ui.tableOffer ? BTN_ON : BTN} text-center"
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
      : html`<button
          class="${BTN_ON} w-full text-center"
          data-gw-claim-go
          @click=${() => {
            c.send({ kind: "table_claim", place: armed });
            c.ui.tableArmed = null;
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

/** What closes the month, or leaves the rest of it to the delegation. */
function closeRow(c: GwCtx, t: GwTableView) {
  const { seat, data } = c;
  if (data.ended !== null || t.closed) return nothing;
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

/** The treaty: who has what now. */
function treaty(c: GwCtx, t: GwTableView) {
  if (!t.closed) return nothing;
  const words = c.pack?.table?.close?.[t.role];
  return html`<section class=${BOX} data-gw-treaty>
    <h3 class=${HEAD}>${translateText("gw.table.signed")}</h3>
    ${words === undefined
      ? nothing
      : html`<p class="text-sm leading-6 text-white/90">
          ${rich(c, words)}
        </p>`}
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
    ${treaty(c, t)} ${wordBox(c, t)} ${turnBox(c, t)} ${aides(c, t)}
    ${closeRow(c, t)} ${agenda(c, t)}
  </div>`;
}

function latest(t: GwTableView): GwTableLine | undefined {
  return t.lines[t.lines.length - 1];
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
  return html`<div
    class="${GLASS} pointer-events-auto fixed inset-x-2 bottom-[calc(42vh+0.5rem)] z-[897] rounded p-2.5 text-white sm:bottom-3 sm:left-[416px] sm:right-3 sm:mx-auto sm:max-w-[720px]"
    data-gw-speech
    data-gw-line=${line.n}
    data-gw-word=${line.word}
  >
    <div class="flex items-center gap-2">
      ${flag(line.who)}
      <span class="text-sm font-bold" data-gw-envoy=${line.who}
        >${envoyName(c.pack, line.who, t, c.seat)}</span
      >
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
