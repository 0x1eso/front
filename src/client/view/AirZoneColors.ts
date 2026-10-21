// World War 1936 P4: the sea and air layers' colour tables, RGBA by
// strategic-region index (plan Task 11 writes the bodies).
import type { WwAirView } from "./WwAirView";
import type { WwNavyView } from "./WwNavyView";

/** Sea layer: my supremacy by sea region (256 × 4 bytes). Stub: transparent. */
export function seaLayerColors(view: WwNavyView): Uint8Array {
  void view;
  return new Uint8Array(256 * 4);
}

/** Air layer: my superiority by air zone (256 × 4 bytes). Stub: transparent. */
export function airLayerColors(view: WwAirView): Uint8Array {
  void view;
  return new Uint8Array(256 * 4);
}
