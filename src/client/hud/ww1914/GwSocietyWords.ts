// Great War 1914 (ww207, lane C): the society's and the utopias' words, for
// the strip, the faction card, the 정국 tab and the election card (U1 draws
// them). Words, never numbers: support, trust, size and the axes' places all
// come out as words. See /home/eser/dev/ww207-format.md.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import {
  GW_AXIS_MAX,
  GW_TRUST_MAX,
  GW_TRUST_WORDS,
  type GwAxis,
  type GwAxisSide,
  type GwElectionCause,
  type GwElectionRule,
  type GwFranchise,
  type GwNodeKind,
  type GwNodeTier,
  type GwTreeTemplate,
} from "@openfront/engine-api/ww1914/GwSociety";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.trunc(n)));

/** An axis's name on the 정국 tab: 왕권과 의회. */
export function axisName(tag: GwTag, axis: GwAxis): string {
  return translateText(`gw.society.axis.${axis}.${tag}.name`);
}

/** One side of an axis: -1 the first word (왕권), +1 the second (의회). */
export function axisSide(tag: GwTag, axis: GwAxis, side: GwAxisSide): string {
  const key = side < 0 ? "minus" : "plus";
  return translateText(`gw.society.axis.${axis}.${tag}.${key}`);
}

/** Where the country stands on an axis, step -3..3, in a line ("의회 쪽으로 기울었다"). */
export function leanLine(tag: GwTag, axis: GwAxis, step: number): string {
  const at = clamp(step, -GW_AXIS_MAX, GW_AXIS_MAX) + GW_AXIS_MAX;
  return translateText(`gw.society.lean.${axis}.${tag}.${at}`);
}

/** Trust -3..3 as a word: 적대 .. 충성. */
export function trustWord(trust: number): string {
  const w = GW_TRUST_WORDS[clamp(trust, -GW_TRUST_MAX, GW_TRUST_MAX) + 3];
  return translateText(`gw.society.trust.${w}`);
}

/** A community's size 1..5 as words: 한 줌 .. 나라의 절반. */
export function sizeWord(size: number): string {
  return translateText(`gw.society.size.${clamp(size, 1, 5)}`);
}

const SUPPORT_BANDS = [
  "none",
  "faint",
  "faint",
  "small",
  "small",
  "fair",
  "fair",
  "strong",
  "strong",
  "sweeping",
  "sweeping",
] as const;

/** A faction's support 0..10 as words on its card. */
export function supportWord(support: number): string {
  const band = SUPPORT_BANDS[clamp(support, 0, SUPPORT_BANDS.length - 1)];
  return translateText(`gw.society.support.${band}`);
}

export function franchiseWord(f: GwFranchise): string {
  return translateText(`gw.society.franchise.${f}`);
}

/** The election card: why it came, and the chamber's rule. */
export function electionCause(cause: GwElectionCause): string {
  return translateText(`gw.society.election.cause.${cause}`);
}

export function electionRule(rule: GwElectionRule): string {
  return translateText(`gw.society.election.rule.${rule}`);
}

/** When the next election is due, in words: chapters to it, or null for none. */
export function electionDue(chapters: number | null): string {
  const key =
    chapters === null
      ? "none"
      : chapters <= 2
        ? "soon"
        : chapters <= 6
          ? "near"
          : "far";
  return translateText(`gw.society.election.due.${key}`);
}

/** A faction's line on the election card, by its seats before and after. */
export function electionLine(
  name: string,
  before: number,
  after: number,
): string {
  const key =
    before === 0 && after > 0
      ? "entered"
      : after === 0 && before > 0
        ? "out"
        : after > before
          ? "gained"
          : after < before
            ? "lost"
            : "held";
  return applyJosa(
    translateText(`gw.society.election.${key}`, { faction: name }),
  );
}

/** "새 당" on a born chip, "사라진 당" on a gone one. */
export function chipWord(kind: "new" | "gone"): string {
  return translateText(kind === "new" ? "gw.society.new" : "gw.society.gone");
}

const GENERIC_NATIONALIST = /^([a-z]{3})_g_nationalist_(.+)$/;

/**
 * A faction's name: the pack's, else a generic nationalist party named after
 * its community (`auh_g_nationalist_czechs` -> 체코인 민족당), else null.
 */
export function factionName(pack: GwPack | null, id: string): string | null {
  const own = pack?.factions?.[id]?.name;
  if (own !== undefined) return own;
  const m = GENERIC_NATIONALIST.exec(id);
  if (m === null) return null;
  const community = pack?.communities?.[`${m[1]}_${m[2]}`]?.name;
  return community === undefined
    ? null
    : translateText("gw.society.generic_nationalist", { community });
}

// ---- Utopias ----

export function templateName(t: GwTreeTemplate): string {
  return translateText(`gw.utopia.template.${t}.name`);
}

/** A utopia's name: the pack's (사회민주 독일), else its template's. */
export function utopiaName(
  pack: GwPack | null,
  utopia: string,
  template: GwTreeTemplate,
): string {
  return (
    pack?.utopia?.[utopia]?.name ??
    translateText(`gw.utopia.template.${template}.utopia`)
  );
}

export function utopiaNote(
  pack: GwPack | null,
  utopia: string,
  template: GwTreeTemplate,
): string {
  return (
    pack?.utopia?.[utopia]?.note ??
    translateText(`gw.utopia.template.${template}.note`)
  );
}

/** A node's name and note: the faction's own words, else the template's. */
export function nodeText(
  pack: GwPack | null,
  utopia: string,
  template: GwTreeTemplate,
  node: string,
): { name: string; note: string } {
  const own = pack?.utopia?.[utopia]?.nodes?.[node];
  return {
    name: own?.name ?? translateText(`gw.utopia.node.${template}.${node}.name`),
    note: own?.note ?? translateText(`gw.utopia.node.${template}.${node}.note`),
  };
}

export function institutionName(id: string): string {
  return translateText(`gw.utopia.institution.${id}`);
}

export function tierWord(tier: GwNodeTier): string {
  return translateText(`gw.utopia.tier.${tier}`);
}

export function kindWord(kind: GwNodeKind): string {
  return translateText(`gw.utopia.kind.${kind}`);
}

/** Why a node or a realisation is not offered: GwNodeView `why`. */
export function utopiaWhy(key: string): string {
  return translateText(`gw.utopia.why.${key}`);
}
