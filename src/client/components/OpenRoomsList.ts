import type { PublicGameInfo } from "@openfront/shared/WireSchemas";
import { html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { getMapName, translateText } from "../Utils";

export interface OpenRoomJoinDetail {
  gameID: string;
}

// The chips for the fork's three rule sets, in display order.
export function openRoomModeChips(
  config: PublicGameInfo["gameConfig"],
): string[] {
  const chips: string[] = [];
  if (config?.domesticMode) chips.push(translateText("open_rooms.domestic"));
  if (config?.warfareExpansion) {
    chips.push(translateText("open_rooms.warfare"));
  }
  if (config?.strategicWeapons) {
    chips.push(translateText("open_rooms.strategic"));
  }
  return chips;
}

/**
 * The homepage's "열린 방" list: friends' lobbies that are open right now,
 * each with a one-tap join. Purely presentational: the owner feeds it the
 * hosted bucket of the lobby feed and handles `open-room-join`.
 */
@customElement("open-rooms-list")
export class OpenRoomsList extends LitElement {
  @property({ attribute: false }) rooms: PublicGameInfo[] = [];
  // False until the feed delivered its first snapshot.
  @property({ type: Boolean }) loaded = false;
  @property({ type: Boolean }) disabled = false;

  createRenderRoot() {
    return this;
  }

  private join(gameID: string) {
    this.dispatchEvent(
      new CustomEvent<OpenRoomJoinDetail>("open-room-join", {
        detail: { gameID },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderRow(room: PublicGameInfo) {
    const config = room.gameConfig;
    const map = config ? (getMapName(config.gameMap) ?? config.gameMap) : "";
    const host = room.hostName ?? "";
    const max = config?.maxPlayers;
    const players =
      max === undefined || max === null
        ? String(room.numClients)
        : `${room.numClients} / ${max}`;
    const chips = openRoomModeChips(config);
    return html`
      <li class="atlas-room" data-game-id=${room.gameID}>
        <div class="atlas-room-info">
          <span class="atlas-room-host">${host}</span>
          <span class="atlas-room-meta">
            <span class="atlas-room-map">${map}</span>
            <span class="atlas-room-players" aria-label=${players}
              >${players}</span
            >
          </span>
          ${chips.length > 0
            ? html`<span class="atlas-room-chips">
                ${chips.map(
                  (chip) => html`<span class="atlas-chip">${chip}</span>`,
                )}
              </span>`
            : nothing}
        </div>
        <button
          type="button"
          class="atlas-room-join"
          ?disabled=${this.disabled}
          @click=${() => this.join(room.gameID)}
        >
          ${translateText("open_rooms.join")}
        </button>
      </li>
    `;
  }

  render() {
    return html`
      <section class="atlas-rooms" aria-labelledby="open-rooms-title">
        <h2 id="open-rooms-title" class="atlas-eyebrow">
          ${translateText("open_rooms.title")}
        </h2>
        ${!this.loaded
          ? nothing
          : this.rooms.length === 0
            ? html`<p class="atlas-rooms-empty">
                ${translateText("open_rooms.empty")}
              </p>`
            : html`<ul class="atlas-rooms-list">
                ${this.rooms.map((room) => this.renderRow(room))}
              </ul>`}
      </section>
    `;
  }
}
