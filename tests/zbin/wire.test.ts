import { TECH_IDS } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  ADMIN_BOT_CLIENT_ID,
  GameConfig,
  IntentSchema,
  StampedIntent,
  Turn,
} from "@openfront/engine-api/Schemas";
import { replacer } from "@openfront/shared/SharedUtil";
import {
  ClientMessage,
  ClientMessageSchema,
  LogSeverity,
  PublicLobbyMessage,
  PublicLobbyMessageSchema,
  ServerMessage,
  ServerMessageSchema,
} from "@openfront/shared/WireSchemas";
import {
  createGameWireContext,
  decodeClientMessage,
  decodeLobbyMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeLobbyMessage,
  encodeServerMessage,
} from "@openfront/shared/ZbinWire";
import { ZbDecodeError } from "@openfront/zbin";
import { describe, expect, it } from "vitest";

const PLAYERS = [
  { clientID: "aB3dEf7h" },
  { clientID: "Xk9mNp2q" },
  { clientID: "Zz8wVu5t" },
];

const [P1, P2, P3] = PLAYERS.map((p) => p.clientID);

// Server and client each build their own context from the same roster, the way
// GameServer.start() and Transport's start handler do.
function ctxPair() {
  return [createGameWireContext(PLAYERS), createGameWireContext(PLAYERS)];
}

const CONFIG: GameConfig = {
  gameMap: GameMapType.World,
  difficulty: Difficulty.Medium,
  donateGold: true,
  donateTroops: true,
  gameType: GameType.Public,
  gameMode: GameMode.FFA,
  gameMapSize: GameMapSize.Normal,
  nations: "default",
  bots: 200,
  infiniteGold: false,
  infiniteTroops: false,
  instantBuild: false,
  randomSpawn: false,
  domesticMode: true,
  conquestPercent: 100,
  warfareExpansion: true,
  strategicWeapons: true,
};

// A vanilla config: no domestic fields at all.
const VANILLA_CONFIG: GameConfig = { ...CONFIG };
delete VANILLA_CONFIG.domesticMode;
delete VANILLA_CONFIG.conquestPercent;
delete VANILLA_CONFIG.warfareExpansion;
delete VANILLA_CONFIG.strategicWeapons;

// One of every intent type, as stamped intents inside a turn.
const SAMPLE_INTENTS: StampedIntent[] = [
  { type: "spawn", clientID: P1, tile: 123456 },
  { type: "attack", clientID: P1, targetID: P2, troops: 5123.75 },
  { type: "attack", clientID: P2, targetID: null, troops: null },
  { type: "cancel_attack", clientID: P1, attackID: "a1b2c3d4" },
  { type: "boat", clientID: P2, troops: 100.5, dst: 998877 },
  { type: "cancel_boat", clientID: P2, unitID: 42 },
  { type: "allianceRequest", clientID: P1, recipient: P3 },
  { type: "allianceReject", clientID: P3, requestor: P1 },
  { type: "allianceExtension", clientID: P1, recipient: P3 },
  { type: "breakAlliance", clientID: P1, recipient: P3 },
  { type: "targetPlayer", clientID: P2, target: P1 },
  { type: "emoji", clientID: P1, recipient: "AllPlayers", emoji: 3 },
  { type: "emoji", clientID: P1, recipient: P2, emoji: 0 },
  { type: "donate_gold", clientID: P1, recipient: P2, gold: 1000000 },
  { type: "donate_troops", clientID: P1, recipient: P2, troops: null },
  {
    type: "build_unit",
    clientID: P2,
    unit: UnitType.Port,
    tile: 7,
    amount: 3,
  },
  {
    type: "upgrade_structure",
    clientID: P2,
    unit: UnitType.City,
    unitId: 88,
  },
  { type: "embargo", clientID: P1, targetID: P2, action: "start" },
  { type: "embargo_all", clientID: P1, action: "stop" },
  { type: "move_warship", clientID: P3, unitIds: [1, 2, 3], tile: 555 },
  { type: "delete_unit", clientID: P3, unitId: 9 },
  { type: "mark_disconnected", clientID: P1, isDisconnected: true },
  { type: "kick_player", clientID: P1, targetClientID: P2 },
  {
    type: "quick_chat",
    clientID: P1,
    recipient: P2,
    quickChatKey: "help.troops",
    target: P3,
  },
  { type: "toggle_pause", clientID: ADMIN_BOT_CLIENT_ID, paused: true },
  {
    type: "update_game_config",
    clientID: P1,
    config: { bots: 5, instantBuild: true },
  },
  { type: "toggle_game_start_timer", clientID: P1 },
  {
    type: "proclaim_law",
    clientID: P1,
    law: "diplomacy",
    option: "B",
    payWithGold: true,
  },
  { type: "choose_government", clientID: P2, government: "communism" },
  {
    type: "start_victory_project",
    clientID: P1,
    kind: "political",
    unitId: 88,
  },
  { type: "research_tech", clientID: P1, tech: TECH_IDS[0] },
  {
    type: "research_tech",
    clientID: P2,
    tech: TECH_IDS[TECH_IDS.length - 1],
    payWithGold: true,
  },
  { type: "queue_research", clientID: P1, tech: TECH_IDS[1] },
  { type: "queue_research", clientID: P2, tech: null },
  { type: "set_recruit_target", clientID: P1, percent: 10 },
  { type: "set_recruit_target", clientID: P2, percent: 100 },
  { type: "paradrop", clientID: P2, troops: 12345.5, dst: 4242 },
  { type: "produce_nuke", clientID: P1, nukeType: UnitType.MIRV },
  { type: "satellite_target", clientID: P2, target: P1 },
  {
    type: "intercept_satellite",
    clientID: P1,
    attacker: P2,
    nukeType: UnitType.AtomBomb,
  },
  {
    type: "congress_vote",
    clientID: P1,
    session: 3,
    item: 2,
    option: "B",
    extra: 5,
  },
  { type: "convene_emergency", clientID: P2, kind: "nuclear", target: P1 },
  { type: "declare_war", clientID: P1, target: P2 },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "build", region: 39_999, building: "infra", count: 10 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "set_law", law: "conscription", value: "all_adults" },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "add_line", equipment: "medium_tank", gen: 3, factories: 0 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "open_trade", seller: P3, resource: "chromium", civs: 50 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "move_line", line: 10_000_000, to: 255 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "cancel_research", slot: 4 },
  },
  // P2: the land war's 20 kinds (plan Task 1 Step 4).
  {
    type: "ww_order",
    clientID: P3,
    order: {
      kind: "template_save",
      template: 0,
      base: 1,
      name: "보병 사단 7·2",
      battalions: ["infantry", "infantry", "artillery"],
      support: ["engineer", "recon"],
    },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "template_delete", template: 3 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "train", template: 2, count: 10, army: 0, region: 0 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "cancel_train", entry: 7 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "deploy_now", entry: 7 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_move", army: 12, region: 1342 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_rail", army: 12, region: 4 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_sea", army: 12, region: 10 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_attack", army: 9_999_999, region: 6 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_front", army: 1, anchor: 3, enemy: 0 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: {
      kind: "army_plan",
      army: 1,
      targets: [6, 7, 8],
      stance: "aggressive",
    },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_execute", army: 1, on: false },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_halt", army: 1 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_split", army: 2, count: 23, template: 0 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_merge", army: 2, into: 3 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_disband", army: 2 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_general", army: 2, general: 100_000 + 7 * 1000 + 1 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "army_auto", army: 2, on: true },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "paradrop", army: 4, region: 6 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "appoint_general" },
  },
  // P3: politics' 24 kinds (plan Task 1 Step 3).
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "focus_start", focus: "gen_ind_survey" },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "focus_queue", focus: "deu_rhineland" },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "focus_cancel" },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "focus_unqueue" },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "advisor_hire", slot: 7, advisor: "title:rs_aircraft" },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "advisor_fire", slot: 0 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "decision_take", decision: "gen_coup_fas", target: 1000 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "decision_cancel", decision: "gen_coup_fas", target: 0 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "event_choose", uid: 10_000_000, option: "d" },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "justify", target: 1, goal: "claim", group: "sudetenland" },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "justify_cancel" },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "guarantee", target: 8 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "guarantee_end", target: 8 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "nap_offer", target: 7 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "nap_break", target: 7 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "access_ask", target: 79 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "access_revoke", target: 79 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "faction_create" },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "faction_invite", target: 2 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "faction_request", target: 4 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "faction_kick", target: 2 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "faction_leave" },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "faction_dissolve" },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "improve_relations", target: 5 },
  }, // P4 (P4 spec §19.3): the navy's and the air war's orders.
  {
    type: "ww_order",
    clientID: P1,
    order: {
      kind: "fleet_mission",
      fleet: 7,
      mission: "invasion_support",
      sr: 1027,
    },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "fleet_move", fleet: 7, zone: 40153 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "fleet_return", fleet: 7 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "fleet_base", fleet: 7, port: 1210 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "fleet_engage", fleet: 7, rule: "if_stronger" },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "fleet_return_at", fleet: 7, pct: 30 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: {
      kind: "fleet_split",
      fleet: 7,
      counts: [
        ["dd", 4],
        ["cl", 1],
      ],
      ships: [],
    },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: {
      kind: "fleet_split",
      fleet: 7,
      counts: [],
      ships: [12, 13, 99_999],
    },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "fleet_merge", fleet: 7, into: 3 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "fleet_admiral", fleet: 7, admiral: 200_301 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "fleet_auto", fleet: 7, on: true },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "fleet_port_strike", fleet: 7, port: 44 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "carrier_mix", fleet: 7, mix: [4, 3, 3] },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: {
      kind: "naval_line_add",
      cls: "convoy",
      gen: 1,
      docks: 15,
      count: 0,
      port: 10,
    },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "naval_line_docks", line: 2, docks: 8 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "naval_line_count", line: 2, count: 99 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "naval_line_remove", line: 2 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "naval_line_move", line: 2, to: 19 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "appoint_admiral" },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "army_invade", army: 4, target: 1301 },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "invasion_execute", army: 4 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "invasion_cancel", army: 4 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: {
      kind: "air_deploy",
      sr: 15,
      type: "cv_naval_bomber",
      mission: "naval_strike",
      count: 5000,
    },
  },
  {
    type: "ww_order",
    clientID: P3,
    order: { kind: "air_recall", sr: 15 },
  },
  {
    type: "ww_order",
    clientID: P1,
    order: { kind: "air_recall", sr: 15, type: "fighter" },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "air_auto", sr: 1001, on: false },
  },
  // P5 (plan decision 10, plan Task 1 Step 4): the 13 endgame orders.
  {
    type: "ww_order",
    clientID: P2,
    order: {
      kind: "peace_submit",
      conf: 3,
      demands: [
        { kind: "take", region: 14 },
        { kind: "take_group", group: "prague" },
        { kind: "take_for", region: 13, beneficiary: 8 },
        { kind: "annex_rest", target: 7 },
        { kind: "occupation_zone", group: "slovakia" },
      ],
    },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: {
      kind: "peace_submit",
      conf: 3,
      demands: [
        { kind: "occupation_zone", region: 15 },
        { kind: "puppet", target: 7 },
        { kind: "release", tag: "SVK" },
        { kind: "liberate", tag: "POL" },
        { kind: "change_government", target: 7 },
      ],
    },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: {
      kind: "peace_submit",
      conf: 4,
      demands: [
        { kind: "dismantle", target: 7 },
        { kind: "demilitarise", region: 4 },
        { kind: "reparations", target: 7, k: 4 },
        { kind: "disarm", target: 7 },
        { kind: "take_navy", target: 7, pct: 25 },
      ],
    },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "peace_pass", conf: 3 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "occupation_law", of: 0, law: "occ_martial" },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "integrate_region", region: 15 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: {
      kind: "lend_lease",
      to: 3,
      item: "infantry_equipment",
      gen: 1,
      perMonth: 500,
    },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "lend_lease", to: 3, item: "fuel", gen: 0, perMonth: 2000 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "lend_lease_cancel", id: 7 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: {
      kind: "lend_lease_request",
      from: 6,
      item: "artillery",
      perMonth: 40,
    },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "volunteers_send", army: 12, to: 23 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "volunteers_recall", army: 12 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: {
      kind: "air_volunteers",
      to: 23,
      zone: 1001,
      plane: "fighter",
      count: 50,
    },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "ships_transfer", to: 3, ships: [101, 102, 103] },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "takeover_pick", smallID: 9 },
  },
  {
    type: "ww_order",
    clientID: P2,
    order: { kind: "army_garrison", army: 12, scope: 7 },
  },
];

const SERVER_MESSAGES: ServerMessage[] = [
  { type: "ping" },
  { type: "turn", turn: { turnNumber: 12345, intents: [] } },
  { type: "turn", turn: { turnNumber: 999, intents: SAMPLE_INTENTS } },
  {
    type: "turn",
    turn: { turnNumber: 4, intents: [], hash: 1234.5 },
  },
  {
    type: "prestart",
    gameMap: GameMapType.Europe,
    gameMapSize: GameMapSize.Compact,
  },
  {
    type: "start",
    turns: [{ turnNumber: 0, intents: SAMPLE_INTENTS.slice(0, 2) }],
    lobbyCreatedAt: 1_700_000_000_000,
    myClientID: P1,
    gameStartInfo: {
      gameID: "gM3xQ1zR",
      lobbyCreatedAt: 1_700_000_000_000,
      config: CONFIG,
      players: [
        { clientID: P1, username: "alpha", clanTag: "ABC" },
        {
          clientID: P2,
          username: "bravo",
          clanTag: null,
          isLobbyCreator: true,
          teamIndex: 1,
          friends: [P1],
          cosmetics: { flag: "flag:mars", verified: true },
        },
        { clientID: P3, username: "charlie", clanTag: null, country: "SUN" },
      ],
      tribes: [{ name: "Wolves" }],
    },
  },
  {
    type: "desync",
    turn: 77,
    correctHash: 12345.5,
    clientsWithCorrectHash: 3,
    totalActiveClients: 5,
    yourHash: 999.25,
  },
  { type: "error", error: "full-lobby" },
  { type: "error", error: "kicked", message: "by host" },
  {
    type: "lobby_info",
    myClientID: P1,
    lobby: {
      gameID: "gM3xQ1zR",
      serverTime: 1_700_000_000_000,
      startsAt: 1_700_000_030_000,
      gameConfig: CONFIG,
      clients: [
        { clientID: P1, username: "alpha", clanTag: null, teamIndex: 0 },
        { clientID: P2, username: "bravo", clanTag: "XY", verified: true },
      ],
      lobbyCreatorClientID: P1,
    },
  },
  {
    type: "lobby_info",
    myClientID: P2,
    lobby: {
      gameID: "gM3xQ1zR",
      serverTime: 1_700_000_000_000,
      gameConfig: { ...CONFIG, worldWar1936: true, historicalAi: true },
      clients: [
        { clientID: P1, username: "alpha", clanTag: null },
        { clientID: P2, username: "bravo", clanTag: null },
      ],
      countryPicks: [
        { clientID: P1, tag: "DEU" },
        { clientID: P2, tag: "GBR" },
      ],
    },
  },
  { type: "new_lobby", gameID: "nEwL0bby" },
  { type: "pong", sentAt: 12345 },
];

const TOKEN = "3f1b8c8e-4a2f-4a0e-9d5e-6f2a1b3c4d5e";

const CLIENT_MESSAGES: ClientMessage[] = [
  { type: "ping", sentAt: 12345 },
  { type: "hash", hash: 3735928559.5, turnNumber: 120 },
  {
    type: "intent",
    intent: { type: "attack", targetID: P3, troops: 17.25 },
  },
  {
    type: "join",
    token: TOKEN,
    gameID: "gM3xQ1zR",
    username: "alpha",
    clanTag: "ABC",
    turnstileToken: null,
    cosmetics: {
      flag: "country:us",
      patternName: "stripes_01",
      effects: { nukeTrail: "sparkle" },
      verified: true,
    },
  },
  {
    type: "rejoin",
    gameID: "gM3xQ1zR",
    lastTurn: 4321,
    token: TOKEN,
  },
  { type: "log", severity: LogSeverity.Warn, log: "abcd1234" },
  {
    type: "winner",
    winner: ["player", P1, P2],
    allPlayersStats: {
      [P1]: {
        attacks: [10n, 20n, 0n],
        gold: [1n, 2n, 3n, 4n, 5n, 6n],
        killedBy: null,
        deathPosition: 2,
        kills: [{ victim: P2, tick: 400n }],
        units: { city: [3n, 0n, 0n, 0n, 1n] },
      },
      [P2]: { betrayals: 1n, finalTiles: 5000n },
    },
  },
  {
    type: "live_stats",
    stats: {
      turn: 900,
      players: [
        {
          clientID: P1,
          tilesOwned: 1234,
          troops: 5000.5,
          gold: "123456789012345678901234567890",
          isAlive: true,
          team: null,
          killedBy: null,
          deathPosition: null,
        },
        {
          clientID: P2,
          tilesOwned: 0,
          troops: 0,
          gold: "0",
          isAlive: false,
          team: "Red",
          killedBy: P1,
          deathPosition: 3,
        },
      ],
    },
  },
  { type: "pick_country", tag: "SUN" },
  { type: "pick_country", tag: null },
];

const LOBBY_MESSAGES: PublicLobbyMessage[] = [
  {
    type: "full",
    serverTime: 1_700_000_000_000,
    games: {
      ffa: [
        {
          gameID: "gM3xQ1zR",
          numClients: 42,
          startsAt: 1_700_000_030_000,
          gameConfig: CONFIG,
          publicGameType: "ffa",
        },
        {
          gameID: "vAn1lla0",
          numClients: 7,
          startsAt: 1_700_000_030_000,
          gameConfig: VANILLA_CONFIG,
          publicGameType: "ffa",
        },
      ],
      hosted: [
        {
          gameID: "hOsT3d01",
          numClients: 3,
          publicGameType: "hosted",
          label: "Tournament finals 🏆",
          accent: "gold",
          featured: true,
        },
      ],
    },
  },
  {
    type: "counts",
    serverTime: 1_700_000_000_000,
    counts: { gM3xQ1zR: 42, hOsT3d01: 3 },
  },
];

// The JSON path a message would have taken before zbin, so binary decoding can
// be checked against it rather than against the in-memory literal alone.
function viaJson<T>(schema: { parse: (v: unknown) => T }, msg: unknown): T {
  return schema.parse(JSON.parse(JSON.stringify(msg, replacer)));
}

describe("zbin wire: sample coverage", () => {
  it("has a sample for every intent type", () => {
    const all = IntentSchema.options.map((o) => o.shape.type.value).sort();
    const sampled = [...new Set(SAMPLE_INTENTS.map((i) => i.type))].sort();
    expect(sampled).toEqual(all);
  });
});

describe("zbin wire: server messages", () => {
  it.each(SERVER_MESSAGES.map((m) => [m.type, m] as const))(
    "round-trips a %s message",
    (_type, msg) => {
      const [sctx, cctx] = ctxPair();
      const decoded = decodeServerMessage(encodeServerMessage(msg, sctx), cctx);
      expect(decoded).toEqual(viaJson(ServerMessageSchema, msg));
    },
  );

  it("encodes the start message without the dictionary", () => {
    // The start message carries the roster the receiver seeds its table from,
    // so a client that has no table yet must still be able to read it.
    const [sctx] = ctxPair();
    const start = SERVER_MESSAGES.find((m) => m.type === "start")!;
    const bytes = encodeServerMessage(start, sctx);
    expect(decodeServerMessage(bytes, undefined)).toEqual(
      viaJson(ServerMessageSchema, start),
    );
  });

  it("keeps an empty turn under 8 bytes", () => {
    const [sctx] = ctxPair();
    const bytes = encodeServerMessage(
      { type: "turn", turn: { turnNumber: 12345, intents: [] } },
      sctx,
    );
    expect(bytes.length).toBeLessThanOrEqual(8);
  });

  it("is much smaller than JSON for a realistic turn", () => {
    const [sctx] = ctxPair();
    const turn: Turn = {
      turnNumber: 12345,
      intents: [
        { type: "attack", clientID: P1, targetID: P2, troops: 5123.75 },
        {
          type: "build_unit",
          clientID: P2,
          unit: UnitType.Port,
          tile: 998877,
        },
      ],
    };
    const msg: ServerMessage = { type: "turn", turn };
    const jsonSize = JSON.stringify(msg).length;
    expect(encodeServerMessage(msg, sctx).length).toBeLessThan(jsonSize / 5);
  });

  it("rejects truncated frames", () => {
    const [sctx, cctx] = ctxPair();
    const bytes = encodeServerMessage(
      {
        type: "turn",
        turn: { turnNumber: 1, intents: SAMPLE_INTENTS.slice(0, 3) },
      },
      sctx,
    );
    for (let cut = 1; cut < bytes.length; cut++) {
      expect(() => decodeServerMessage(bytes.subarray(0, cut), cctx)).toThrow(
        ZbDecodeError,
      );
    }
  });

  it("rejects trailing bytes", () => {
    const [sctx, cctx] = ctxPair();
    const bytes = encodeServerMessage({ type: "ping" }, sctx);
    const padded = new Uint8Array(bytes.length + 1);
    padded.set(bytes);
    expect(() => decodeServerMessage(padded, cctx)).toThrow(ZbDecodeError);
  });

  it("unmapped ids (admin bot) survive via the inline escape", () => {
    const [sctx, cctx] = ctxPair();
    const msg: ServerMessage = {
      type: "turn",
      turn: {
        turnNumber: 5,
        intents: [
          {
            type: "toggle_pause",
            clientID: ADMIN_BOT_CLIENT_ID,
            paused: false,
          },
        ],
      },
    };
    expect(decodeServerMessage(encodeServerMessage(msg, sctx), cctx)).toEqual(
      msg,
    );
  });

  it("handles a 1000-client roster without losing the dictionary", () => {
    // Big events exceed the old one-byte table; indexes are varints now, so
    // every roster entry stays mapped (1 byte for the first 127, 2 after).
    const roster = Array.from({ length: 1000 }, (_, i) => ({
      clientID: `c${String(i).padStart(7, "0")}`,
    }));
    const sctx = createGameWireContext(roster);
    const cctx = createGameWireContext(roster);
    const turnOf = (clientID: string): ServerMessage => ({
      type: "turn",
      turn: {
        turnNumber: 1,
        intents: [{ type: "targetPlayer", clientID, target: clientID }],
      },
    });
    const early = encodeServerMessage(turnOf(roster[50].clientID), sctx);
    const late = encodeServerMessage(turnOf(roster[999].clientID), sctx);
    // Two mapped ids in the intent: 1 byte each early, 2 bytes each late.
    expect(late.length).toBe(early.length + 2);
    for (const p of [roster[0], roster[126], roster[127], roster[999]]) {
      expect(
        decodeServerMessage(
          encodeServerMessage(turnOf(p.clientID), sctx),
          cctx,
        ),
      ).toEqual(turnOf(p.clientID));
    }
  });

  it("fails loudly when the peers seeded different rosters", () => {
    const sctx = createGameWireContext(PLAYERS);
    const cctx = createGameWireContext(PLAYERS.slice(0, 1));
    const bytes = encodeServerMessage(
      {
        type: "turn",
        turn: {
          turnNumber: 1,
          intents: [{ type: "targetPlayer", clientID: P1, target: P3 }],
        },
      },
      sctx,
    );
    expect(() => decodeServerMessage(bytes, cctx)).toThrow(ZbDecodeError);
  });
});

describe("zbin wire: client messages", () => {
  it.each(CLIENT_MESSAGES.map((m) => [m.type, m] as const))(
    "round-trips a %s message",
    (_type, msg) => {
      const [cctx, sctx] = ctxPair();
      const decoded = decodeClientMessage(encodeClientMessage(msg, cctx), sctx);
      expect(decoded).toEqual(viaJson(ClientMessageSchema, msg));
    },
  );

  it("round-trips join and rejoin with no dictionary yet", () => {
    // Both are sent before the game starts, when neither peer has a table.
    for (const msg of CLIENT_MESSAGES.filter(
      (m) => m.type === "join" || m.type === "rejoin",
    )) {
      const decoded = decodeClientMessage(
        encodeClientMessage(msg, undefined),
        undefined,
      );
      expect(decoded).toEqual(viaJson(ClientMessageSchema, msg));
    }
  });

  it("keeps an attack intent to about a dozen bytes", () => {
    const [cctx] = ctxPair();
    const bytes = encodeClientMessage(
      { type: "intent", intent: { type: "attack", targetID: P2, troops: 500 } },
      cctx,
    );
    expect(bytes.length).toBeLessThanOrEqual(14);
  });

  it("preserves bigint stats exactly", () => {
    const [cctx, sctx] = ctxPair();
    const huge = 2n ** 200n + 12345n;
    const msg: ClientMessage = {
      type: "winner",
      winner: ["team", "Red", P1],
      allPlayersStats: { [P1]: { gold: [huge], betrayals: -7n } },
    };
    const decoded = decodeClientMessage(encodeClientMessage(msg, cctx), sctx);
    expect(decoded).toEqual(msg);
  });

  it("accepts stats that arrive as decimal strings", () => {
    // Engine values are bigints, but the same schema also reads archived JSON
    // where they are strings; both must encode to the same bytes.
    const [cctx, sctx] = ctxPair();
    const asBigint: ClientMessage = {
      type: "winner",
      winner: undefined,
      allPlayersStats: { [P1]: { betrayals: 42n } },
    };
    const asString = {
      ...asBigint,
      allPlayersStats: { [P1]: { betrayals: "42" } },
    };
    expect(
      encodeClientMessage(asString as unknown as ClientMessage, cctx),
    ).toEqual(encodeClientMessage(asBigint, cctx));
    expect(
      decodeClientMessage(encodeClientMessage(asBigint, cctx), sctx),
    ).toEqual(asBigint);
  });

  it("rejects truncated frames", () => {
    const [cctx, sctx] = ctxPair();
    const bytes = encodeClientMessage(
      { type: "hash", hash: 1.5, turnNumber: 300 },
      cctx,
    );
    for (let cut = 1; cut < bytes.length; cut++) {
      expect(() => decodeClientMessage(bytes.subarray(0, cut), sctx)).toThrow(
        ZbDecodeError,
      );
    }
  });

  it("rejects a payload that decodes but violates the schema", () => {
    // parseBytes runs full zod validation, so a structurally valid frame with
    // an out-of-range value is still rejected.
    const [cctx, sctx] = ctxPair();
    const bytes = encodeClientMessage(
      {
        type: "rejoin",
        gameID: "not a game id!" as never,
        lastTurn: 1,
        token: TOKEN,
      },
      cctx,
    );
    expect(() => decodeClientMessage(bytes, sctx)).toThrow();
  });
});

describe("zbin wire: lobby list messages", () => {
  it.each(LOBBY_MESSAGES.map((m) => [m.type, m] as const))(
    "round-trips a %s message",
    (_type, msg) => {
      const decoded = decodeLobbyMessage(encodeLobbyMessage(msg));
      expect(decoded).toEqual(viaJson(PublicLobbyMessageSchema, msg));
    },
  );

  // The lobby socket carries no player ids, so it gets no dictionary: the
  // saving here is structural (varints, no keys, no punctuation) only.
  it("shrinks the counts broadcast below JSON", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      counts[`g${String(i).padStart(7, "0")}`] = i * 3;
    }
    const msg: PublicLobbyMessage = {
      type: "counts",
      serverTime: 1_700_000_000_000,
      counts,
    };
    const jsonSize = JSON.stringify(msg).length;
    expect(encodeLobbyMessage(msg).length).toBeLessThan(jsonSize * 0.7);
  });

  it("shrinks the full snapshot well below JSON", () => {
    const msg = LOBBY_MESSAGES[0];
    const jsonSize = JSON.stringify(msg).length;
    expect(encodeLobbyMessage(msg).length).toBeLessThan(jsonSize / 3);
  });

  it("rejects corrupt frames", () => {
    const bytes = encodeLobbyMessage(LOBBY_MESSAGES[1]);
    expect(() => decodeLobbyMessage(bytes.subarray(0, 2))).toThrow(
      ZbDecodeError,
    );
  });
});
