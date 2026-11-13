import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { RULER_AUH } from "./ruler_auh";
import { RULER_DEU } from "./ruler_deu";
import { RULER_FRA } from "./ruler_fra";
import { RULER_GBR } from "./ruler_gbr";
import { RULER_HEADS } from "./ruler_heads";
import { RULER_RUS } from "./ruler_rus";

/** The rulers' own lives, a list a country. A later country adds a line. */
export const RULER_SCENES: readonly GwScene[] = [
  ...RULER_DEU,
  ...RULER_GBR,
  ...RULER_AUH,
  ...RULER_RUS,
  ...RULER_FRA,
  // ww208 1B: the heads a utopia brings, one set for all.
  ...RULER_HEADS,
];
