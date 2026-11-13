// Great War 1914: the 통치 tab (ww169, design ww168 B2). Each power the person
// holds, by group: what it is, who must sign or vote, and why a greyed one
// can't be used now. Nothing shows its result: no odds, no price, no tell.
import type { GwRuledView } from "@openfront/engine-api/ww1914/GwFate";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwPowerGroup,
  GwPowerView,
} from "@openfront/engine-api/ww1914/GwPowers";
import { GW_POWER_GROUPS } from "@openfront/engine-api/ww1914/GwPowers";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { bookSection } from "./GwBook";
import type { GwCtx, GwRuleDraft } from "./GwCtx";
import { timeLeft } from "./GwDept";
import { rich } from "./GwDict";
import { crownName, gwName, ruledWords } from "./GwFateModel";
import { factionName } from "./GwHouse";
import type { GwTab } from "./GwModel";
import { officeTitle } from "./GwOffice";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { fullDate, personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const SMALL = "!px-2 !py-1";
const GO =
  "w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-1.5 text-center text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-40";
/** Groups whose work is done on another tab: the row links there. */
const LINKS: Partial<Record<GwPowerGroup, GwTab>> = {
  treaty: "diplo",
  cabinet: "people",
  schedule: "schedule",
};

export function powerName(pack: GwPack | null, id: string): string {
  return pack?.powers?.[id]?.name ?? id;
}

/** The procedure as facts: "재상의 부서가 필요하다". */
export function needsLines(c: GwCtx, p: GwPowerView): string[] {
  const own = c.pack?.powers?.[p.id]?.needs;
  const n = p.needs;
  // The row's own words name the office it had; another signs now (ww171).
  if (own !== undefined && n.instead === undefined) return [own];
  const out: string[] = [];
  if (n.office !== undefined) {
    const office = officeTitle(c.seat.tag, n.office);
    if (n.instead !== undefined) {
      out.push(
        translateText("gw.power.needs.instead", {
          office,
          instead: officeTitle(c.seat.tag, n.instead),
        }),
      );
    }
    out.push(
      n.signer === undefined || n.signer === null
        ? translateText("gw.power.needs.office", { office })
        : translateText("gw.power.needs.office_who", {
            office,
            who: personName(c.pack, n.signer),
          }),
    );
  }
  if (n.consent !== undefined) {
    out.push(
      translateText("gw.power.needs.consent", {
        faction: factionName(c, n.consent),
      }),
    );
  }
  if (n.council === true) out.push(translateText("gw.power.needs.council"));
  if (n.houses !== undefined) {
    out.push(
      n.houses.length === 0
        ? translateText("gw.power.needs.house_all")
        : translateText("gw.power.needs.house", {
            house: n.houses
              .map((h) => translateText(`gw.house.chamber.${h}`))
              .join(", "),
          }),
    );
  }
  if (p.slot) out.push(translateText("gw.power.needs.slot"));
  return out;
}

export function whyLine(c: GwCtx, p: GwPowerView): string | null {
  if (p.why === null) return null;
  return (
    c.pack?.powers?.[p.id]?.why?.[p.why] ??
    translateText(`gw.power.why.${p.why}`)
  );
}

/** How a target reads: a person, a country, a front, a chamber, the row's words. */
export function targetLabel(c: GwCtx, p: GwPowerView, id: string): string {
  switch (p.target?.kind) {
    case "person":
      return personName(c.pack, id);
    case "country":
      return gwName(id);
    case "front":
      return translateText(`gw.theatre.${id}`);
    case "house":
      return translateText(`gw.house.chamber.${id}`);
    default:
      return c.pack?.powers?.[p.id]?.opt?.[id] ?? id;
  }
}

function fieldLabel(c: GwCtx, p: GwPowerView, field: string, id: string) {
  return c.pack?.powers?.[p.id]?.fields?.[field]?.opt?.[id] ?? id;
}

function draftOf(c: GwCtx): GwRuleDraft {
  if (c.ui.rule === undefined || c.ui.rule === null) {
    const wide =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 768px)").matches;
    c.ui.rule = {
      open: null,
      target: null,
      picks: {},
      groups: wide ? [...GW_POWER_GROUPS] : [],
    };
  }
  return c.ui.rule;
}

/** The order the open row sends, or null while a pick is missing. */
export function powerOrder(
  p: GwPowerView,
  d: GwRuleDraft,
  without: boolean,
): {
  kind: "power";
  id: string;
  target: string | null;
  picks: string[];
  without: boolean;
  sound: boolean;
} | null {
  if (p.target !== null && d.target === null) return null;
  const picks = p.fields.map((f) => d.picks[f.id]);
  if (picks.some((x) => x === undefined)) return null;
  return {
    kind: "power",
    id: p.id,
    target: p.target === null ? null : d.target,
    picks,
    without,
    sound: false,
  };
}

function chips(
  c: GwCtx,
  values: readonly string[],
  on: string | null,
  label: (v: string) => string,
  pick: (v: string) => void,
  data: string,
) {
  return html`<div class="flex flex-wrap gap-1">
    ${values.map(
      (v) =>
        html`<button
          class="${on === v ? BTN_ON : BTN} ${SMALL}"
          data-gw-power-pick=${`${data}.${v}`}
          @click=${() => {
            pick(v);
            c.redraw();
          }}
        >
          ${label(v)}
        </button>`,
    )}
  </div>`;
}

function send(c: GwCtx, p: GwPowerView, d: GwRuleDraft, without: boolean) {
  const o = powerOrder(p, d, without);
  if (o === null) return;
  c.ui.notes.push({
    chapter: c.data.chapter,
    title: powerName(c.pack, p.id),
    // What was named: the target, else each field's pick (the war row's foe).
    pick:
      o.target !== null
        ? targetLabel(c, p, o.target)
        : p.fields.map((f, i) => fieldLabel(c, p, f.id, o.picks[i])).join(", "),
    rest: "",
    tell: [],
  });
  c.send(o);
  d.open = null;
  d.target = null;
  d.picks = {};
  d.armed = null;
  c.ui.summoned = Date.now();
  c.redraw();
}

/** The open row: target, fields, sounding out, and the order itself. */
function rowBody(c: GwCtx, p: GwPowerView, d: GwRuleDraft): TemplateResult {
  const note = c.pack?.powers?.[p.id]?.note;
  const ready = powerOrder(p, d, false) !== null;
  const signer = p.needs.signer ?? null;
  return html`<div class="space-y-1.5 pl-1" data-gw-power-body=${p.id}>
    ${note === undefined
      ? nothing
      : html`<p class="text-sm text-white/75">${rich(c, note)}</p>`}
    ${p.target === null
      ? nothing
      : html`<div class=${MUTED}>${translateText("gw.power.target")}</div>
          ${chips(
            c,
            p.target.ids,
            d.target,
            (v) => targetLabel(c, p, v),
            (v) => (d.target = d.target === v ? null : v),
            "target",
          )}`}
    ${p.fields.map(
      (f) =>
        html`<div class=${MUTED}>
            ${c.pack?.powers?.[p.id]?.fields?.[f.id]?.label ?? f.id}
          </div>
          ${chips(
            c,
            f.options,
            d.picks[f.id] ?? null,
            (v) => fieldLabel(c, p, f.id, v),
            (v) => (d.picks[f.id] = v),
            f.id,
          )}`,
    )}
    ${signer === null
      ? nothing
      : p.sounded !== null
        ? html`<p class="text-sm text-amber-100" data-gw-power-said>
            ${translateText(
              p.sounded.said ? "gw.power.said_yes" : "gw.power.said_no",
              { who: personName(c.pack, p.sounded.person) },
            )}
          </p>`
        : html`<button
            class="${BTN} ${SMALL} w-full"
            data-gw-power-sound
            ?disabled=${timeLeft(c) <= 0}
            @click=${() => {
              c.send({
                kind: "power",
                id: p.id,
                target: null,
                picks: [],
                without: false,
                sound: true,
              });
              c.ui.summoned = Date.now();
              c.redraw();
            }}
          >
            ${translateText("gw.power.sound", {
              who: personName(c.pack, signer),
            })}
          </button>`}
    <button
      class=${GO}
      data-gw-power-go
      ?disabled=${!ready}
      @click=${() => {
        // The person's own end is asked twice: the first press only arms it.
        if (p.ends && d.armed !== p.id) {
          d.armed = p.id;
          c.redraw();
          return;
        }
        send(c, p, d, false);
      }}
    >
      ${translateText(
        p.ends && d.armed === p.id ? "gw.power.ends_confirm" : "gw.power.go",
      )}
    </button>
    ${p.without
      ? html`<p class=${MUTED}>${translateText("gw.power.without_note")}</p>
          <button
            class="${BTN} w-full !text-center"
            data-gw-power-without
            ?disabled=${!ready}
            @click=${() => send(c, p, d, true)}
          >
            ${translateText("gw.power.without", {
              who: personName(c.pack, signer ?? ""),
            })}
          </button>`
      : nothing}
  </div>`;
}

function powerRow(c: GwCtx, p: GwPowerView, d: GwRuleDraft): TemplateResult {
  const open = d.open === p.id;
  const why = whyLine(c, p);
  return html`<div class="space-y-1" data-gw-power=${p.id}>
    <button
      class="${open ? BTN_ON : BTN} w-full"
      data-gw-power-open=${p.id}
      ?disabled=${why !== null}
      @click=${() => {
        d.open = open ? null : p.id;
        d.target = null;
        d.picks = {};
        d.armed = null;
        c.redraw();
      }}
    >
      <b>${powerName(c.pack, p.id)}</b>
      ${p.kind === "lawful"
        ? nothing
        : html`<span
            class="${CHIP} ml-1"
            title=${translateText(`gw.power.kind_hint.${p.kind}`)}
            >${translateText(`gw.power.kind.${p.kind}`)}</span
          >`}
    </button>
    ${needsLines(c, p).map(
      (l) => html`<p class="${MUTED} pl-1" data-gw-power-needs>${l}</p>`,
    )}
    ${p.ends
      ? html`<p class="pl-1 text-sm text-amber-100" data-gw-power-ends>
          ${translateText("gw.power.ends")}
        </p>`
      : nothing}
    ${why === null
      ? nothing
      : html`<p class="${MUTED} pl-1 italic" data-gw-power-why>${why}</p>`}
    ${open && why === null ? rowBody(c, p, d) : nothing}
  </div>`;
}

function linkRow(c: GwCtx, g: GwPowerGroup, tab: GwTab): TemplateResult {
  const left = g === "schedule" ? (c.seat.actsLeft ?? 0) : null;
  return html`<button
    class="${BTN} ${SMALL} w-full"
    data-gw-power-link=${tab}
    @click=${() => {
      c.ui.tab = tab;
      c.redraw();
    }}
  >
    ${translateText(`gw.power.link.${g}`)}
    ${left === null
      ? nothing
      : html`<span class="${CHIP} ml-1"
          >${translateText("gw.act.left", { n: left })}</span
        >`}
  </button>`;
}

/** ww190: the house doesn't sit: till the election's date, or sent home. */
function shutChip(c: GwCtx): TemplateResult | typeof nothing {
  const shut = c.seat.world.budget.shut ?? null;
  if (shut === null) return nothing;
  return html`<span class=${CHIP} data-gw-house-shut
    >${shut.until === null
      ? translateText("gw.power.house_closed")
      : translateText("gw.power.house_shut", {
          date: fullDate(shut.until),
        })}</span
  >`;
}

function group(
  c: GwCtx,
  g: GwPowerGroup,
  rows: readonly GwPowerView[],
  d: GwRuleDraft,
): TemplateResult | typeof nothing {
  // Solo, treaties and terms are drawn up on the schedule tab.
  const link =
    g === "treaty" && c.data.roster.length <= 1 ? "schedule" : LINKS[g];
  // ww203: the house group carries the 법전 and the 의사일정.
  const book = g === "house" ? bookSection(c) : nothing;
  if (rows.length === 0 && link === undefined && book === nothing) {
    return nothing;
  }
  const open = d.groups.includes(g);
  return html`<section class=${BOX} data-gw-power-group=${g}>
    <button
      class="flex w-full items-center gap-2 text-left"
      data-gw-power-fold=${g}
      @click=${() => {
        d.groups = open ? d.groups.filter((x) => x !== g) : [...d.groups, g];
        c.redraw();
      }}
    >
      <h3 class=${HEAD}>${translateText(`gw.power.group.${g}`)}</h3>
      ${g === "beyond"
        ? html`<span
            class=${CHIP}
            title=${translateText("gw.power.kind_hint.beyond")}
            >${translateText("gw.power.beyond_tag")}</span
          >`
        : nothing}
      ${g === "house" ? shutChip(c) : nothing}
      <span class="${MUTED} ml-auto">${open ? "−" : "+"}</span>
    </button>
    ${open
      ? html`${book} ${rows.map((p) => powerRow(c, p, d))}
        ${link === undefined ? nothing : linkRow(c, g, link)}`
      : nothing}
  </section>`;
}

/** One land the seat rules, or a state or vassal of its: words only. */
function ruledRow(r: GwRuledView): TemplateResult {
  const words = ruledWords(r);
  return html`<div
    class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
    data-gw-ruled=${r.tag}
    data-gw-ruled-kind=${r.kind}
  >
    <span class="text-sm text-white/90">${gwName(r.tag)}</span>
    <span class=${CHIP}>${translateText(`gw.fate.kind.${r.kind}`)}</span>
    <span class="${MUTED} ml-auto">${words.join(", ")}</span>
    ${r.kind === "client"
      ? html`<p class="${MUTED} w-full" data-gw-ruled-crown>
          ${translateText("gw.ui.fate_crown", { who: crownName(r.crown) })}
        </p>`
      : nothing}
  </div>`;
}

/** ww199: the land the seat rules, the states it founded, its vassals. */
function ruledBox(c: GwCtx): TemplateResult | typeof nothing {
  const rows = c.seat.ruled ?? [];
  if (rows.length === 0) return nothing;
  return html`<section class=${BOX} data-gw-ruled-box>
    <h3 class=${HEAD}>${translateText("gw.ui.fate_ruled")}</h3>
    ${rows.map(ruledRow)}
  </section>`;
}

/** The 통치 tab: every power by group; 일정 links to the schedule. */
export function ruleTab(c: GwCtx): TemplateResult {
  const d = draftOf(c);
  const all = c.seat.powers ?? [];
  return html`<div class="space-y-2.5" data-gw-rule-tab>
    <p class=${MUTED}>${translateText("gw.power.hint")}</p>
    ${ruledBox(c)}
    ${GW_POWER_GROUPS.map((g) =>
      group(
        c,
        g,
        all.filter((p) => p.group === g),
        d,
      ),
    )}
  </div>`;
}
