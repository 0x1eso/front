import { assetUrl } from "@openfront/shared/AssetUrls";
import type { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Controller } from "../../Controller";
import {
  AlternateViewEvent,
  CenterCameraEvent,
  ToggleCoordinateGridEvent,
} from "../../InputHandler";
import { translateText } from "../../Utils";

const centerIcon = assetUrl("images/TargetIconWhite.svg");
const viewIcon = assetUrl("images/TreeIconWhite.svg");
const gridIcon = assetUrl("images/GridIconWhite.svg");

/**
 * On-screen buttons for the map actions that otherwise only have keys
 * (spec §14a): center on my nation (C), the relation view (Space, a toggle
 * here) and the coordinate grid (M). Pause and fullscreen live in the
 * top-right sidebar.
 */
@customElement("map-controls")
export class MapControls extends LitElement implements Controller {
  public eventBus: EventBus;

  @state() private active = false;
  @state() private altView = false;
  @state() private grid = false;

  createRenderRoot() {
    return this;
  }

  init() {
    // The keys and the settings menu flip these too; show what is on.
    this.eventBus.on(AlternateViewEvent, (e) => {
      this.altView = e.alternateView;
    });
    this.eventBus.on(ToggleCoordinateGridEvent, (e) => {
      this.grid = e.enabled;
    });
    this.active = true;
  }

  render() {
    if (!this.active) return null;
    return html`
      <div
        class="fixed right-2 top-1/2 -translate-y-1/2 z-[900] flex flex-col gap-2"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        ${this.button(
          "center",
          centerIcon,
          translateText("user_setting.center_camera"),
          null,
          () => this.eventBus.emit(new CenterCameraEvent()),
        )}
        ${this.button(
          "view",
          viewIcon,
          translateText("user_setting.toggle_view"),
          this.altView,
          () => this.eventBus.emit(new AlternateViewEvent(!this.altView)),
        )}
        ${this.button(
          "grid",
          gridIcon,
          translateText("user_setting.coordinate_grid_label"),
          this.grid,
          () => this.eventBus.emit(new ToggleCoordinateGridEvent(!this.grid)),
        )}
      </div>
    `;
  }

  private button(
    id: string,
    icon: string,
    label: string,
    pressed: boolean | null,
    onClick: () => void,
  ): TemplateResult {
    return html`<button
      type="button"
      data-map-control=${id}
      class="size-8 flex items-center justify-center rounded-lg shadow-lg backdrop-blur-sm text-white ${pressed
        ? "bg-sky-700"
        : "bg-gray-800/92 hover:bg-gray-700"}"
      aria-label=${label}
      aria-pressed=${pressed === null ? nothing : String(pressed)}
      @click=${onClick}
    >
      <img src=${icon} alt="" width="28" height="28" />
    </button>`;
  }
}
