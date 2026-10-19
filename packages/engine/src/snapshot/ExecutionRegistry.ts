// Every entry is `<ClassName>Snapshot`, exported next to its class.
import { CongressExecutionSnapshot } from "../congress/CongressExecution";
import { CongressVoteExecutionSnapshot } from "../congress/CongressVoteExecution";
import { ConveneEmergencyExecutionSnapshot } from "../congress/ConveneEmergencyExecution";
import { ChooseGovernmentExecutionSnapshot } from "../domestic/ChooseGovernmentExecution";
import { DomesticExecutionSnapshot } from "../domestic/DomesticExecution";
import { ProclaimLawExecutionSnapshot } from "../domestic/ProclaimLawExecution";
import { QueueResearchExecutionSnapshot } from "../domestic/QueueResearchExecution";
import { ResearchExecutionSnapshot } from "../domestic/ResearchExecution";
import { SetRecruitTargetExecutionSnapshot } from "../domestic/SetRecruitTargetExecution";
import { VictoryProjectExecutionSnapshot } from "../domestic/VictoryProjectExecution";
import { AllianceExtensionExecutionSnapshot } from "../execution/alliance/AllianceExtensionExecution";
import { AllianceRejectExecutionSnapshot } from "../execution/alliance/AllianceRejectExecution";
import { AllianceRequestExecutionSnapshot } from "../execution/alliance/AllianceRequestExecution";
import { BreakAllianceExecutionSnapshot } from "../execution/alliance/BreakAllianceExecution";
import { AttackExecutionSnapshot } from "../execution/AttackExecution";
import { BoatRetreatExecutionSnapshot } from "../execution/BoatRetreatExecution";
import { CityExecutionSnapshot } from "../execution/CityExecution";
import { ConstructionExecutionSnapshot } from "../execution/ConstructionExecution";
import { DefensePostExecutionSnapshot } from "../execution/DefensePostExecution";
import { DeleteUnitExecutionSnapshot } from "../execution/DeleteUnitExecution";
import { DonateGoldExecutionSnapshot } from "../execution/DonateGoldExecution";
import { DonateTroopsExecutionSnapshot } from "../execution/DonateTroopExecution";
import { DoomsdayClockExecutionSnapshot } from "../execution/DoomsdayClockExecution";
import { EmbargoAllExecutionSnapshot } from "../execution/EmbargoAllExecution";
import { EmbargoExecutionSnapshot } from "../execution/EmbargoExecution";
import { EmojiExecutionSnapshot } from "../execution/EmojiExecution";
import { FactoryExecutionSnapshot } from "../execution/FactoryExecution";
import { MarkDisconnectedExecutionSnapshot } from "../execution/MarkDisconnectedExecution";
import { MirvExecutionSnapshot } from "../execution/MIRVExecution";
import { MissileSiloExecutionSnapshot } from "../execution/MissileSiloExecution";
import { MoveWarshipExecutionSnapshot } from "../execution/MoveWarshipExecution";
import { NationExecutionSnapshot } from "../execution/NationExecution";
import { NoOpExecutionSnapshot } from "../execution/NoOpExecution";
import { NukeExecutionSnapshot } from "../execution/NukeExecution";
import { PauseExecutionSnapshot } from "../execution/PauseExecution";
import { PlayerExecutionSnapshot } from "../execution/PlayerExecution";
import { PortExecutionSnapshot } from "../execution/PortExecution";
import { QuickChatExecutionSnapshot } from "../execution/QuickChatExecution";
import { RecomputeRailClusterExecutionSnapshot } from "../execution/RecomputeRailClusterExecution";
import { RetreatExecutionSnapshot } from "../execution/RetreatExecution";
import { SAMLauncherExecutionSnapshot } from "../execution/SAMLauncherExecution";
import { SAMMissileExecutionSnapshot } from "../execution/SAMMissileExecution";
import { ShellExecutionSnapshot } from "../execution/ShellExecution";
import { SpawnExecutionSnapshot } from "../execution/SpawnExecution";
import { SpawnTimerExecutionSnapshot } from "../execution/SpawnTimerExecution";
import { TargetPlayerExecutionSnapshot } from "../execution/TargetPlayerExecution";
import { TradeShipExecutionSnapshot } from "../execution/TradeShipExecution";
import { TrainExecutionSnapshot } from "../execution/TrainExecution";
import { TrainStationExecutionSnapshot } from "../execution/TrainStationExecution";
import { TransportShipExecutionSnapshot } from "../execution/TransportShipExecution";
import { TribeExecutionSnapshot } from "../execution/TribeExecution";
import { UpgradeStructureExecutionSnapshot } from "../execution/UpgradeStructureExecution";
import { WarshipExecutionSnapshot } from "../execution/WarshipExecution";
import { WinCheckExecutionSnapshot } from "../execution/WinCheckExecution";
import { ConventionalMissileExecutionSnapshot } from "../strategic/ConventionalMissileExecution";
import { NukeProductionExecutionSnapshot } from "../strategic/NukeProductionExecution";
import {
  SatelliteInterceptExecutionSnapshot,
  SatelliteTargetExecutionSnapshot,
} from "../strategic/SatelliteOrders";
import { StrategicExecutionSnapshot } from "../strategic/StrategicExecution";
import { AirportExecutionSnapshot } from "../warfare/AirportExecution";
import { BombingExecutionSnapshot } from "../warfare/BombingExecution";
import { CargoPlaneExecutionSnapshot } from "../warfare/CargoPlaneExecution";
import { CoastalBarrageExecutionSnapshot } from "../warfare/CoastalBarrageExecution";
import { CoastalBatteryExecutionSnapshot } from "../warfare/CoastalBatteryExecution";
import { ParadropExecutionSnapshot } from "../warfare/ParadropExecution";
import type { ExecutionSnapshotType } from "./ExecutionSnapshot";

/**
 * Every execution class, by the type name its snapshots are stored under.
 * A class missing here cannot be snapshotted (snapshotGame throws), and a
 * stored type missing here cannot be restored. Retiring a class means
 * keeping an entry whose restoreSnapshot maps old records onto whatever
 * replaced it.
 */
export const EXECUTION_SNAPSHOT_TYPES = [
  AirportExecutionSnapshot,
  AllianceExtensionExecutionSnapshot,
  AllianceRejectExecutionSnapshot,
  AllianceRequestExecutionSnapshot,
  AttackExecutionSnapshot,
  BoatRetreatExecutionSnapshot,
  BombingExecutionSnapshot,
  BreakAllianceExecutionSnapshot,
  CargoPlaneExecutionSnapshot,
  ChooseGovernmentExecutionSnapshot,
  CityExecutionSnapshot,
  CoastalBarrageExecutionSnapshot,
  CoastalBatteryExecutionSnapshot,
  CongressExecutionSnapshot,
  CongressVoteExecutionSnapshot,
  ConveneEmergencyExecutionSnapshot,
  ConventionalMissileExecutionSnapshot,
  ConstructionExecutionSnapshot,
  DefensePostExecutionSnapshot,
  DeleteUnitExecutionSnapshot,
  DomesticExecutionSnapshot,
  DonateGoldExecutionSnapshot,
  DonateTroopsExecutionSnapshot,
  DoomsdayClockExecutionSnapshot,
  EmbargoAllExecutionSnapshot,
  EmbargoExecutionSnapshot,
  EmojiExecutionSnapshot,
  FactoryExecutionSnapshot,
  MarkDisconnectedExecutionSnapshot,
  MirvExecutionSnapshot,
  MissileSiloExecutionSnapshot,
  MoveWarshipExecutionSnapshot,
  NationExecutionSnapshot,
  NoOpExecutionSnapshot,
  NukeExecutionSnapshot,
  NukeProductionExecutionSnapshot,
  ParadropExecutionSnapshot,
  PauseExecutionSnapshot,
  PlayerExecutionSnapshot,
  PortExecutionSnapshot,
  ProclaimLawExecutionSnapshot,
  QuickChatExecutionSnapshot,
  RecomputeRailClusterExecutionSnapshot,
  QueueResearchExecutionSnapshot,
  ResearchExecutionSnapshot,
  RetreatExecutionSnapshot,
  SAMLauncherExecutionSnapshot,
  SAMMissileExecutionSnapshot,
  SatelliteInterceptExecutionSnapshot,
  SatelliteTargetExecutionSnapshot,
  SetRecruitTargetExecutionSnapshot,
  ShellExecutionSnapshot,
  SpawnExecutionSnapshot,
  SpawnTimerExecutionSnapshot,
  StrategicExecutionSnapshot,
  TargetPlayerExecutionSnapshot,
  TradeShipExecutionSnapshot,
  TrainExecutionSnapshot,
  TrainStationExecutionSnapshot,
  TransportShipExecutionSnapshot,
  TribeExecutionSnapshot,
  UpgradeStructureExecutionSnapshot,
  VictoryProjectExecutionSnapshot,
  WarshipExecutionSnapshot,
  WinCheckExecutionSnapshot,
] as unknown as readonly ExecutionSnapshotType<unknown>[];
