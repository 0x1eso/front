import {
  GW_POSTURES,
  GW_RESEARCH,
  GW_SCALES,
  GW_THEATRES,
  type GwAlloc,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTheatreView } from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { theatreSpot } from "./GwModel";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { textOrNull } from "./GwTicker";

const TRENCH_MAX = 5;

function lineName(id: string, line: string): string {
  return textOrNull(`gw.ui.line.${id}.${line}`) ?? line.replace(/_/g, " ");
}

function side(tag: string | null): string {
  return tag === null ? "" : translateText(`gw.country.${tag}`);
}

function theatreCard(t: GwTheatreView): TemplateResult {
  const spot = theatreSpot(t.id, t.line, t.progress);
  return html`<section
    data-gw-theatre=${t.id}
    class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5 ${t.open
      ? ""
      : "opacity-55"}"
  >
    <div class="flex items-center gap-2">
      <h3 class=${HEAD}>${translateText(`gw.ui.theatre.${t.id}`)}</h3>
      ${t.open && t.attacker !== null && t.defender !== null
        ? html`<span class="${MUTED} ml-auto truncate"
            >${side(t.attacker)} – ${side(t.defender)}</span
          >`
        : nothing}
    </div>
    ${t.open
      ? html`<div class="relative h-2 rounded bg-white/15" aria-hidden="true">
            <div
              class="absolute left-0 top-0 h-2 rounded bg-amber-300/80"
              style="width:${Math.round(spot.at * 100)}%"
            ></div>
          </div>
          <div class="flex justify-between gap-1 text-[11px] text-white/60">
            ${spot.names.map(
              (n, i) =>
                html`<span
                  class=${i === spot.line ? "font-bold text-amber-200" : ""}
                  >${lineName(t.id, n)}</span
                >`,
            )}
          </div>
          <div class=${MUTED}>
            ${translateText("gw.ui.trench", { n: t.trench, max: TRENCH_MAX })} ·
            ${translateText(
              `gw.ui.trench_word.${Math.min(t.trench, TRENCH_MAX)}`,
            )}
          </div>`
      : html`<p class=${MUTED}>${translateText("gw.ui.front_quiet")}</p>`}
  </section>`;
}

function pick<T extends string>(
  c: GwCtx,
  label: string,
  values: readonly T[],
  current: T,
  nameOf: (v: T) => string,
  set: (v: T) => void,
  attr: string,
): TemplateResult {
  return html`<div class="space-y-1">
    <div class=${MUTED}>${label}</div>
    <div class="flex flex-wrap gap-1">
      ${values.map(
        (v) =>
          html`<button
            class="${v === current ? BTN_ON : BTN} !px-2 !py-1"
            data-gw-pick=${`${attr}:${v}`}
            @click=${() => {
              set(v);
              c.redraw();
            }}
          >
            ${nameOf(v)}
          </button>`,
      )}
    </div>
  </div>`;
}

/** The allocation: where the weight goes this chapter (design §4.2). */
function allocForm(c: GwCtx): TemplateResult {
  const cur = c.seat.alloc;
  const draft: GwAlloc = c.ui.alloc ?? cur;
  const open = c.seat.theatres.filter((t) => t.open).map((t) => t.id);
  const mains = open.length === 0 ? [draft.main] : open;
  const set = (patch: Partial<GwAlloc>) =>
    (c.ui.alloc = { ...draft, ...patch });
  const same = JSON.stringify(draft) === JSON.stringify(cur);
  return html`<section
    data-gw-alloc
    class="space-y-2 rounded border border-white/15 bg-black/35 p-2.5"
  >
    <h3 class=${HEAD}>${translateText("gw.ui.alloc_title")}</h3>
    ${pick(
      c,
      translateText("gw.ui.alloc_main"),
      mains,
      draft.main,
      (v) => translateText(`gw.ui.theatre.${v}`),
      (v) => set({ main: v }),
      "main",
    )}
    ${pick(
      c,
      translateText("gw.ui.alloc_posture"),
      GW_POSTURES,
      draft.posture,
      (v) => translateText(`gw.ui.posture.${v}`),
      (v) => set({ posture: v }),
      "posture",
    )}
    ${pick(
      c,
      translateText("gw.ui.alloc_scale"),
      GW_SCALES,
      draft.scale,
      (v) => translateText(`gw.ui.scale.${v}`),
      (v) => set({ scale: v }),
      "scale",
    )}
    ${pick(
      c,
      translateText("gw.ui.alloc_allies"),
      ["0", "1", "2", "3"] as const,
      String(draft.allyShare) as "0" | "1" | "2" | "3",
      (v) => translateText(`gw.ui.ally_share.${v}`),
      (v) => set({ allyShare: Number(v) }),
      "ally",
    )}
    ${pick(
      c,
      translateText("gw.ui.alloc_research"),
      GW_RESEARCH,
      draft.research,
      (v) => translateText(`gw.ui.research.${v}`),
      (v) => set({ research: v }),
      "research",
    )}
    <button
      class="${BTN} w-full text-center"
      data-gw-alloc-send
      ?disabled=${same}
      @click=${() => {
        c.send({ kind: "allocate", ...draft });
        c.ui.alloc = null;
        c.redraw();
      }}
    >
      ${translateText("gw.ui.alloc_send")}
    </button>
    <p class=${MUTED}>
      ${translateText("gw.ui.alloc_now", {
        main: translateText(`gw.ui.theatre.${cur.main}`),
        posture: translateText(`gw.ui.posture.${cur.posture}`),
        scale: translateText(`gw.ui.scale.${cur.scale}`),
      })}
    </p>
  </section>`;
}

/** The fronts tab: every theatre's line, then the allocation. */
export function frontsTab(c: GwCtx): TemplateResult {
  const byId = new Map(c.seat.theatres.map((t) => [t.id, t]));
  const all = GW_THEATRES.flatMap((id) => byId.get(id) ?? []);
  const open = all.filter((t) => t.open);
  const shut = all.filter((t) => !t.open);
  return html`<div class="space-y-2.5" data-gw-fronts>
    ${open.length === 0
      ? html`<p class="text-sm text-white/65" data-gw-nofronts>
          ${translateText("gw.ui.no_fronts")}
        </p>`
      : open.map(theatreCard)}
    ${shut.length === 0
      ? nothing
      : html`<div class=${MUTED}>
          ${translateText("gw.ui.quiet_fronts")}:
          ${shut.map(
            (t) =>
              html`<span class="${CHIP} mr-1"
                >${translateText(`gw.ui.theatre.${t.id}`)}</span
              >`,
          )}
        </div>`}
    ${allocForm(c)}
  </div>`;
}
