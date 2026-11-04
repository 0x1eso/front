// World War 1936 (ww63): the designer is off unless the game config says
// `ww1936Designer: true`. Off, every screen of it is hidden (the code stays);
// the historical catalogue picks what the country builds instead.
export interface DesignerFlagGame {
  config?: () =>
    | { gameConfig?: () => { ww1936Designer?: boolean } | undefined }
    | undefined;
}

/** Whether the designer, its entry points and its saved designs are shown. */
export function designerOn(game: DesignerFlagGame | null | undefined): boolean {
  try {
    return game?.config?.()?.gameConfig?.()?.ww1936Designer === true;
  } catch {
    return false;
  }
}
