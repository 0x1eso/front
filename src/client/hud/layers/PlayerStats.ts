import type { EventBus } from "@openfront/shared/EventBus";
import { customElement } from "lit/decorators.js";
import { type StatsRow, StatsTable } from "../../components/StatsTable";
import { hasSatelliteUp } from "../../render/frame/derive/StrategicFx";
import { GoToPlayerEvent } from "../../TransformHandler";
import type { GameView } from "../../view";
import { countryLabel, sameFaction } from "../ww1936/WorldWarModel";
import { type ColumnDef, columnValues } from "./lib/StatsColumns";

@customElement("player-stats")
export class PlayerStats extends StatsTable {
  public eventBus: EventBus | null = null;

  protected readonly tableKind = "player";

  protected buildRows(
    game: GameView,
    columns: readonly ColumnDef[],
  ): StatsRow[] {
    const myPlayer = game.myPlayer();
    // World War 1936 (spec §8.2): country names, my faction emphasized.
    const ww = game.worldWarScenario() !== null;

    return game
      .playerViews()
      .filter((player) => player.isAlive())
      .map((player) => ({
        key: player.id(),
        name: ww ? countryLabel(game, player) : player.name(),
        clanTag: player.clanTag(),
        values: columnValues(player, game, columns),
        satellite:
          this.strategicWeapons && hasSatelliteUp(player.strategicData()),
        emphasized:
          myPlayer !== null &&
          (player === myPlayer ||
            player.isOnSameTeam(myPlayer) ||
            (ww && sameFaction(myPlayer, player))),
        pinned: player === myPlayer,
        onClick: () => {
          if (this.eventBus !== null) {
            this.eventBus.emit(new GoToPlayerEvent(player));
          }
        },
      }));
  }
}
