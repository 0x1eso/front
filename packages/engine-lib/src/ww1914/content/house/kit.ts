// Authoring words for the house files (content/house/<tag>.ts). See
// /home/eser/dev/ww158-format.md.
import type {
  GwAskStage,
  GwFactionStatus,
  GwLawOrigin,
  GwVoteBand,
  GwWhipWord,
} from "@openfront/engine-api/ww1914/GwHouse";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwWho,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

// ---- Conditions ----
export { low } from "../laws/kit";
/** Chapters since the war began. */
export const warAge = (min: number): GwCond => world({ is: "war_age", min });
/** The law is in force. */
export const isLaw = (law: string): GwCond =>
  world({ is: "law", id: law, of: ["force"] });
/** A faction's status (any if none given) and strength range. */
export const faction = (
  id: string,
  o: { of?: GwFactionStatus[]; min?: number; max?: number } = {},
): GwCond => world({ is: "faction", id, ...o });
/** A faction's temper, 0 따른다 .. 4 말이 없다. */
export const temper = (id: string, min: number, max?: number): GwCond =>
  world(
    max === undefined
      ? { is: "faction_temper", id, min }
      : { is: "faction_temper", id, min, max },
  );
export const asks = (id: string, law: string): GwCond =>
  world({ is: "faction_asks", id, law });
export const wants = (id: string, want: string): GwCond =>
  world({ is: "faction_want", id, want });
export const dealt = (id: string): GwCond => world({ is: "deal", id });
export const band = (...of: GwVoteBand[]): GwCond =>
  world({ is: "vote_band", of });
export const origin = (law: string, ...of: GwLawOrigin[]): GwCond =>
  world({ is: "law_origin", id: law, of });
export const whipSaid = (...of: GwWhipWord[]): GwCond =>
  world({ is: "whip_said", of });
export const aroundUsed = (min: number): GwCond => world({ is: "around", min });

// ---- Effects ----
export const heat = (id: string, by = 1): GwEffect =>
  doWorld({ do: "faction", id, delta: by });
export const cool = (id: string, by = 1): GwEffect =>
  doWorld({ do: "faction", id, delta: -by });
export const grow = (id: string, delta: number): GwEffect =>
  doWorld({ do: "faction_grow", id, delta });
/** Only from a written decision: arrests are consequences, never a button. */
export const under = (id: string): GwEffect =>
  doWorld({ do: "faction_under", id });
export const startLaw = (law: string, from: GwLawOrigin): GwEffect =>
  doWorld({ do: "law_start", law, origin: from });

// ---- Cast ----
export const leaderOf = (id: string): GwCastRule => ({ faction_leader: id });

// ---- S2: plots, the dossier, allies ----
export const signsOpened = (id: string, min: number): GwCond =>
  world({ is: "plot_signs", id, min });
export const warned = (id: string): GwCond => world({ is: "plot_warned", id });
export const hasFile = (
  who: GwWho,
  ...of: ("held" | "used" | "out")[]
): GwCond =>
  world(of.length === 0 ? { is: "file", who } : { is: "file", who, of });
export const askAt = (id: string, ...of: GwAskStage[]): GwCond =>
  world({ is: "ask", id, of });
export const plotSign = (id: string): GwEffect =>
  doWorld({ do: "plot_sign", id });
export const plotWarn = (id: string): GwEffect =>
  doWorld({ do: "plot_warn", id });
export const gatherFile = (who: GwWho): GwEffect =>
  doWorld({ do: "file", who });
export const hold = (who: GwWho): GwEffect => doWorld({ do: "hold", who });
export const answerAsk = (id: string, yes: boolean): GwEffect =>
  doWorld({ do: "ask", id, answer: yes ? "yes" : "no" });
