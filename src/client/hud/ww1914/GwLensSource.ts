import type { OccupationSource } from "../../render/gl/passes/OccupationPass";
import type { GameView } from "../../view";
import { gwMapState, lensCells } from "./GwLensModel";

/**
 * What the renderer's occupation pass reads for the Great War lens: nothing
 * while no lens is on, else the cells of the lens for the seat (GwLensModel).
 */
export function gwLensMapSource(game: GameView): OccupationSource {
  const seatOf = () => {
    const data = game.greatWarData();
    const me = game.myPlayer()?.smallID();
    const seat = data?.seats.find((s) => s.smallID === me) ?? null;
    return data === null || seat === null ? null : { data, seat };
  };
  return {
    on: () => gwMapState.lens !== null && seatOf() !== null,
    key: () => {
      const v = seatOf();
      if (v === null) return "none";
      const { data, seat } = v;
      return [
        gwMapState.lens,
        data.chapter,
        data.date,
        seat.gauges.order,
        seat.gauges.bread,
        seat.world.unrest,
        seat.world.news.length,
        Object.keys(data.held).join(","),
        seat.prologue?.done === false ? "p" : "",
      ].join("|");
    },
    cells: () => {
      const v = seatOf();
      const scenario = game.gwScenario();
      const lens = gwMapState.lens;
      if (v === null || scenario === null || lens === null) return [];
      return lensCells(lens, v.data, v.seat, scenario);
    },
  };
}
