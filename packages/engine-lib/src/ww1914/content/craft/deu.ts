import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "../../CraftRows";

// DEU's statecraft: rows and the scenes they call (ww157-format.md). Text in
// resources/ww1914/ko/DEU.craft.json.
export const DEU_INVENTIONS: readonly GwInventionRow[] = [];
export const DEU_PROJECTS: readonly GwProjectRow[] = [];
export const DEU_FOOTING: GwFootingRow | null = null;
export const DEU_SHORTAGES: readonly GwShortageRow[] = [];
/** Project chapters, footing big scenes, shortage events, labour scenes. */
export const DEU_CRAFT_SCENES: readonly GwScene[] = [];
