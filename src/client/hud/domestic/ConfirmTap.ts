import { translateText } from "../../Utils";

/**
 * A permanent choice (a law, a government) takes two taps, like the build
 * bar: the first arms its button, which then says "tap again to confirm";
 * the second carries it out. The panel holds which button is armed.
 */
export interface ConfirmTap {
  /** The armed button's key, or null. */
  armed: string | null;
  arm(key: string | null): void;
}

/** The click handler: arm `key`, or run `act` if it is already armed. */
export function confirmTapHandler(
  confirm: ConfirmTap,
  key: string,
  act: () => void,
): () => void {
  return () => {
    if (confirm.armed === key) {
      confirm.arm(null);
      act();
    } else {
      confirm.arm(key);
    }
  };
}

/** The button's label: `label`, or the confirm prompt while armed. */
export function confirmTapLabel(
  confirm: ConfirmTap,
  key: string,
  label: string,
): string {
  return confirm.armed === key
    ? translateText("domestic.tap_again_to_confirm")
    : label;
}

/** Extra classes that make an armed button stand out. */
export function confirmTapClass(confirm: ConfirmTap, key: string): string {
  return confirm.armed === key ? "ring-2 ring-white" : "";
}
