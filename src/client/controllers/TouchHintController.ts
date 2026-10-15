import { UnitType } from "@openfront/engine-api/game/GameTypes";
import type { Controller } from "../Controller";
import { Platform } from "../Platform";
import type { UserSettings } from "../UserSettings";
import { showToast, translateText } from "../Utils";
import type { GameView } from "../view";

/** How long the one-time long-press hint stays on screen. */
export const LONG_PRESS_HINT_MS = 8000;

/**
 * A touch screen has no Shift key: warships are box-selected by long-pressing
 * the map and dragging (InputHandler). Says so once (spec §14a), the first
 * time a touch player has a warship, then never again on this device.
 */
export class TouchHintController implements Controller {
  constructor(
    private readonly game: GameView,
    private readonly userSettings: UserSettings,
    private readonly isTouch: () => boolean = () => Platform.isTouch,
  ) {}

  getTickIntervalMs() {
    return 1000;
  }

  tick() {
    if (!this.isTouch() || this.userSettings.touchLongPressHintShown()) return;
    const me = this.game.myPlayer();
    if (me === null || !me.isAlive()) return;
    if (me.units(UnitType.Warship).length === 0) return;
    this.userSettings.setTouchLongPressHintShown();
    showToast(
      translateText("touch_ui.warship_long_press"),
      "green",
      LONG_PRESS_HINT_MS,
    );
  }
}
