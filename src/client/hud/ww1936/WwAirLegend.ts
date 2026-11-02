// World War 1936 ww8 (lane G, design §8.3): the air layer's legend chips,
// ours / contested / enemy, under the top band while the layer shows in the
// wing model. The colours are the render lane's AIR_LEGEND ramps' ends
// (view/AirZoneColors); keep them in step when those change.
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { WW_BAND_PX } from "./WorldWarModel";
import { seaAirOf } from "./WwSeaAirController";

const CHIPS = [
  ["mine", "rgb(52 211 153)"],
  ["contested", "rgb(250 204 21)"],
  ["enemy", "rgb(239 68 68)"],
] as const;

@customElement("ww-air-legend")
export class WwAirLegend extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private shown = false;

  createRenderRoot() {
    return this;
  }

  init() {}

  getTickIntervalMs() {
    return 500;
  }

  tick() {
    const on =
      (this.game?.worldWarScenario() ?? null) !== null &&
      this.game.wwAir?.()?.live === true &&
      seaAirOf(this.game).selection.layer === "air";
    if (on !== this.shown) this.shown = on;
  }

  render() {
    if (!this.shown) return nothing;
    return html`<div
      data-ww-air-legend
      class="pointer-events-none fixed left-2 z-[1000] flex gap-1 text-xs text-white"
      style="top: ${WW_BAND_PX + 8}px"
    >
      ${CHIPS.map(
        ([k, color]) =>
          html`<span
            class="flex items-center gap-1 rounded-md bg-gray-900/80 px-1.5 py-0.5"
            ><span
              class="size-2.5 rounded-sm"
              style="background: ${color}"
            ></span
            >${translateText(`ww1936.wing.legend_${k}`)}</span
          >`,
      )}
    </div>`;
  }
}
