// "Install as an app": Chrome, Edge and Android offer it through
// `beforeinstallprompt`, which must be caught early (it fires once, soon
// after load) and replayed when the player asks. iOS has no such event: the
// player adds the page to the home screen from Safari's share sheet, so the
// menu shows a one-line hint there instead (InstallAppPrompt.ts).

/** Dispatched on window when the offer appears or goes away. */
export const INSTALL_CHANGE_EVENT = "install-offer-change";

/** The non-standard event Chromium fires when the page is installable. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let captured = false;

/** Starts listening; Main calls it first thing at boot. */
export function captureInstallPrompt(): void {
  if (captured || typeof window === "undefined") return;
  captured = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep the browser's own mini-infobar away; the menu has a button.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_CHANGE_EVENT));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    window.dispatchEvent(new Event(INSTALL_CHANGE_EVENT));
  });
}

/** Whether the browser has offered to install the app. */
export function canPromptInstall(): boolean {
  return deferred !== null;
}

/** Shows the browser's install dialog; true if the player accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (event === null) return false;
  // One use per event: the browser fires a new one if it is offered again.
  deferred = null;
  window.dispatchEvent(new Event(INSTALL_CHANGE_EVENT));
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome === "accepted";
}

/** Whether the page is already running as an installed app. */
export function runningStandalone(
  win: Pick<Window, "matchMedia" | "navigator">,
): boolean {
  // Safari's own flag for a page opened from the home screen.
  const ios = win.navigator as Navigator & { standalone?: boolean };
  if (ios.standalone === true) return true;
  // Absent in some embedded webviews (and jsdom).
  if (typeof win.matchMedia !== "function") return false;
  return (
    win.matchMedia("(display-mode: standalone)").matches ||
    win.matchMedia("(display-mode: fullscreen)").matches
  );
}

export type InstallOffer = "button" | "ios-hint" | "none";

/**
 * What the menu offers: the install button where the browser can install,
 * the share-sheet hint on iOS, nothing once installed (or dismissed, or
 * offline: nothing to install from).
 */
export function installOffer(state: {
  standalone: boolean;
  canPrompt: boolean;
  isIOS: boolean;
  hintDismissed: boolean;
  offline: boolean;
}): InstallOffer {
  if (state.standalone || state.offline) return "none";
  if (state.canPrompt) return "button";
  if (state.isIOS && !state.hintDismissed) return "ios-hint";
  return "none";
}
