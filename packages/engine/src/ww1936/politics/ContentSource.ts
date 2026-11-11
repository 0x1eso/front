// World War 1936 P3 (plan decision 7): where the engine gets its content.
import { imjinContent } from "@openfront/engine-lib/imjin/Content";
import {
  CONTENT,
  ContentRegistry,
} from "@openfront/engine-lib/ww1936/content/registry";
import type { WwScenarioId } from "@openfront/engine-lib/ww1936/scenario/Profile";

let override: ContentRegistry | null = null;

/** Tests only (plan decision 7): the content the next WorldWar gets. */
export function usePoliticsContent(reg: ContentRegistry | null): void {
  override = reg;
}

/** ww177: the profile's content (the Imjin War's until P6 writes its own). */
export function politicsContent(
  scenario: WwScenarioId = "ww1936",
): ContentRegistry {
  if (override !== null) return override;
  return scenario === "imjin1590" ? imjinContent() : CONTENT;
}
