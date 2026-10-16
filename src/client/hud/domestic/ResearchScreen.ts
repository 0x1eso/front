import {
  DomesticData,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  MILLI,
  TECHS_REQUIRED_FROM_PREVIOUS_ERA,
} from "@openfront/engine-lib/domestic/Balance";
import {
  researchTicks,
  shortfallGold,
} from "@openfront/engine-lib/domestic/Research";
import { Branch, Era, TECHS } from "@openfront/engine-lib/domestic/Techs";
import { renderNumber } from "@openfront/engine-lib/Format";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { DomesticClientView } from "../../view/DomesticClientView";
import {
  airportIcon,
  atomBombIcon,
  bomberIcon,
  coastalBarrageIcon,
  coastalBatteryIcon,
  factoryIcon,
  hydrogenBombIcon,
  mirvIcon,
  missileSiloIcon,
  paradropIcon,
  samLauncherIcon,
  satelliteIcon,
  warshipIcon,
} from "../HotbarIcons";
import { ConfirmTap, confirmTapClass, confirmTapHandler } from "./ConfirmTap";
import { ringSvg } from "./Dial";
import {
  eraGate,
  linkedToAbove,
  linkedToBelow,
  TECH_ICONS,
  TECH_TREE,
  TechNodeKind,
  TechNodeState,
  techNodeState,
  TREE_BRANCHES,
  TREE_ERAS,
} from "./DomesticStatus";

// The research screen (spec §14d, after Civilization VI's tech tree): the
// running research and the reserved next one on top, then the tree with
// eras top to bottom and one column per branch. Tapping a node opens its
// detail sheet at the bottom of the drawer.

/** Starting is a plain tap; reserving takes a second tap (ConfirmTap). */
export interface ResearchScreenContext extends ConfirmTap {
  view: DomesticClientView;
  gold: bigint;
  /** Config.hasInfiniteGold: the engine charges this player no gold. */
  infiniteGold: boolean;
  /** The node whose detail sheet is open. */
  selected: TechId | null;
  select(tech: TechId | null): void;
  isUnitDisabled(type: UnitType): boolean;
  research(tech: TechId, payWithGold: boolean): void;
  /** Reserve `tech` as the next research; null clears the reservation. */
  queue(tech: TechId | null): void;
}

const BRANCH_BG: Readonly<Record<Branch, string>> = {
  economy: "bg-amber-400",
  military: "bg-rose-500",
  learning: "bg-sky-400",
};

const BRANCH_TEXT: Readonly<Record<Branch, string>> = {
  economy: "text-amber-300",
  military: "text-rose-300",
  learning: "text-sky-300",
};

const NODE_LOOK: Readonly<Record<TechNodeKind, string>> = {
  done: "border-emerald-500/70 bg-emerald-950/70",
  researching: "border-cyan-300 bg-cyan-950/70 ring-1 ring-cyan-300",
  available:
    "border-yellow-300 bg-gray-800 ring-2 ring-yellow-300/60 shadow-[0_0_10px_rgba(253,224,71,0.35)]",
  short: "border-gray-600 bg-gray-800",
  locked: "border-gray-700 bg-gray-900 opacity-60",
};

const NODE_MARK: Readonly<Record<TechNodeKind, string>> = {
  done: "✔",
  researching: "◔",
  available: "★",
  short: "",
  locked: "🔒",
};

const STATUS_COLOR: Readonly<Record<TechNodeKind, string>> = {
  done: "text-emerald-300",
  researching: "text-cyan-200",
  available: "text-yellow-200 font-semibold",
  short: "text-gray-300",
  locked: "text-gray-400",
};

/** What a tech unlocks, drawn with the build bar's icon and name. */
const UNLOCKS: Partial<Record<UnitType, { icon: string; key: string }>> = {
  [UnitType.Factory]: { icon: factoryIcon, key: "factory" },
  [UnitType.Warship]: { icon: warshipIcon, key: "warship" },
  [UnitType.MissileSilo]: { icon: missileSiloIcon, key: "missile_silo" },
  [UnitType.SAMLauncher]: { icon: samLauncherIcon, key: "sam_launcher" },
  [UnitType.AtomBomb]: { icon: atomBombIcon, key: "atom_bomb" },
  [UnitType.HydrogenBomb]: { icon: hydrogenBombIcon, key: "hydrogen_bomb" },
  [UnitType.MIRV]: { icon: mirvIcon, key: "mirv" },
  [UnitType.CoastalBattery]: {
    icon: coastalBatteryIcon,
    key: "coastal_battery",
  },
  [UnitType.Airport]: { icon: airportIcon, key: "airport" },
  [UnitType.Bomber]: { icon: bomberIcon, key: "bomber" },
  [UnitType.TransportPlane]: { icon: paradropIcon, key: "paradrop" },
  [UnitType.CoastalBarrage]: {
    icon: coastalBarrageIcon,
    key: "coastal_barrage",
  },
  [UnitType.Satellite]: { icon: satelliteIcon, key: "satellite" },
};

function techName(id: TechId): string {
  return translateText(`domestic.tech.${id}.name`);
}

function costText(ctx: ResearchScreenContext, id: TechId): string {
  return translateText("domestic.cost", {
    cost: TECHS[id].cost,
    seconds: researchTicks(id, ctx.view.pct("researchTime")) / 10,
  });
}

/** The node's one-line status: done, time left, ready, ETA or why it's locked. */
function statusText(d: DomesticData, id: TechId, s: TechNodeState): string {
  switch (s.kind) {
    case "done":
      return translateText("domestic.tree.done");
    case "researching":
      return translateText("domestic.tree.seconds_left", {
        seconds: Math.ceil((d.research?.ticksLeft ?? 0) / 10),
      });
    case "available":
      return translateText("domestic.tree.ready");
    case "short":
      return s.secondsUntil === null
        ? translateText("domestic.tree.no_income")
        : translateText("domestic.ready_in", { seconds: s.secondsUntil });
    case "locked":
      return s.lock === "era"
        ? translateText("domestic.tree.needs_era", {
            era: TECHS[id].era - 1,
            need: TECHS_REQUIRED_FROM_PREVIOUS_ERA,
          })
        : translateText("domestic.blocked.prereq", {
            tech: s.missing === null ? "" : techName(s.missing),
          });
  }
}

export function renderResearchScreen(
  ctx: ResearchScreenContext,
): TemplateResult {
  return html`
    <div class="flex flex-col gap-3">
      ${renderCurrent(ctx)} ${renderTree(ctx)}
    </div>
  `;
}

function renderCurrent(ctx: ResearchScreenContext): TemplateResult {
  const d = ctx.view.data;
  const r = d.research;
  const done = r === null ? 0 : 1 - r.ticksLeft / Math.max(1, r.totalTicks);
  return html`
    <section
      data-research-current
      class="flex flex-col gap-2 rounded-lg bg-gray-800/80 border border-white/10 p-3"
    >
      <div class="flex items-center gap-3">
        <div class="relative size-14 shrink-0">
          ${ringSvg(done, r === null ? "grey" : "science")}
          <span
            class="relative flex items-center justify-center w-full h-full text-2xl"
            >${r === null ? "🔬" : TECH_ICONS[r.tech]}</span
          >
        </div>
        <div class="flex-1 min-w-0">
          ${r === null
            ? html`<div class="text-base font-bold">
                  ${translateText("domestic.tree.idle")}
                </div>
                <div class="text-xs text-gray-300">
                  ${translateText("domestic.tree.idle_hint")}
                </div>`
            : html`<div class="text-xs font-semibold text-sky-300">
                  ${translateText("domestic.researching")}
                </div>
                <div class="text-base font-bold truncate">
                  ${techName(r.tech)}
                </div>
                <div class="text-sm tabular-nums">
                  ${translateText("domestic.tree.seconds_left", {
                    seconds: Math.ceil(r.ticksLeft / 10),
                  })}
                </div>`}
        </div>
        <div data-research-science class="shrink-0 text-right">
          <div class="text-xs text-gray-400">
            ${translateText("domestic.science")}
          </div>
          <div class="text-lg font-bold tabular-nums leading-tight">
            ${d.science}
          </div>
          <div class="text-xs text-sky-300 tabular-nums">
            ${translateText("domestic.per_sec", {
              value: d.sciencePerSec.toFixed(1),
            })}
          </div>
        </div>
      </div>
      ${renderQueueSlot(ctx)}
    </section>
  `;
}

function renderQueueSlot(ctx: ResearchScreenContext): TemplateResult {
  const queued = ctx.view.data.queuedTech ?? null;
  return html`
    <div
      data-queue-slot
      class="flex items-center gap-2 min-h-11 rounded-md border border-dashed px-2 py-1 ${queued ===
      null
        ? "border-white/20"
        : "border-sky-400/70 bg-sky-950/40"}"
    >
      <span class="shrink-0 text-xs font-semibold text-gray-300"
        >⏭ ${translateText("domestic.tree.next")}</span
      >
      ${queued === null
        ? html`<span class="flex-1 text-xs text-gray-400"
            >${translateText("domestic.tree.next_empty")}</span
          >`
        : html`<button
              type="button"
              data-queue-tech=${queued}
              class="flex-1 min-w-0 min-h-9 text-left text-sm font-bold truncate"
              @click=${() => ctx.select(queued)}
            >
              ${TECH_ICONS[queued]} ${techName(queued)}
            </button>
            <button
              type="button"
              data-queue-cancel
              aria-label=${translateText("domestic.tree.cancel_queue")}
              class="h-9 px-3 shrink-0 rounded-md bg-gray-700 hover:bg-red-800 text-sm font-bold"
              @click=${() => ctx.queue(null)}
            >
              ✕ ${translateText("common.cancel")}
            </button>`}
    </div>
    <p class="text-[11px] leading-snug text-gray-400">
      ${translateText("domestic.tree.next_hint")}
    </p>
  `;
}

function renderTree(ctx: ResearchScreenContext): TemplateResult {
  const researched = ctx.view.researchedTechs();
  return html`
    <div data-tech-tree class="flex flex-col">
      <div class="sticky top-0 z-10 grid grid-cols-3 gap-2 py-1.5 bg-gray-900">
        ${TREE_BRANCHES.map(
          (b) =>
            html`<div
              data-branch-header=${b}
              class="flex items-center gap-1 text-xs font-bold ${BRANCH_TEXT[
                b
              ]}"
            >
              <span class="size-2 rounded-full ${BRANCH_BG[b]}"></span>
              ${translateText(`domestic.branch.${b}`)}
            </div>`,
        )}
      </div>
      ${TREE_ERAS.map(
        (era) => html`
          ${renderEraBar(era, researched)}
          <div data-era=${era} class="grid grid-cols-3 gap-2 items-stretch">
            ${TREE_BRANCHES.map((b) => renderColumn(ctx, era, b, researched))}
          </div>
        `,
      )}
    </div>
  `;
}

/** Era 1's title; above later eras, the gate: N techs of the era before. */
function renderEraBar(era: Era, researched: ReadonlySet<TechId>) {
  if (era === 1) {
    return html`<div class="py-1 text-xs font-bold text-gray-300">
      ${translateText("domestic.era", { era })}
    </div>`;
  }
  const gate = eraGate(researched, (era - 1) as Era);
  const open = gate.have >= gate.need;
  const have = Math.min(gate.have, gate.need);
  return html`<div
    data-era-gate=${era}
    data-open=${String(open)}
    class="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold border ${open
      ? "bg-emerald-950/80 text-emerald-200 border-emerald-600/50"
      : "bg-gray-800 text-gray-300 border-white/10"}"
  >
    <span>${open ? "🔓" : "🔒"}</span>
    <span class="flex-1"
      >${translateText("domestic.tree.era_gate", {
        era,
        prev: era - 1,
        need: gate.need,
        have,
      })}</span
    >
    <span class="h-1.5 w-12 shrink-0 rounded-full bg-gray-700 overflow-hidden"
      ><span
        class="block h-full bg-emerald-400"
        style="width: ${Math.round((have / gate.need) * 100)}%"
      ></span
    ></span>
  </div>`;
}

function line(branch: Branch, show: boolean, grow = false) {
  return html`<div
    class="${grow ? "flex-1 min-h-2" : "h-2"} flex justify-center"
    aria-hidden="true"
  >
    ${show
      ? html`<div data-prereq-line class="w-0.5 ${BRANCH_BG[branch]}"></div>`
      : nothing}
  </div>`;
}

function renderColumn(
  ctx: ResearchScreenContext,
  era: Era,
  branch: Branch,
  researched: ReadonlySet<TechId>,
) {
  const ids = TECH_TREE[era][branch];
  const last = ids[ids.length - 1];
  // Lines join a node to its prerequisite right above it; the last node's
  // line runs to the bottom of the era, through the gate, to the next.
  return html`<div data-column=${branch} class="flex flex-col items-stretch">
    ${ids.map(
      (id) =>
        html`${line(branch, linkedToAbove(id))}
        ${renderNode(ctx, id, researched)}`,
    )}
    ${line(branch, last !== undefined && linkedToBelow(last), true)}
  </div>`;
}

function renderNode(
  ctx: ResearchScreenContext,
  id: TechId,
  researched: ReadonlySet<TechId>,
): TemplateResult {
  const d = ctx.view.data;
  const s = techNodeState(d, researched, id);
  const def = TECHS[id];
  const selected = ctx.selected === id;
  const r = d.research;
  return html`<button
    type="button"
    data-tech=${id}
    data-state=${s.kind}
    data-queued=${String(s.queued)}
    aria-pressed=${String(selected)}
    class="relative w-full min-h-11 text-left rounded-md border px-1.5 pb-1.5 pt-2 flex flex-col gap-0.5 ${NODE_LOOK[
      s.kind
    ]} ${selected ? "outline-2 outline-offset-1 outline-white" : ""}"
    @click=${() => ctx.select(selected ? null : id)}
  >
    <span
      class="absolute inset-x-0 top-0 h-1 rounded-t-md ${BRANCH_BG[def.branch]}"
    ></span>
    <span class="flex items-start gap-1">
      <span class="text-base leading-none">${TECH_ICONS[id]}</span>
      <span class="flex-1 min-w-0 text-xs font-bold leading-tight"
        >${techName(id)}</span
      >
      <span data-node-mark class="text-xs leading-none ${STATUS_COLOR[s.kind]}"
        >${NODE_MARK[s.kind]}</span
      >
    </span>
    <span
      data-node-status
      class="text-[11px] leading-tight ${STATUS_COLOR[s.kind]}"
      >${statusText(d, id, s)}</span
    >
    ${s.kind === "done"
      ? nothing
      : html`<span
          data-node-cost
          class="text-[11px] leading-tight tabular-nums ${s.kind === "short"
            ? "text-red-400 font-semibold"
            : "text-gray-400"}"
          >${costText(ctx, id)}</span
        >`}
    ${s.queued
      ? html`<span data-node-queued class="text-[10px] font-bold text-sky-300"
          >⏭ ${translateText("domestic.tree.queued")}</span
        >`
      : nothing}
    ${s.kind === "researching" && r !== null
      ? html`<span class="h-1 mt-0.5 rounded-full bg-gray-700 overflow-hidden"
          ><span
            class="block h-full bg-cyan-300"
            style="width: ${Math.round(
              (1 - r.ticksLeft / Math.max(1, r.totalTicks)) * 100,
            )}%"
          ></span
        ></span>`
      : nothing}
  </button>`;
}

/** The selected node's detail sheet: full effect, unlocks, cost and actions. */
export function renderTechSheet(ctx: ResearchScreenContext): TemplateResult {
  const id = ctx.selected!;
  const d = ctx.view.data;
  const def = TECHS[id];
  const s = techNodeState(d, ctx.view.researchedTechs(), id);
  const unlocks = def.unlocks.filter(
    (u) => UNLOCKS[u] !== undefined && !ctx.isUnitDisabled(u),
  );
  const status =
    s.kind === "done"
      ? translateText("domestic.researched")
      : s.kind === "researching"
        ? translateText("domestic.research_progress", {
            tech: techName(id),
            seconds: Math.ceil((d.research?.ticksLeft ?? 0) / 10),
          })
        : statusText(d, id, s);
  return html`
    <div class="flex flex-col gap-2" data-sheet-tech=${id}>
      <div class="flex items-start gap-2">
        <span class="text-3xl leading-none">${TECH_ICONS[id]}</span>
        <div class="flex-1 min-w-0">
          <div class="text-lg font-bold leading-tight">${techName(id)}</div>
          <div class="text-xs text-gray-400">
            ${translateText("domestic.tree.meta", {
              era: def.era,
              branch: translateText(`domestic.branch.${def.branch}`),
            })}
            · ${costText(ctx, id)}
          </div>
        </div>
        <button
          type="button"
          data-sheet-close
          aria-label=${translateText("common.close")}
          class="size-9 shrink-0 flex items-center justify-center rounded-md text-xl hover:bg-white/10"
          @click=${() => ctx.select(null)}
        >
          ✕
        </button>
      </div>
      <p class="text-sm text-gray-100">
        ${translateText(`domestic.tech.${id}.desc`)}
      </p>
      ${unlocks.length === 0
        ? nothing
        : html`<div class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs font-semibold text-gray-300"
              >${translateText("domestic.tree.unlocks")}</span
            >
            ${unlocks.map((u) => {
              const item = UNLOCKS[u]!;
              return html`<span
                data-unlock=${item.key}
                class="flex items-center gap-1 rounded-md bg-gray-900 border border-white/10 px-1.5 py-0.5 text-xs"
                ><img
                  src=${item.icon}
                  alt=""
                  width="16"
                  height="16"
                  class="size-4"
                />${translateText(`unit_type.${item.key}`)}</span
              >`;
            })}
          </div>`}
      <div data-sheet-status class="text-sm ${STATUS_COLOR[s.kind]}">
        ${NODE_MARK[s.kind]} ${status}
      </div>
      ${renderSheetActions(ctx, id, s)}
    </div>
  `;
}

const ACTION =
  "w-full h-11 px-4 rounded-md text-base font-bold disabled:opacity-40";

function renderSheetActions(
  ctx: ResearchScreenContext,
  id: TechId,
  s: TechNodeState,
): TemplateResult | typeof nothing {
  if (s.kind === "done" || s.kind === "researching") return nothing;
  const d = ctx.view.data;
  const busy = d.research !== null;
  if (!busy && s.kind === "available" && !s.queued) {
    return html`<button
      type="button"
      data-sheet-action="start"
      class="${ACTION} h-12 bg-sky-600 hover:bg-sky-500"
      @click=${() => ctx.research(id, false)}
    >
      ${translateText("domestic.tree.start", { cost: TECHS[id].cost })}
    </button>`;
  }
  const gold = !busy && s.kind === "short" ? renderGoldButton(ctx, id) : null;
  if (s.queued) {
    return html`<div class="flex flex-col gap-1.5">
      ${gold ?? nothing}
      <button
        type="button"
        data-sheet-action="cancel"
        class="${ACTION} bg-gray-700 hover:bg-gray-600"
        @click=${() => ctx.queue(null)}
      >
        ✕ ${translateText("domestic.tree.cancel_queue")}
      </button>
    </div>`;
  }
  const key = `queue:${id}`;
  const queued = d.queuedTech ?? null;
  return html`<div class="flex flex-col gap-1.5">
    ${gold ?? nothing}
    <button
      type="button"
      data-sheet-action="queue"
      class="${ACTION} bg-indigo-600 hover:bg-indigo-500 ${confirmTapClass(
        ctx,
        key,
      )}"
      @click=${confirmTapHandler(ctx, key, () => ctx.queue(id))}
    >
      ⏭
      ${ctx.armed === key
        ? translateText("domestic.tree.queue_confirm")
        : translateText(
            busy ? "domestic.tree.queue_next" : "domestic.tree.queue_auto",
          )}
    </button>
    ${queued === null
      ? nothing
      : html`<span data-sheet-replaces class="text-xs text-amber-200"
          >${translateText("domestic.tree.queue_replaces", {
            tech: techName(queued),
          })}</span
        >`}
  </div>`;
}

/** Start now, paying the missing science in gold (spec §3.1). */
function renderGoldButton(
  ctx: ResearchScreenContext,
  id: TechId,
): TemplateResult {
  const d = ctx.view.data;
  // Infinite gold: the engine charges nothing (payPoints).
  const gold = ctx.infiniteGold
    ? 0n
    : shortfallGold(
        (TECHS[id].cost - d.science) * MILLI,
        ctx.view.pct("goldPaymentCost"),
      );
  const affordable = ctx.gold >= gold;
  return html`<button
      type="button"
      data-sheet-action="gold"
      class="${ACTION} bg-amber-700 hover:bg-amber-600"
      ?disabled=${!affordable}
      @click=${() => ctx.research(id, true)}
    >
      ${translateText("domestic.pay_with_gold", { gold: renderNumber(gold) })}
    </button>
    ${affordable
      ? nothing
      : html`<span data-reason class="text-xs text-red-300"
          >${translateText("build_menu.not_enough_money")}</span
        >`}`;
}
