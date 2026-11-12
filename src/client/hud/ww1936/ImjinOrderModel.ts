// ww194 (Imjin leftovers): the diplomacy drawer's first tab in the Imjin
// War. 1936's factions are not the 1590s' order; there, the Ming emperor
// invested the kings around him and they sent tribute (책봉·조공). The tab
// tells where each of the war's countries stands in that order, in words,
// and the one change the state shows: Ming's army fighting beside Joseon
// (the engine's Ming entry is a 1936 faction Joseon joins, JoseonMing).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { IMJIN_COUNTRIES } from "@openfront/engine-lib/ww1936/scenario/Profile";
import { translateText } from "../../Utils";
import {
  countryName,
  enemiesOf,
  factionOfId,
  wwActive,
  type WwGame,
} from "./WorldWarModel";

export interface ImjinOrderRow {
  tag: CountryTag;
  name: string;
  /** Its place in the order (`imjin.order.standing.<tag>`). */
  standing: string;
  /** What the war has changed in it now; null: nothing. */
  now: string | null;
  mine: boolean;
}

/** The order's rows: Ming first, then the seats and the Jurchen. */
const ORDER: readonly CountryTag[] = [
  "MIN",
  ...IMJIN_COUNTRIES.filter((t) => t !== "MIN"),
];

function nowLine(
  game: WwGame,
  tag: CountryTag,
  id: (t: CountryTag) => number,
): string | null {
  const min = id("MIN");
  const jos = id("JOS");
  const jpn = id("JPN");
  const mingWithJoseon =
    min > 0 &&
    jos > 0 &&
    factionOfId(game, min) !== null &&
    factionOfId(game, min) === factionOfId(game, jos);
  const atWar = (a: number, b: number) =>
    a > 0 && b > 0 && enemiesOf(game, a).includes(b);
  switch (tag) {
    case "MIN":
      if (atWar(min, jpn)) return translateText("imjin.order.now.ming_war");
      return null;
    case "JOS":
      if (mingWithJoseon) return translateText("imjin.order.now.ming_help");
      if (atWar(jos, jpn)) return translateText("imjin.order.now.ming_wait");
      return null;
    default:
      return null;
  }
}

/** The investiture order's rows, for the countries still in the game. */
export function imjinOrderRows(game: WwGame, me: number): ImjinOrderRow[] {
  const sc = game.worldWarScenario();
  if (sc === null) return [];
  const id = (t: CountryTag) => sc.smallIdOf(t);
  return ORDER.filter((t) => id(t) > 0 && wwActive(game, id(t))).map((t) => ({
    tag: t,
    name: countryName(t),
    standing: translateText(`imjin.order.standing.${t}`),
    now: nowLine(game, t, id),
    mine: id(t) === me,
  }));
}
