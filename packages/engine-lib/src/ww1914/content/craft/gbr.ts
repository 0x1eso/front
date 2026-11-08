import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "../../CraftRows";

// GBR's statecraft: rows and the scenes they call (ww157-format.md). Text in
// resources/ww1914/ko/GBR.craft.json.
export const GBR_INVENTIONS: readonly GwInventionRow[] = [];
export const GBR_PROJECTS: readonly GwProjectRow[] = [];
export const GBR_FOOTING: GwFootingRow | null = null;
export const GBR_SHORTAGES: readonly GwShortageRow[] = [];
/** Project chapters, footing big scenes, shortage events, labour scenes. */
export const GBR_CRAFT_SCENES: readonly GwScene[] = [];
