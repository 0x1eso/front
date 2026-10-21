// P6 lane E fills this file (plan Task 3): designs crossing between countries (spec §26: the one path).
// The foundation's stub: final signatures, neutral answers.
import type {
  DesignKind,
  DesignOrigin,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { EQUIP_KEYS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { isDesignType } from "@openfront/engine-lib/ww1936/Equipment";
import type { WwDepth } from "./WwDepth";

/** Copies `from`'s design into `to`; the slot it landed in, or null. */
export function copyDesignTo(
  d: WwDepth,
  from: number,
  slot: number,
  kind: DesignKind,
  to: number,
  origin: DesignOrigin,
): number | null {
  return null;
}

/** The key `to` receives equipment of `from`'s `key` as (capture, lend-lease); −1: lost. Stub: static keys stay, design keys are lost. */
export function receiveKey(
  d: WwDepth,
  from: number,
  key: number,
  to: number,
  origin: DesignOrigin,
): number {
  return isDesignType(EQUIP_KEYS[key][0]) ? -1 : key;
}
