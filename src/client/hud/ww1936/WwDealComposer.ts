import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { DealSide } from "./DealUi";
import { DEAL_UI_KEYS } from "./DiploKeys";
import type {
  DealChipView,
  DealChoice,
  DealComposerView,
  DealFormView,
} from "./DiploModel";

/** What the composer's buttons do (the host's handlers). */
export interface DealComposerActions {
  /** The send button is armed (the first of two taps). */
  armed: boolean;
  remove(side: DealSide, index: number): void;
  removeRegion(region: number): void;
  toggleAdding(side: DealSide): void;
  pickKind(
    side: DealSide,
    kind: DealComposerView["kinds"][number]["kind"],
  ): void;
  choose(value: string): void;
  gen(value: number): void;
  group(value: string): void;
  count(value: number): void;
  months(value: number): void;
  addForm(): void;
  cancelForm(): void;
  send(): void;
  close(): void;
}

/** A chip: 36 px tall (design §7), × to remove. */
const CHIP =
  "flex h-9 min-w-0 max-w-full shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 text-xs hover:bg-white/10";
const SMALL =
  "flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 px-2 text-xs hover:bg-white/10 disabled:opacity-40";
const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const ON = "border-emerald-300 bg-emerald-900/50";

function chip(c: DealChipView, a: DealComposerActions): TemplateResult {
  return html`<button
    type="button"
    data-ww-deal-chip=${`${c.side}:${c.index}`}
    class=${CHIP}
    aria-label=${translateText("ww1936.deal.remove", { item: c.text })}
    @click=${() => a.remove(c.side, c.index)}
  >
    <span class="min-w-0 truncate">${c.text}</span
    ><span aria-hidden="true" class="text-white/60">×</span>
  </button>`;
}

function choices(
  list: readonly DealChoice[],
  attr: string,
  pick: (value: string) => void,
): TemplateResult | typeof nothing {
  if (list.length === 0) return nothing;
  return html`<div class="flex flex-wrap gap-1">
    ${list.map(
      (c) =>
        html`<button
          type="button"
          data-ww-deal-choice=${`${attr}:${c.value}`}
          data-on=${String(c.on)}
          class="${SMALL} ${c.on ? ON : ""}"
          @click=${() => pick(c.value)}
        >
          ${c.label}
        </button>`,
    )}
  </div>`;
}

function stepper(
  attr: string,
  label: string,
  value: number,
  min: number,
  max: number | null,
  set: (n: number) => void,
): TemplateResult {
  const step = value < 10 ? 1 : value < 100 ? 10 : value < 1000 ? 100 : 1000;
  const clamp = (n: number) =>
    Math.max(min, max === null ? n : Math.min(max, n));
  return html`<div data-ww-deal-step=${attr} class="flex items-center gap-1">
    <span class="min-w-0 flex-1 text-white/70">${label}</span>
    <button
      type="button"
      class=${SMALL}
      ?disabled=${value <= min}
      @click=${() => set(clamp(value - step))}
    >
      −
    </button>
    <span class="min-w-12 text-center tabular-nums">${value}</span>
    <button
      type="button"
      class=${SMALL}
      ?disabled=${max !== null && value >= max}
      @click=${() => set(clamp(value + step))}
    >
      +
    </button>
  </div>`;
}

function form(f: DealFormView, a: DealComposerActions): TemplateResult {
  return html`<div
    data-ww-deal-form=${f.kind}
    class="flex flex-col gap-1 rounded-md border border-white/15 bg-black/20 p-1.5"
  >
    <b>${f.title}</b>
    ${choices(f.choices, "item", a.choose)}
    ${choices(f.gens, "gen", (v) => a.gen(Number(v)))}
    ${choices(f.groups, "group", a.group)}
    ${f.count === null
      ? nothing
      : stepper(
          "count",
          translateText(
            f.kind === "lend_lease"
              ? "ww1936.deal.per_month"
              : "ww1936.deal.count",
          ),
          f.count,
          1,
          f.countMax,
          a.count,
        )}
    ${f.months === null
      ? nothing
      : stepper(
          "months",
          translateText("ww1936.deal.months"),
          f.months,
          1,
          24,
          a.months,
        )}
    <div class="flex gap-1">
      <button
        type="button"
        data-ww-act="deal_form_add"
        class="${BUTTON} flex-1"
        ?disabled=${f.item === null}
        @click=${a.addForm}
      >
        ${translateText("ww1936.deal.form_add")}
      </button>
      <button
        type="button"
        data-ww-act="deal_form_cancel"
        class=${BUTTON}
        @click=${a.cancelForm}
      >
        ${translateText("ww1936.npeace.cancel")}
      </button>
    </div>
  </div>`;
}

function column(
  v: DealComposerView,
  side: DealSide,
  a: DealComposerActions,
): TemplateResult {
  const list = side === "give" ? v.give : v.take;
  const open = v.adding === side;
  return html`<section data-ww-deal-col=${side} class="flex flex-col gap-1">
    <span class="font-semibold text-amber-200"
      >${translateText(
        side === "give" ? DEAL_UI_KEYS.give : DEAL_UI_KEYS.take,
      )}</span
    >
    <div class="flex flex-wrap gap-1">
      ${list.map((c) => chip(c, a))}
      <button
        type="button"
        data-ww-deal-add=${side}
        aria-expanded=${String(open)}
        class="${CHIP} border-dashed ${open ? ON : ""}"
        @click=${() => a.toggleAdding(side)}
      >
        ${translateText(DEAL_UI_KEYS.add)}
      </button>
    </div>
    ${open && v.form === null
      ? html`<ul
          data-ww-deal-kinds
          class="m-0 flex list-none flex-col gap-0.5 p-0"
        >
          ${v.kinds.map(
            (k) =>
              html`<li class="flex flex-col">
                <button
                  type="button"
                  data-ww-deal-kind=${k.kind}
                  class="${BUTTON} w-full text-left"
                  ?disabled=${k.block !== null}
                  @click=${() => a.pickKind(side, k.kind)}
                >
                  ${k.label}
                </button>
                ${k.block === null
                  ? nothing
                  : html`<span class="text-red-300">${k.block}</span>`}
              </li>`,
          )}
        </ul>`
      : nothing}
    ${v.form !== null && v.form.side === side ? form(v.form, a) : nothing}
  </section>`;
}

function regionList(
  v: DealComposerView,
  a: DealComposerActions,
): TemplateResult {
  return html`<div data-ww-deal-regions class="flex flex-wrap gap-1">
    ${v.regions.length === 0
      ? html`<span class="text-white/50"
          >${translateText("ww1936.npeace.none")}</span
        >`
      : v.regions.map(
          (r) =>
            html`<button
              type="button"
              data-ww-deal-region=${r.region}
              class=${CHIP}
              aria-label=${translateText("ww1936.npeace.remove", {
                region: r.name,
              })}
              @click=${() => a.removeRegion(r.region)}
            >
              <span class="min-w-0 truncate">${r.name}</span
              ><span aria-hidden="true" class="text-white/60">×</span>
            </button>`,
        )}
  </div>`;
}

const TONE: Readonly<Record<string, string>> = {
  high: "bg-emerald-400",
  medium: "bg-amber-300",
  low: "bg-red-400",
  none: "bg-red-600",
};

/**
 * World War 1936 diplomacy (ww161 Design B §7): the composer — the
 * negotiated peace composer's look, widened. A deal: "내가 준다" and "내가
 * 받는다", each a row of 36 px item chips (× removes) and "+ 추가" (a
 * one-column list of item kinds, a small form for the ones with numbers);
 * regions come from the map. An ultimatum or a collaboration government:
 * the regions (pre-picked; a tap on the map adds or drops one) and their
 * share of the victory points. At the bottom: the reason it can't go, the
 * "상대가 받아들일 가능성" bar, the cost and a two-tap 보내기.
 */
export function dealComposerTemplate(
  v: DealComposerView,
  a: DealComposerActions,
): TemplateResult {
  return html`<div
    data-ww-deal=${v.mode}
    data-ww-deal-to=${v.to}
    class="flex min-h-0 flex-col gap-1.5 text-xs"
  >
    <div class="flex items-center gap-1">
      <b class="min-w-0 flex-1 truncate leading-tight">🤝 ${v.title}</b>
      <button
        type="button"
        data-ww-act="deal_close"
        class="size-9 shrink-0 rounded-md hover:bg-white/10"
        aria-label=${translateText("common.close")}
        @click=${a.close}
      >
        ✕
      </button>
    </div>
    <div class="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
      ${v.mode === "deal"
        ? html`${column(v, "give", a)} ${column(v, "take", a)}`
        : regionList(v, a)}
      <span data-ww-deal-map class="text-white/60"
        >🗺
        ${translateText(
          v.mode === "deal"
            ? "ww1936.deal.map_hint"
            : "ww1936.deal.map_hint_regions",
        )}</span
      >
      ${v.tapRegion === ""
        ? nothing
        : html`<span class="text-white/70">${v.tapRegion}</span>`}
      ${v.tapNote === null
        ? nothing
        : html`<span data-ww-deal-note class="text-red-300"
            >${v.tapNote}</span
          >`}
      ${v.share === null
        ? nothing
        : html`<span data-ww-deal-share class="text-white/70"
            >${v.share}</span
          >`}
    </div>
    ${v.block === null
      ? nothing
      : html`<span data-ww-deal-block class="text-red-300">${v.block}</span>`}
    ${v.chancePct === null
      ? html`<span data-ww-deal-hint class="text-white/70"
          >${v.chanceText}</span
        >`
      : html`<div
          data-ww-deal-chance=${v.chanceLevel ?? ""}
          class="flex flex-col gap-0.5"
        >
          <div class="flex justify-between gap-2">
            <span class="text-white/70">${v.chanceText}</span>
            <span class="font-semibold"
              >${translateText(`ww1936.npeace.chance_${v.chanceLevel}`)}</span
            >
          </div>
          <div class="h-1.5 rounded bg-white/10">
            <div
              class="h-1.5 rounded ${TONE[v.chanceLevel ?? "none"]}"
              style="width: ${v.chancePct}%"
            ></div>
          </div>
        </div>`}
    <div class="flex gap-1">
      <button
        type="button"
        data-ww-act="deal_send"
        data-armed=${String(a.armed)}
        class="${BUTTON} flex-1 ${a.armed ? "ring-2 ring-red-400" : ""}"
        ?disabled=${v.block !== null || v.order === null}
        @click=${a.send}
      >
        ${a.armed
          ? translateText(DEAL_UI_KEYS.sendConfirm)
          : html`${translateText(DEAL_UI_KEYS.send)}<span
                class="font-normal text-white/60"
              >
                · ${v.cost}</span
              >`}
      </button>
      <button
        type="button"
        data-ww-act="deal_cancel"
        class=${BUTTON}
        @click=${a.close}
      >
        ${translateText("ww1936.npeace.cancel")}
      </button>
    </div>
  </div>`;
}
