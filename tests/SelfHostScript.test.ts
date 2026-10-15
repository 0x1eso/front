import { spawn, spawnSync } from "child_process";
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

// `start` and `stop` against a throwaway repository with stand-ins for
// everything they launch: npm (the build), node_modules/.bin/tsx (the game
// server), cloudflared and curl. Nothing listens on a real port: the fake
// curl answers for the ports a test marks as listening in its state
// directory, so a server running on this machine changes nothing here.
const FAKE_SERVER = `#!/usr/bin/env bash
# Stands in for src/server/Server.ts; FAKE_SERVER says how it behaves.
echo $$ > "$FAKE_STATE/server-pid"
echo "NODE_ENV=\${NODE_ENV:-} GIT_COMMIT=\${GIT_COMMIT:-}" >> "$FAKE_STATE/server.log"
case "\${FAKE_SERVER:-healthy}" in
  healthy) touch "$FAKE_STATE/listening-3000" ;;
  exit) exit 1 ;;
esac
trap 'rm -f "$FAKE_STATE/listening-3000"; exit 0' TERM
while true; do sleep 0.1; done
`;

const FAKE_CURL = `#!/usr/bin/env bash
# Answers on the ports marked FAKE_STATE/listening-<port>; refuses (exit 7,
# couldn't connect) elsewhere. FAKE_STRAY_HEALTH: something else answers the
# health URL. FAKE_HEALTH_DELAY: the health answer takes that long.
url="\${*: -1}"
echo "$url" >> "$FAKE_STATE/curl.log"
port="\${url#http://127.0.0.1:}"
port="\${port%%/*}"
if [[ "$url" == */api/health ]]; then
  [[ -f "$FAKE_STATE/listening-$port" || -n "\${FAKE_STRAY_HEALTH:-}" ]] || exit 7
  [[ -z "\${FAKE_HEALTH_DELAY:-}" ]] || sleep "$FAKE_HEALTH_DELAY"
  echo '{"status":"ok"}'
  exit 0
fi
[[ -f "$FAKE_STATE/listening-$port" ]] || exit 7
`;

const FAKE_CLOUDFLARED = `#!/usr/bin/env bash
echo $$ > "$FAKE_STATE/tunnel-pid"
echo "$*" >> "$FAKE_STATE/cloudflared.log"
if [[ "\${FAKE_TUNNEL:-up}" == exit ]]; then
  echo "ERR Couldn't start tunnel"
  exit 1
fi
echo "INF Registered tunnel connection connIndex=0 protocol=quic"
while true; do sleep 0.1; done
`;

const FAKE_NPM = `#!/usr/bin/env bash
echo "$* GAME_VERSION=\${GAME_VERSION:-}" >> "$FAKE_STATE/npm.log"
mkdir -p static
echo built > static/index.html
`;

interface Sandbox {
  repo: string;
  state: string;
  run: (
    args: string[],
    env?: Record<string, string>,
  ) => ReturnType<typeof spawnSync>;
  git: (...args: string[]) => string;
  read: (name: string) => string;
  has: (name: string) => boolean;
  /** Processes the test started that the sandbox kills when done. */
  spawned: number[];
  dispose: () => void;
}

function writeExecutable(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode: 0o755 });
}

function makeSandbox(): Sandbox {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "game-night-start-"));
  const repo = path.join(root, "repo");
  const bin = path.join(root, "bin");
  const state = path.join(root, "state");
  fs.mkdirSync(state);
  // The script finds the repository from its own path.
  fs.mkdirSync(path.join(repo, "scripts/selfhost"), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(repo, "scripts/selfhost/game-night.sh"));
  fs.writeFileSync(
    path.join(repo, ".gitignore"),
    "static/\nnode_modules/\n.selfhost/\n",
  );
  fs.writeFileSync(path.join(repo, "game.ts"), "export const turn = 1;\n");
  writeExecutable(path.join(repo, "node_modules/.bin/tsx"), FAKE_SERVER);
  writeExecutable(path.join(bin, "curl"), FAKE_CURL);
  writeExecutable(path.join(bin, "cloudflared"), FAKE_CLOUDFLARED);
  writeExecutable(path.join(bin, "npm"), FAKE_NPM);
  const envFile = path.join(root, "selfhost.env");
  fs.writeFileSync(envFile, VALID);
  const tunnelConfig = path.join(root, "config.yml");
  fs.writeFileSync(tunnelConfig, "tunnel: statecraft\n");

  const baseEnv = {
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    HOME: root,
    SELFHOST_ENV_FILE: envFile,
    CLOUDFLARED_CONFIG: tunnelConfig,
    FAKE_STATE: state,
    HEALTH_TIMEOUT: "5",
  };
  const git = (...args: string[]) =>
    spawnSync("git", args, {
      cwd: repo,
      env: { ...baseEnv, GIT_CONFIG_NOSYSTEM: "1" },
      encoding: "utf8",
    }).stdout.trim();
  git("init", "-q");
  git("add", ".");
  git(
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.com",
    "commit",
    "-qm",
    "init",
  );

  const sandbox: Sandbox = {
    repo,
    state,
    spawned: [],
    git,
    run: (args, env = {}) =>
      spawnSync(
        "bash",
        [path.join(repo, "scripts/selfhost/game-night.sh"), ...args],
        {
          env: { ...baseEnv, ...env },
          encoding: "utf8",
          timeout: 30_000,
        },
      ),
    read: (name) => fs.readFileSync(path.join(state, name), "utf8"),
    has: (name) => fs.existsSync(path.join(state, name)),
    dispose: () => {
      sandbox.run(["stop"]);
      const pids = [...sandbox.spawned];
      for (const name of ["server-pid", "tunnel-pid"]) {
        if (sandbox.has(name)) pids.push(Number(sandbox.read(name)));
      }
      for (const pid of pids) {
        for (const target of [-pid, pid]) {
          try {
            process.kill(target, "SIGKILL");
          } catch {
            // Already gone.
          }
        }
      }
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
  return sandbox;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// A process that is gone may linger a moment as a zombie until its parent
// reaps it.
async function waitGone(pid: number) {
  for (let i = 0; i < 50 && alive(pid); i++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return !alive(pid);
}

describe("game-night.sh start and stop", { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(() => {
    box = makeSandbox();
  });

  afterEach(() => {
    box.dispose();
  });

  const builds = () =>
    box.has("npm.log") ? box.read("npm.log").trim().split("\n").length : 0;
  const serverRuns = () =>
    box
      .read("server.log")
      .trim()
      .split("\n")
      .map((line) => line.split(" "));
  const last = <T>(items: T[]): T => items[items.length - 1];
  const lastCommit = () => last(serverRuns())[1].replace("GIT_COMMIT=", "");
  const lastVersion = () =>
    last(box.read("npm.log").trim().split("\n")).split("GAME_VERSION=")[1];
  // The label an untagged build shows instead of version.txt's placeholder.
  const versionOf = (suffix = "") => {
    const date = box.git("log", "-1", "--format=%cd", "--date=format:%Y.%m.%d");
    return `${date}+${box.git("rev-parse", "HEAD").slice(0, 7)}${suffix}`;
  };

  test("builds a commit once and serves it as a production server", () => {
    const head = box.git("rev-parse", "HEAD");
    const first = box.run(["start", "--local"]);
    expect(first.stderr).not.toMatch(/uncommitted/);
    expect(first.status).toBe(0);
    expect(builds()).toBe(1);
    expect(lastVersion()).toBe(versionOf());
    expect(lastVersion()).toMatch(/^\d{4}\.\d{2}\.\d{2}\+[0-9a-f]{7}$/);
    expect(serverRuns()).toEqual([
      ["NODE_ENV=production", `GIT_COMMIT=${head}`],
    ]);
    expect(box.run(["stop"]).status).toBe(0);

    expect(box.run(["start", "--local"]).status).toBe(0);
    expect(builds()).toBe(1);
    expect(lastCommit()).toBe(head);
  });

  // A build of uncommitted changes must not pass for HEAD's: after the
  // changes are dropped, the next start has to rebuild, and a tab loaded
  // from one build must fail the server's version check against another.
  test("a build of uncommitted changes is a build of its own", () => {
    const head = box.git("rev-parse", "HEAD");
    const game = path.join(box.repo, "game.ts");
    fs.writeFileSync(game, "export const turn = 2;\n");

    const dirty = box.run(["start", "--local"]);
    expect(dirty.status).toBe(0);
    expect(dirty.stderr).toMatch(/uncommitted changes.*AGPL/);
    expect(builds()).toBe(1);
    expect(lastVersion()).toBe(versionOf(".dirty"));
    const firstDirty = lastCommit();
    expect(firstDirty).toMatch(
      new RegExp(`^${head.slice(0, 12)}-dirty-[0-9a-f]{12}$`),
    );
    box.run(["stop"]);

    // The same changes: the same build.
    expect(box.run(["start", "--local"]).status).toBe(0);
    expect(builds()).toBe(1);
    expect(lastCommit()).toBe(firstDirty);
    box.run(["stop"]);

    fs.writeFileSync(game, "export const turn = 3;\n");
    expect(box.run(["start", "--local"]).status).toBe(0);
    expect(builds()).toBe(2);
    expect(lastCommit()).toMatch(/-dirty-/);
    expect(lastCommit()).not.toBe(firstDirty);
    box.run(["stop"]);

    box.git("checkout", "--", ".");
    const clean = box.run(["start", "--local"]);
    expect(clean.status).toBe(0);
    expect(clean.stderr).not.toMatch(/uncommitted/);
    expect(builds()).toBe(3);
    expect(lastCommit()).toBe(head);
    expect(lastVersion()).toBe(versionOf());
  });

  test("an untracked file changes a dirty build", () => {
    fs.writeFileSync(
      path.join(box.repo, "game.ts"),
      "export const turn = 2;\n",
    );
    fs.writeFileSync(path.join(box.repo, "rules.ts"), "export const a = 1;\n");
    expect(box.run(["start", "--local"]).status).toBe(0);
    const first = lastCommit();
    box.run(["stop"]);
    fs.writeFileSync(path.join(box.repo, "rules.ts"), "export const a = 2;\n");
    expect(box.run(["start", "--local"]).status).toBe(0);
    expect(lastCommit()).not.toBe(first);
    expect(builds()).toBe(2);
  });

  test.each([3000, 3001, 3002])(
    "refuses to start while something listens on port %i",
    (port) => {
      fs.writeFileSync(path.join(box.state, `listening-${port}`), "");
      const result = box.run(["start"]);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(
        new RegExp(`port ${port} is already in use`),
      );
      expect(box.has("server.log")).toBe(false);
      expect(box.has("cloudflared.log")).toBe(false);
      expect(builds()).toBe(0);
    },
  );

  // The new server died (say on EADDRINUSE) while something else answers
  // the health URL: that answer is not ours, and no tunnel may open onto it.
  test("a health answer does not count once the server has exited", () => {
    const result = box.run(["start"], {
      FAKE_SERVER: "exit",
      FAKE_STRAY_HEALTH: "1",
      FAKE_HEALTH_DELAY: "0.5",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/the server exited/);
    expect(box.has("cloudflared.log")).toBe(false);
    expect(fs.existsSync(path.join(box.repo, ".selfhost/server.pid"))).toBe(
      false,
    );
  });

  test("stops a server that never answers", async () => {
    const result = box.run(["start", "--local"], {
      FAKE_SERVER: "hang",
      HEALTH_TIMEOUT: "1",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/did not become healthy in 1s/);
    expect(await waitGone(Number(box.read("server-pid")))).toBe(true);
  });

  test("opens the tunnel once the server answers and waits for it to connect", async () => {
    const result = box.run(["start"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/tunnel up: https:\/\/play\.example\.com/);
    const status = box.run(["status"]);
    expect(status.stdout).toMatch(/server: running/);
    expect(status.stdout).toMatch(/tunnel: running/);

    const server = Number(box.read("server-pid"));
    const tunnel = Number(box.read("tunnel-pid"));
    expect(box.run(["stop"]).status).toBe(0);
    expect(await waitGone(server)).toBe(true);
    expect(await waitGone(tunnel)).toBe(true);
    expect(box.run(["status"]).stdout).toMatch(
      /server: stopped\ntunnel: stopped/,
    );
  });

  test("a tunnel that exits fails the start and stops the server", async () => {
    const result = box.run(["start"], { FAKE_TUNNEL: "exit" });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/the tunnel exited/);
    expect(await waitGone(Number(box.read("server-pid")))).toBe(true);
  });

  test("stops a tunnel left over from an earlier start", async () => {
    const leftover = spawn(
      path.join(path.dirname(box.state), "bin/cloudflared"),
      ["tunnel", "run", "statecraft"],
      {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, FAKE_STATE: box.state },
      },
    );
    box.spawned.push(leftover.pid!);
    fs.mkdirSync(path.join(box.repo, ".selfhost"), { recursive: true });
    fs.writeFileSync(
      path.join(box.repo, ".selfhost/tunnel.pid"),
      `${leftover.pid}\n`,
    );
    expect(box.run(["start", "--local"]).status).toBe(0);
    expect(await waitGone(leftover.pid!)).toBe(true);
  });

  test("keeps the previous run's log", () => {
    fs.mkdirSync(path.join(box.repo, ".selfhost"), { recursive: true });
    fs.writeFileSync(
      path.join(box.repo, ".selfhost/server.log"),
      "last night\n",
    );
    expect(box.run(["start", "--local"]).status).toBe(0);
    expect(
      fs.readFileSync(path.join(box.repo, ".selfhost/server.log.1"), "utf8"),
    ).toBe("last night\n");
  });

  // A pid file can outlive its process, and the system can hand the number
  // to another program: stop must signal only what it started.
  test.each(["unrelated", "abc", "12abc", ""])(
    "stop and status leave alone a pid file naming %j",
    async (kind) => {
      const other = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
      box.spawned.push(other.pid!);
      const content = kind === "unrelated" ? `${other.pid}` : kind;
      fs.mkdirSync(path.join(box.repo, ".selfhost"), { recursive: true });
      for (const file of ["server.pid", "tunnel.pid"]) {
        fs.writeFileSync(path.join(box.repo, ".selfhost", file), content);
      }
      expect(box.run(["status"]).stdout).toMatch(
        /server: stopped\ntunnel: stopped/,
      );
      expect(box.run(["stop"]).status).toBe(0);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(alive(other.pid!)).toBe(true);
    },
  );
});

describe("game-night.sh local curls", () => {
  test("every curl bypasses proxy variables for 127.0.0.1 and the health URL", () => {
    const script = fs.readFileSync(SCRIPT, "utf8");
    const curls = script
      .split("\n")
      .filter((l) => /^\s*(if |health="\$\()?curl /.test(l.trimEnd()));
    expect(curls.length).toBeGreaterThan(0);
    for (const line of curls) expect(line).toContain("--noproxy '*'");
  });
});
