// This fork's identity, in one place.
//
// LICENSE, "ADDITIONAL TERMS (AGPL v3 Section 7)": a modified version must not
// use "OpenFront" as its primary title or imply endorsement (7(c)), and must
// keep "© OpenFront and Contributors" visible (7(b), the `main.copyright`
// translation). AGPL section 13 obliges offering every player the source.
//
// To rename the game, change GAME_TITLE here, `branding.title` in
// resources/lang/ko.json (the Korean spelling), and the two names in
// resources/manifest.json (tests/Branding.test.ts checks the manifest).
// English text reads the name from here: en.json's `branding.title` is
// "{name}", and its callers pass { name: GAME_TITLE }.

/** The game's display name: page title, meta tags, menus, link previews. */
export const GAME_TITLE = "Statecraft";

/**
 * This fork's public repository. Its default branch mirrors upstream, so the
 * source offer (AGPL v3 section 13) links the running commit through
 * sourceTreeUrl, not this.
 */
export const SOURCE_URL = "https://github.com/0x1eso/front";

// A build id as the server's GIT_COMMIT spells it: a commit, full or
// abbreviated, which scripts/selfhost/game-night.sh suffixes with
// "-dirty-<hash>" for a build of uncommitted changes.
const BUILD_COMMIT_RE = /^([0-9a-f]{7,40})(?:-dirty-[0-9a-f]+)?$/i;

function commitOf(gitCommit: string): string | null {
  return BUILD_COMMIT_RE.exec(gitCommit.trim())?.[1] ?? null;
}

/**
 * The source of the commit a build runs (the server's GIT_COMMIT); the
 * repository itself when the build names no commit ("DEV").
 */
export function sourceTreeUrl(gitCommit: string): string {
  const commit = commitOf(gitCommit);
  return commit === null ? SOURCE_URL : `${SOURCE_URL}/tree/${commit}`;
}

/** CREDITS.md as of the commit a build runs; see sourceTreeUrl. */
export function creditsUrl(gitCommit: string): string {
  const commit = commitOf(gitCommit);
  return commit === null
    ? SOURCE_URL
    : `${SOURCE_URL}/blob/${commit}/CREDITS.md`;
}

/** The project this fork is based on. */
export const UPSTREAM_URL = "https://github.com/openfrontio/OpenFrontIO";

/** Favicon (resources/images/Emblem.svg, drawn for this fork). */
export const EMBLEM_ASSET = "images/Emblem.svg";
