// World War 1936 w51 (air groups, design ww50 Part 2): the air drawer's two
// new tabs. "Groups": my groups by status, and the wings outside any
// template as one-type entries. "Templates": the saved templates with their
// keep-N steppers, and the editor (per-type steppers in 25s, the 600 total,
// role totals, ranges and the warning for a mix of very different ranges).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_TYPES,
  WW_AIR_TEMPLATE_NAME_MAX,
  WW_GROUP_STEP,
  WW_MAX_AIR_TEMPLATES,
  WW_MAX_GROUP_PLANES,
  WW_MAX_KEEP_GROUPS,
} from "@openfront/engine-api/ww1936/AirTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import {
  airTypeLabel,
  draftOf,
  draftTotal,
  emptyDraft,
  groupName,
  groupPlanes,
  groupStatus,
  groupWanted,
  myGroups,
  myTemplates,
  rangeSpread,
  roleTotals,
  statusText,
  stepKeep,
  stepType,
  TEMPLATE_ROLES,
  TEMPLATE_TYPES,
  templateBlock,
  TemplateDraft,
  templateDropOrder,
  templateFormed,
  templateOrder,
  typeRanges,
  ungroupedWings,
} from "./AirGroupModel";
import { NavyCtx, srName } from "./NavyModel";
import { baseName, phaseNow, stateKeyOf, wingName } from "./WingModel";

const BUTTON =
  "h-10 min-w-10 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";

export interface GroupsTabEnv {
  ctx: NavyCtx;
  ticks: number;
  openGroup: (id: number) => void;
  openWing: (id: number) => void;
  toTemplates: () => void;
}

export function renderGroupsTab(env: GroupsTabEnv): TemplateResult {
  const { ctx } = env;
  const groups = myGroups(ctx);
  const loose = ungroupedWings(ctx);
  if (groups.length === 0 && loose.length === 0) {
    return html`<p data-ww-groups-none class="m-0 mt-2 text-xs text-white/60">
      ${translateText("ww1936.airgroup.none")}
      <button
        type="button"
        data-ww-groups-to-templates
        class="${BUTTON} mt-1 block"
        @click=${env.toTemplates}
      >
        ${translateText("ww1936.airgroup.make_template")}
      </button>
    </p>`;
  }
  return html`<ul
    data-ww-group-list
    class="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs"
  >
    ${groups.map((g) => {
      const st = groupStatus(g, env.ticks);
      const want = groupWanted(g);
      const zones =
        g.army !== 0
          ? translateText("ww1936.airgroup.following_short")
          : g.zones.map((z) => srName(ctx.scenario, z)).join(" · ");
      return html`<li>
        <button
          type="button"
          data-ww-group-row=${g.id}
          data-status=${st.status}
          class="flex min-h-10 w-full flex-col gap-0.5 rounded-md border border-white/10 bg-white/5 p-1.5 text-left hover:bg-white/10"
          @click=${() => env.openGroup(g.id)}
        >
          <span class="flex w-full items-baseline gap-1.5">
            <span class="min-w-0 flex-1 truncate font-semibold"
              >${groupName(g)}</span
            >
            <span class="shrink-0 tabular-nums"
              >${groupPlanes(g)}${want > 0 ? `/${want}` : ""}</span
            >
            <span
              data-ww-group-status=${st.status}
              class="shrink-0 ${st.status === "none" || st.status === "range"
                ? "text-amber-300"
                : "text-emerald-300"}"
              >${statusText(st)}</span
            >
          </span>
          <span class="truncate text-white/70"
            >${zones === "" ? baseName(ctx, g.base) : zones}</span
          >
        </button>
      </li>`;
    })}
    ${loose.map((w) => {
      const ph = phaseNow(ctx.air, w, env.ticks);
      return html`<li>
        <button
          type="button"
          data-ww-loose-row=${w.id}
          class="flex min-h-10 w-full items-baseline gap-1.5 rounded-md border border-white/10 bg-white/5 p-1.5 text-left hover:bg-white/10"
          @click=${() => env.openWing(w.id)}
        >
          <span class="min-w-0 flex-1 truncate font-semibold"
            >${wingName(w)}</span
          >
          <span class="shrink-0 tabular-nums">${w.planes}</span>
          <span class="shrink-0 text-white/70"
            >${translateText(stateKeyOf(ph.phase, w.planes))}</span
          >
        </button>
      </li>`;
    })}
  </ul>`;
}

export interface TemplatesTabEnv {
  ctx: NavyCtx;
  draft: TemplateDraft | null;
  setDraft: (d: TemplateDraft | null) => void;
  send: (o: WwOrder) => void;
  /** Saves the template into this device's library (share code and the lobby read it from there). */
  toLibrary?: (d: TemplateDraft) => void;
  /** The template waiting for a second tap on delete (0 none). */
  armedDrop: number;
  armDrop: (id: number) => void;
}

export function renderTemplatesTab(env: TemplatesTabEnv): TemplateResult {
  if (env.draft !== null) return renderEditor(env, env.draft);
  const list = myTemplates(env.ctx);
  return html`<div class="mt-2 flex flex-col gap-1 text-xs">
    <button
      type="button"
      data-ww-tpl-new
      class="${BUTTON} w-full ${list.length >= WW_MAX_AIR_TEMPLATES
        ? "opacity-40"
        : ""}"
      aria-disabled=${String(list.length >= WW_MAX_AIR_TEMPLATES)}
      @click=${() => {
        if (list.length < WW_MAX_AIR_TEMPLATES) env.setDraft(emptyDraft());
      }}
    >
      + ${translateText("ww1936.airgroup.tpl_new")}
      (${list.length}/${WW_MAX_AIR_TEMPLATES})
    </button>
    ${list.length === 0
      ? html`<p class="m-0 text-white/60">
          ${translateText("ww1936.airgroup.tpl_none")}
        </p>`
      : nothing}
    <ul class="m-0 flex list-none flex-col gap-1 p-0" data-ww-tpl-list>
      ${list.map((t) => {
        const d = draftOf(t);
        const formed = templateFormed(env.ctx, t.id);
        return html`<li
          data-ww-tpl-row=${t.id}
          class="flex flex-col gap-1 rounded-md border border-white/10 bg-white/5 p-1.5"
        >
          <div class="flex items-baseline gap-1.5">
            <span class="min-w-0 flex-1 truncate font-semibold">${t.name}</span>
            <span class="shrink-0 tabular-nums text-white/70"
              >${draftTotal(d)}</span
            >
          </div>
          <div class="text-white/70">
            ${TEMPLATE_TYPES.filter((i) => t.planes[i] > 0)
              .map((i) => `${airTypeLabel(i)} ${t.planes[i]}`)
              .join(" · ")}
          </div>
          <div class="flex flex-wrap items-center gap-1">
            <span class="text-white/70"
              >${translateText("ww1936.airgroup.keep")}</span
            >
            <button
              type="button"
              data-ww-tpl-keep-dec=${t.id}
              class="${BUTTON} w-10"
              aria-label=${translateText("ww1936.airgroup.keep_dec")}
              @click=${() => {
                const n = stepKeep(d, -1);
                if (n !== d) sendTemplate(env, n);
              }}
            >
              −
            </button>
            <span
              data-ww-tpl-keep=${t.id}
              class="min-w-8 text-center tabular-nums"
              >${t.keep}</span
            >
            <button
              type="button"
              data-ww-tpl-keep-inc=${t.id}
              class="${BUTTON} w-10"
              aria-label=${translateText("ww1936.airgroup.keep_inc")}
              @click=${() => {
                const n = stepKeep(d, 1);
                if (n !== d) sendTemplate(env, n);
              }}
            >
              +
            </button>
            <span class="tabular-nums text-white/60"
              >${translateText("ww1936.airgroup.formed", {
                n: formed,
                keep: t.keep,
              })}</span
            >
            <span class="flex-1"></span>
            <button
              type="button"
              data-ww-tpl-edit=${t.id}
              class=${BUTTON}
              @click=${() => env.setDraft(d)}
            >
              ${translateText("ww1936.airgroup.edit")}
            </button>
            <button
              type="button"
              data-ww-tpl-drop=${t.id}
              class="${BUTTON} ${env.armedDrop === t.id
                ? "border-red-400 bg-red-900/70"
                : ""}"
              @click=${() => {
                if (env.armedDrop !== t.id) env.armDrop(t.id);
                else {
                  env.armDrop(0);
                  env.send(templateDropOrder(t.id));
                }
              }}
            >
              ${translateText(
                env.armedDrop === t.id
                  ? "ww1936.land.tap_again"
                  : "ww1936.library.delete",
              )}
            </button>
          </div>
        </li>`;
      })}
    </ul>
  </div>`;
}

function sendTemplate(env: TemplatesTabEnv, d: TemplateDraft): void {
  const o = templateOrder(d, myTemplates(env.ctx));
  if (o !== null) env.send(o);
}

function renderEditor(env: TemplatesTabEnv, d: TemplateDraft): TemplateResult {
  const existing = myTemplates(env.ctx);
  const block = templateBlock(d, existing);
  const total = draftTotal(d);
  const roles = roleTotals(d);
  const ranges = typeRanges(env.ctx);
  const spread = rangeSpread(d, ranges);
  return html`<div
    data-ww-tpl-editor
    class="mt-2 flex flex-col gap-1.5 text-xs"
  >
    <input
      type="text"
      data-ww-tpl-name
      maxlength=${WW_AIR_TEMPLATE_NAME_MAX}
      .value=${d.name}
      placeholder=${translateText("ww1936.airgroup.name_hint")}
      aria-label=${translateText("ww1936.airgroup.name_hint")}
      class="h-10 rounded-md border border-white/15 bg-black/30 px-2 text-sm text-white"
      @input=${(e: Event) =>
        env.setDraft({ ...d, name: (e.target as HTMLInputElement).value })}
    />
    <ul class="m-0 flex list-none flex-col gap-1 p-0">
      ${TEMPLATE_TYPES.map(
        (i) =>
          html`<li
            data-ww-tpl-type=${AIR_TYPES[i]}
            class="flex items-center gap-1.5"
          >
            <span class="min-w-0 flex-1 truncate">
              <span class="font-semibold">${airTypeLabel(i)}</span>
              <span class="text-white/50"
                >${ranges[i] > 0
                  ? translateText("ww1936.airgroup.range_km", { km: ranges[i] })
                  : ""}</span
              >
            </span>
            <button
              type="button"
              data-ww-tpl-dec=${AIR_TYPES[i]}
              class="${BUTTON} w-10"
              aria-label=${translateText("ww1936.airgroup.type_dec")}
              @click=${() => env.setDraft(stepType(d, i, -1))}
            >
              −
            </button>
            <span class="min-w-10 text-center tabular-nums" data-ww-tpl-n
              >${d.planes[i]}</span
            >
            <button
              type="button"
              data-ww-tpl-inc=${AIR_TYPES[i]}
              class="${BUTTON} w-10"
              aria-label=${translateText("ww1936.airgroup.type_inc")}
              @click=${() => env.setDraft(stepType(d, i, 1))}
            >
              +
            </button>
          </li>`,
      )}
    </ul>
    <div
      data-ww-tpl-total
      class="tabular-nums ${total >= WW_MAX_GROUP_PLANES
        ? "text-amber-300"
        : ""}"
    >
      ${translateText("ww1936.airgroup.total", {
        n: total,
        max: WW_MAX_GROUP_PLANES,
        step: WW_GROUP_STEP,
      })}
    </div>
    <div data-ww-tpl-roles class="flex flex-wrap gap-x-3 text-white/80">
      ${TEMPLATE_ROLES.map((r) =>
        roles[r] > 0
          ? html`<span
              >${translateText(`ww1936.airgroup.role_${r}`)} ${roles[r]}</span
            >`
          : nothing,
      )}
    </div>
    ${spread === null
      ? nothing
      : html`<div
          data-ww-tpl-range
          class="${spread.warn ? "text-amber-300" : "text-white/60"}"
        >
          ${translateText("ww1936.airgroup.range_spread", {
            min: spread.min,
            max: spread.max,
          })}
          ${spread.warn ? translateText("ww1936.airgroup.range_warn") : nothing}
        </div>`}
    <div class="flex items-center gap-1.5">
      <span>${translateText("ww1936.airgroup.keep")}</span>
      <button
        type="button"
        data-ww-tpl-ed-keep-dec
        class="${BUTTON} w-10"
        @click=${() => env.setDraft(stepKeep(d, -1))}
      >
        −
      </button>
      <span data-ww-tpl-ed-keep class="min-w-8 text-center tabular-nums"
        >${d.keep}</span
      >
      <button
        type="button"
        data-ww-tpl-ed-keep-inc
        class="${BUTTON} w-10"
        @click=${() => env.setDraft(stepKeep(d, 1))}
      >
        +
      </button>
      <span class="text-white/50">/ ${WW_MAX_KEEP_GROUPS}</span>
    </div>
    ${block === null
      ? nothing
      : html`<div data-ww-tpl-block class="text-red-300">
          ${translateText(`ww1936.airgroup.err_${block}`)}
        </div>`}
    <div class="flex flex-wrap gap-1">
      <button
        type="button"
        data-ww-tpl-save
        aria-disabled=${String(block !== null)}
        class="${BUTTON} flex-1 ${block === null
          ? "border-emerald-400/60 bg-emerald-800/50"
          : "opacity-40"}"
        @click=${() => {
          const o = templateOrder(d, existing);
          if (o === null) return;
          env.send(o);
          env.setDraft(null);
        }}
      >
        ${translateText("ww1936.airgroup.save")}
      </button>
      ${env.toLibrary === undefined
        ? nothing
        : html`<button
            type="button"
            data-ww-tpl-library
            aria-disabled=${String(
              block === "no_name" || block === "no_planes",
            )}
            class=${BUTTON}
            @click=${() => {
              if (block !== "no_name" && block !== "no_planes") {
                env.toLibrary?.(d);
              }
            }}
          >
            ${translateText("ww1936.airgroup.to_library")}
          </button>`}
      <button
        type="button"
        data-ww-tpl-cancel
        class=${BUTTON}
        @click=${() => env.setDraft(null)}
      >
        ${translateText("common.cancel")}
      </button>
    </div>
  </div>`;
}
