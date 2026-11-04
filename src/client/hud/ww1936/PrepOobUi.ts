// World War 1936 lobby preparation (view): the top bar and the armies list of
// a major's start army plan. Plain template functions over PrepOob's model;
// the screen (WwLobbyPrep) owns the state and the handlers.
import {
  EQUIPMENT_TYPES,
  EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  NEED_GROUPS,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { ArmyEntry } from "./ArmyTemplates";
import { equipmentName } from "./EconomyModel";
import { armyName } from "./LandModel";
import type { PrepOobModel } from "./PrepOob";

const BTN =
  "min-h-10 shrink-0 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-semibold hover:bg-white/10";
const STEP =
  "size-10 shrink-0 rounded-md border border-white/15 bg-white/5 text-base font-bold hover:bg-white/10 disabled:opacity-30";

const num = (n: number) => Math.round(n).toLocaleString();

/** The top bar: men used and total, each equipment group's use against the stock, shortages in red. */
export function renderOobTop(m: PrepOobModel): TemplateResult {
  const r = m.result;
  const groups: TemplateResult[] = [];
  for (let g = 0; g < EQUIPMENT_TYPES.length; g++) {
    const stock = r.groupStock[g];
    const asked = r.equipAsked[g];
    if (stock <= 0 && asked <= 0) continue;
    const red = asked > stock;
    groups.push(
      html`<span
        data-ww-oob-equip=${NEED_GROUPS[g]}
        data-short=${String(red)}
        class="rounded border px-1.5 py-0.5 ${red
          ? "border-red-400/60 bg-red-500/15 text-red-200"
          : "border-white/10 bg-white/5 text-white/80"}"
        >${translateText("ww1936.prep.use", {
          name: equipmentName(NEED_GROUPS[g] as EquipmentType),
          used: num(r.equipUsed[g]),
          stock: num(stock),
        })}</span
      >`,
    );
  }
  const menShort = r.menAsked > r.menBudget;
  const shortWhy =
    r.limitedGroup >= 0
      ? translateText("ww1936.prep.short", {
          equipment: equipmentName(
            NEED_GROUPS[r.limitedGroup] as EquipmentType,
          ),
          n: r.total,
        })
      : r.cutAny && r.armies.some((a) => a.items.some((i) => i.cut === "men"))
        ? translateText("ww1936.prep.short_men", { n: r.total })
        : "";
  return html`<div
    data-ww-oob-top
    class="sticky top-0 z-10 flex flex-col gap-1 rounded-md border border-white/15 bg-gray-900/95 p-2 text-xs"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        data-ww-oob-men
        data-short=${String(menShort)}
        class="font-bold ${menShort ? "text-red-300" : "text-white"}"
        >${translateText("ww1936.prep.men", {
          used: num(r.menUsed),
          total: num(r.menBudget),
        })}</span
      >
      <span data-ww-oob-total class="text-white/80"
        >${translateText("ww1936.prep.total", {
          n: r.total,
          asked: r.asked,
        })}</span
      >
    </div>
    <div class="flex flex-wrap gap-1">${groups}</div>
    ${shortWhy === ""
      ? nothing
      : html`<div data-ww-oob-short class="font-semibold text-red-300">
          ${shortWhy}
        </div>`}
    ${m.problems.map(
      (p) =>
        html`<div data-ww-oob-problem class="font-semibold text-red-300">
          ${p}
        </div>`,
    )}
  </div>`;
}

export interface OobArmiesCtx {
  open: number | null;
  libraryOpen: number | null;
  fillKey: string;
  library: readonly ArmyEntry[];
  toggle(army: number): void;
  setCount(army: number, key: string, n: number): void;
  toggleLibrary(army: number): void;
  takeLibrary(army: number, entry: ArmyEntry): void;
  setFillKey(key: string): void;
  fill(army: number, key: string): void;
  reset(): void;
}

/** The armies, in the game's naming, each with a row per template. */
export function renderOobArmies(
  m: PrepOobModel,
  ctx: OobArmiesCtx,
): TemplateResult {
  const fillKey = m.templates.some((t) => t.key === ctx.fillKey)
    ? ctx.fillKey
    : (m.templates[0]?.key ?? "");
  // Required armies are shown first, marked.
  const order = m.armies
    .map((_, i) => i)
    .sort(
      (a, b) =>
        Number(m.armies[b].required) - Number(m.armies[a].required) || a - b,
    );
  return html`<div data-ww-oob-armies class="flex flex-col gap-2">
    <h3 class="m-0 text-sm font-bold">
      ${translateText("ww1936.prep.armies_title")}
    </h3>
    ${order.map((i) => {
      const a = m.armies[i];
      const open = ctx.open === i;
      return html`<section
        data-ww-oob-army=${i}
        data-required=${String(a.required)}
        class="flex flex-col gap-1 rounded-md border p-2 text-xs ${a.required
          ? "border-amber-400/50 bg-amber-500/10"
          : "border-white/10 bg-white/5"}"
      >
        <button
          type="button"
          data-ww-oob-army-head
          aria-expanded=${String(open)}
          class="flex min-h-10 w-full flex-wrap items-center gap-x-2 text-left"
          @click=${() => ctx.toggle(i)}
        >
          <span class="min-w-0 flex-1 text-sm font-bold"
            >${translateText("ww1936.prep.army_head", {
              army: armyName(a.nameNo),
              region: a.region,
            })}</span
          >
          ${a.required
            ? html`<span class="rounded bg-amber-500/30 px-1 text-amber-200"
                >${translateText("ww1936.prep.operation")}</span
              >`
            : nothing}
          <span
            data-ww-oob-army-sum
            class="${a.fieldedTotal < a.total
              ? "text-amber-200"
              : "text-white/80"}"
            >${translateText("ww1936.prep.army_sum", {
              plan: a.total,
              max: WW_MAX_ARMY_DIVISIONS,
              real: a.fieldedTotal,
            })}</span
          >
        </button>
        ${a.required
          ? html`<div class="text-amber-100">
              ${translateText("ww1936.prep.operation_guide", {
                n: a.original,
              })}
            </div>`
          : nothing}
        ${open ? renderArmyBody(m, i, ctx, fillKey) : nothing}
      </section>`;
    })}
    <button
      type="button"
      data-ww-oob-reset
      class="${BTN} self-start border-red-400/40"
      @click=${() => ctx.reset()}
    >
      ${translateText("ww1936.prep.defaults")}
    </button>
  </div>`;
}

function renderArmyBody(
  m: PrepOobModel,
  i: number,
  ctx: OobArmiesCtx,
  fillKey: string,
): TemplateResult {
  const a = m.armies[i];
  return html`<div class="flex flex-col gap-1">
    ${m.templates.map((t, k) => {
      const n = a.counts[k];
      const real = a.fielded[k];
      const lastOfRequired = a.required && a.total === n && n > 0;
      return html`<div
        data-ww-oob-row=${t.key}
        class="flex min-h-10 items-center gap-1 ${t.problem !== null
          ? "opacity-60"
          : ""}"
      >
        <span class="min-w-0 flex-1 truncate" title=${t.problem ?? ""}
          >${t.def.name}${t.problem !== null ? " 🔒" : ""}</span
        >
        ${t.problem === null && real !== n
          ? html`<span data-ww-oob-real class="text-amber-200">→ ${real}</span>`
          : nothing}
        <button
          type="button"
          data-ww-oob-minus
          class=${STEP}
          aria-label=${translateText("ww1936.prep.less")}
          ?disabled=${n <= 0 || lastOfRequired}
          @click=${() => ctx.setCount(i, t.key, n - 1)}
        >
          −
        </button>
        <span data-ww-oob-count class="w-7 text-center font-bold">${n}</span>
        <button
          type="button"
          data-ww-oob-plus
          class=${STEP}
          aria-label=${translateText("ww1936.prep.more")}
          ?disabled=${t.problem !== null || a.total >= WW_MAX_ARMY_DIVISIONS}
          @click=${() => ctx.setCount(i, t.key, n + 1)}
        >
          +
        </button>
      </div>`;
    })}
    <div class="flex flex-wrap items-center gap-1">
      <button
        type="button"
        data-ww-oob-load
        aria-expanded=${String(ctx.libraryOpen === i)}
        class="${BTN} flex-1"
        @click=${() => ctx.toggleLibrary(i)}
      >
        ${translateText("ww1936.prep.load_army")}
      </button>
    </div>
    ${ctx.libraryOpen !== i
      ? nothing
      : html`<ul
          data-ww-oob-library
          class="m-0 flex list-none flex-col gap-1 p-0"
        >
          ${ctx.library.length === 0
            ? html`<li class="text-white/60">
                ${translateText("ww1936.prep.library_army_none")}
              </li>`
            : ctx.library.map(
                (e) =>
                  html`<li>
                    <button
                      type="button"
                      data-ww-oob-take=${e.id}
                      class="${BTN} flex w-full items-center justify-between text-left"
                      @click=${() => ctx.takeLibrary(i, e)}
                    >
                      <span class="min-w-0 truncate font-bold">${e.name}</span>
                      <span class="text-white/60"
                        >${e.items.reduce((n, x) => n + x.count, 0)}</span
                      >
                    </button>
                  </li>`,
              )}
        </ul>`}
    <div class="flex flex-wrap items-center gap-1">
      <select
        data-ww-oob-fill-key
        class="min-h-10 min-w-0 flex-1 rounded-md border border-white/15 bg-gray-800 px-2 text-xs"
        aria-label=${translateText("ww1936.prep.fill_with")}
        @change=${(e: Event) =>
          ctx.setFillKey((e.target as HTMLSelectElement).value)}
      >
        ${m.templates
          .filter((t) => t.problem === null)
          .map(
            (t) =>
              html`<option value=${t.key} ?selected=${t.key === fillKey}>
                ${t.def.name}
              </option>`,
          )}
      </select>
      <button
        type="button"
        data-ww-oob-fill
        class="${BTN}"
        @click=${() => ctx.fill(i, fillKey)}
      >
        ${translateText("ww1936.prep.fill_rest")}
      </button>
    </div>
  </div>`;
}
