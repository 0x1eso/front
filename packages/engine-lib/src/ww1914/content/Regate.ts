// Great War 1914 (ww170 S3, design ww168 B4): scenes come by state, not by date.
// What counts as waiting for a date, the scenes allowed to, and the ones the
// hand lanes still have to re-gate. tests/ww1914/DateGates.test.ts holds the
// content to it; scripts/ww1914-regate.ts did the mechanical part.
import type { GwAct } from "@openfront/engine-api/ww1914/GwActs";
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_REGATE_PENDING_IDS } from "./RegatePending";

/**
 * Calendar-true scenes: they may keep a world `date` (Christmas, a birthday, a
 * budget year). Anything seasonal should use world `month` instead, which is
 * always allowed. Add an id here with the reason beside it.
 */
export const GW_CALENDAR_SCENES: readonly string[] = [
  // FRA: the year's close, the 1914 table's last chapter (New Year's Day 1915).
  "fra_c_closing",
  // The y1914 game's last page, on 1 January 1915: the year really ends.
  "gbr_c_closing",
  "rus_c_closing",
  // The American presidential election of November 1916: a fixed day.
  "gw_o_usa_election",
  // Marie is Queen of Romania from King Carol's death (10 Oct 1914): her
  // letters to her kin in Berlin and Petrograd come after it.
  "deu_dept_kin_rou",
  "rus_dept_kin_rou",
  "deu_a_marie",
  "rus_a_l_marie",
];

/**
 * Scenes and acts the script left for the five hand lanes, listed in
 * /home/eser/dev/ww170-regate-hand.md. Take an id out once it is re-gated;
 * the check fails on an id that no longer waits for a date.
 */
export const GW_REGATE_PENDING: ReadonlySet<string> = new Set(
  GW_REGATE_PENDING_IDS,
);

/**
 * Why a scene or act waits for a date, or [] when it doesn't. A date is a world
 * `date`, a `chapter` past the opening weeks, a `stage` condition, or a stage
 * list that keeps it to 1914 (`crisis`/`y1914` without `war`). Allowed: a
 * chapter inside the opening weeks (max 5, or a lower bound of 5 or less), the
 * stage `crisis` alone, a 1914 stage with such a chapter beside it, and stage
 * lists with `war` in them (the design kept them: B4 "state-gated draws").
 */
export function dateGates(
  x: Pick<GwScene | GwAct, "when" | "stage">,
): string[] {
  const out: string[] = [];
  let opening = false;
  const walk = (c: GwCond | undefined, top: boolean) => {
    if (c === undefined) return;
    switch (c.kind) {
      case "all":
        return c.of.forEach((y) => walk(y, top));
      case "any":
        return c.of.forEach((y) => walk(y, false));
      case "not":
        return walk(c.of, false);
      case "chapter": {
        const max = c.max;
        const early =
          (max !== undefined && max <= 5) ||
          (max === undefined && (c.min ?? 0) <= 5);
        if (!early) out.push(`chapter ${c.min ?? ""}..${max ?? ""}`);
        else if (top && max !== undefined) opening = true;
        return;
      }
      case "stage":
        out.push(`stage condition ${c.stage}`);
        return;
      case "world":
        // The July chain runs only in the crisis: as good as the opening weeks.
        if (c.of.is === "chain" && top) opening = true;
        if (c.of.is === "date") {
          out.push(`date ${c.of.from ?? ""}..${c.of.to ?? ""}`);
        }
        return;
      default:
        return;
    }
  };
  walk(x.when, true);
  const st = x.stage ?? [];
  const only1914 =
    st.length > 0 &&
    !st.includes("war") &&
    st.some((s) => s === "crisis" || s === "y1914");
  const crisisOnly = st.length === 1 && st[0] === "crisis";
  if (only1914 && !crisisOnly && !opening) out.push(`stage ${st.join("+")}`);
  return out;
}
