// Great War 1914: AUH's powers on the 통치 tab (ww169). Rows here, text in
// resources/ww1914/ko/AUH.powers.json. Shapes: ../../PowerRows.ts; the format
// is /home/eser/dev/ww169-format.md. A writer lane owns this file and that one.
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwPowerRow, GwReactorRow } from "../../PowerRows";

export const AUH_POWERS: readonly GwPowerRow[] = [];

/** AUH's own reactors, on top of GW_REACTORS (`nation: "AUH"`). */
export const AUH_REACTORS: readonly GwReactorRow[] = [];

/** Result cards and other scenes the rows call. */
export const AUH_POWER_SCENES: readonly GwScene[] = [];
