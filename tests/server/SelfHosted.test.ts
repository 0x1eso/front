import { GameEnv } from "@openfront/shared/configuration/Env";
import { afterEach, describe, expect, test, vi } from "vitest";
import { checkinBody, registeredSite } from "../../src/server/ClusterCheckin";
import { verifyClientToken } from "../../src/server/jwt";
import { ServerEnv } from "../../src/server/ServerEnv";

// What deploy.sh would write for a public server. A self-hosted server must
// still register with no API.
function stubDeployedIdentity() {
  vi.stubEnv("INSTANCE_LETTER", "a");
  vi.stubEnv("NUM_WORKERS", "2");
  vi.stubEnv("DOMAIN", "play.example.com");
  vi.stubEnv("SUBDOMAIN", "blue");
}

describe("self-hosted mode (SELF_HOSTED=true)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test.each([
    ["true", true],
    ["false", false],
    ["1", false],
    ["", false],
  ])("SELF_HOSTED=%j reads as %s", (raw, expected) => {
    vi.stubEnv("SELF_HOSTED", raw);
    expect(ServerEnv.selfHosted()).toBe(expected);
  });

  test("a prod server skips the API checks only when self-hosted", () => {
    vi.spyOn(ServerEnv, "env").mockReturnValue(GameEnv.Prod);
    vi.stubEnv("SELF_HOSTED", "");
    expect(ServerEnv.skipsApiChecks()).toBe(false);
    vi.stubEnv("SELF_HOSTED", "true");
    expect(ServerEnv.skipsApiChecks()).toBe(true);
  });

  test("dev keeps skipping them", () => {
    vi.spyOn(ServerEnv, "env").mockReturnValue(GameEnv.Dev);
    vi.stubEnv("SELF_HOSTED", "");
    expect(ServerEnv.skipsApiChecks()).toBe(true);
  });

  test("never builds an API URL", async () => {
    stubDeployedIdentity();
    vi.stubEnv("SELF_HOSTED", "true");
    expect(() => ServerEnv.jwtIssuer()).toThrow(/self-hosted/);
    await expect(ServerEnv.jwkPublicKey()).rejects.toThrow(/self-hosted/);
  });

  test("needs no Turnstile key", () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    vi.stubEnv("SELF_HOSTED", "true");
    expect(ServerEnv.turnstileSiteKey()).toBe("");
    vi.stubEnv("SELF_HOSTED", "");
    expect(() => ServerEnv.turnstileSiteKey()).toThrow(/TURNSTILE_SITE_KEY/);
  });

  test("lets a guest in by persistent ID on a prod server", async () => {
    vi.spyOn(ServerEnv, "env").mockReturnValue(GameEnv.Prod);
    vi.stubEnv("SELF_HOSTED", "true");
    const id = crypto.randomUUID();
    expect(await verifyClientToken(id)).toEqual({
      type: "success",
      persistentId: id,
      claims: null,
    });
  });

  test("a prod server that is not self-hosted still refuses one", async () => {
    vi.spyOn(ServerEnv, "env").mockReturnValue(GameEnv.Prod);
    vi.stubEnv("SELF_HOSTED", "");
    expect(await verifyClientToken(crypto.randomUUID())).toEqual({
      type: "error",
      message: "persistent ID not allowed in production",
    });
  });

  test("refuses an account token without fetching any keys", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await verifyClientToken(
      "eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl",
    );
    expect(result).toEqual({
      type: "error",
      message: "account tokens are not accepted on a self-hosted server",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("registers with no API, even with a public host", () => {
    stubDeployedIdentity();
    vi.stubEnv("SELF_HOSTED", "true");
    expect(registeredSite()).toBeUndefined();
    expect(checkinBody(0)).toBeNull();
    // Control: the same identity does register when not self-hosted.
    vi.stubEnv("SELF_HOSTED", "");
    expect(registeredSite()).toBe("blue.play.example.com");
  });
});
