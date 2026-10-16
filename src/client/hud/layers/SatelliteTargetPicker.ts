import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendSatelliteTargetIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView, PlayerView } from "../../view";

/** Opens the satellite's target picker (the band's "Choose a target"). */
export class OpenSatelliteTargetPickerEvent implements GameEvent {}

/**
 * Strategic weapons (spec §6.2, §7): pick the nation the satellite in orbit
 * strikes. One 44px row per nation it may strike, biggest first; the first
 * tap arms a row, the second aims and closes. Tribes are not offered.
 */
@customElement("satellite-target-picker")
export class SatelliteTargetPicker extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private open = false;
  /** Id of the row waiting for its second tap. */
  @state() private armed: string | null = null;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(OpenSatelliteTargetPickerEvent, () => {
      this.open = true;
      this.armed = null;
    });
  }

  tick() {
    if (!this.open) return;
    // A nation that died or allied since the first tap is no longer armed.
    if (
      this.armed !== null &&
      !this.choices().some((p) => p.id() === this.armed)
    ) {
      this.armed = null;
    }
    this.requestUpdate();
  }

  /** Alive nations that aren't me, my allies or my team, biggest first. */
  private choices(): PlayerView[] {
    const me = this.game.myPlayer();
    if (me === null) return [];
    return this.game
      .playerViews()
      .filter(
        (p) =>
          p !== me &&
          p.isAlive() &&
          p.type() !== PlayerType.Bot &&
          !me.isFriendly(p),
      )
      .sort((a, b) => b.numTilesOwned() - a.numTilesOwned());
  }

  private pick(p: PlayerView): void {
    if (this.armed !== p.id()) {
      this.armed = p.id();
      return;
    }
    this.eventBus.emit(new SendSatelliteTargetIntentEvent(p.id()));
    this.close();
  }

  private close(): void {
    this.open = false;
    this.armed = null;
  }

  render() {
    if (!this.open) return null;
    const choices = this.choices();
    return html`
      <div
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-[10002]"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.close();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          data-target-picker
          class="bg-zinc-900/95 text-white p-3 rounded-xl w-[min(28rem,calc(100vw-32px))] max-h-[calc(100vh-60px)] overflow-y-auto"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="flex-1 text-base font-bold">
              ${translateText("strategic.target_title")}
            </div>
            <button
              type="button"
              class="size-11 flex items-center justify-center rounded-md text-xl hover:bg-white/10"
              aria-label=${translateText("common.close")}
              @click=${() => this.close()}
            >
              ✕
            </button>
          </div>
          ${choices.length === 0
            ? html`<div class="text-gray-300">
                ${translateText("strategic.no_targets")}
              </div>`
            : html`<div class="flex flex-col gap-1">
                ${choices.map(
                  (p) => html`
                    <button
                      type="button"
                      data-target=${p.id()}
                      class="min-h-11 px-3 rounded-md text-left border-l-4 bg-white/5 hover:bg-white/15 active:bg-white/25 ${this
                        .armed === p.id()
                        ? "ring-2 ring-white"
                        : ""}"
                      style="border-left-color: ${p.territoryColor().toHex()}"
                      @click=${() => this.pick(p)}
                    >
                      ${p.displayName()}
                      ${this.armed === p.id()
                        ? html`<span class="ml-2 text-xs text-sky-300"
                            >${translateText(
                              "strategic.tap_again_to_target",
                            )}</span
                          >`
                        : null}
                    </button>
                  `,
                )}
              </div>`}
        </div>
      </div>
    `;
  }
}
