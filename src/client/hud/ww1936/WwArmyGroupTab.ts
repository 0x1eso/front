// World War 1936 P6 (spec §20.4): the army drawer's "army groups" tab — a
// card per group (marshal, abilities, traits), its armies, and [Front],
// [Execute all] (two taps), [Auto], [Disband] (two taps). Rendered by
// WwArmyPanel, which owns the two-tap state and the order sending.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { WwLandView } from "../../view/WwLandView";
import { DoctrineModel, GroupRow } from "./DoctrineModel";
import { armyName, armyStatus } from "./LandModel";
import { landSelectionOf } from "./LandSelection";
import { groupColor, multiSelectOf } from "./MultiSelect";
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
}

const BTN =
  "min-h-9 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold hover:bg-white/20";

function renderGroup(c: GroupTabCtx, g: GroupRow): TemplateResult {
  const armies = g.armies
    .map((id) => c.view.armies.get(id))
    .filter((a) => a !== undefined);
  const auto = armies.length > 0 && armies.every((a) => a.mine?.auto === true);
  const exec = `agx${g.id}`;
  const disband = `agd${g.id}`;
  const divisions = armies.reduce((n, a) => n + a.divisions, 0);
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
              max: 24,
            })}</span
          >
          <span class="ml-auto min-w-0 truncate text-white/70"
            >${translateText(st.key, st.params)}</span
          >
          <button
            type="button"
            data-ww-group-remove=${a.id}
            aria-label=${translateText("ww1936.ag.remove")}
            class="size-9 shrink-0 rounded hover:bg-white/10"
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
  return html`<div data-ww-groups class="flex flex-col gap-1.5 pt-2">
    ${groups.length === 0
      ? html`<p data-ww-empty class="m-0 text-xs text-white/60">
          ${translateText("ww1936.ag.empty")}
        </p>`
      : groups.map((g) => renderGroup(c, g))}
    ${multi.frontGroup !== null
      ? html`<p class="m-0 text-xs text-amber-300">
          ${translateText("ww1936.ag.front_hint")}
        </p>`
      : nothing}
  </div>`;
}
