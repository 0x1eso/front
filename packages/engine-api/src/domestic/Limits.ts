// Domestic-mode bounds that the wire schemas validate and the lobby/HUD
// controls clamp to. Defined once here so a retune cannot make the UI offer a
// value the schema rejects (SocketIngress kicks the sender of an invalid
// intent). engine-lib's domestic/Balance.ts re-exports them.

/** Lobby bounds for GameConfig.conquestPercent (100 = no conquest victory). */
export const CONQUEST_PERCENT_MIN = 30;
export const CONQUEST_PERCENT_MAX = 100;

/** Bounds for the set_recruit_target intent (percent of max troops). */
export const RECRUIT_TARGET_MIN_PCT = 10;
export const RECRUIT_TARGET_MAX_PCT = 100;
