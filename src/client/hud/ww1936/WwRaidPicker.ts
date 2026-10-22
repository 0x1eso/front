import {
  RAID_KINDS,
  type RaidKind,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { BuildingId } from "@openfront/engine-api/ww1936/EconomyTypes";
import { html, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { RaidTarget } from "./DepthMiscModel";
import { buildingName } from "./EconomyModel";

const BUTTON =
  "min-h-9 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold hover:bg-white/20";

/** P6 (spec §10): the raid picker — the kind, then the target building list. */
export function renderRaidPicker(
  kind: RaidKind,
  targets: readonly RaidTarget[],
  onKind: (k: RaidKind) => void,
  onTarget: (b: BuildingId) => void,
  onClose: () => void,
): TemplateResult {
  return html`<div data-ww-raid-picker class="col-span-5 flex flex-col gap-1">
    <div class="flex flex-wrap gap-1">
      ${RAID_KINDS.map(
        (k) =>
          html`<button
            type="button"
            data-ww-raid-kind=${k}
            aria-pressed=${String(k === kind)}
            class="${BUTTON} ${k === kind ? "border-amber-300" : ""}"
            @click=${() => onKind(k)}
          >
            ${translateText(`ww1936.raid.${k}`)}
          </button>`,
      )}
    </div>
    <div class="flex flex-wrap gap-1">
      ${targets.map(
        (t) =>
          html`<button
            type="button"
            data-ww-raid-target=${t.building}
            class=${BUTTON}
            @click=${() => onTarget(t.building)}
          >
            ${buildingName(t.building)}
          </button>`,
      )}
      <button type="button" class=${BUTTON} @click=${onClose}>
        ${translateText("common.back")}
      </button>
    </div>
  </div>`;
}
