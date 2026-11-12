import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * Common scenes of a beaten country's fate (ww199). Owned by the W-C lane:
 * the crown papers (`gw_settle_crown_<client>`: options with
 * `{ do: "crown", client, pick }`, one per candidate of GW_CLIENT_ROWS plus
 * "regency"), the common sign card (`gw_settle_sign`: options with
 * `{ do: "treaty_sign", how }`), and the years after (requisition, a rising,
 * a state's king writing, the neutral papers) gated on the world conditions
 * `fate`, `client_state`, `vassal`, `revanche`, `settle_open`. Text in
 * resources/ww1914/ko/common.settle.json. See /home/eser/dev/ww199-format.md.
 */
export const SETTLE_SCENES: readonly GwScene[] = [];
