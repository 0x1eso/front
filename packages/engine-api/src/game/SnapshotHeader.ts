import { ClientID, GameConfig } from "../Schemas";

/** What a snapshot holds that a host needs before it can restore it. */
import type { GwTag } from "../ww1914/GwCountries";

export interface SnapshotHeader {
  format: number;
  gitCommit: string;
  gameID: string | null;
  tick: number;
  gameConfig: GameConfig;
  /** The human players, by the clientID their intents must carry. */
  humans: { clientID: ClientID; name: string }[];
  /** Great War 1914: what a resume lobby shows of the save. */
  greatWar?: GwSaveHeader;
}

export interface GwSaveHeader {
  seats: GwTag[];
  chapter: number;
  /** YYYY-MM-DD. */
  date: string;
}
