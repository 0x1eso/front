// ww7 (lane B): helpers for tests about the depth bands. The test maps'
// regions are big (1,500 to 4,000 tiles, 3 to 5 bands), so a test that is
// about one battle and what follows it fights the region's last band.
import { depthOf } from "@openfront/engine/ww1936/land/Bands";
import type { WwLand } from "@openfront/engine/ww1936/land/WwLand";

/** Every band but the last of `region` has fallen to `taker`: the next battle is the last one. */
export function lastBand(l: WwLand, region: number, taker: number): void {
  const left = depthOf(l, region) - 1;
  l.bandProg[region] = left;
  l.bandTaker[region] = left === 0 ? 0 : taker;
}
