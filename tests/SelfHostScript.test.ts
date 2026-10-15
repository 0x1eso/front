import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts/selfhost/game-night.sh");
const EXAMPLE = path.join(ROOT, "scripts/selfhost/selfhost.env.example");

const VALID = [
  "SELF_HOSTED=true",
  "GAME_ENV=prod",
  "DOMAIN=play.example.com",
  "TUNNEL_NAME=statecraft",
  "",
].join("\n");

// `check` validates the env file and nothing else, so it runs anywhere. A
// bare environment keeps the runner's own DOMAIN etc. out of the result.
function check(envFile: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "game-night-"));
  const file = path.join(dir, "selfhost.env");
  fs.writeFileSync(file, envFile);
  try {
    return spawnSync("bash", [SCRIPT, "check"], {
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? dir,
        SELFHOST_ENV_FILE: file,
      },
      encoding: "utf8",
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("game-night.sh check", () => {
  test("accepts the example env file once DOMAIN is filled in", () => {
    const example = fs.readFileSync(EXAMPLE, "utf8");
    expect(example).toMatch(/^DOMAIN=$/m);
    const result = check(
      example.replace(/^DOMAIN=$/m, "DOMAIN=play.example.com"),
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  test("accepts a minimal valid file", () => {
    expect(check(VALID).status).toBe(0);
  });

  test.each([
    [
      "a file without SELF_HOSTED",
      VALID.replace("SELF_HOSTED=true\n", ""),
      /SELF_HOSTED must be true/,
    ],
    [
      "GAME_ENV=dev",
      VALID.replace("GAME_ENV=prod", "GAME_ENV=dev"),
      /GAME_ENV must be prod/,
    ],
    [
      "a file without DOMAIN",
      VALID.replace("DOMAIN=play.example.com\n", ""),
      /DOMAIN is not set/,
    ],
    [
      "OpenFront's own domain",
      VALID.replace("play.example.com", "play.OpenFront.io"),
      /your own domain/,
    ],
    [
      "NUM_WORKERS=two",
      `${VALID}NUM_WORKERS=two\n`,
      /NUM_WORKERS must be a positive integer/,
    ],
    [
      "INSTANCE_LETTER=AB",
      `${VALID}INSTANCE_LETTER=AB\n`,
      /INSTANCE_LETTER must be one lowercase letter/,
    ],
  ])("refuses %s", (_name, envFile, message) => {
    const result = check(envFile);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
  });

  test("refuses a missing env file", () => {
    const result = spawnSync("bash", [SCRIPT, "check"], {
      env: {
        PATH: process.env.PATH ?? "",
        SELFHOST_ENV_FILE: "/nonexistent/selfhost.env",
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no env file/);
  });

  test("prints usage for an unknown command", () => {
    const result = spawnSync("bash", [SCRIPT, "dance"], { encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/usage: game-night\.sh/);
  });
});
