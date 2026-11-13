import type { SavedGame, SavedGameInfo } from "@openfront/shared/ApiSchemas";
import { translateText } from "./Utils";

// How a save names itself in the lists. This fork's modes share maps (Great
// War 1914 is played on the 1936 map), so a save's mode, country and in-game
// date come from what it recorded (SavedGame.game), not from its map.

const MODE_KEYS: Readonly<Record<SavedGameInfo["mode"], string>> = {
  gw1914: "saved_games.mode.gw1914",
  ww1936: "saved_games.mode.ww1936",
  imjin: "saved_games.mode.imjin",
};

/** The mode's name: "대전쟁 1914". */
export function saveModeName(mode: SavedGameInfo["mode"]): string {
  return translateText(MODE_KEYS[mode]);
}

function countryName(mode: SavedGameInfo["mode"], tag: string): string {
  const key = mode === "gw1914" ? `gw.country.${tag}` : `ww1936.country.${tag}`;
  const name = translateText(key);
  return name === key ? tag : name;
}

function monthOf(iso: string): string | null {
  const [year, month] = iso.split("-").map(Number);
  if (!Number.isInteger(year) || !(month >= 1 && month <= 12)) return null;
  return translateText("saved_games.game_date", {
    year,
    month: translateText(`ww1936.month.m${month < 10 ? "0" : ""}${month}`),
  });
}

/** "대전쟁 1914 · 독일 · 1915년 3월": the mode, the country, the month. */
export function saveGameLabel(info: SavedGameInfo): string {
  const parts = [saveModeName(info.mode)];
  if (info.country !== undefined) {
    parts.push(countryName(info.mode, info.country));
  }
  const month = info.date === undefined ? null : monthOf(info.date);
  if (month !== null) parts.push(month);
  return parts.join(" · ");
}

/** A save's title: an autosave by its slot ("자동 2"), else its name. */
export function saveTitle(save: Pick<SavedGame, "name" | "autosave">): string {
  return save.autosave === undefined
    ? save.name
    : translateText("saved_games.autosave_name", { n: save.autosave });
}
