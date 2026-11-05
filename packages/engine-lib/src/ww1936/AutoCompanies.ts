// World War 1936 ww107: the automatic support companies. A default template
// carries only what the stock can equip; its other companies join one at a
// time, once their tech is open and the stock can fill them. The pure rule,
// called by the engine (land/AutoCompanies) and read by the template card.
import {
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  NEED_GROUPS,
  NeedGroup,
  SUPPORT_IDS,
  SupportId,
  TemplateDef,
  wwMaxSupport,
} from "@openfront/engine-api/ww1936/LandTypes";
import { SUPPORTS } from "./Battalions";

/** Days between checks: a country's check falls on a day of its own. */
export const WW_AUTO_COMPANY_DAYS = 30;
/** A company joins when the stock fills it in this share of the template's divisions, ‰. */
export const WW_AUTO_COMPANY_FILL_PM = 800;
/** The AI's training gate: stock against one division's need, ‰ (aiTrainPlan). */
export const AI_TRAIN_FILL_PM = 500;

/** The guide's companies, in its order: engineers first, then recon. */
const LINE_TARGET: readonly SupportId[] = [
  "engineer",
  "recon",
  "support_artillery",
  "support_anti_tank",
];
const NO_TARGET: readonly SupportId[] = [];
/** A template of four battalions carries two companies: the guide's are these. */
const ASSAULT_TARGET: readonly SupportId[] = ["engineer", "support_artillery"];
/** The narrow assault line's preset id. */
export const ASSAULT_LINE_KEY = "pre_guide_assault9";

/** Garrisons stay as they are, and so do the Soviet mountain rifles. */
const NO_COMPANIES: ReadonlySet<string> = new Set([
  "colonial",
  "colonial_garrison",
  "garrison",
  "mountain_rifle",
]);

/** The companies a template of `key` works towards ("": a player's own, the line's). */
export function autoCompanyTarget(key: string): readonly SupportId[] {
  if (NO_COMPANIES.has(key)) return NO_TARGET;
  return key === ASSAULT_LINE_KEY ? ASSAULT_TARGET : LINE_TARGET;
}

/** A template with something to add has the switch. */
export const hasAutoCompanies = (key: string): boolean =>
  autoCompanyTarget(key).length > 0;

/** The bit of `s` in a template's `autoDropped`. */
export const companyBit = (s: SupportId): number =>
  1 << SUPPORT_IDS.indexOf(s);

const groupOf = (t: NeedGroup): number => NEED_GROUPS.indexOf(t);

export interface AutoCompanyInput {
  def: TemplateDef;
  target: readonly SupportId[];
  researched: ReadonlySet<WwTechId>;
  /** The divisions on the template, in the field and in training. */
  divisions: number;
  /** Stock free for it per need group: what divisions are still owed is not. */
  free: readonly number[];
  /** Companies the AI gave up for want of gear (companyBit). */
  dropped: number;
}

/**
 * The next company for a template, or null. In target order; a company with
 * its tech closed waits and the next one goes on, and one the stock can't fill
 * holds back the companies after it on the same gear. A company given up comes
 * back only when the stock fills every division and leaves a division's worth
 * to train on: what the drop gave back is never enough, so it can't flip.
 */
export function nextAutoCompany(i: AutoCompanyInput): SupportId | null {
  const { support, battalions } = i.def;
  if (support.length >= wwMaxSupport(battalions.length)) return null;
  const n = Math.max(1, i.divisions);
  const held = new Set<number>();
  for (const s of i.target) {
    if (support.includes(s)) continue;
    const d = SUPPORTS[s];
    if (d.techs.some((t) => !i.researched.has(t))) continue;
    if (d.equip.some(([t]) => held.has(groupOf(t)))) continue;
    const back = (i.dropped & companyBit(s)) !== 0;
    const fills = d.equip.every(([t, k]) => {
      const free = i.free[groupOf(t)] ?? 0;
      return back
        ? free >= k * (n + 1)
        : free * 1000 >= WW_AUTO_COMPANY_FILL_PM * k * n;
    });
    if (fills) return s;
    for (const [t] of d.equip) held.add(groupOf(t));
  }
  return null;
}
