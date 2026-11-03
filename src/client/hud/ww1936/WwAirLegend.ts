// World War 1936 ww8 (lane G, design §8.3): the air layer's legend chips,
// ours / contested / enemy, under the top band while the layer shows in the
// wing model. The colours are the render lane's AIR_LEGEND (view/AirZoneColors).
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { AIR_LEGEND } from "../../view/AirZoneColors";
import { WwAirLayerEvent } from "./SeaAirSelection";
import { WW_BAND_PX, WW_STRIP_EXTRA } from "./WorldWarModel";
import { seaAirOf } from "./WwSeaAirController";

@customElement("ww-air-legend")
export class WwAirLegend extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private shown = false;

  createRenderRoot() {
    return this;
  }

  init() {
    // tick() does not run while the game is paused: follow the layer switch too.
    this.eventBus.on(WwAirLayerEvent, () => {
      void Promise.resolve().then(() => this.tick());
    });
  }

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
      style="top: calc(${WW_BAND_PX + 8}px + ${WW_STRIP_EXTRA})"
    >
      ${AIR_LEGEND.map(
        ({ key, rgb }) =>
          html`<span
            class="flex items-center gap-1 rounded-md bg-gray-900/80 px-1.5 py-0.5"
            ><span
              class="size-2.5 rounded-sm"
              style="background: rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})"
            ></span
            >${translateText(`ww1936.wing.legend_${key}`)}</span
          >`,
      )}
    </div>`;
  }
}
