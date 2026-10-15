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

/** This fork's public source code (AGPL v3 section 13). */
export const SOURCE_URL = "https://github.com/0x1eso/front";

/** The project this fork is based on. */
export const UPSTREAM_URL = "https://github.com/openfrontio/OpenFrontIO";

/** Favicon (resources/images/Emblem.svg, drawn for this fork). */
export const EMBLEM_ASSET = "images/Emblem.svg";
