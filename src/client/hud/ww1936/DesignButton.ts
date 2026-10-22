// World War 1936 P6 (plan Task 1 Step 18): the [design] button the
// production, template, shipyard and aircraft tabs show. It only opens the
// designer (lane U2 listens for WwDepthOpenEvent).
import type { DesignKind } from "@openfront/engine-api/ww1936/DepthTypes";
import type { EventBus } from "@openfront/shared/EventBus";
import { html, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { WwDepthOpenEvent } from "./DepthEvents";

const DESIGN_BUTTON_KEYS: Readonly<Record<DesignKind, string>> = {
  tank: "ww1936.depth.design_tank",
  ship: "ww1936.depth.design_ship",
  plane: "ww1936.depth.design_plane",
};

export function designButton(
  eventBus: EventBus,
  kind: DesignKind,
): TemplateResult {
  return html`<button
    type="button"
    data-ww-designer=${kind}
    class="mt-2 flex min-h-11 w-full items-center justify-center rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10"
    @click=${() => eventBus.emit(new WwDepthOpenEvent("designer", { kind }))}
  >
    ${translateText(DESIGN_BUTTON_KEYS[kind])}
  </button>`;
}

/** The production tab's [designs] button: the saved designs of every kind. */
export function designsButton(eventBus: EventBus): TemplateResult {
  return html`<button
    type="button"
    data-ww-designs
    class="mt-2 flex min-h-11 w-full items-center justify-center rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10"
    @click=${() => eventBus.emit(new WwDepthOpenEvent("designs"))}
  >
    ${translateText("ww1936.depth.designs")}
  </button>`;
}
