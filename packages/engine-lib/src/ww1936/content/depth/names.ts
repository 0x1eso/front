// World War 1936 P6 — the pieces of a design's automatic name (spec §5.1). Content lane K5 (plan Task 20) fills this
// file; the foundation registers it empty.
import type { DesignKind } from "@openfront/engine-api/ww1936/DepthTypes";

export interface DesignNamePart {
  kind: DesignKind;
  by: "base" | "role" | "module" | "type" | "default";
  /** The base, role, module or P4 type id ("" for the default). */
  id: string;
  /** Text key ww1936.design_name.<key>. */
  key: string;
}

export const DESIGN_NAME_KEYS: readonly DesignNamePart[] = [];
