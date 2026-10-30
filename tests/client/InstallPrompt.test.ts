import { afterEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ isIOS: false }));
vi.mock("../../src/client/Platform", () => ({ Platform: platform }));

import "../../src/client/components/InstallAppPrompt";
import {
  captureInstallPrompt,
  installOffer,
  runningStandalone,
} from "../../src/client/pwa/InstallPrompt";
import { setOffline } from "../../src/client/pwa/OfflineState";
import {
  registerServiceWorker,
  serviceWorkerWanted,
} from "../../src/client/pwa/RegisterServiceWorker";

type Mountable = HTMLElement & { updateComplete: Promise<unknown> };

async function mount(): Promise<Mountable> {
  const el = document.createElement("install-app-prompt") as Mountable;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** What Chromium fires once the page is installable. */
function offerInstall(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  const prompt = vi.fn(async () => {});
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  window.dispatchEvent(event);
  return { event, prompt };
}

afterEach(() => {
  document.body.innerHTML = "";
  platform.isIOS = false;
  setOffline(false);
  localStorage.clear();
});

describe("what the menu offers", () => {
  const base = {
    standalone: false,
    canPrompt: false,
    isIOS: false,
    hintDismissed: false,
    offline: false,
  };

  it("the install button where the browser offers to install", () => {
    expect(installOffer({ ...base, canPrompt: true })).toBe("button");
  });

  it("the share-sheet hint on iOS, until dismissed", () => {
    expect(installOffer({ ...base, isIOS: true })).toBe("ios-hint");
    expect(installOffer({ ...base, isIOS: true, hintDismissed: true })).toBe(
      "none",
    );
  });

  it("nothing once installed, offline, or with no way to install", () => {
    expect(installOffer({ ...base, canPrompt: true, standalone: true })).toBe(
      "none",
    );
    expect(installOffer({ ...base, isIOS: true, offline: true })).toBe("none");
    expect(installOffer(base)).toBe("none");
  });

  it("knows when it already runs as the installed app", () => {
    const media = (standalone: boolean) =>
      ({
        navigator: {} as Navigator,
        matchMedia: (q: string) => ({
          matches: standalone && q.includes("standalone"),
        }),
      }) as unknown as Window;
    expect(runningStandalone(media(true))).toBe(true);
    expect(runningStandalone(media(false))).toBe(false);
    expect(
      runningStandalone({
        navigator: { standalone: true } as unknown as Navigator,
        matchMedia: undefined,
      } as unknown as Window),
    ).toBe(true);
  });
});

describe("<install-app-prompt>", () => {
  it("shows nothing before the browser offers anything", async () => {
    captureInstallPrompt();
    const el = await mount();
    expect(el.querySelector("button")).toBeNull();
    expect(el.textContent?.trim()).toBe("");
  });

  it("shows the button once offered, and replays the browser's dialog", async () => {
    captureInstallPrompt();
    const el = await mount();
    const { event, prompt } = offerInstall();
    // The browser's own mini-infobar stays away.
    expect(event.defaultPrevented).toBe(true);
    await el.updateComplete;
    const button = el.querySelector<HTMLButtonElement>("[data-install-app]");
    expect(button?.textContent).toContain("pwa.install");
    button!.click();
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    // One use per offer.
    await el.updateComplete;
    expect(el.querySelector("[data-install-app]")).toBeNull();
  });

  it("drops the button once the app is installed", async () => {
    captureInstallPrompt();
    const el = await mount();
    offerInstall();
    await el.updateComplete;
    expect(el.querySelector("[data-install-app]")).not.toBeNull();
    window.dispatchEvent(new Event("appinstalled"));
    await el.updateComplete;
    expect(el.querySelector("[data-install-app]")).toBeNull();
  });

  it("on iOS, one line that can be dismissed for good", async () => {
    platform.isIOS = true;
    const el = await mount();
    const hint = el.querySelector("[data-ios-install-hint]");
    expect(hint?.textContent).toContain("pwa.ios_hint");
    el.querySelector<HTMLButtonElement>(
      "[data-ios-install-hint] button",
    )!.click();
    await el.updateComplete;
    expect(el.querySelector("[data-ios-install-hint]")).toBeNull();
    // Stays dismissed on the next visit.
    el.remove();
    const again = await mount();
    expect(again.querySelector("[data-ios-install-hint]")).toBeNull();
  });
});

describe("registering the service worker", () => {
  const prod = {
    production: true,
    supported: true,
    desktopShell: false,
    cdnBase: "",
  };

  it("only in a production web build serving its own assets", () => {
    expect(serviceWorkerWanted(prod)).toBe(true);
    expect(serviceWorkerWanted({ ...prod, production: false })).toBe(false);
    expect(serviceWorkerWanted({ ...prod, supported: false })).toBe(false);
    expect(serviceWorkerWanted({ ...prod, desktopShell: true })).toBe(false);
    expect(
      serviceWorkerWanted({ ...prod, cdnBase: "https://cdn.example" }),
    ).toBe(false);
  });

  it("registers /sw.js for the whole site once the page has loaded", async () => {
    const register = vi.fn(async () => ({}));
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register, controller: null },
    });
    try {
      registerServiceWorker(prod);
      // jsdom's document has finished loading by the time tests run.
      expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
      register.mockClear();
      registerServiceWorker({ ...prod, production: false });
      expect(register).not.toHaveBeenCalled();
    } finally {
      delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    }
  });
});
