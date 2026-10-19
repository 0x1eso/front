import { GameConfigPatch } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { GameEvent } from "@openfront/shared/EventBus";

// Sent from the lobby screens, which load before the game client: here, not
// in Transport, so emitting them doesn't pull the connection into the
// homepage's bundle.

export class SendKickPlayerIntentEvent implements GameEvent {
  constructor(public readonly target: string) {}
}

export class SendUpdateGameConfigIntentEvent implements GameEvent {
  constructor(public readonly config: GameConfigPatch) {}
}

export class SendToggleGameStartTimer implements GameEvent {
  constructor() {}
}

// Switch between playing and watching from the lobby screen.
export class SendSpectateEvent implements GameEvent {
  constructor(public readonly spectator: boolean) {}
}

// World War 1936 (spec §8.1): pick a country in the lobby (null gives it up).
export class SendPickCountryEvent implements GameEvent {
  constructor(public readonly tag: CountryTag | null) {}
}
