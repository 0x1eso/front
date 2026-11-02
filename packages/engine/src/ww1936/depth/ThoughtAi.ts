// World War 1936 military thought sliders (design §9): the AI's judgement
// of its nine slider targets. Lane T2 fills this in; until then it never
// moves a target.
import type { WwDepth } from "./WwDepth";

/**
 * The new nine target notches on the country's judgement day, or null (not
 * its day, or nothing to change). Pure: reads `d`, writes nothing.
 */
export function aiThoughtTargets(
  d: WwDepth,
  id: number,
  day: number,
): number[] | null {
  void d;
  void id;
  void day;
  return null;
}
