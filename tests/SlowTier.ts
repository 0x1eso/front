// The slow test tier: files `npm test` skips and `npm run test:slow` runs.
// See docs/Testing.md for when to run it.
//
// A file is here when it spends 5 s or more running its tests alone (measured
// 2026-11-09 with --maxWorkers=1), or when it is a timing benchmark (*Perf*)
// whose numbers are noise on a shared machine. Nothing here is skipped for
// good: every file still runs in the slow tier, and naming one on the command
// line (`npx vitest tests/ww1936/AiLand.test.ts --run`) runs it as before.
//
// The safety net stays in the default tier even where it is slow:
// WorldWarSnapshot (~2.5 min alone), VanillaDigest, GreatWarSnapshot,
// LayerBoundaries and TranslationSystem.
//
// Paths are relative to the repo root; a glob must end in `.test.ts`, since
// the slow projects use these entries as their `include`.
export const SLOW_TESTS: readonly string[] = [
  // Timing benchmarks.
  "tests/perf/**/*.test.ts",
  "tests/ww1936/DepthPerf.test.ts",
  "tests/ww1936/EconomyPerf.test.ts",
  "tests/ww1936/EndgamePerf.test.ts",
  "tests/ww1936/LandPerf.test.ts",
  "tests/ww1936/NavyPerf.test.ts",
  "tests/ww1936/PlaneSwapPerf.test.ts",
  "tests/ww1936/SeaAirPerf.test.ts",
  "tests/ww1936/TankSwapPerf.test.ts",

  // World War 1936: games played for months or years, AI runs, many seeds.
  "tests/ww1936/AiEconomy.test.ts",
  "tests/ww1936/AiFrontsMove.test.ts",
  "tests/ww1936/AiLand.test.ts",
  "tests/ww1936/AiPlansWiring.test.ts",
  "tests/ww1936/AiPolitics.test.ts",
  "tests/ww1936/AiWarOrders.test.ts",
  "tests/ww1936/AiWings.test.ts",
  "tests/ww1936/Automation.test.ts",
  "tests/ww1936/Bands.test.ts",
  "tests/ww1936/Battles.test.ts",
  "tests/ww1936/CombatOverhaul.test.ts",
  "tests/ww1936/Conference.test.ts",
  "tests/ww1936/DefaultTemplates.test.ts",
  "tests/ww1936/DesignsGame.test.ts",
  "tests/ww1936/Events.test.ts",
  "tests/ww1936/FastUnlimited.test.ts",
  "tests/ww1936/Focus.test.ts",
  "tests/ww1936/FreeMilitary.test.ts",
  "tests/ww1936/GbrAltHistory.test.ts",
  "tests/ww1936/HistEngine.test.ts",
  "tests/ww1936/Ideology.test.ts",
  "tests/ww1936/IntelLevels.test.ts",
  "tests/ww1936/JpnAltHistory.test.ts",
  "tests/ww1936/MapEdge.test.ts",
  "tests/ww1936/NationAi.test.ts",
  "tests/ww1936/NegPeace.test.ts",
  "tests/ww1936/Occupation.test.ts",
  "tests/ww1936/Paradrop.test.ts",
  "tests/ww1936/PeaceAssignWorld.test.ts",
  "tests/ww1936/PeaceOffersW88.test.ts",
  "tests/ww1936/StartConvert.test.ts",
  "tests/ww1936/StartOob.test.ts",
  "tests/ww1936/SunAltHistory.test.ts",
  "tests/ww1936/SupportCompanies.test.ts",
  "tests/ww1936/TaiwanSupply.test.ts",
  "tests/ww1936/ThoughtIntegration.test.ts",
  "tests/ww1936/UsaFascist.test.ts",
  "tests/ww1936/Victory.test.ts",
  "tests/ww1936/WingsLive.test.ts",
  "tests/ww1936/WorldLockstep.test.ts",

  // World War 1936: long snapshot round trips (the *Basic files stay default).
  "tests/ww1936/AirSnapshot.test.ts",
  "tests/ww1936/DepthSnapshot.test.ts",
  "tests/ww1936/EconomySnapshot.test.ts",
  "tests/ww1936/EndgameSnapshot.test.ts",
  "tests/ww1936/LandSnapshot.test.ts",
  "tests/ww1936/NavySnapshot.test.ts",
  "tests/ww1936/PoliticsSnapshot.test.ts",

  // Great War 1914: whole-game runs.
  "tests/ww1914/Acts.test.ts",
  "tests/ww1914/AuhAct.test.ts",
  "tests/ww1914/BudgetGame.test.ts",
  "tests/ww1914/Content.test.ts",
  "tests/ww1914/Desk.test.ts",
  "tests/ww1914/Friends.test.ts",
  "tests/ww1914/GbrPrologue.test.ts",
  "tests/ww1914/Government.test.ts",
  "tests/ww1914/GwSim.test.ts",
  "tests/ww1914/Integration.test.ts",
  "tests/ww1914/Laws.test.ts",
  "tests/ww1914/PairWarSim.test.ts",
  "tests/ww1914/PressGame.test.ts",
  "tests/ww1914/RulerGame.test.ts",
  "tests/ww1914/Seats.test.ts",
  "tests/ww1914/World.test.ts",

  // Vanilla: full-game snapshots and long nation runs.
  "tests/NationGoldPerMinute.test.ts",
  "tests/TradeTrainScenarios.test.ts",
  "tests/client/replay/codec/NationsWorld.test.ts",
  "tests/core/snapshot/FullGameSnapshot.test.ts",
  "tests/core/snapshot/NationExecutions.test.ts",

  // jsdom suites that build whole panels.
  "tests/client/InventoryModal.test.ts",
  "tests/client/RewardTrack.test.ts",
  "tests/client/components/LobbyPlayerView.badgeFill.test.ts",
  "tests/client/ww1914/GwSeams.test.ts",
  "tests/client/ww1936/AutoBuild.test.ts",
  "tests/client/ww1936/FogEquivalence.test.ts",

  // Self-host script: starts and stops game-night.sh in a scratch repo.
  "tests/SelfHostScript.test.ts",
];
