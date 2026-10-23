import { ClientID } from "@openfront/engine-api/Schemas";
import { RateLimiter } from "limiter";

const INTENTS_PER_SECOND = 10;
const INTENTS_PER_MINUTE = 150;
const MAX_INTENT_SIZE = 2000;
// A rejoin makes the server serialize and send the turn history since
// `lastTurn`, which is the full game so far when lastTurn is 0. A real client
// only sends one per (re)connect, so anything beyond a handful per minute is
// abuse.
const REJOINS_PER_MINUTE = 5;
// Final review D (D3): a lobby toggle — a World War 1936 country pick or
// release (`pick_country`), or the Play/Spectate switch (`spectate`) —
// makes the server send the whole lobby list to every member. A 3-byte
// message would otherwise buy about a million broadcasts before the 5 MB
// cap; a person taps a few a second at most. Both share one bucket.
const LOBBY_TOGGLES_PER_SECOND = 5;
const LOBBY_TOGGLES_PER_MINUTE = 60;
const LOBBY_TOGGLES = new Set(["pick_country", "spectate"]);
const TOTAL_BYTES = 5 * 1024 * 1024; // 5MB per client
export type RateLimitResult = "ok" | "limit" | "kick";

interface ClientBucket {
  perSecond: RateLimiter;
  perMinute: RateLimiter;
  rejoinPerMinute: RateLimiter;
  lobbyPerSecond: RateLimiter;
  lobbyPerMinute: RateLimiter;
  totalBytes: number;
}

export class ClientMsgRateLimiter {
  private buckets = new Map<ClientID, ClientBucket>();

  check(clientID: ClientID, type: string, bytes: number): RateLimitResult {
    const bucket = this.getOrCreate(clientID);
    bucket.totalBytes += bytes;

    if (bucket.totalBytes >= TOTAL_BYTES) return "kick";

    if (type === "intent") {
      // Intents are stored in turn history for the duration of the game, so
      // oversized intents would accumulate and fill up server RAM.
      // Intents are also sent to all players, so it increase outgoing
      // data.
      // Intents should never be larger than MAX_INTENT_SIZE, so we assume the client is malicious.
      if (bytes > MAX_INTENT_SIZE) {
        return "kick";
      }
      if (
        !bucket.perSecond.tryRemoveTokens(1) ||
        !bucket.perMinute.tryRemoveTokens(1)
      ) {
        return "limit";
      }
    } else if (type === "rejoin") {
      if (!bucket.rejoinPerMinute.tryRemoveTokens(1)) {
        return "limit";
      }
    } else if (LOBBY_TOGGLES.has(type)) {
      if (
        !bucket.lobbyPerSecond.tryRemoveTokens(1) ||
        !bucket.lobbyPerMinute.tryRemoveTokens(1)
      ) {
        return "limit";
      }
    }

    return "ok";
  }

  private getOrCreate(clientID: ClientID): ClientBucket {
    const existing = this.buckets.get(clientID);
    if (existing) {
      return existing;
    }
    const bucket = {
      perSecond: new RateLimiter({
        tokensPerInterval: INTENTS_PER_SECOND,
        interval: "second",
      }),
      perMinute: new RateLimiter({
        tokensPerInterval: INTENTS_PER_MINUTE,
        interval: "minute",
      }),
      rejoinPerMinute: new RateLimiter({
        tokensPerInterval: REJOINS_PER_MINUTE,
        interval: "minute",
      }),
      lobbyPerSecond: new RateLimiter({
        tokensPerInterval: LOBBY_TOGGLES_PER_SECOND,
        interval: "second",
      }),
      lobbyPerMinute: new RateLimiter({
        tokensPerInterval: LOBBY_TOGGLES_PER_MINUTE,
        interval: "minute",
      }),
      totalBytes: 0,
    };
    this.buckets.set(clientID, bucket);
    return bucket;
  }
}
