import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { gwDeskView, gwView } from "@openfront/engine/ww1914/View";
import { HUMAN, stamped, step, wwRunnerCapture } from "../ww1936/util";

export { HUMAN };

/** A solo Great War game on the mini map: Germany, no timer. */
export async function gwRunner(
  config: Partial<GameConfig> = {},
  gameID?: string,
): Promise<{ runner: GameRunner; updates: GameUpdateViewData[] }> {
  const made = await wwRunnerCapture(
    { greatWar1914: true, gameType: GameType.Singleplayer, ...config },
    [{ clientID: HUMAN, country: "DEU" }],
    undefined,
    gameID,
    HUMAN,
  );
  step(made.runner, 2);
  return made;
}

export function view(r: GameRunner): GreatWarData {
  return gwView(r.game.greatWar()!);
}

export function seat(r: GameRunner): GwSeatView {
  return view(r).seats[0];
}

/** Sends one order and lets it land and the clock see it. */
export function order(r: GameRunner, o: GwOrder): void {
  step(r, 1, [stamped(HUMAN, { type: "gw_order", order: o })]);
  step(r, 1);
}

/**
 * Decides every card the plain way and says ready. It reads only the desk,
 * not the whole view: a long game spends most of its time in views.
 */
export function playChapter(r: GameRunner): void {
  const gw = r.game.greatWar()!;
  for (let guard = 0; guard < 50; guard++) {
    const card = gwDeskView(gw, gw.s.seats[0])[0];
    if (card === undefined) break;
    if (card.node !== null) {
      const reply = card.replies.find((x) => x.open)!;
      order(r, { kind: "reply", card: card.uid, reply: reply.id });
    } else if (card.options.length > 0) {
      const option = card.options.find((x) => x.open)!;
      order(r, { kind: "choose", card: card.uid, option: option.id });
    } else {
      order(r, { kind: "read", card: card.uid });
    }
  }
  order(r, { kind: "ready", chapter: gw.s.chapter, on: true });
}
