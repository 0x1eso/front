export const COLUMN_IDS = [
  // Identity (only clan is hideable; rank/player/team are not).
  "rank",
  "clan",
  "player",
  "playerType",
  "team",
  // Domestic mode only: always shown there, never offered in the menu.
  "score",
  // Strategic weapons only: always shown there, never offered in the menu.
  "nukes",
  // World congress only: always shown there, never offered in the menu.
  "congress",
  // Territory.
  "tiles",
  // Economy: balance, then its per-source income rates.
  "gold",
  "goldIncomePerMin",
  "shipTradeGoldPerMin",
  "piracyGoldPerMin",
  "trainTradeGoldPerMin",
  // Military.
  "troops",
  "maxtroops",
  // Buildings & units.
  "cities",
  "ports",
  "factories",
  "silos",
  "sams",
  "warships",
  // Diplomacy.
  "allies",
  "betrayals",
] as const;

export type ColumnId = (typeof COLUMN_IDS)[number];

export const DEFAULT_STATS_COLUMNS = {
  player: ["clan", "tiles", "gold", "maxtroops"],
  team: ["tiles", "gold", "maxtroops"],
} as const satisfies Record<StatsTableKind, readonly ColumnId[]>;

export type StatsTableKind = "player" | "team";
