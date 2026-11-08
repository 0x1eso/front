// Great War 1914 with friends: the table, telegrams, secret treaties (design
// §9) and the memoirs side by side at the end.
import {
  GW_ALLY_GRACE,
  GW_CIPHERS,
  GW_CLAUSE_KINDS,
  GW_LINES,
  GW_LOAN_MAX,
  GW_SIDES,
  GW_TELEGRAM_MAX,
  GW_THEATRES,
  GW_TREATY_CLAUSES_MAX,
  GwClause,
  GwClauseKind,
  GwMemoir,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  gwCountry,
  GwTag,
  isGwTag,
} from "@openfront/engine-api/ww1914/GwCountries";
import { gwCleanTelegram } from "@openfront/engine-api/ww1914/GwOrders";
import type {
  GwTelegramView,
  GwTreatyView,
} from "@openfront/engine-api/ww1914/GwView";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { BTN, BTN_ON, CHIP, GLASS, HEAD, MUTED } from "./GwStyle";
import { endingTitle, frontLine, shortDate } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const FIELD =
  "rounded border border-white/25 bg-slate-800 px-2 py-1 text-sm text-white";

const countryName = (tag: GwTag): string => translateText(`gw.country.${tag}`);

function flag(tag: GwTag) {
  return html`<img
    class="h-3.5 w-5 rounded-sm object-cover"
    src=${assetUrl(`flags/${gwCountry(tag).flag}.svg`)}
    alt=""
  />`;
}

/** Who sits at the table and how they stand this chapter. */
function table(c: GwCtx): TemplateResult {
  return html`<section class=${BOX} data-gw-table>
    <h3 class=${HEAD}>${translateText("gw.diplo.table")}</h3>
    ${c.data.roster.map((r) => {
      const state = r.regent
        ? "regent"
        : r.away
          ? "away"
          : r.ready
            ? "ready"
            : "reading";
      return html`<div
        class="flex items-center gap-2 text-sm"
        data-gw-seat-row=${r.tag}
      >
        ${flag(r.tag)}
        <span class="text-white/90">${countryName(r.tag)}</span>
        <span class=${MUTED}>${c.holder?.(r.smallID) ?? ""}</span>
        ${r.host
          ? html`<span class=${CHIP}>${translateText("gw.diplo.host")}</span>`
          : nothing}
        <span class="ml-auto ${CHIP}" data-gw-seat-state=${state}
          >${translateText(`gw.diplo.seat.${state}`)}</span
        >
      </div>`;
    })}
  </section>`;
}

/** 느리게 읽기: anyone asks, the host agrees, everyone gets the time. */
function slowVote(c: GwCtx): TemplateResult | typeof nothing {
  const { data, seat } = c;
  if (data.deadlineTick === null) return nothing;
  const me = data.roster.find((r) => r.smallID === seat.smallID);
  const asked = data.slow.asked;
  const spent = data.slow.granted >= data.slow.max;
  return html`<section class=${BOX} data-gw-slow>
    <button
      class="${asked.includes(seat.smallID) ? BTN_ON : BTN} w-full"
      data-gw-slow-ask
      ?disabled=${spent}
      @click=${() => c.send({ kind: "slow" })}
    >
      ${translateText("gw.diplo.slow_ask")}
    </button>
    <p class=${MUTED}>
      ${translateText("gw.diplo.slow_hint", {
        n: data.slow.max - data.slow.granted,
      })}
    </p>
    ${me?.host === true && asked.length > 0
      ? html`<p class="text-sm text-amber-200">
            ${translateText("gw.diplo.slow_asked", { n: asked.length })}
          </p>
          <div class="flex gap-2">
            <button
              class=${BTN}
              data-gw-slow-grant
              @click=${() => c.send({ kind: "slow_answer", grant: true })}
            >
              ${translateText("gw.diplo.slow_grant")}
            </button>
            <button
              class=${BTN}
              data-gw-slow-deny
              @click=${() => c.send({ kind: "slow_answer", grant: false })}
            >
              ${translateText("gw.diplo.slow_deny")}
            </button>
          </div>`
      : nothing}
  </section>`;
}

function wire(t: GwTelegramView): TemplateResult {
  return html`<article
    class="rounded border border-white/10 bg-white/5 p-2 text-sm"
    data-gw-wire=${t.box}
  >
    <div class="flex items-center gap-1.5 ${MUTED}">
      ${flag(t.from)} ${countryName(t.from)} → ${flag(t.to)}
      ${countryName(t.to)}
      <span class="ml-auto">${shortDate(t.date)}</span>
    </div>
    <p class="mt-1 whitespace-pre-wrap break-words text-white/90">${t.text}</p>
    <p class=${MUTED}>
      ${translateText(`gw.wire.box.${t.box}`)}${t.box === "sent"
        ? ` · ${translateText(`gw.wire.cipher.${t.cipher}`)} · ${translateText(
            t.delivered ? "gw.wire.delivered" : "gw.wire.on_the_way",
          )}`
        : ""}
    </p>
  </article>`;
}

function wires(c: GwCtx): TemplateResult {
  const { seat, ui, data } = c;
  const d = ui.diplo;
  const others = data.roster.filter((r) => r.smallID !== seat.smallID);
  const to = d.wireTo ?? others[0]?.tag ?? null;
  const left = seat.diplo.wiresLeft;
  const cost = GW_CIPHERS[d.cipher].cost;
  const clean = gwCleanTelegram(d.text);
  const canSend =
    to !== null &&
    clean.length > 0 &&
    left > 0 &&
    seat.world.authority >= cost &&
    data.ended === null;
  return html`<section class=${BOX} data-gw-wires>
    <h3 class=${HEAD}>${translateText("gw.diplo.wires")}</h3>
    <div class="flex flex-wrap items-center gap-2">
      <select
        class=${FIELD}
        data-gw-wire-to
        @change=${(e: Event) => {
          d.wireTo = (e.target as HTMLSelectElement).value as GwTag;
          c.redraw();
        }}
      >
        ${others.map(
          (r) =>
            html`<option value=${r.tag} ?selected=${r.tag === to}>
              ${countryName(r.tag)}
            </option>`,
        )}
      </select>
      <select
        class=${FIELD}
        data-gw-wire-cipher
        @change=${(e: Event) => {
          d.cipher = Number((e.target as HTMLSelectElement).value);
          c.redraw();
        }}
      >
        ${GW_CIPHERS.map(
          (x, i) =>
            html`<option value=${i} ?selected=${i === d.cipher}>
              ${translateText(`gw.wire.cipher.${i}`)} ·
              ${translateText("gw.wire.cost", { n: x.cost })}
            </option>`,
        )}
      </select>
    </div>
    <textarea
      class="${FIELD} block h-20 w-full resize-none"
      data-gw-wire-text
      maxlength=${GW_TELEGRAM_MAX}
      placeholder=${translateText("gw.diplo.wire_placeholder")}
      .value=${d.text}
      @keydown=${(e: Event) => e.stopPropagation()}
      @input=${(e: Event) => {
        d.text = (e.target as HTMLTextAreaElement).value;
        c.redraw();
      }}
    ></textarea>
    <div class="flex items-center gap-2">
      <span class=${MUTED}
        >${translateText("gw.diplo.wire_left", {
          chars: GW_TELEGRAM_MAX - d.text.length,
          n: left,
        })}</span
      >
      <button
        class="${BTN} ml-auto"
        data-gw-wire-send
        ?disabled=${!canSend}
        @click=${() => {
          if (to === null) return;
          c.send({ kind: "telegram", to, cipher: d.cipher, text: clean });
          d.text = "";
          c.redraw();
        }}
      >
        ${translateText("gw.diplo.wire_send")}
      </button>
    </div>
    <p class=${MUTED}>${translateText("gw.diplo.wire_hint")}</p>
    ${[...seat.diplo.telegrams].reverse().map(wire)}
  </section>`;
}

/** A clause in words. */
export function clauseText(cl: GwClause, a: GwTag, b: GwTag): string {
  const other = cl.by === a ? b : a;
  const theatre =
    cl.theatre === null ? "" : translateText(`gw.theatre.${cl.theatre}`);
  const line =
    cl.kind === "territory" && cl.theatre !== null
      ? frontLine(cl.theatre, cl.value)
      : "";
  return translateText(`gw.treaty.clause.${cl.kind}`, {
    by: countryName(cl.by),
    other: countryName(other),
    theatre,
    line,
    n: cl.kind === "entry" ? cl.value + 1 : cl.value,
    grace: GW_ALLY_GRACE,
  });
}

function treaty(c: GwCtx, t: GwTreatyView): TemplateResult {
  const d = c.ui.diplo;
  return html`<article
    class="space-y-1 rounded border border-white/10 bg-white/5 p-2 text-sm"
    data-gw-treaty=${t.state}
  >
    <div class="flex items-center gap-1.5 ${MUTED}">
      ${flag(t.from)} ${countryName(t.from)} · ${flag(t.to)}
      ${countryName(t.to)}
      <span class="ml-auto ${CHIP}"
        >${translateText(`gw.treaty.state.${t.state}`)}</span
      >
    </div>
    ${t.clauses.map(
      (x) =>
        html`<p class="text-white/90">· ${clauseText(x, t.from, t.to)}</p>`,
    )}
    ${t.leaked
      ? html`<p class="text-amber-200">${translateText("gw.treaty.leaked")}</p>`
      : nothing}
    ${t.why === null || t.brokenBy === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText(`gw.treaty.why.${t.why}`, {
            by: countryName(t.brokenBy),
          })}
        </p>`}
    ${t.answer
      ? html`<div class="flex gap-2">
          <button
            class=${BTN}
            data-gw-treaty-sign
            @click=${() =>
              c.send({ kind: "treaty_answer", treaty: t.uid, sign: true })}
          >
            ${translateText("gw.treaty.sign")}
          </button>
          <button
            class=${BTN}
            data-gw-treaty-refuse
            @click=${() =>
              c.send({ kind: "treaty_answer", treaty: t.uid, sign: false })}
          >
            ${translateText("gw.treaty.refuse")}
          </button>
        </div>`
      : nothing}
    ${t.mine && t.state === "signed"
      ? html`<button
          class=${d.armedBreak === t.uid ? BTN_ON : BTN}
          data-gw-treaty-break
          @click=${() => {
            if (d.armedBreak === t.uid) {
              c.send({ kind: "treaty_break", treaty: t.uid });
              d.armedBreak = null;
            } else {
              d.armedBreak = t.uid;
            }
            c.redraw();
          }}
        >
          ${translateText(
            d.armedBreak === t.uid ? "gw.treaty.break_sure" : "gw.treaty.break",
          )}
        </button>`
      : nothing}
  </article>`;
}

const NEEDS_THEATRE: readonly GwClauseKind[] = ["territory", "passage"];

/** A new clause of `kind`, with values that are valid from the start. */
function blankClause(
  c: GwCtx,
  kind: GwClauseKind,
  by: GwTag,
  theatre: GwTheatre | null,
): GwClause {
  return {
    kind,
    by,
    theatre: NEEDS_THEATRE.includes(kind) ? (theatre ?? "west") : null,
    value:
      kind === "loan"
        ? 1
        : kind === "entry"
          ? Math.min(c.data.chapter + 3, c.data.chapterCount - 1)
          : 0,
  };
}

function clauseRow(
  c: GwCtx,
  cl: GwClause,
  i: number,
  to: GwTag,
): TemplateResult {
  const d = c.ui.diplo;
  const me = c.seat.tag;
  const set = (patch: Partial<GwClause>) => {
    d.clauses[i] = { ...cl, ...patch };
    c.redraw();
  };
  return html`<div
    class="flex flex-wrap items-center gap-1.5"
    data-gw-clause=${cl.kind}
  >
    <select
      class=${FIELD}
      data-gw-clause-kind
      @change=${(e: Event) => {
        const kind = (e.target as HTMLSelectElement).value as GwClauseKind;
        d.clauses[i] = blankClause(c, kind, cl.by, cl.theatre);
        c.redraw();
      }}
    >
      ${GW_CLAUSE_KINDS.map(
        (k) =>
          html`<option value=${k} ?selected=${k === cl.kind}>
            ${translateText(`gw.treaty.kind.${k}`)}
          </option>`,
      )}
    </select>
    ${cl.kind === "alliance"
      ? nothing
      : html`<select
          class=${FIELD}
          data-gw-clause-by
          @change=${(e: Event) =>
            set({ by: (e.target as HTMLSelectElement).value as GwTag })}
        >
          ${[me, to].map(
            (tag) =>
              html`<option value=${tag} ?selected=${tag === cl.by}>
                ${countryName(tag)}
              </option>`,
          )}
        </select>`}
    ${cl.theatre === null
      ? nothing
      : html`<select
          class=${FIELD}
          @change=${(e: Event) =>
            set({
              theatre: (e.target as HTMLSelectElement).value as GwTheatre,
              value: 0,
            })}
        >
          ${GW_THEATRES.map(
            (t) =>
              html`<option value=${t} ?selected=${t === cl.theatre}>
                ${translateText(`gw.theatre.${t}`)}
              </option>`,
          )}
        </select>`}
    ${cl.kind === "territory" && cl.theatre !== null
      ? html`<select
          class=${FIELD}
          @change=${(e: Event) =>
            set({ value: Number((e.target as HTMLSelectElement).value) })}
        >
          ${GW_LINES[cl.theatre].map(
            (_, n) =>
              html`<option value=${n} ?selected=${n === cl.value}>
                ${frontLine(cl.theatre!, n)}
              </option>`,
          )}
        </select>`
      : nothing}
    ${cl.kind === "loan"
      ? html`<select
          class=${FIELD}
          @change=${(e: Event) =>
            set({ value: Number((e.target as HTMLSelectElement).value) })}
        >
          ${Array.from({ length: GW_LOAN_MAX }, (_, n) => n + 1).map(
            (n) =>
              html`<option value=${n} ?selected=${n === cl.value}>
                ${translateText("gw.treaty.loan_amount", { n })}
              </option>`,
          )}
        </select>`
      : nothing}
    ${cl.kind === "entry"
      ? html`<input
          class="${FIELD} w-20"
          type="number"
          data-gw-clause-chapter
          min=${c.data.chapter + 2}
          max=${c.data.chapterCount}
          .value=${String(cl.value + 1)}
          @keydown=${(e: Event) => e.stopPropagation()}
          @change=${(e: Event) =>
            set({
              value: Number((e.target as HTMLInputElement).value) - 1,
            })}
        />`
      : nothing}
    <button
      class="ml-auto px-2 text-white/60 hover:text-white"
      data-gw-clause-remove
      @click=${() => {
        d.clauses.splice(i, 1);
        c.redraw();
      }}
    >
      ×
    </button>
  </div>`;
}

function treatyWriter(c: GwCtx): TemplateResult {
  const { seat, ui, data } = c;
  const d = ui.diplo;
  const partners = seat.world.countries
    .map((x) => x.tag)
    .filter((t) => t !== seat.tag);
  const to = d.treatyTo ?? data.roster.find((r) => r.tag !== seat.tag)?.tag;
  if (to === undefined) return html``;
  return html`<section class=${BOX} data-gw-treaty-writer>
    <h3 class=${HEAD}>${translateText("gw.diplo.treaty_new")}</h3>
    <select
      class=${FIELD}
      data-gw-treaty-to
      @change=${(e: Event) => {
        const v = (e.target as HTMLSelectElement).value;
        if (!isGwTag(v)) return;
        d.treatyTo = v;
        d.clauses = d.clauses.map((x) =>
          x.by === seat.tag ? x : { ...x, by: v },
        );
        c.redraw();
      }}
    >
      ${partners.map(
        (t) =>
          html`<option value=${t} ?selected=${t === to}>
            ${countryName(t)}
          </option>`,
      )}
    </select>
    ${d.clauses.map((x, i) => clauseRow(c, x, i, to))}
    <div class="flex gap-2">
      <button
        class=${BTN}
        data-gw-clause-add
        ?disabled=${d.clauses.length >= GW_TREATY_CLAUSES_MAX}
        @click=${() => {
          d.clauses.push(blankClause(c, "neutrality", to, null));
          c.redraw();
        }}
      >
        ${translateText("gw.diplo.clause_add")}
      </button>
      <button
        class="${BTN} ml-auto"
        data-gw-treaty-send
        ?disabled=${d.clauses.length === 0 || data.ended !== null}
        @click=${() => {
          c.send({ kind: "treaty_offer", to, clauses: d.clauses });
          d.clauses = [];
          c.redraw();
        }}
      >
        ${translateText("gw.diplo.treaty_send")}
      </button>
    </div>
    <p class=${MUTED}>${translateText("gw.diplo.treaty_hint")}</p>
  </section>`;
}

function enterWar(c: GwCtx): TemplateResult | typeof nothing {
  const { seat } = c;
  const war = seat.world.countries.some((x) => x.side !== null);
  if (!war || seat.world.side !== null) return nothing;
  return html`<section class=${BOX} data-gw-enter-war>
    <h3 class=${HEAD}>${translateText("gw.diplo.enter_title")}</h3>
    <div class="flex gap-2">
      ${GW_SIDES.map(
        (side) =>
          html`<button
            class=${BTN}
            data-gw-enter=${side}
            @click=${() => c.send({ kind: "enter_war", side })}
          >
            ${translateText("gw.diplo.enter", {
              side: translateText(`gw.ui.side.${side}`),
            })}
          </button>`,
      )}
    </div>
  </section>`;
}

/** The diplomacy tab. */
export function diploTab(c: GwCtx): TemplateResult {
  const treaties = c.seat.diplo.treaties;
  return html`<div class="space-y-2.5" data-gw-diplo>
    ${table(c)}${slowVote(c)}${wires(c)}
    <section class=${BOX} data-gw-treaties>
      <h3 class=${HEAD}>${translateText("gw.diplo.treaties")}</h3>
      ${treaties.length === 0
        ? html`<p class=${MUTED}>${translateText("gw.diplo.no_treaties")}</p>`
        : [...treaties].reverse().map((t) => treaty(c, t))}
    </section>
    ${treatyWriter(c)}${enterWar(c)}
  </div>`;
}

function memoirColumn(
  c: GwCtx,
  m: { smallID: number; tag: GwTag; memoir: GwMemoir },
): TemplateResult {
  const met = m.memoir.mandates.filter((x) => x.met).length;
  return html`<article
    class="min-w-[220px] flex-1 space-y-1.5 rounded border border-white/15 bg-black/35 p-3"
    data-gw-finale-seat=${m.tag}
  >
    <h3 class="flex items-center gap-2 text-base font-bold">
      ${flag(m.tag)} ${countryName(m.tag)}
    </h3>
    <p class=${MUTED}>${c.holder?.(m.smallID) ?? ""}</p>
    <p class="text-sm text-amber-200">${endingTitle(m.memoir.ending)}</p>
    <p class="text-sm text-white/85">
      ${translateText("gw.diplo.finale_mandates", {
        n: met,
        total: m.memoir.mandates.length,
      })}
    </p>
    <p class="text-sm text-white/85">
      ${translateText("gw.ui.casualties", { n: m.memoir.casualties })}
    </p>
  </article>`;
}

/** Everyone's memoir side by side: who promised what, who broke it, who read it. */
export function finaleView(c: GwCtx): TemplateResult {
  const f = c.data.finale!;
  return html`<div
    data-gw-finale
    class="${GLASS} pointer-events-auto fixed inset-2 z-[905] flex flex-col overflow-hidden rounded text-white sm:inset-10"
  >
    <header class="flex items-center border-b border-white/10 p-3">
      <h2 class="text-lg font-bold">${translateText("gw.diplo.finale")}</h2>
      <button
        class="${BTN} ml-auto"
        data-gw-finale-close
        @click=${() => {
          c.ui.finale = false;
          c.redraw();
        }}
      >
        ${translateText("gw.diplo.finale_close")}
      </button>
    </header>
    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <div class="flex gap-2 overflow-x-auto">
        ${f.memoirs.map((m) => memoirColumn(c, m))}
      </div>
      <section class=${BOX} data-gw-finale-treaties>
        <h3 class=${HEAD}>${translateText("gw.diplo.finale_treaties")}</h3>
        ${f.treaties.length === 0
          ? html`<p class=${MUTED}>${translateText("gw.diplo.no_treaties")}</p>`
          : f.treaties.map((t) => treaty(c, t))}
      </section>
      ${f.intercepted.length === 0
        ? nothing
        : html`<section class=${BOX} data-gw-finale-wires>
            <h3 class=${HEAD}>${translateText("gw.diplo.finale_wires")}</h3>
            ${f.intercepted.map(
              (t) =>
                html`<article
                  class="rounded border border-white/10 bg-white/5 p-2 text-sm"
                >
                  <p class=${MUTED}>
                    ${countryName(t.from)} → ${countryName(t.to)} ·
                    ${shortDate(t.date)} ·
                    ${translateText("gw.diplo.finale_read_by", {
                      who: t.by.map(countryName).join(", "),
                    })}
                  </p>
                  <p class="whitespace-pre-wrap break-words text-white/90">
                    ${t.text}
                  </p>
                </article>`,
            )}
          </section>`}
    </div>
  </div>`;
}
