// World War 1936 P6 lane U4 (spec §20.9): the small card of the rocket and
// the paratrooper / commando raid flows (the bomb and the precision raid
// show in the air zone card). It lists what the flow asks next: the target
// hint, the kind and count steppers and [Launch], or the building chips and
// the two-tap [Raid]. Rendered by <ww-air-zone-card>, which owns the place.
import { ROCKET_KINDS } from "@openfront/engine-api/ww1936/DepthTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { buildingName, equipmentName } from "./EconomyModel";
import { isRaidKind, strikeFlowOf, WwNukeFlow } from "./WwNukeFlow";

const BTN =
  "h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 hover:bg-white/10 disabled:opacity-40";

/** True when this card (not the zone card) shows the active flow. */
export function strikeCardActive(game: object): boolean {
  const st = strikeFlowOf(game);
  return (
    st.step !== "idle" &&
    (st.kind === "rocket" ||
      st.kind === "raid_para" ||
      st.kind === "raid_commando")
  );
}

export function renderStrikePanel(
  game: object,
  flow: WwNukeFlow,
  style: string,
): TemplateResult {
  const st = strikeFlowOf(game);
  const rocket = st.kind === "rocket";
  return html`<section
    data-ww-strike-card=${st.kind}
    class="fixed z-[1001] flex flex-col gap-1 rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
    style=${style}
  >
    <div class="flex items-center gap-2">
      <span class="min-w-0 flex-1 truncate text-sm font-bold"
        >${translateText(
          rocket ? "ww1936.rocket.launch" : "ww1936.raid_ui.raid",
        )}</span
      >
      <button
        type="button"
        data-ww-strike-cancel
        class=${BTN}
        @click=${() => flow.cancel()}
      >
        ${translateText("common.cancel")}
      </button>
    </div>
    ${st.step === "target"
      ? html`<span data-ww-hint=${st.kind} class="text-amber-200"
          >${flow.targets().length === 0
            ? translateText("ww1936.rocket.none_in_range")
            : translateText(
                rocket
                  ? "ww1936.rocket.pick_target"
                  : "ww1936.nuke.pick_region",
              )}</span
        >`
      : nothing}
    ${rocket && st.step === "setup" ? renderRocket(flow) : nothing}
    ${isRaidKind(st.kind) && st.step === "setup" ? renderRaid(flow) : nothing}
  </section>`;
}

function renderRocket(flow: WwNukeFlow): TemplateResult {
  const st = flow.state;
  const max = flow.maxCount();
  return html`<div class="flex flex-wrap items-center gap-1">
    ${([0, 1] as const).map(
      (k) =>
        html`<button
          type="button"
          data-ww-rocket-kind=${ROCKET_KINDS[k]}
          aria-pressed=${String(st.rocket === k)}
          class="${BTN} ${st.rocket === k
            ? "border-sky-300 bg-sky-800/60"
            : ""}"
          @click=${() => flow.setRocketKind(k)}
        >
          ${equipmentName(ROCKET_KINDS[k])}
        </button>`,
    )}
    <button
      type="button"
      data-ww-rocket-step="down"
      class=${BTN}
      ?disabled=${st.count <= 1}
      @click=${() => flow.setCount(st.count - 1)}
    >
      −
    </button>
    <span data-ww-rocket-count class="tabular-nums"
      >${translateText("ww1936.rocket.count", { n: st.count })}</span
    >
    <button
      type="button"
      data-ww-rocket-step="up"
      class=${BTN}
      ?disabled=${st.count >= max}
      @click=${() => flow.setCount(st.count + 1)}
    >
      +
    </button>
    <button
      type="button"
      data-ww-rocket-fire
      class="${BTN} border-red-400 bg-red-900/70 font-semibold"
      ?disabled=${max <= 0}
      @click=${() => flow.fire()}
    >
      ${translateText("ww1936.rocket.fire")}
    </button>
  </div>`;
}

function renderRaid(flow: WwNukeFlow): TemplateResult {
  const st = flow.state;
  return html`<div class="flex flex-wrap items-center gap-1">
    ${flow
      .raidBuildings()
      .map(
        (b) =>
          html`<button
            type="button"
            data-ww-raid-building=${b}
            aria-pressed=${String(st.building === b)}
            class="${BTN} ${st.building === b
              ? "border-sky-300 bg-sky-800/60"
              : ""}"
            @click=${() => flow.setBuilding(b)}
          >
            ${buildingName(b)}
          </button>`,
      )}
    <button
      type="button"
      data-ww-raid-confirm
      class="${BTN} border-red-400 bg-red-900/70 font-semibold"
      ?disabled=${st.building === null}
      @click=${() => flow.confirmRaid()}
    >
      ${flow.raidArmed()
        ? translateText("ww1936.raid_ui.confirm")
        : translateText("ww1936.raid_ui.raid")}
    </button>
  </div>`;
}
