import { creditsUrl, sourceTreeUrl } from "@openfront/shared/Branding";
import { ClientEnv } from "./ClientEnv";

// The source offer (AGPL v3 section 13) names the commit this page's server
// runs. ClientEnv.get() throws without a BOOTSTRAP_CONFIG; a link must never
// take the page down, so "" (no commit known) links the repository instead.
function runningCommit(): string {
  try {
    return ClientEnv.gitCommit();
  } catch {
    return "";
  }
}

/** The source of the code this page runs. */
export function runningSourceUrl(): string {
  return sourceTreeUrl(runningCommit());
}

/** CREDITS.md as of the code this page runs. */
export function runningCreditsUrl(): string {
  return creditsUrl(runningCommit());
}
