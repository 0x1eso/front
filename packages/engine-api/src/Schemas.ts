import { zb } from "@openfront/zbin";
import quickChatData from "resources/QuickChat.json";
import { z } from "zod";
import {
  BALLOT_OPTIONS,
  EMERGENCY_KINDS,
  MAX_AGENDA_ITEMS,
  MAX_EXTRA_VOTES,
} from "./congress/CongressTypes";
import {
  GOVERNMENT_IDS,
  LAW_IDS,
  LAW_OPTIONS,
  TECH_IDS,
  VICTORY_PROJECT_KINDS,
} from "./domestic/DomesticTypes";
import {
  CONQUEST_PERCENT_MAX,
  CONQUEST_PERCENT_MIN,
  RECRUIT_TARGET_MAX_PCT,
  RECRUIT_TARGET_MIN_PCT,
} from "./domestic/Limits";
import {
  AllPlayers,
  Difficulty,
  Duos,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  HumansVsNations,
  MAX_UPGRADE_AMOUNT,
  Quads,
  RankedType,
  Trios,
  UnitType,
} from "./game/GameTypes";
import { PlayerStatsSchema } from "./StatsSchemas";
import {
  INTERCEPTOR_NUKES,
  STOCKPILED_NUKES,
} from "./strategic/StrategicTypes";
import { COUNTRY_TAGS } from "./ww1936/Countries";
import {
  BUILDING_IDS,
  EQUIPMENT_TYPES,
  LAW_KINDS,
  LAW_VALUES,
  RESOURCE_IDS,
  WW_MAX_LINE_FACTORIES,
  WW_MAX_PROJECT_COUNT,
  WW_MAX_SLOTS,
  WW_MAX_TRADE_CIVS,
  WW_TECH_IDS,
} from "./ww1936/EconomyTypes";
import {
  BATTALION_IDS,
  LandOrderKind,
  STANCES,
  SUPPORT_IDS,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_BATTALIONS,
  WW_MAX_SUPPORT,
  WW_MAX_TARGETS,
  WW_MAX_TRAIN_COUNT,
  WW_TEMPLATE_NAME_MAX,
} from "./ww1936/LandTypes";
import {
  ADVISOR_SLOTS,
  PolOrderKind,
  WAR_GOAL_TYPES,
} from "./ww1936/PoliticsTypes";
import { SEA_ZONE_BASE } from "./ww1936/WorldWarTypes";

export type GameID = string;
export type ClientID = string;

export type Intent =
  | SpawnIntent
  | AttackIntent
  | CancelAttackIntent
  | BoatAttackIntent
  | CancelBoatIntent
  | AllianceRequestIntent
  | AllianceRejectIntent
  | AllianceExtensionIntent
  | BreakAllianceIntent
  | TargetPlayerIntent
  | EmojiIntent
  | DonateGoldIntent
  | DonateTroopsIntent
  | BuildUnitIntent
  | EmbargoIntent
  | QuickChatIntent
  | MoveWarshipIntent
  | MarkDisconnectedIntent
  | EmbargoAllIntent
  | UpgradeStructureIntent
  | DeleteUnitIntent
  | KickPlayerIntent
  | TogglePauseIntent
  | UpdateGameConfigIntent
  | ToggleGameStartTimer
  | ResearchTechIntent
  | SetRecruitTargetIntent
  | ProclaimLawIntent
  | ChooseGovernmentIntent
  | StartVictoryProjectIntent
  | ParadropIntent
  | ProduceNukeIntent
  | SatelliteTargetIntent
  | InterceptSatelliteIntent
  | QueueResearchIntent
  | CongressVoteIntent
  | ConveneEmergencyIntent
  | DeclareWarIntent
  | WwOrderIntent;

export type AttackIntent = z.infer<typeof AttackIntentSchema>;
export type CancelAttackIntent = z.infer<typeof CancelAttackIntentSchema>;
export type SpawnIntent = z.infer<typeof SpawnIntentSchema>;
export type BoatAttackIntent = z.infer<typeof BoatAttackIntentSchema>;
export type EmbargoAllIntent = z.infer<typeof EmbargoAllIntentSchema>;
export type CancelBoatIntent = z.infer<typeof CancelBoatIntentSchema>;
export type AllianceRequestIntent = z.infer<typeof AllianceRequestIntentSchema>;
export type AllianceRejectIntent = z.infer<typeof AllianceRejectIntentSchema>;
export type BreakAllianceIntent = z.infer<typeof BreakAllianceIntentSchema>;
export type TargetPlayerIntent = z.infer<typeof TargetPlayerIntentSchema>;
export type EmojiIntent = z.infer<typeof EmojiIntentSchema>;
export type DonateGoldIntent = z.infer<typeof DonateGoldIntentSchema>;
export type DonateTroopsIntent = z.infer<typeof DonateTroopIntentSchema>;
export type EmbargoIntent = z.infer<typeof EmbargoIntentSchema>;
export type BuildUnitIntent = z.infer<typeof BuildUnitIntentSchema>;
export type UpgradeStructureIntent = z.infer<
  typeof UpgradeStructureIntentSchema
>;
export type MoveWarshipIntent = z.infer<typeof MoveWarshipIntentSchema>;
export type QuickChatIntent = z.infer<typeof QuickChatIntentSchema>;
export type MarkDisconnectedIntent = z.infer<
  typeof MarkDisconnectedIntentSchema
>;
export type AllianceExtensionIntent = z.infer<
  typeof AllianceExtensionIntentSchema
>;
export type DeleteUnitIntent = z.infer<typeof DeleteUnitIntentSchema>;
export type KickPlayerIntent = z.infer<typeof KickPlayerIntentSchema>;
export type TogglePauseIntent = z.infer<typeof TogglePauseIntentSchema>;
export type UpdateGameConfigIntent = z.infer<
  typeof UpdateGameConfigIntentSchema
>;
export type ToggleGameStartTimer = z.infer<
  typeof ToggleGameStartTimerIntentSchema
>;

export type ResearchTechIntent = z.infer<typeof ResearchTechIntentSchema>;
export type SetRecruitTargetIntent = z.infer<
  typeof SetRecruitTargetIntentSchema
>;
export type ProclaimLawIntent = z.infer<typeof ProclaimLawIntentSchema>;
export type ChooseGovernmentIntent = z.infer<
  typeof ChooseGovernmentIntentSchema
>;
export type StartVictoryProjectIntent = z.infer<
  typeof StartVictoryProjectIntentSchema
>;
export type ParadropIntent = z.infer<typeof ParadropIntentSchema>;
export type ProduceNukeIntent = z.infer<typeof ProduceNukeIntentSchema>;
export type SatelliteTargetIntent = z.infer<typeof SatelliteTargetIntentSchema>;
export type InterceptSatelliteIntent = z.infer<
  typeof InterceptSatelliteIntentSchema
>;
export type QueueResearchIntent = z.infer<typeof QueueResearchIntentSchema>;
export type CongressVoteIntent = z.infer<typeof CongressVoteIntentSchema>;
export type ConveneEmergencyIntent = z.infer<
  typeof ConveneEmergencyIntentSchema
>;
export type DeclareWarIntent = z.infer<typeof DeclareWarIntentSchema>;
export type WwOrderIntent = z.infer<typeof WwOrderIntentSchema>;

export type Turn = z.infer<typeof TurnSchema>;
export type GameConfig = z.infer<typeof GameConfigSchema>;

export type AllPlayersStats = z.infer<typeof AllPlayersStatsSchema>;
export type Player = z.infer<typeof PlayerSchema>;

export type GameStartInfo = z.infer<typeof GameStartInfoSchema>;

// Deliberately looser than MAX_USERNAME_LENGTH, which caps what the form will
// accept at 20. This schema also reads data at rest: it backs PlayerSchema,
// so every archived GameRecord embeds names written under the rules of its
// era. Lowering the bound doesn't rewrite those records — it makes them
// unparseable, which dead-ends replay links (JoinLobbyModal parses before the
// gitCommit check, so a failure never reaches the versioned-shell fallback)
// and share previews (GamePreviewBuilder). Widen freely; never narrow.
//
// The charset accepts everything AccountUsernameSchema can produce, hyphens
// included, so a verified account name is always representable on the wire —
// verified play skips free-form validation, so an unrepresentable name would
// reach the server and be closed with CloseCode.BadRequest.
//
// Letters and digits the in-game name renderer can actually draw, plus the
// punctuation a name may carry. This is what lets José, Müller, Renée and
// Bjørn keep their names instead of falling back to a generated one.
//
// The bound is U+00FF — the end of Latin-1 Supplement — and it is set by the
// renderer twice over. Do not raise it without changing the renderer first:
//
//  1. The string path is 8-bit end to end. `TextLayout` writes
//     `charCodes[i] = text.charCodeAt(i)` into a `Uint8Array`, `DataTextures`
//     uploads it as `R8UI`/`UNSIGNED_BYTE`, and `name.vert.glsl` uses the
//     byte directly as the glyph index. Anything above 255 silently truncates
//     mod 256: Ł (U+0141) would draw as "A", ā (U+0101) as a code-0 slot the
//     shader drops while still consuming a layout position.
//  2. The atlas has no glyphs up there anyway. Of the 128 Latin Extended-A
//     entries in `resources/atlases/msdf-atlas.json`, exactly three (Œ œ Ÿ)
//     have a real glyph; the other 125 point at .notdef. All 64 Latin-1
//     Supplement entries are real.
//
// `CHAR_RANGE = 384` in the name-pass sizes the metrics and kerning tables, so
// it looks like the limit and is not — it is an upper bound on ids the atlas
// file may contain, not on what the string path can carry.
//
// Deliberately NOT every codepoint below the bound: that would admit control
// characters, the C1 block, and HTML-significant punctuation. The ranges skip
// × (U+00D7) and ÷ (U+00F7), maths symbols sitting inside the Latin-1 letter
// block, and the ordinal/micro signs.
//
// Emoji are excluded on purpose and stay excluded: the renderer draws them as
// a separate icon beside the name, never inline, so an emoji in the name
// itself has no glyph at all.
//
// Regex source for the character class, not a finished pattern: the wire
// schema, the free-form form rule and the persona sanitiser all need the same
// set in different shapes, and a single source is what keeps them from
// drifting apart by hand (which is how the charsets got out of step before).
export const RENDERABLE_NAME_ALNUM =
  "a-zA-Z0-9\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF";
export const RENDERABLE_NAME_CHARS = ` _.\\-${RENDERABLE_NAME_ALNUM}`;

/** One renderable character. Used per-codepoint by the persona sanitiser. */
export const RENDERABLE_NAME_CHAR_RE = new RegExp(
  `^[${RENDERABLE_NAME_CHARS}]$`,
  "u",
);

/** At least one letter or digit — punctuation alone is not a name. */
export const RENDERABLE_NAME_HAS_ALNUM_RE = new RegExp(
  `[${RENDERABLE_NAME_ALNUM}]`,
  "u",
);

// Requires at least one non-space so a name is never all padding.
export const UsernameSchema = z
  .string()
  .regex(new RegExp(`^(?=.*\\S)[${RENDERABLE_NAME_CHARS}]+$`, "u"))
  .min(3)
  .max(27);

export const ClanTagSchema = z
  .string()
  .regex(/^[a-zA-Z0-9]{2,5}$/)
  .nullable();

//
// Utility types
//

// select: encoding an untagged union without one costs a zod safeParse per
// rejected candidate (~10 µs each) — real money on schemas embedded in every
// GameConfig on the wire. The candidate ORDER is the wire layout; only the
// picking got cheaper.
const TEAM_COUNT_PRESETS = [Duos, Trios, Quads, HumansVsNations] as const;
const TeamCountConfigSchema = zb.union(
  [
    zb.uint(),
    z.literal(Duos),
    z.literal(Trios),
    z.literal(Quads),
    z.literal(HumansVsNations),
  ],
  {
    select: (v) =>
      typeof v === "number"
        ? 0
        : TEAM_COUNT_PRESETS.indexOf(v as (typeof TEAM_COUNT_PRESETS)[number]) +
          1,
  },
);
export type TeamCountConfig = z.infer<typeof TeamCountConfigSchema>;

// Doomsday Clock (anti-stall). Below a rising share of the map a player (or, in
// team modes, their whole team) gets skulled and their troops drain to zero. The
// required share rises in discrete waves per the `speed` preset (see
// DoomsdayClock.ts). Only `enabled` and `speed` are wire-configurable; the
// drain/warn tuning lives in DOOMSDAY_CLOCK_DEFAULTS (Config.ts).
export const DoomsdayClockConfigSchema = z.object({
  enabled: z.boolean().optional(),
  speed: z.enum(["slow", "normal", "fast", "veryfast"]).optional(),
});

// Overtime (anti-stalemate). After startMinutes of game time the tile share
// required to win drops steadily from the 80% base at a fixed rate (see
// OVERTIME_DEFAULTS in Config.ts), so the leading side eventually crosses the
// shrinking bar and a stalled game is guaranteed to end. Only `enabled` and
// `startMinutes` are wire-configurable.
export const OvertimeConfigSchema = z.object({
  enabled: z.boolean().optional(),
  startMinutes: zb.uint({ min: 1, max: 120 }).optional(),
});

// A lobby pool: several lobbies that arriving players are spread across, so
// one advertised entry point can absorb more players than a single lobby
// holds. Assignment is a hash of the joiner's identity (server/PoolRouting.ts),
// so members need no shared state. Every member carries this same config and
// recognises itself by its own game id.
//
// The advertised entry point is itself a member rather than an empty router:
// a lobby nobody plays in would start, leave the Lobby phase, drop out of the
// listing and be reaped, taking the entry point with it.
export const PoolConfigSchema = z
  .object({
    id: z.string().min(1).max(64),
    // z.lazy because ID is declared further down this file, and GameConfigSchema
    // — which embeds this — is evaluated before that point.
    siblings: z
      .lazy(() => ID)
      .array()
      .min(1)
      .max(64),
  })
  // Rejected rather than deduped: a repeated id holds more than one slot and
  // draws proportionally more players than the rest.
  .refine((pool) => new Set(pool.siblings).size === pool.siblings.length, {
    error: "pool siblings must be unique",
    path: ["siblings"],
  });
export type PoolConfig = z.infer<typeof PoolConfigSchema>;

export const GameConfigSchema = z.object({
  gameMap: z.enum(GameMapType),
  difficulty: z.enum(Difficulty),
  donateGold: z.boolean(), // Configures donations to humans only
  donateTroops: z.boolean(), // Configures donations to humans only
  gameType: z.enum(GameType),
  gameMode: z.enum(GameMode),
  rankedType: z.enum(RankedType).optional(), // Only set for ranked games.
  gameMapSize: z.enum(GameMapSize),
  doomsdayClock: DoomsdayClockConfigSchema.optional(),
  overtime: OvertimeConfigSchema.optional(),
  publicGameModifiers: z
    .object({
      isCompact: z.boolean().optional(),
      isRandomSpawn: z.boolean().optional(),
      isCrowded: z.boolean().optional(),
      isHardNations: z.boolean().optional(),
      startingGold: zb.uint().optional(),
      goldMultiplier: zb.float({ min: 0.1, max: 1000 }).optional(),
      isAlliancesDisabled: z.boolean().optional(),
      isPortsDisabled: z.boolean().optional(),
      isNukesDisabled: z.boolean().optional(),
      isSAMsDisabled: z.boolean().optional(),
      isPeaceTime: z.boolean().optional(),
      isWaterNukes: z.boolean().optional(),
      isDoomsdayClock: z.boolean().optional(),
    })
    .optional(),
  nations: zb.union(
    [zb.uint({ min: 1, max: 400 }), z.enum(["default", "disabled"])],
    {
      select: (v) => (typeof v === "number" ? 0 : 1),
    },
  ),
  bots: zb.uint({ max: 400 }),
  infiniteGold: z.boolean(),
  infiniteTroops: z.boolean(),
  instantBuild: z.boolean(),
  disableNavMesh: z.boolean().optional(),
  disableAlliances: z.boolean().nullable().optional(),
  disableClanTags: z.boolean().optional(),
  // Opt-in live game stats reporting for the admin bot. Off by default and has
  // no UI — the admin bot sets it when creating tournament games, since it adds
  // per-client traffic. See LiveStatsController / GameServer.handleLiveStats.
  liveStatsEnabled: z.boolean().optional(),
  anonymizeNames: z.boolean().optional(),
  // While anonymizeNames is on, clientIDs the host has granted real-name
  // visibility to (e.g. casters / observers). Everyone else stays anonymized.
  nameReveals: z.string().array().optional(),
  // Like nameReveals but keyed by stable account publicId (for automated hosts
  // that only know publicIds at create_game); resolved to clientID at lookup.
  nameRevealPublicIds: z.string().array().max(200).optional(),
  waterNukes: z.boolean().nullable().optional(),
  randomSpawn: z.boolean(),
  maxPlayers: zb.uint().optional(),
  // OFM: allowlist of publicIds allowed to join (admin-only, see create_game).
  allowedPublicIds: z.array(z.string()).max(200).optional(),
  // Only accounts the API reports as trusted (users/@me `trustTier`) may join.
  // Enforced server-side at join (GameServer.joinClient); advertised in the
  // lobby browser so a card can show a lock. No host UI yet: set through
  // create_game / update_game_config.
  trusted: z.boolean().optional(),
  maxTimerValue: zb.uint({ min: 1, max: 120 }).nullable().optional(), // In minutes
  customAllianceDuration: zb.uint({ max: 15 }).nullable().optional(), // In minutes; 0 disables alliances
  startDelay: zb.uint({ max: 600 }).nullable().optional(), // In seconds
  spawnImmunityDuration: zb.uint().nullable().optional(), // In ticks
  disabledUnits: z.enum(UnitType).array().optional(),
  playerTeams: TeamCountConfigSchema.optional(),
  goldMultiplier: zb.float({ min: 0.1, max: 1000 }).nullable().optional(),
  startingGold: zb.uint({ max: 1000000000 }).nullable().optional(),
  hostCheats: z
    .object({
      infiniteGold: z.boolean().optional(),
      infiniteTroops: z.boolean().optional(),
      goldMultiplier: zb.float({ min: 0.1, max: 1000 }).nullable().optional(),
      startingGold: zb.uint({ max: 1000000000 }).nullable().optional(),
    })
    .optional(),
  // Stripped from gameStartInfo and from the advertised lobby config: sibling
  // ids are private lobby ids, which are join secrets.
  pool: PoolConfigSchema.optional(),
  // Domestic mode (this fork): science / political power, tech tree, gold
  // sinks. Off by default. See docs/superpowers/specs/2026-10-15-domestic-system-design.md.
  domesticMode: z.boolean().optional(),
  // Domestic mode: land share (percent) that wins by conquest. Unset means
  // 70; ignored outside domestic mode (vanilla keeps 80). 100 turns conquest
  // victory off. Bounds live in domestic/Limits.ts (shared with the UI).
  conquestPercent: zb
    .uint({ min: CONQUEST_PERCENT_MIN, max: CONQUEST_PERCENT_MAX })
    .nullable()
    .optional(),
  // Expanded warfare (this fork, spec §14b): coastal battery, coastal
  // barrage, airport (paradrop, bombing, cargo routes), warship tuning and
  // SAMs that hit planes. Off by default; works with and without domestic
  // mode.
  warfareExpansion: z.boolean().optional(),
  // Strategic weapons (this fork): nukes made in factories and stockpiled,
  // the conventional missile and the orbital satellite. Off by default;
  // independent of warfareExpansion. See
  // docs/superpowers/specs/2026-10-16-strategic-weapons-design.md.
  strategicWeapons: z.boolean().optional(),
  // World congress (this fork): three-minute secret-ballot sessions,
  // influence, resolutions and emergencies. Only with domestic mode in FFA;
  // the lobby turns it on with domestic mode. See
  // docs/superpowers/specs/2026-10-19-world-congress-design.md.
  congress: z.boolean().optional(),
  // World War 1936 (this fork): the 1936 world, countries picked in the
  // lobby, declarations of war and the historical calendar. Exclusive with
  // every other fork mode (engine-lib/ww1936/ModeConfig.ts). See
  // docs/superpowers/specs/2026-10-19-world-war-1936-design.md.
  worldWar1936: z.boolean().optional(),
  // World War 1936: nations follow the historical calendar (spec §7.4).
  historicalAi: z.boolean().optional(),
});

// What a host sends in update_game_config. maxPlayers is the private-lobby
// player cap: nullable so the host can lift it (null clears, undefined leaves
// it alone), and at least 2 so a lobby can't be capped down to the host alone.
export const GameConfigPatchSchema = GameConfigSchema.partial().extend({
  maxPlayers: zb.uint({ min: 2, max: 1000 }).nullable().optional(),
});
export type GameConfigPatch = z.infer<typeof GameConfigPatchSchema>;

export const TeamSchema = z.string();

export const SafeString = z
  .string()
  .regex(
    /^([a-zA-Z0-9\s.,!?@#$%&*()\-_+=[\]{}|;:"'/\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|[üÜ])*$/u,
  )
  .max(1000);

export const emojiTable = [
  ["😀", "😊", "🥰", "😇", "😎"],
  ["😞", "🥺", "😭", "😱", "😡"],
  ["😈", "🤡", "🥱", "🫡", "🖕"],
  ["👋", "👏", "✋", "🙏", "💪"],
  ["👍", "👎", "🫴", "🤌", "🤦‍♂️"],
  ["🤝", "🆘", "🕊️", "🏳️", "⏳"],
  ["🔥", "💥", "💀", "☢️", "⚠️"],
  ["↖️", "⬆️", "↗️", "👑", "🥇"],
  ["⬅️", "🎯", "➡️", "🥈", "🥉"],
  ["↙️", "⬇️", "↘️", "❤️", "💔"],
  ["💰", "⚓", "⛵", "🏡", "🛡️"],
  ["🏭", "🚂", "❓", "🐔", "🐀"],
] as const;

// 2d to 1d array
export const flattenedEmojiTable = emojiTable.flat();

export type Emoji = (typeof flattenedEmojiTable)[number];

const EmojiSchema = zb.uint({ max: flattenedEmojiTable.length - 1 });

// 8–10: today's ids are 8 chars; multi-server ids (docs/MultiServer.md) will
// be 10 (instance letter + 9 random). The range ships ahead of the new format
// so every deployed client/server validates the longer ids before any are
// minted — old bundles reject unknown id lengths at the Zod layer.
export const GAME_ID_REGEX = /^[A-Za-z0-9]{8,10}$/;

export const isValidGameID = (value: string): boolean =>
  GAME_ID_REGEX.test(value);

export const ID = z.string().regex(GAME_ID_REGEX);

// zbin dictionary for player clientIDs (see ZbinWire.ts): both peers seed it
// from GameStartInfo.players, so an in-game player id costs one byte on the
// binary wire. Validates exactly like ID; ids outside the roster (e.g.
// ADMIN_BOT_CLIENT_ID) encode inline via the escape byte.
export const CLIENT_ID_MAPPING = "clientId";
export const MappedID = zb.mapped(CLIENT_ID_MAPPING, { regex: GAME_ID_REGEX });

export const AllPlayersStatsSchema = z.record(ID, PlayerStatsSchema);

export const QuickChatKeySchema = z.enum(
  Object.entries(quickChatData).flatMap(([category, entries]) =>
    entries.map((entry) => `${category}.${entry.key}`),
  ) as [string, ...string[]],
);

//
// Intents
//

export const AllianceExtensionIntentSchema = z.object({
  type: z.literal("allianceExtension"),
  recipient: MappedID,
});

export const AttackIntentSchema = z.object({
  type: z.literal("attack"),
  targetID: MappedID.nullable(),
  troops: zb.float({ min: 0 }).nullable(),
});

export const SpawnIntentSchema = z.object({
  type: z.literal("spawn"),
  // A TileRef indexes the typed-array terrain buffers, so it must be a
  // non-negative integer. Fractional refs silently corrupt those lookups.
  tile: zb.uint(),
});

export const BoatAttackIntentSchema = z.object({
  type: z.literal("boat"),
  // Not an int: troops are fractional throughout the sim (attackRatio *
  // troops(), combat attrition), and the client sends the raw float.
  troops: zb.float({ min: 0 }),
  dst: zb.uint(),
});

export const AllianceRequestIntentSchema = z.object({
  type: z.literal("allianceRequest"),
  recipient: MappedID,
});

export const AllianceRejectIntentSchema = z.object({
  type: z.literal("allianceReject"),
  requestor: MappedID,
});

export const BreakAllianceIntentSchema = z.object({
  type: z.literal("breakAlliance"),
  recipient: MappedID,
});

export const TargetPlayerIntentSchema = z.object({
  type: z.literal("targetPlayer"),
  target: MappedID,
});

export const EmojiIntentSchema = z.object({
  type: z.literal("emoji"),
  recipient: zb.union([MappedID, z.literal(AllPlayers)], {
    select: (v) => (v === AllPlayers ? 1 : 0),
  }),
  emoji: EmojiSchema,
});

export const EmbargoIntentSchema = z.object({
  type: z.literal("embargo"),
  targetID: MappedID,
  action: z.union([z.literal("start"), z.literal("stop")]),
});

export const EmbargoAllIntentSchema = z.object({
  type: z.literal("embargo_all"),
  action: z.union([z.literal("start"), z.literal("stop")]),
});

export const DonateGoldIntentSchema = z.object({
  type: z.literal("donate_gold"),
  recipient: MappedID,
  gold: zb.float({ min: 0 }).nullable(),
});

export const DonateTroopIntentSchema = z.object({
  type: z.literal("donate_troops"),
  recipient: MappedID,
  troops: zb.float({ min: 0 }).nullable(),
});

export const BuildUnitIntentSchema = z.object({
  type: z.literal("build_unit"),
  unit: z.enum(UnitType),
  tile: zb.uint(),
  rocketDirectionUp: z.boolean().optional(),
  amount: zb.uint({ min: 1, max: MAX_UPGRADE_AMOUNT }).optional(),
});

export const UpgradeStructureIntentSchema = z.object({
  type: z.literal("upgrade_structure"),
  unit: z.enum(UnitType),
  unitId: zb.uint(),
  amount: zb.uint({ min: 1, max: MAX_UPGRADE_AMOUNT }).optional(),
});

export const CancelAttackIntentSchema = z.object({
  type: z.literal("cancel_attack"),
  attackID: z.string(),
});

export const CancelBoatIntentSchema = z.object({
  type: z.literal("cancel_boat"),
  unitID: zb.uint(),
});

export const MoveWarshipIntentSchema = z.object({
  type: z.literal("move_warship"),
  unitIds: z.array(zb.int()).nonempty(),
  tile: zb.uint(),
});

export const DeleteUnitIntentSchema = z.object({
  type: z.literal("delete_unit"),
  unitId: zb.uint(),
});

export const QuickChatIntentSchema = z.object({
  type: z.literal("quick_chat"),
  recipient: MappedID,
  quickChatKey: QuickChatKeySchema,
  target: MappedID.optional(),
});

// Server-internal (rejected from clients). The player being marked is the
// intent's own sender, so the target rides the stamped `clientID` that
// StampedIntentSchema adds to every intent — declaring it here too would
// write the same key twice on the binary wire.
export const MarkDisconnectedIntentSchema = z.object({
  type: z.literal("mark_disconnected"),
  isDisconnected: z.boolean(),
});

export const KickPlayerIntentSchema = z.object({
  type: z.literal("kick_player"),
  // Either a live clientID (lobby / in-game kick) OR an account publicID, for
  // callers that identify a player by account rather than per-session clientID;
  // the server resolves the publicID to the live clientID. Exactly one is set.
  targetClientID: MappedID.optional(),
  targetPublicID: MappedID.optional(),
});

export const TogglePauseIntentSchema = z.object({
  type: z.literal("toggle_pause"),
  paused: z.boolean().default(false),
});

export const UpdateGameConfigIntentSchema = z.object({
  type: z.literal("update_game_config"),
  // zb.json: too rare and too config-shaped to deserve a binary layout —
  // rides the binary wire as length-prefixed JSON.
  config: zb.json(GameConfigPatchSchema),
});

export const ToggleGameStartTimerIntentSchema = z.object({
  type: z.literal("toggle_game_start_timer"),
});

// Domestic mode: start researching a tech, paying a science shortfall with
// gold when payWithGold is set.
export const ResearchTechIntentSchema = z.object({
  type: z.literal("research_tech"),
  tech: z.enum(TECH_IDS),
  payWithGold: z.boolean().optional(),
});

// Domestic mode: troops stop regrowing at this percent of max troops.
export const SetRecruitTargetIntentSchema = z.object({
  type: z.literal("set_recruit_target"),
  percent: zb.uint({
    min: RECRUIT_TARGET_MIN_PCT,
    max: RECRUIT_TARGET_MAX_PCT,
  }),
});

// Domestic mode: proclaim one option of a law forever, paying a political
// shortfall with gold when payWithGold is set.
export const ProclaimLawIntentSchema = z.object({
  type: z.literal("proclaim_law"),
  law: z.enum(LAW_IDS),
  option: z.enum(LAW_OPTIONS),
  payWithGold: z.boolean().optional(),
});

// Domestic mode: adopt a government of the current tier.
export const ChooseGovernmentIntentSchema = z.object({
  type: z.literal("choose_government"),
  government: z.enum(GOVERNMENT_IDS),
});

// Domestic mode: start a victory project (spec §8.1) in one of the sender's
// own level 3+ research institutes / admin offices.
export const StartVictoryProjectIntentSchema = z.object({
  type: z.literal("start_victory_project"),
  kind: z.enum(VICTORY_PROJECT_KINDS),
  unitId: zb.uint(),
});

// Expanded warfare: fly `troops` from the nearest airport with a free
// sortie and drop them on `dst` (spec §14b).
export const ParadropIntentSchema = z.object({
  type: z.literal("paradrop"),
  // Fractional like a boat's troops (attackRatio * troops).
  troops: zb.float({ min: 0 }),
  dst: zb.uint(),
});

// Strategic weapons: start one nuke on a free factory line (the engine
// picks the factory).
export const ProduceNukeIntentSchema = z.object({
  type: z.literal("produce_nuke"),
  nukeType: z.enum(STOCKPILED_NUKES),
});

// Strategic weapons: aim the sender's satellite in orbit at a nation.
export const SatelliteTargetIntentSchema = z.object({
  type: z.literal("satellite_target"),
  target: MappedID,
});

// Strategic weapons: fire a stockpiled hydrogen or atom bomb at
// `attacker`'s satellite while its strike counts down.
export const InterceptSatelliteIntentSchema = z.object({
  type: z.literal("intercept_satellite"),
  attacker: MappedID,
  nukeType: z.enum(INTERCEPTOR_NUKES),
});

// Domestic mode: reserve the next tech (null clears the reservation). It
// starts by itself once the current research ends and science covers it.
export const QueueResearchIntentSchema = z.object({
  type: z.literal("queue_research"),
  tech: z.enum(TECH_IDS).nullable(),
});

// World congress (spec §6.3): a ballot, or a raise of its extra votes, on
// one agenda item of the open session.
export const CongressVoteIntentSchema = z.object({
  type: z.literal("congress_vote"),
  session: zb.uint(),
  item: zb.uint({ max: MAX_AGENDA_ITEMS - 1 }),
  option: z.enum(BALLOT_OPTIONS),
  extra: zb.uint({ max: MAX_EXTRA_VOTES }),
});

// World congress (spec §9.2): convene an emergency session against `target`.
export const ConveneEmergencyIntentSchema = z.object({
  type: z.literal("convene_emergency"),
  kind: z.enum(EMERGENCY_KINDS),
  target: MappedID,
});

// World War 1936 (spec §7.3): declare war on `target`.
export const DeclareWarIntentSchema = z.object({
  type: z.literal("declare_war"),
  target: MappedID,
});

// World War 1936 P1 (spec §4.3, §5.4, §7.4, §8.4, §9.3): one economy order
// for the sender's own country. The kinds are stored by position: append only.
const WwIndex = zb.uint({ max: 255 });
const WwId = zb.uint({ min: 1, max: 10_000_000 });
const WwGen = zb.uint({ min: 1, max: 3 });
const WwFactories = zb.uint({ max: WW_MAX_LINE_FACTORIES });
// P2 (P2 spec §16.3).
const WwArmy = zb.uint({ min: 1, max: 10_000_000 });
const WwRegionId = zb.uint({ min: 1, max: SEA_ZONE_BASE - 1 });
const WwTemplateId = zb.uint({ max: 65_535 });
// P3 (P3 spec §22.3, plan decision 3, 6): content ids and target countries.
const WwContentRef = zb.string({
  min: 1,
  max: 48,
  regex: /^[a-z][a-z0-9_:]*$/,
});
const WwCountry = zb.uint({ min: 1, max: 1000 });
const WwTemplateName = zb.string({
  min: 1,
  max: WW_TEMPLATE_NAME_MAX,
  // No control characters, no space at either end (P2 spec §4.4).
  regex: /^[^\s\p{Cc}](?:[^\p{Cc}]*[^\s\p{Cc}])?$/u,
});

export const WwOrderSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("build"),
    region: zb.uint({ min: 1, max: SEA_ZONE_BASE - 1 }),
    building: z.enum(BUILDING_IDS),
    count: zb.uint({ min: 1, max: WW_MAX_PROJECT_COUNT }),
  }),
  z.object({ kind: z.literal("cancel_build"), index: WwIndex }),
  z.object({ kind: z.literal("move_build"), index: WwIndex, to: WwIndex }),
  z.object({
    kind: z.literal("set_law"),
    law: z.enum(LAW_KINDS),
    value: z.enum(LAW_VALUES),
  }),
  z.object({
    kind: z.literal("add_line"),
    equipment: z.enum(EQUIPMENT_TYPES),
    gen: WwGen,
    factories: WwFactories,
  }),
  z.object({
    kind: z.literal("change_line"),
    line: WwId,
    equipment: z.enum(EQUIPMENT_TYPES),
    gen: WwGen,
  }),
  z.object({
    kind: z.literal("set_line_factories"),
    line: WwId,
    factories: WwFactories,
  }),
  z.object({ kind: z.literal("remove_line"), line: WwId }),
  z.object({ kind: z.literal("move_line"), line: WwId, to: WwIndex }),
  z.object({
    kind: z.literal("open_trade"),
    seller: MappedID,
    resource: z.enum(RESOURCE_IDS),
    civs: zb.uint({ min: 1, max: WW_MAX_TRADE_CIVS }),
  }),
  z.object({ kind: z.literal("close_trade"), trade: WwId }),
  z.object({ kind: z.literal("research"), tech: z.enum(WW_TECH_IDS) }),
  z.object({
    kind: z.literal("cancel_research"),
    slot: zb.uint({ max: WW_MAX_SLOTS - 1 }),
  }),
  // ---- P2 land war (P2 spec §16.3, plan decision 2), appended ----
  z.object({
    kind: z.literal("template_save"),
    /** 0: a new template. */
    template: WwTemplateId,
    /** For a new one: the template it copies (0: from nothing). */
    base: WwTemplateId,
    name: WwTemplateName,
    battalions: z.array(z.enum(BATTALION_IDS)).min(1).max(WW_MAX_BATTALIONS),
    support: z.array(z.enum(SUPPORT_IDS)).max(WW_MAX_SUPPORT),
  }),
  z.object({ kind: z.literal("template_delete"), template: WwTemplateId }),
  z.object({
    kind: z.literal("train"),
    template: WwTemplateId,
    count: zb.uint({ min: 1, max: WW_MAX_TRAIN_COUNT }),
    /** 0: a new army. */
    army: zb.uint({ max: 10_000_000 }),
    /** 0: the capital region. */
    region: zb.uint({ max: SEA_ZONE_BASE - 1 }),
  }),
  z.object({ kind: z.literal("cancel_train"), entry: WwId }),
  z.object({ kind: z.literal("deploy_now"), entry: WwId }),
  z.object({ kind: z.literal("army_move"), army: WwArmy, region: WwRegionId }),
  z.object({ kind: z.literal("army_rail"), army: WwArmy, region: WwRegionId }),
  z.object({ kind: z.literal("army_sea"), army: WwArmy, region: WwRegionId }),
  z.object({
    kind: z.literal("army_attack"),
    army: WwArmy,
    region: WwRegionId,
  }),
  z.object({
    kind: z.literal("army_front"),
    army: WwArmy,
    anchor: WwRegionId,
    /** smallID; 0: every country at war with us. */
    enemy: zb.uint({ max: 1000 }),
  }),
  z.object({
    kind: z.literal("army_plan"),
    army: WwArmy,
    targets: z.array(WwRegionId).max(WW_MAX_TARGETS),
    stance: z.enum(STANCES),
  }),
  z.object({ kind: z.literal("army_execute"), army: WwArmy, on: z.boolean() }),
  z.object({ kind: z.literal("army_halt"), army: WwArmy }),
  z.object({
    kind: z.literal("army_split"),
    army: WwArmy,
    count: zb.uint({ min: 1, max: WW_MAX_ARMY_DIVISIONS - 1 }),
    /** 0: any template. */
    template: WwTemplateId,
  }),
  z.object({ kind: z.literal("army_merge"), army: WwArmy, into: WwArmy }),
  z.object({ kind: z.literal("army_disband"), army: WwArmy }),
  z.object({
    kind: z.literal("army_general"),
    army: WwArmy,
    /** 0: take the general away. */
    general: zb.uint({ max: 10_000_000 }),
  }),
  z.object({ kind: z.literal("army_auto"), army: WwArmy, on: z.boolean() }),
  z.object({ kind: z.literal("paradrop"), army: WwArmy, region: WwRegionId }),
  z.object({ kind: z.literal("appoint_general") }),
  // ---- P3 politics (P3 spec §22.3, plan decision 3), appended ----
  z.object({ kind: z.literal("focus_start"), focus: WwContentRef }),
  z.object({ kind: z.literal("focus_queue"), focus: WwContentRef }),
  z.object({ kind: z.literal("focus_cancel") }),
  z.object({ kind: z.literal("focus_unqueue") }),
  z.object({
    kind: z.literal("advisor_hire"),
    slot: zb.uint({ max: ADVISOR_SLOTS.length - 1 }),
    /** A person id, or "title:<trait>" for a titled card. */
    advisor: WwContentRef,
  }),
  z.object({
    kind: z.literal("advisor_fire"),
    slot: zb.uint({ max: ADVISOR_SLOTS.length - 1 }),
  }),
  z.object({
    kind: z.literal("decision_take"),
    decision: WwContentRef,
    /** smallID of the target for a targeted decision; 0: none. */
    target: zb.uint({ max: 1000 }),
  }),
  z.object({
    kind: z.literal("decision_cancel"),
    decision: WwContentRef,
    target: zb.uint({ max: 1000 }),
  }),
  z.object({
    kind: z.literal("event_choose"),
    uid: WwId,
    option: zb.string({ min: 1, max: 2, regex: /^[a-z]+$/ }),
  }),
  z.object({
    kind: z.literal("justify"),
    target: WwCountry,
    goal: z.enum(WAR_GOAL_TYPES),
    /** A claim's region group; "" for none. */
    group: zb.string({ max: 48, regex: /^[a-z0-9_]*$/ }),
  }),
  z.object({ kind: z.literal("justify_cancel") }),
  z.object({ kind: z.literal("guarantee"), target: WwCountry }),
  z.object({ kind: z.literal("guarantee_end"), target: WwCountry }),
  z.object({ kind: z.literal("nap_offer"), target: WwCountry }),
  z.object({ kind: z.literal("nap_break"), target: WwCountry }),
  z.object({ kind: z.literal("access_ask"), target: WwCountry }),
  z.object({ kind: z.literal("access_revoke"), target: WwCountry }),
  z.object({ kind: z.literal("faction_create") }),
  z.object({ kind: z.literal("faction_invite"), target: WwCountry }),
  /** Asks to join the faction `target` belongs to. */
  z.object({ kind: z.literal("faction_request"), target: WwCountry }),
  z.object({ kind: z.literal("faction_kick"), target: WwCountry }),
  z.object({ kind: z.literal("faction_leave") }),
  z.object({ kind: z.literal("faction_dissolve") }),
  z.object({ kind: z.literal("improve_relations"), target: WwCountry }),
]);
export type WwOrder = z.infer<typeof WwOrderSchema>;
/** The land war's orders (P2): what WwLand.issue takes. */
export type LandOrder = Extract<WwOrder, { kind: LandOrderKind }>;
/** The politics orders (P3): what WwPolitics.issue takes. */
export type PolOrder = Extract<WwOrder, { kind: PolOrderKind }>;

export const WwOrderIntentSchema = z.object({
  type: z.literal("ww_order"),
  order: WwOrderSchema,
});

export const IntentSchema = z.discriminatedUnion("type", [
  AttackIntentSchema,
  CancelAttackIntentSchema,
  SpawnIntentSchema,
  MarkDisconnectedIntentSchema,
  BoatAttackIntentSchema,
  CancelBoatIntentSchema,
  AllianceRequestIntentSchema,
  AllianceRejectIntentSchema,
  BreakAllianceIntentSchema,
  TargetPlayerIntentSchema,
  EmojiIntentSchema,
  DonateGoldIntentSchema,
  DonateTroopIntentSchema,
  BuildUnitIntentSchema,
  UpgradeStructureIntentSchema,
  EmbargoIntentSchema,
  EmbargoAllIntentSchema,
  MoveWarshipIntentSchema,
  QuickChatIntentSchema,
  AllianceExtensionIntentSchema,
  DeleteUnitIntentSchema,
  KickPlayerIntentSchema,
  TogglePauseIntentSchema,
  UpdateGameConfigIntentSchema,
  ToggleGameStartTimerIntentSchema,
  ResearchTechIntentSchema,
  SetRecruitTargetIntentSchema,
  ProclaimLawIntentSchema,
  ChooseGovernmentIntentSchema,
  StartVictoryProjectIntentSchema,
  ParadropIntentSchema,
  ProduceNukeIntentSchema,
  SatelliteTargetIntentSchema,
  InterceptSatelliteIntentSchema,
  QueueResearchIntentSchema,
  CongressVoteIntentSchema,
  ConveneEmergencyIntentSchema,
  DeclareWarIntentSchema,
  WwOrderIntentSchema,
]);

// StampedIntent = Intent with server-stamped clientID (used in turns and execution)
export const StampedIntentSchema = zb.stamped(IntentSchema, {
  clientID: MappedID,
});
export type StampedIntent = Intent & { clientID: ClientID };

// Placeholder clientID stamped onto admin-bot intents (HTTP admin API). The bot
// is not a player, but toggle_pause — the one bot intent that reaches the turn
// queue — needs a valid clientID. Chosen so it can never collide with a real id:
// generateID() omits 0/l/I/O, and this contains I and O.
export const ADMIN_BOT_CLIENT_ID: ClientID = "ADMINBOT";

//
// Server utility types
//

export const TurnSchema = z.object({
  turnNumber: zb.uint(),
  intents: StampedIntentSchema.array(),
  // The hash of the game state at the end of the turn.
  hash: zb.float().nullable().optional(),
});

export const PlayerSchema = z.object({
  clientID: ID,
  username: UsernameSchema,
  clanTag: ClanTagSchema,
  isLobbyCreator: z.boolean().optional(),
  friends: z.array(ID).optional(),
  // Server-stamped team slot for matchmade team games (index into the
  // game's team list). Feeds deterministic team assignment, so it must be
  // identical for every client (like clanTag/friends).
  teamIndex: zb.uint().optional(),
  // World War 1936: the country this player picked in the lobby, stamped by
  // the server (spec §7.1). Missing or taken picks get a free country.
  country: z.enum(COUNTRY_TAGS).optional(),
});

// A purchased bot tribe name in use this game (active names are globally
// unique, so the name alone identifies the tribe). Loose to mirror infra's
// analytics-ingest schema — a field the API adds later flows through to the
// record without a game-side change, instead of being silently stripped.
export const TribeSchema = z
  .object({
    name: SafeString.min(1).max(64),
  })
  .loose();
export type Tribe = z.infer<typeof TribeSchema>;

export const GameStartInfoSchema = z.object({
  gameID: ID,
  lobbyCreatedAt: zb.uint(),
  visibleAt: zb.uint().optional(),
  listed: z.boolean().optional(),
  config: GameConfigSchema,
  players: PlayerSchema.array(),
  // Purchased bot tribe names in use this game (public games only). Rides
  // the analytics record to infra at game end for owner appearance stats.
  // zb.json: TribeSchema is `.loose()`, and a positional binary layout would
  // silently drop the passthrough keys that looseness exists to preserve.
  tribes: z.array(zb.json(TribeSchema)).max(100).optional(),
});

export const WinnerSchema = z
  .union([
    z.tuple([z.literal("player"), ID]).rest(ID),
    z.tuple([z.literal("team"), SafeString]).rest(ID),
    z.tuple([z.literal("nation"), SafeString]).rest(ID),
  ])
  .optional();
export type Winner = z.infer<typeof WinnerSchema>;
