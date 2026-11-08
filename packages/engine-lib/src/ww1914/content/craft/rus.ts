import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwFootingRow,
  GwInventionRow,
  GwProjectRow,
  GwShortageRow,
} from "../../CraftRows";

// RUS's statecraft: rows and the scenes they call (ww157-format.md). Text in
// resources/ww1914/ko/RUS.craft.json.
export const RUS_INVENTIONS: readonly GwInventionRow[] = [];
export const RUS_PROJECTS: readonly GwProjectRow[] = [];
export const RUS_FOOTING: GwFootingRow | null = null;
export const RUS_SHORTAGES: readonly GwShortageRow[] = [];
/** Project chapters, footing big scenes, shortage events, labour scenes. */
export const RUS_CRAFT_SCENES: readonly GwScene[] = [];
