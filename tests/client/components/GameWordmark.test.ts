import { GAME_TITLE } from "@openfront/shared/Branding";
import { afterEach, describe, expect, it } from "vitest";
import "../../../src/client/components/GameWordmark";
import type { GameWordmark } from "../../../src/client/components/GameWordmark";

// translateText reads the <lang-selector> in the document; a plain element
// carrying the same fields stands in for it.
function installLanguage(lang: string, translations: Record<string, string>) {
  const fixture = document.createElement("lang-selector");
  Object.assign(fixture, {
    translations,
    defaultTranslations: translations,
    currentLang: lang,
  });
  document.body.appendChild(fixture);
}

async function mount(compact = false): Promise<GameWordmark> {
  const el = document.createElement("game-wordmark") as GameWordmark;
  el.compact = compact;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const text = (root: ParentNode, selector: string) =>
  root.querySelector(selector)?.textContent?.trim();

afterEach(() => {
  document.body.innerHTML = "";
});

describe("game-wordmark", () => {
  it("spells the name from GAME_TITLE, with the based-on line", async () => {
    installLanguage("en", {
      "branding.title": "{name}",
      "branding.based_on": "Based on OpenFront",
    });
    const el = await mount();
    expect(text(el, ".game-wordmark-title")).toBe(GAME_TITLE);
    expect(text(el, ".game-wordmark-based-on")).toBe("Based on OpenFront");
  });

  it("follows the player's language", async () => {
    installLanguage("ko", {
      "branding.title": "스테이트크래프트",
      "branding.based_on": "OpenFront 기반",
    });
    const el = await mount();
    expect(text(el, ".game-wordmark-title")).toBe("스테이트크래프트");
  });

  it("drops the based-on line when compact", async () => {
    installLanguage("en", { "branding.title": "{name}" });
    const el = await mount(true);
    expect(text(el, ".game-wordmark-title")).toBe(GAME_TITLE);
    expect(el.querySelector(".game-wordmark-based-on")).toBeNull();
  });
});
