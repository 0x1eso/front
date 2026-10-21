// World War 1936 P6 — the continuous focuses (spec §12): names and icons
// only, in CONTINUOUS_FOCUSES order. Content lane K4 (plan Task 19) fills
// this file; the foundation registers it empty.
import type { ContinuousFocus } from "@openfront/engine-api/ww1936/DepthTypes";

export const CONTINUOUS_FOCUS_TABLE: readonly {
  readonly id: ContinuousFocus;
  readonly icon: string;
}[] = [];
