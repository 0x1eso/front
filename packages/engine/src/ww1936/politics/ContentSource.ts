// World War 1936 P3 (plan decision 7): where the engine gets its content.
import {
  CONTENT,
  ContentRegistry,
} from "@openfront/engine-lib/ww1936/content/registry";

let override: ContentRegistry | null = null;

/** Tests only (plan decision 7): the content the next WorldWar gets. */
export function usePoliticsContent(reg: ContentRegistry | null): void {
  override = reg;
}

export function politicsContent(): ContentRegistry {
  return override ?? CONTENT;
}
