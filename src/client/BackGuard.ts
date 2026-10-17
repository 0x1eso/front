import { showInGameConfirm } from "./InGameModal";
import { homeHref, translateText } from "./Utils";

/**
 * Keeps the Back gesture (Android back button, iOS swipe-back, browser back)
 * from throwing the player out of a running game.
 *
 * While armed, the history stack is [..., menu entry, guard entry]. Back pops
 * the guard; handleGamePopState() immediately pushes it again and, unless an
 * in-game modal/drawer was open (it is closed first) or the confirm dialog is
 * already showing (a second Back closes it), asks "leave the game?".
 *
 * Kept free of game-client imports so Main (the homepage chunk) can use it.
 */

type BackClosable = () => boolean;

let guardUrl: string | null = null;
let onLeave: (() => void) | null = null;
let confirmUnload = false;
let dialogAbort: AbortController | null = null;
const closables = new Set<BackClosable>();

/**
 * Register an in-game overlay that Back should close before it asks to leave.
 * `close` closes it and returns true, or returns false when it is not open.
 * Returns the unregister function.
 */
export function registerBackClosable(close: BackClosable): () => void {
  closables.add(close);
  return () => {
    closables.delete(close);
  };
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (guardUrl === null || !confirmUnload) return;
  e.preventDefault();
  // Legacy browsers only show the native prompt when returnValue is set.
  e.returnValue = "";
}

export function isBackGuardArmed(): boolean {
  return guardUrl !== null;
}

/**
 * Start guarding: push the guard history entry (same URL) and remember how to
 * leave. `confirmUnload` also asks the browser's native "leave site?" on
 * reload/close (desktop; mobile mostly ignores it).
 */
export function armBackGuard(opts: {
  url: string;
  leave: () => void;
  confirmUnload: boolean;
}): void {
  disarmBackGuard();
  history.pushState(null, "", opts.url);
  guardUrl = opts.url;
  onLeave = opts.leave;
  confirmUnload = opts.confirmUnload;
  window.addEventListener("beforeunload", onBeforeUnload);
}

/** Stop guarding without any dialog. The history entry is left to the caller. */
export function disarmBackGuard(): void {
  window.removeEventListener("beforeunload", onBeforeUnload);
  guardUrl = null;
  onLeave = null;
  confirmUnload = false;
  dialogAbort?.abort();
  dialogAbort = null;
}

/**
 * The normal way out of a game (exit button, win screen, settings): drops the
 * guard, folds the game's history entry into the menu's so Back afterwards
 * does not land on a dead game page, and navigates to the menu.
 */
export function leaveGameToHome(): void {
  disarmBackGuard();
  const home = homeHref();
  if (home.startsWith("/")) {
    try {
      history.replaceState(null, "", home);
    } catch {
      // Navigating still works; only the stale-entry cleanup is lost.
    }
  }
  window.location.href = home;
}

/**
 * Call from the popstate handler. Returns true when the guard consumed the
 * event (the caller must not route it any further).
 */
export function handleGamePopState(): boolean {
  if (guardUrl === null) return false;
  history.pushState(null, "", guardUrl);

  if (dialogAbort !== null) {
    // Back while the dialog is open means "keep playing".
    dialogAbort.abort();
    return true;
  }
  for (const close of [...closables]) {
    if (close()) return true;
  }

  const abort = new AbortController();
  dialogAbort = abort;
  const leave = onLeave;
  void showInGameConfirm(
    translateText("back_guard.message"),
    {
      confirmText: translateText("back_guard.leave"),
      cancelText: translateText("back_guard.stay"),
    },
    abort.signal,
  ).then((confirmed) => {
    if (dialogAbort === abort) dialogAbort = null;
    if (confirmed && !abort.signal.aborted) leave?.();
  });
  return true;
}
