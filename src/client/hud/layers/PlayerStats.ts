import type { EventBus } from "@openfront/shared/EventBus";
import { customElement } from "lit/decorators.js";
import { type StatsRow, StatsTable } from "../../components/StatsTable";
import { hasSatelliteUp } from "../../render/frame/derive/StrategicFx";
import { GoToPlayerEvent } from "../../TransformHandler";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  endgameLabel,
  endgameMark,
  onLeaderboard,
} from "../ww1936/EndgameNames";
import { sameFaction } from "../ww1936/WorldWarModel";
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

    // P5 (spec §3.5–§3.7, §20.6): no dormant slot; the endgame's names and
    // the human who plays a country now; a gone country struck through, a
    // government in exile (no land) badged.
    return game
      .playerViews()
      .filter((player) => (ww ? onLeaderboard(game, player) : player.isAlive()))
      .map((player) => {
        const mark = ww ? endgameMark(game, player.smallID()) : null;
        return {
          key: player.id(),
          name: ww ? endgameLabel(game, player) : player.name(),
          clanTag: player.clanTag(),
          values: columnValues(player, game, columns),
          satellite:
            this.strategicWeapons && hasSatelliteUp(player.strategicData()),
          emphasized:
            myPlayer !== null &&
            (player === myPlayer ||
              player.isOnSameTeam(myPlayer) ||
              (ww && sameFaction(myPlayer, player, game))),
          pinned: player === myPlayer,
          struck: mark === "gone",
          ...(mark === "exile"
            ? { badge: translateText("ww1936.exile.badge") }
            : {}),
          onClick: () => {
            if (this.eventBus !== null) {
              this.eventBus.emit(new GoToPlayerEvent(player));
            }
          },
        };
      });
  }
}
