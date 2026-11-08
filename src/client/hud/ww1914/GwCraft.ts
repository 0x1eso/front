// Great War 1914: statecraft on the screen (ww157). The country tab's
// footing, inventions and the year's project; the band's word for the footing.
// Words only: no numbers, and nothing said of a choice before it is made.
import {
  GW_FOOTINGS,
  GwCraftView,
  GwInventionView,
  GwProjectView,
} from "@openfront/engine-api/ww1914/GwCraft";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

const footingWord = (level: number): string =>
  translateText(`gw.craft.footing.${GW_FOOTINGS[level] ?? "peace"}`);

/** An invention's or a project's name: the pack's, else its paper's title. */
export function craftName(c: GwCtx, id: string): string {
  return c.pack?.craft?.[id]?.name ?? c.pack?.scenes[id]?.title ?? id;
}
const craftNote = (c: GwCtx, id: string): string | null =>
  c.pack?.craft?.[id]?.note ?? null;

/** The band's word: shown once the country has moved off its peacetime footing. */
export function footingChip(c: GwCtx): TemplateResult | typeof nothing {
  const v = c.seat.world.craft;
  if (v === undefined || v.footing === 0) return nothing;
  return html`<span class=${CHIP} data-gw-footing-chip=${v.footing}
    >${footingWord(v.footing)}</span
  >`;
}

function raiseButton(
  c: GwCtx,
  v: GwCraftView,
): TemplateResult | typeof nothing {
  const r = v.raise;
  if (r === null) return nothing;
  const to = GW_FOOTINGS[v.footing + 1];
  return html`<button
      class="${BTN} w-full"
      data-gw-footing-raise=${v.footing + 1}
      ?disabled=${!r.open || r.asked}
      @click=${() => c.send({ kind: "footing" })}
    >
      ${translateText(`gw.craft.raise.${to}`)}
    </button>
    ${r.open && !r.asked
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText(
            r.asked ? "gw.craft.raise_asked" : "gw.craft.raise_closed",
          )}
        </p>`}`;
}

function footingBox(c: GwCtx, v: GwCraftView): TemplateResult | typeof nothing {
  const short = v.shortages.filter((s) => !s.solved);
  const solved = v.shortages.filter((s) => s.solved);
  if (v.raise === null && v.footing === 0 && v.shortages.length === 0) {
    return nothing;
  }
  return html`<section class=${BOX} data-gw-footing=${v.footing}>
    <div class="flex justify-between gap-2 text-sm">
      <h3 class=${HEAD}>${translateText("gw.craft.footing_title")}</h3>
      <span>${footingWord(v.footing)}</span>
    </div>
    ${v.footing === 0
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText(`gw.craft.terms.${GW_FOOTINGS[v.footing]}`)}
        </p>`}
    ${short.length === 0
      ? nothing
      : html`<p class="text-sm text-amber-200" data-gw-shortages>
          ${translateText("gw.craft.short_of", {
            list: short
              .map((s) => translateText(`gw.craft.shortage.${s.id}`))
              .join(", "),
          })}
        </p>`}
    ${solved.map(
      (s) =>
        html`<p class=${MUTED} data-gw-shortage-solved=${s.id}>
          ${translateText("gw.craft.shortage_solved", {
            name: translateText(`gw.craft.shortage.${s.id}`),
          })}
        </p>`,
    )}
    ${raiseButton(c, v)}
  </section>`;
}

function fieldButton(c: GwCtx, x: GwInventionView): TemplateResult {
  const armed = c.ui.armedField === x.id;
  return html`<button
    class="${armed ? BTN_ON : BTN} w-full"
    data-gw-field=${x.id}
    @click=${() => {
      if (!armed) {
        c.ui.armedField = x.id;
        c.redraw();
        return;
      }
      c.ui.armedField = null;
      c.send({ kind: "field", invention: x.id });
    }}
  >
    ${translateText(armed ? "gw.craft.field_sure" : "gw.craft.field")}
  </button>`;
}

function invention(c: GwCtx, x: GwInventionView): TemplateResult {
  const note = craftNote(c, x.id);
  const stage =
    x.stage === "ready" && x.ripe
      ? translateText("gw.craft.ripe")
      : translateText(`gw.craft.stage.${x.stage}`);
  return html`<div class="space-y-1" data-gw-invention=${x.id}>
    <div class="flex justify-between gap-2 text-sm">
      <span class="font-bold">${craftName(c, x.id)}</span>
      <span class="shrink-0 text-white/70">${stage}</span>
    </div>
    <p class=${MUTED}>
      ${translateText("gw.craft.inventor", {
        name: personName(c.pack, x.inventor),
      })}${note === null ? "" : ` · ${note}`}
    </p>
    ${x.stage === "fielded" && x.early
      ? html`<p class=${MUTED} data-gw-early>
          ${translateText("gw.craft.early")}
        </p>`
      : nothing}
    ${x.stage === "ready" ? fieldButton(c, x) : nothing}
  </div>`;
}

function inventionsBox(
  c: GwCtx,
  v: GwCraftView,
): TemplateResult | typeof nothing {
  if (v.inventions.length === 0) return nothing;
  return html`<section class=${BOX} data-gw-inventions>
    <h3 class=${HEAD}>${translateText("gw.craft.inventions_title")}</h3>
    ${v.inventions.map((x) => invention(c, x))}
  </section>`;
}

function project(c: GwCtx, p: GwProjectView): TemplateResult {
  return html`<div class="space-y-0.5" data-gw-project=${p.id}>
    <div class="flex justify-between gap-2 text-sm">
      <span class="font-bold">${craftName(c, p.id)}</span>
      <span class="shrink-0 text-white/70"
        >${translateText(`gw.craft.phase.${p.phase}`)}</span
      >
    </div>
    ${p.lead === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.craft.lead", {
            name: personName(c.pack, p.lead),
          })}
        </p>`}
  </div>`;
}

function projectBox(c: GwCtx, v: GwCraftView): TemplateResult | typeof nothing {
  if (v.project === null && v.past.length === 0) return nothing;
  const note = v.project === null ? null : craftNote(c, v.project.id);
  return html`<section class=${BOX} data-gw-projects>
    <h3 class=${HEAD}>${translateText("gw.craft.project_title")}</h3>
    ${v.project === null
      ? html`<p class=${MUTED}>${translateText("gw.craft.project_none")}</p>`
      : html`${project(c, v.project)}
        ${note === null ? nothing : html`<p class=${MUTED}>${note}</p>`}`}
    ${v.past.length === 0
      ? nothing
      : html`<div class=${MUTED}>${translateText("gw.craft.past_title")}</div>
          ${[...v.past].reverse().map((p) => project(c, p))}`}
  </section>`;
}

/** The country tab's statecraft: footing and shortages, inventions, the project. */
export function craftSection(c: GwCtx): TemplateResult | typeof nothing {
  const v = c.seat.world.craft;
  if (v === undefined) return nothing;
  return html`${footingBox(c, v)} ${projectBox(c, v)} ${inventionsBox(c, v)}`;
}
