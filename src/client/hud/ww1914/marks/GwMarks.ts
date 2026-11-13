// Great War 1914 (ww207): the parties' marks on the bottom strip. Our own
// simple SVG marks in a party's colours (a logo or a name mark, never a
// portrait); W lanes write one file a seat, U1 draws them. A faction with no
// mark gets a shield in its bloc colour with its pack `factions.<id>.short`
// (2-3 Hangul letters). See /home/eser/dev/ww207-format.md.
import { AUH_MARKS } from "./auh";
import { DEU_MARKS } from "./deu";
import { FRA_MARKS } from "./fra";
import { GBR_MARKS } from "./gbr";
import { RUS_MARKS } from "./rus";

export interface GwMarkRow {
  /** The faction row (`deu_spd`). */
  readonly faction: string;
  /** Its colours, first the main one: `#c00000`. The SVG may use them as fill. */
  readonly colours: readonly string[];
  /**
   * The mark's SVG body in a `0 0 24 24` viewBox (paths, rects, text; no
   * script, no image, no outside reference): SPD's red flag, the Centre's
   * tower, the Irish harp, the Kadets' "К-Д".
   */
  readonly svg: string;
}

export const GW_MARKS: readonly GwMarkRow[] = [
  ...DEU_MARKS,
  ...GBR_MARKS,
  ...FRA_MARKS,
  ...RUS_MARKS,
  ...AUH_MARKS,
];

/** A faction's mark; null: draw the fallback shield. */
export function markOf(faction: string): GwMarkRow | null {
  return GW_MARKS.find((m) => m.faction === faction) ?? null;
}
