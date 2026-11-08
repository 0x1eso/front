// World War 1936 P6 (spec §20.4): the army drawer's "army groups" tab — a
// card per group (marshal, abilities, traits), its armies, and [Front],
// [Execute all] (two taps), [Auto], [Disband] (two taps). Rendered by
// WwArmyPanel, which owns the two-tap state and the order sending.
// ww162 (Design A §3, design ww162 §1): the group's supply line, summed over
// its armies, and the marshal's lines with the offensive line's split.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { WwArmyGroupData } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  type ArmySummary,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { WwLandView } from "../../view/WwLandView";
import {
  ARMY_HUD_KEYS,
  groupShort,
  meanStrengthPm,
  supplyLine,
  supplyWords,
} from "./ArmyHudModel";
import { DoctrineModel, GroupRow } from "./DoctrineModel";
import { stockTable, type StockTableRow } from "./EconomyModel";
import { armyName, armyStatus, groupZoneOf, regionName } from "./LandModel";
import { landSelectionOf } from "./LandSelection";
import { groupColor, multiSelectOf } from "./MultiSelect";
import { PLANNER_KEYS } from "./PlannerKeys";
import type { WwGame } from "./WorldWarModel";

export interface GroupTabCtx {
  game: WwGame & ConstructorParameters<typeof DoctrineModel>[0];
  view: WwLandView;
  me: number;
  day: number;
  send: (o: WwOrder) => void;
  armed: (key: string) => boolean;
  confirmTap: (key: string, act: () => void) => void;
  /** The map taps pick the front now: a short screen closes the drawer. */
  onFront: () => void;
  /** ww162: the supply line was tapped: the industry drawer lights these need groups. */
  lit: (groups: readonly number[]) => void;
  /** ww162 §1.1-§1.3: a line chip: the map draws the group's line (WwDrawModeEvent with the group). */
  drawLine: (mode: GroupLineMode, group: number) => void;
}

/** The marshal's line modes the group tab's chips turn on. */
export type GroupLineMode = "front" | "goal" | "fallback";
const GROUP_LINE_MODES: readonly GroupLineMode[] = [
  "front",
  "goal",
  "fallback",
];
const GROUP_LINE_KEYS: Readonly<Record<GroupLineMode, string>> = {
  front: PLANNER_KEYS.btnFront,
  goal: PLANNER_KEYS.btnGoal,
  fallback: PLANNER_KEYS.btnFallback,
};
const GROUP_LINE_ICONS: Readonly<Record<GroupLineMode, string>> = {
  front: "🛡",
  goal: "⚔",
  fallback: "↩",
};

/** ww162 (design §2): [전선][공세선][후퇴선] for the marshal: the same draw modes, the group's orders. */
function renderLineChips(c: GroupTabCtx, g: GroupRow): TemplateResult {
  const sel = landSelectionOf(c.game);
  // Captioned: the card's own [전선] below is the one-shot zone (ag_front).
  return html`<div
      data-ww-group-draw-label
      class="mt-1 text-[11px] font-semibold text-sky-300"
    >
      ${translateText(PLANNER_KEYS.groupLines)}
    </div>
    <div
      data-ww-group-draw=${g.id}
      role="group"
      aria-label=${translateText(PLANNER_KEYS.groupLines)}
      class="grid grid-cols-3 gap-1"
    >
      ${GROUP_LINE_MODES.map((m) => {
        const on = sel.group === g.id && sel.draw === m;
        return html`<button
          type="button"
          data-ww-group-draw-mode=${m}
          aria-pressed=${String(on)}
          class="${BTN} min-h-11 ${on
            ? "border-amber-300 bg-amber-700/50"
            : ""}"
          @click=${() => c.drawLine(m, g.id)}
        >
          ${GROUP_LINE_ICONS[m]} ${translateText(GROUP_LINE_KEYS[m])}
        </button>`;
      })}
    </div>`;
}

/** ww162: the stock table's rows, for the supply line's days. */
function stockRowsOf(c: GroupTabCtx): StockTableRow[] {
  const detail = c.game.wwEconomy?.()?.detail(c.me) ?? null;
  if (detail === null) return [];
  return stockTable(
    detail,
    c.view.details.get(c.me)?.equipShort ?? null,
    c.game.wwDepth?.()?.detail(c.me)?.designs ?? [],
  );
}

/** ww162 (Design A §3): the group's supply line, its armies' shortages summed. */
function renderSupply(
  c: GroupTabCtx,
  g: GroupRow,
  armies: readonly ArmySummary[],
  rows: () => StockTableRow[],
): TemplateResult | typeof nothing {
  const short = groupShort(armies);
  if (short.length === 0) return nothing;
  const line = supplyLine(short, rows());
  if (line === null) return nothing;
  const w = supplyWords(line, meanStrengthPm(armies));
  return html`<button
    type="button"
    data-ww-group-short=${g.id}
    class="mt-1 flex min-h-10 w-full flex-wrap items-center gap-x-1.5 rounded-md text-left text-white/80 hover:bg-white/10"
    @click=${() => c.lit(line.short.map(([n]) => n))}
  >
    <span>${w.strength}</span>
    <span aria-hidden="true">·</span>
    <span class="text-amber-200">${w.short}</span>
    <span aria-hidden="true">·</span>
    <span class=${w.amber ? "font-semibold text-amber-300" : ""}
      >${w.days}</span
    >
  </button>`;
}

/**
 * ww162 (design §1.1-1.3): the marshal's lines, and for an offensive line
 * the split: each army its own sector, or every army the whole line
 * ([한 점 집중]); a change re-sends group_goal.
 */
function renderLines(
  c: GroupTabCtx,
  data: WwArmyGroupData | undefined,
): TemplateResult | typeof nothing {
  if (data === undefined) return nothing;
  const sc = c.view.scenario;
  const goal = data.goal ?? [];
  const fallback = data.fallback ?? [];
  if (data.ends === undefined && goal.length === 0 && fallback.length === 0) {
    return nothing;
  }
  const split = data.split === true;
  const setSplit = (on: boolean) => {
    if (on === split) return;
    c.send({
      kind: "group_goal",
      group: data.id,
      regions: [...goal],
      spear: data.spear === true,
      split: on,
    });
  };
  const chip = (on: boolean) =>
    html`<button
      type="button"
      data-ww-group-split=${on ? "on" : "off"}
      aria-pressed=${String(split === on)}
      class="${BTN} ${split === on ? "border-amber-300 bg-amber-700/50" : ""}"
      @click=${() => setSplit(on)}
    >
      ${translateText(on ? ARMY_HUD_KEYS.splitOn : ARMY_HUD_KEYS.splitOff)}
    </button>`;
  return html`<div data-ww-group-lines class="mt-1 flex flex-col gap-1">
    <div class="flex flex-wrap gap-x-2 text-white/80">
      ${data.ends !== undefined
        ? html`<span data-ww-line="front" class="text-sky-300"
            >${translateText(ARMY_HUD_KEYS.lineFront, {
              a: regionName(sc, data.ends[0]),
              b: regionName(sc, data.ends[1]),
            })}</span
          >`
        : nothing}
      ${goal.length > 0
        ? html`<span data-ww-line="goal" class="text-amber-200"
            >⚔
            ${translateText(
              data.spear === true
                ? ARMY_HUD_KEYS.lineSpear
                : ARMY_HUD_KEYS.lineGoal,
              { n: goal.length },
            )}</span
          >`
        : nothing}
      ${fallback.length > 0
        ? html`<span data-ww-line="fallback"
            >↩
            ${translateText(ARMY_HUD_KEYS.lineFallback, {
              n: fallback.length,
            })}</span
          >`
        : nothing}
    </div>
    ${goal.length > 0
      ? html`<div role="radiogroup" class="grid grid-cols-2 gap-1">
          ${chip(true)} ${chip(false)}
        </div>`
      : nothing}
  </div>`;
}

const BTN =
  "min-h-10 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold hover:bg-white/20";

function renderGroup(
  c: GroupTabCtx,
  g: GroupRow,
  rows: () => StockTableRow[],
): TemplateResult {
  const armies = g.armies
    .map((id) => c.view.armies.get(id))
    .filter((a) => a !== undefined);
  const auto = armies.length > 0 && armies.every((a) => a.mine?.auto === true);
  const exec = `agx${g.id}`;
  const disband = `agd${g.id}`;
  const divisions = armies.reduce((n, a) => n + a.divisions, 0);
  // ww7: the group's front is the union of its armies' zones.
  const zone = groupZoneOf(c.view, g.armies);
  return html`<div
    data-ww-group=${g.id}
    class="rounded-md border border-white/10 bg-white/5 p-1.5 text-xs"
  >
    <div class="flex items-center gap-2">
      <span
        data-ww-group-color
        class="h-3 w-3 shrink-0 rounded-sm"
        style="background: ${groupColor(g.id)}"
      ></span>
      <span class="font-bold"
        >${translateText("ww1936.ag.number", { n: g.id })}</span
      >
      <span class="ml-auto text-white/60"
        >${translateText("ww1936.land.band_divisions", { n: divisions })}</span
      >
    </div>
    <div data-ww-group-zone=${zone.length} class="mt-1 text-white/80">
      ${translateText("ww1936.ag.zone", { n: zone.length })}
    </div>
    ${renderSupply(c, g, armies, rows)}
    ${renderLines(
      c,
      c.game
        .wwDepth?.()
        ?.armyGroups()
        .find((d) => d.id === g.id),
    )}
    ${armies.length > 0 ? renderLineChips(c, g) : nothing}
    <div class="mt-1" data-ww-group-fm>
      <span class="font-semibold">${g.fmName}</span>
      <span class="text-white/70"
        >${g.fmTraits
          .map((t) => translateText(`ww1936.fm_trait.${t}`))
          .join(", ")}</span
      >
    </div>
    <ul class="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
      ${armies.map((a) => {
        const st = armyStatus(c.view, c.me, a, c.day);
        return html`<li
          data-ww-group-army=${a.id}
          class="flex items-center gap-2 rounded bg-white/5 px-1 py-0.5"
        >
          <span class="font-semibold">${armyName(a.nameNo)}</span>
          <span class="tabular-nums"
            >${translateText("ww1936.land.divisions_of", {
              n: a.divisions,
              max: WW_MAX_ARMY_DIVISIONS,
            })}</span
          >
          <span class="ml-auto min-w-0 truncate text-white/70"
            >${translateText(st.key, st.params)}</span
          >
          ${(a.mine?.front.length ?? 0) > 0
            ? html`<span
                data-ww-group-army-zone=${a.mine!.front.length}
                class="shrink-0 tabular-nums text-sky-300"
                >🛡${a.mine!.front.length}</span
              >`
            : nothing}
          <button
            type="button"
            data-ww-group-remove=${a.id}
            aria-label=${translateText("ww1936.ag.remove")}
            class="size-10 shrink-0 rounded hover:bg-white/10"
            @click=${() =>
              c.send({ kind: "ag_remove", group: g.id, army: a.id })}
          >
            ✕
          </button>
        </li>`;
      })}
    </ul>
    <div class="mt-1 grid grid-cols-2 gap-1">
      <button
        type="button"
        data-ww-group-front
        class=${BTN}
        @click=${() => {
          multiSelectOf(landSelectionOf(c.game)).startFront(g.id);
          c.onFront();
        }}
      >
        ${translateText("ww1936.ag.front")}
      </button>
      <button
        type="button"
        data-ww-group-attack
        aria-pressed=${String(
          multiSelectOf(landSelectionOf(c.game)).attackGroup === g.id,
        )}
        class="${BTN} ${multiSelectOf(landSelectionOf(c.game)).attackGroup ===
        g.id
          ? "border-red-400 bg-red-500/30"
          : ""}"
        @click=${() => {
          const m = multiSelectOf(landSelectionOf(c.game));
          m.startAttack(g.id);
          if (m.attackGroup !== null) c.onFront();
        }}
      >
        ${translateText("ww1936.ag.attack")}
      </button>
      <button
        type="button"
        data-ww-group-execute
        class="${BTN} ${c.armed(exec)
          ? "border-amber-300 bg-amber-500/30"
          : ""}"
        @click=${() =>
          c.confirmTap(exec, () => c.send({ kind: "ag_execute", group: g.id }))}
      >
        ${c.armed(exec)
          ? translateText("ww1936.doctrine.tap_again")
          : translateText("ww1936.ag.exec_all")}
      </button>
      <button
        type="button"
        data-ww-group-auto
        aria-pressed=${String(auto)}
        class="${BTN} ${auto ? "border-emerald-300" : ""}"
        @click=${() => c.send({ kind: "ag_auto", group: g.id, on: !auto })}
      >
        ${translateText("ww1936.ag.auto")}
      </button>
      <button
        type="button"
        data-ww-group-disband
        class="${BTN} ${c.armed(disband) ? "border-red-400 bg-red-500/30" : ""}"
        @click=${() =>
          c.confirmTap(disband, () =>
            c.send({ kind: "ag_disband", group: g.id }),
          )}
      >
        ${c.armed(disband)
          ? translateText("ww1936.doctrine.tap_again")
          : translateText("ww1936.ag.disband")}
      </button>
    </div>
  </div>`;
}

/** The tab's body. */
export function renderGroupTab(c: GroupTabCtx): TemplateResult {
  const groups = new DoctrineModel(c.game).groups();
  const multi = multiSelectOf(landSelectionOf(c.game));
  // The stock table is built once, and only for a group short of something.
  let stock: StockTableRow[] | null = null;
  const rows = () => (stock ??= stockRowsOf(c));
  return html`<div data-ww-groups class="flex flex-col gap-1.5 pt-2">
    ${groups.length === 0
      ? html`<p data-ww-empty class="m-0 text-xs text-white/60">
          ${translateText("ww1936.ag.empty")}
        </p>`
      : groups.map((g) => renderGroup(c, g, rows))}
    ${multi.attackGroup !== null
      ? html`<p data-ww-attack-hint class="m-0 text-xs text-red-300">
          ${translateText("ww1936.ag.attack_hint")}
        </p>`
      : nothing}
    ${multi.frontGroup !== null
      ? html`<p class="m-0 text-xs text-amber-300">
          ${translateText("ww1936.ag.front_hint")}
        </p>`
      : nothing}
  </div>`;
}
