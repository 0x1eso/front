// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  armBackGuard,
  disarmBackGuard,
  handleGamePopState,
  isBackGuardArmed,
  leaveGameToHome,
  registerBackClosable,
} from "../../src/client/BackGuard";

vi.mock("../../src/client/Utils", () => ({
  homeHref: () => "/",
  translateText: (key: string) => key,
}));

const GAME_URL = "/game/abcd1234?live";

function dialogButtons(): HTMLButtonElement[] {
  return [
    ...document.body.querySelectorAll(
      "confirm-dialog ~ div button, div button",
    ),
  ].filter((b) => b.closest(".fixed") !== null) as HTMLButtonElement[];
}

async function settle() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

function dialogOpen(): boolean {
  return document.body.querySelector("confirm-dialog") !== null;
}

// cancel button first, then confirm (ConfirmDialog's layout)
async function press(which: "stay" | "leave") {
  await settle();
  const buttons = dialogButtons();
  expect(buttons.length).toBe(2);
  buttons[which === "stay" ? 0 : 1].click();
  await settle();
}

describe("BackGuard", () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;
  let leave: () => void;

  beforeEach(() => {
    pushSpy = vi.spyOn(history, "pushState");
    leave = vi.fn() as unknown as () => void;
  });

  afterEach(() => {
    disarmBackGuard();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("pushes a guard entry with the same URL when the game starts", () => {
    armBackGuard({ url: GAME_URL, leave, confirmUnload: true });
    expect(isBackGuardArmed()).toBe(true);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][2]).toBe(GAME_URL);
  });

  it("does nothing outside a game, so menu hash routing is untouched", () => {
    expect(handleGamePopState()).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(dialogOpen()).toBe(false);
  });

  it("re-pushes the guard and opens the dialog on popstate", async () => {
    armBackGuard({ url: GAME_URL, leave, confirmUnload: true });
    pushSpy.mockClear();
    expect(handleGamePopState()).toBe(true);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][2]).toBe(GAME_URL);
    await settle();
    expect(dialogOpen()).toBe(true);
    expect(leave as unknown).not.toHaveBeenCalled();
  });

  it("leave runs the leave flow", async () => {
    armBackGuard({ url: GAME_URL, leave, confirmUnload: true });
    handleGamePopState();
    await press("leave");
    expect(leave as unknown).toHaveBeenCalledTimes(1);
    expect(dialogOpen()).toBe(false);
  });

  it("stay closes the dialog without leaving", async () => {
    armBackGuard({ url: GAME_URL, leave, confirmUnload: true });
    handleGamePopState();
    await press("stay");
    expect(leave as unknown).not.toHaveBeenCalled();
    expect(dialogOpen()).toBe(false);
    // and the guard is still up for the next Back
    expect(handleGamePopState()).toBe(true);
    await settle();
    expect(dialogOpen()).toBe(true);
  });

  it("a second Back while the dialog is open closes it", async () => {
    armBackGuard({ url: GAME_URL, leave, confirmUnload: true });
    handleGamePopState();
    await settle();
    expect(dialogOpen()).toBe(true);
    pushSpy.mockClear();
    expect(handleGamePopState()).toBe(true);
    await settle();
    expect(dialogOpen()).toBe(false);
    expect(leave as unknown).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("closes an open in-game overlay before asking to leave", async () => {
    armBackGuard({ url: GAME_URL, leave, confirmUnload: true });
    let open = true;
    const unregister = registerBackClosable(() => {
      if (!open) return false;
      open = false;
      return true;
    });
    handleGamePopState();
    await settle();
    expect(open).toBe(false);
    expect(dialogOpen()).toBe(false);
    handleGamePopState();
    await settle();
    expect(dialogOpen()).toBe(true);
    unregister();
  });

  it("normal exit removes the guard without a dialog and folds the entry", () => {
    const replaceSpy = vi.spyOn(history, "replaceState");
    const loc = { href: "" };
    vi.stubGlobal("location", loc);
    armBackGuard({ url: GAME_URL, leave, confirmUnload: true });
    leaveGameToHome();
    expect(isBackGuardArmed()).toBe(false);
    expect(dialogOpen()).toBe(false);
    expect(replaceSpy).toHaveBeenCalledWith(null, "", "/");
    expect(loc.href).toBe("/");
    expect(handleGamePopState()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("asks the browser before unload only when requested", () => {
    armBackGuard({ url: GAME_URL, leave, confirmUnload: true });
    const e1 = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e1);
    expect(e1.defaultPrevented).toBe(true);

    armBackGuard({ url: GAME_URL, leave, confirmUnload: false });
    const e2 = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(false);

    disarmBackGuard();
    const e3 = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e3);
    expect(e3.defaultPrevented).toBe(false);
  });
});
