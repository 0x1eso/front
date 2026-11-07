import type {
  GwAskClause,
  GwGiveClause,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwActFieldView,
  GwActView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const SMALL = "!px-2 !py-1";
/** The schedule's sections, in order. */
const KINDS = ["visit", "letter", "order", "speech", "intrigue"] as const;

export function actName(pack: GwPack | null, id: string): string {
  return pack?.acts?.[id]?.name ?? id;
}

function fieldLabel(pack: GwPack | null, act: string, f: GwActFieldView) {
  const own = pack?.acts?.[act]?.fields?.[f.id]?.label;
  if (own !== undefined) return own;
  return translateText(
    f.tones.length > 0 ? "gw.act.tone_label" : "gw.act.people_label",
  );
}

/** How a value of a field reads: an option's words, a tone, a person. */
export function pickLabel(
  pack: GwPack | null,
  act: string,
  f: GwActFieldView,
  value: string,
): string {
  if (f.people.includes(value)) return personName(pack, value);
  const own = pack?.acts?.[act]?.fields?.[f.id]?.opt?.[value];
  if (own !== undefined) return own;
  return translateText(`gw.act.tone.${value}`);
}

/** The order's flat list, or null while a field isn't full. */
export function actPicks(
  a: GwActView,
  picks: Readonly<Record<string, readonly string[]>>,
): string[] | null {
  const out: string[] = [];
  for (const f of a.fields) {
    const got = picks[f.id] ?? [];
    if (got.length !== f.count) return null;
    out.push(...got);
  }
  return out;
}

/** A pick toggled: a list holds one, a people field up to `count`. */
export function togglePick(
  have: readonly string[],
  value: string,
  count: number,
): string[] {
  if (have.includes(value)) return have.filter((x) => x !== value);
  if (count === 1) return [value];
  return have.length >= count ? [...have] : [...have, value];
}

function fieldRow(c: GwCtx, a: GwActView, f: GwActFieldView): TemplateResult {
  const picks = c.ui.actPicks;
  const values: readonly string[] = [...f.options, ...f.tones, ...f.people];
  return html`<div class="space-y-1" data-gw-act-field=${f.id}>
    <div class=${MUTED}>${fieldLabel(c.pack, a.id, f)}</div>
    <div class="flex flex-wrap gap-1">
      ${values.map((v) => {
        const on = (picks[f.id] ?? []).includes(v);
        return html`<button
          class="${on ? BTN_ON : BTN} ${SMALL}"
          data-gw-act-pick=${v}
          @click=${() => {
            picks[f.id] = togglePick(picks[f.id] ?? [], v, f.count);
            c.redraw();
          }}
        >
          ${pickLabel(c.pack, a.id, f, v)}
        </button>`;
      })}
    </div>
  </div>`;
}

/** What a started act leaves on the desk, as a signed paper does. */
function actNote(c: GwCtx, a: GwActView) {
  const picks = c.ui.actPicks;
  const words = a.fields.flatMap((f) =>
    (picks[f.id] ?? []).map((v) => pickLabel(c.pack, a.id, f, v)),
  );
  const tells = a.fields.flatMap((f) =>
    (picks[f.id] ?? []).flatMap((v) => f.tells?.[v] ?? []),
  );
  return {
    chapter: c.data.chapter,
    title: actName(c.pack, a.id),
    pick: words.join(" · "),
    rest: "",
    tell: [...a.tell, ...tells],
  };
}

/** `preset`: what the map already filled in when it opens. */
export function actRow(
  c: GwCtx,
  a: GwActView,
  preset: Record<string, string[]> = {},
): TemplateResult {
  const open = c.ui.actOpen === a.id;
  const left = c.seat.actsLeft ?? 0;
  const note = c.pack?.acts?.[a.id]?.note;
  const picks = open ? actPicks(a, c.ui.actPicks) : null;
  return html`<div data-gw-act=${a.id} class="space-y-1.5">
    <button
      class="${open ? BTN_ON : BTN} w-full"
      data-gw-act-open=${a.id}
      ?disabled=${left <= 0}
      @click=${() => {
        c.ui.actOpen = open ? null : a.id;
        c.ui.actPicks = { ...preset };
        c.redraw();
      }}
    >
      ${actName(c.pack, a.id)}
    </button>
    ${open
      ? html`<div class="space-y-1.5 pl-1">
          ${note === undefined
            ? nothing
            : html`<p class="text-sm text-white/75">${rich(c, note)}</p>`}
          ${a.fields.map((f) => fieldRow(c, a, f))}
          <button
            class="w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-1.5 text-center text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-40"
            data-gw-act-go
            ?disabled=${picks === null}
            @click=${() => {
              if (picks === null) return;
              c.ui.notes.push(actNote(c, a));
              c.send({ kind: "act", act: a.id, picks });
              c.ui.actOpen = null;
              c.ui.actPicks = {};
              c.ui.summoned = Date.now();
              c.redraw();
            }}
          >
            ${translateText("gw.act.go")}
          </button>
        </div>`
      : nothing}
  </div>`;
}

function schedule(c: GwCtx): TemplateResult {
  const acts = c.seat.acts ?? [];
  return html`<section class=${BOX} data-gw-schedule>
    <div class="flex items-center gap-2">
      <h3 class=${HEAD}>${translateText("gw.act.title")}</h3>
      <span class="${CHIP} ml-auto" data-gw-acts-left
        >${translateText("gw.act.left", { n: c.seat.actsLeft ?? 0 })}</span
      >
    </div>
    ${acts.length === 0
      ? html`<p class=${MUTED}>${translateText("gw.act.none")}</p>`
      : KINDS.map((k) => {
          const rows = acts.filter((a) => a.kind === k);
          if (rows.length === 0) return nothing;
          return html`<div class="space-y-1" data-gw-act-kind=${k}>
            <div class=${MUTED}>${translateText(`gw.act.kind.${k}`)}</div>
            ${rows.map((a) => actRow(c, a))}
          </div>`;
        })}
  </section>`;
}

function aimRow(c: GwCtx, id: string): TemplateResult {
  const armed = c.ui.aimArmed === id;
  const words = c.pack?.aims?.[id];
  return html`<div class="space-y-1" data-gw-aim=${id}>
    <button
      class="${armed ? BTN_ON : BTN} w-full"
      data-gw-aim-pick=${id}
      @click=${() => {
        c.ui.aimArmed = armed ? null : id;
        c.redraw();
      }}
    >
      <b>${words?.name ?? id}</b>
    </button>
    ${armed
      ? html`${words === undefined
            ? nothing
            : html`<p class="pl-1 text-sm text-white/80">
                ${rich(c, words.text)}
              </p>`}
          <button
            class="w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-1.5 text-center text-sm font-bold text-slate-900 hover:bg-amber-200"
            data-gw-aim-go
            @click=${() => {
              c.send({ kind: "aim", aim: id });
              c.ui.aimArmed = null;
              c.ui.aimOpen = false;
              c.redraw();
            }}
          >
            ${translateText("gw.aim.declare")}
          </button>`
      : nothing}
  </div>`;
}

function aimBox(c: GwCtx): TemplateResult | typeof nothing {
  const a = c.seat.aims;
  if (a === null || a === undefined) return nothing;
  const words = a.aim === null ? undefined : c.pack?.aims?.[a.aim];
  const rows = a.open.filter((id) => id !== a.aim);
  const showList = a.aim === null || c.ui.aimOpen;
  return html`<section class=${BOX} data-gw-aims>
    <h3 class=${HEAD}>${translateText("gw.aim.title")}</h3>
    ${a.aim === null
      ? html`<p class="text-sm text-white/75">
          ${translateText("gw.aim.ask")}
        </p>`
      : html`<p class="text-sm font-bold text-amber-100" data-gw-aim-now>
            ${words?.name ?? a.aim}
          </p>
          ${words === undefined
            ? nothing
            : html`<p class="text-sm text-white/80">${rich(c, words.text)}</p>`}
          <button
            class="${BTN} ${SMALL}"
            data-gw-aim-change
            @click=${() => {
              c.ui.aimOpen = !c.ui.aimOpen;
              c.ui.aimArmed = null;
              c.redraw();
            }}
          >
            ${translateText("gw.aim.change")}
          </button>`}
    ${showList
      ? html`${a.priced
          ? html`<p class=${MUTED} data-gw-aim-priced>
              ${translateText("gw.aim.priced")}
            </p>`
          : nothing}
        ${rows.map((id) => aimRow(c, id))}`
      : nothing}
  </section>`;
}

function clauseRow<T extends string>(
  c: GwCtx,
  head: string,
  word: string,
  open: readonly T[],
  have: T[],
): TemplateResult | typeof nothing {
  if (open.length === 0) return nothing;
  return html`<div class="space-y-1">
    <div class=${MUTED}>${translateText(head)}</div>
    <div class="flex flex-wrap gap-1">
      ${open.map((x) => {
        const on = have.includes(x);
        return html`<button
          class="${on ? BTN_ON : BTN} ${SMALL}"
          data-gw-clause=${`${word}.${x}`}
          @click=${() => {
            if (on) have.splice(have.indexOf(x), 1);
            else have.push(x);
            c.redraw();
          }}
        >
          ${translateText(`gw.terms.${word}.${x}`)}
        </button>`;
      })}
    </div>
  </div>`;
}

function termAnswer(
  c: GwCtx,
  x: NonNullable<GwCtx["seat"]["terms"]>["log"][0],
) {
  const name = translateText(`gw.country.${x.tag}`);
  const clauses = [
    ...x.give.map((g: GwGiveClause) => translateText(`gw.terms.give.${g}`)),
    ...x.ask.map((a: GwAskClause) => translateText(`gw.terms.ask.${a}`)),
  ].join(", ");
  const said =
    x.yes === null
      ? translateText("gw.terms.waiting")
      : x.yes
        ? translateText("gw.terms.yes")
        : translateText(`gw.terms.why.${x.why ?? "too_little"}`);
  return html`<p class="text-sm text-white/80" data-gw-term-log=${x.tag}>
    <b>${name}</b> · ${clauses} — ${said}
  </p>`;
}

function termsBox(c: GwCtx): TemplateResult | typeof nothing {
  const t = c.seat.terms;
  if (t === undefined) return nothing;
  const ui = c.ui;
  const open = t.targets.find((x) => x.tag === ui.termTag);
  const count = ui.termGive.length + ui.termAsk.length;
  return html`<section class=${BOX} data-gw-terms>
    <h3 class=${HEAD}>${translateText("gw.terms.title")}</h3>
    ${t.sent
      ? html`<p class=${MUTED}>${translateText("gw.terms.sent")}</p>`
      : html`<p class=${MUTED}>${translateText("gw.terms.hint")}</p>
          <div class="flex flex-wrap gap-1">
            ${t.targets.map(
              (x) =>
                html`<button
                  class="${ui.termTag === x.tag ? BTN_ON : BTN} ${SMALL}"
                  data-gw-term-tag=${x.tag}
                  @click=${() => {
                    ui.termTag = ui.termTag === x.tag ? null : (x.tag as GwTag);
                    ui.termGive = [];
                    ui.termAsk = [];
                    c.redraw();
                  }}
                >
                  ${translateText(`gw.country.${x.tag}`)}
                </button>`,
            )}
          </div>
          ${open === undefined
            ? nothing
            : html`${clauseRow(
                  c,
                  "gw.terms.give_label",
                  "give",
                  open.give,
                  ui.termGive,
                )}
                ${clauseRow(
                  c,
                  "gw.terms.ask_label",
                  "ask",
                  open.ask,
                  ui.termAsk,
                )}
                <button
                  class="w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-1.5 text-center text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-40"
                  data-gw-term-go
                  ?disabled=${count === 0}
                  @click=${() => {
                    c.send({
                      kind: "terms",
                      tag: open.tag,
                      give: [...ui.termGive],
                      ask: [...ui.termAsk],
                    });
                    ui.termTag = null;
                    ui.termGive = [];
                    ui.termAsk = [];
                    c.redraw();
                  }}
                >
                  ${translateText("gw.terms.go")}
                </button>`}`}
    ${t.log.map((x) => termAnswer(c, x))}
  </section>`;
}

/** The schedule tab: what this reign is for, what to start, who to approach. */
export function scheduleTab(c: GwCtx): TemplateResult {
  return html`<div class="space-y-2.5" data-gw-schedule-tab>
    ${aimBox(c)} ${schedule(c)} ${termsBox(c)}
  </div>`;
}

/** On the desk until the seat has said what the war is for. */
export function aimNudge(c: GwCtx): TemplateResult | typeof nothing {
  const a = c.seat.aims;
  if (a === null || a === undefined || a.aim !== null) return nothing;
  if (a.priced || a.open.length === 0) return nothing;
  return html`<button
    class="w-full rounded border border-amber-200/40 bg-amber-200/10 p-2 text-left text-sm text-amber-100"
    data-gw-aim-nudge
    @click=${() => {
      c.ui.tab = "schedule";
      c.redraw();
    }}
  >
    ${translateText("gw.aim.nudge")}
  </button>`;
}
