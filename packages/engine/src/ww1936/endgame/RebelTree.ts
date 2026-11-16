// ww229 (design ww227 §2, owner D6): a civil war's rebels on a country with
// its own national tree play that tree, with every focus the country has
// done (or bypassed) already done, and nothing running. Countries on a
// major's tree or an old one keep what the rebels' slot gets today.
import { isNationTree } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwEndgame } from "./WwEndgame";

export function inheritNationTree(eg: WwEndgame, X: number, R: number): void {
  const pol = eg.ww.politics;
  const xc = pol.country(X);
  const rc = pol.country(R);
  if (xc === null || rc === null || !isNationTree(xc.tree)) return;
  rc.tree = xc.tree;
  rc.focusState = xc.focusState.map((s) => (s === 1 || s === 2 ? s : 0));
  rc.focus = null;
  rc.queue = [];
  pol.markCountry(R);
}
