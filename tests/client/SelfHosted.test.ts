import { afterEach, describe, expect, it } from "vitest";
import {
  isSelfHosted,
  selfHostApiBase,
  turnstileRequired,
} from "../../src/client/SelfHosted";

afterEach(() => {
  window.BOOTSTRAP_CONFIG = undefined;
});

describe("SelfHosted", () => {
  it("is off without a page config, as upstream", () => {
    window.BOOTSTRAP_CONFIG = undefined;
    expect(isSelfHosted()).toBe(false);
    expect(turnstileRequired()).toBe(true);
  });

  it("is off unless the page says selfHosted: true", () => {
    window.BOOTSTRAP_CONFIG = { gameEnv: "prod" };
    expect(isSelfHosted()).toBe(false);
  });

  it("is on when the server rendered selfHosted: true", () => {
    window.BOOTSTRAP_CONFIG = { gameEnv: "prod", selfHosted: true };
    expect(isSelfHosted()).toBe(true);
    expect(turnstileRequired()).toBe(false);
  });

  it("sends API calls to this server's stub", () => {
    expect(selfHostApiBase()).toBe(`${window.location.origin}/selfhost-api`);
  });
});
