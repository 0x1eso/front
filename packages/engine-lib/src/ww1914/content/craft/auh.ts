import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "../../CraftRows";

// AUH's statecraft: rows and the scenes they call (ww157-format.md). Text in
// resources/ww1914/ko/AUH.craft.json.
export const AUH_INVENTIONS: readonly GwInventionRow[] = [];
export const AUH_PROJECTS: readonly GwProjectRow[] = [];
export const AUH_FOOTING: GwFootingRow | null = null;
export const AUH_SHORTAGES: readonly GwShortageRow[] = [];
/** Project chapters, footing big scenes, shortage events, labour scenes. */
export const AUH_CRAFT_SCENES: readonly GwScene[] = [];
