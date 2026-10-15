#!/usr/bin/env bash
# Game night on a self-hosted server (README, "자체 호스팅 (게임 나이트)").
#
#   game-night.sh start [--local] [--rebuild]
#       Build when the code changed, start the game server with the
#       self-host settings, wait until it answers, then open the Cloudflare
#       Tunnel and wait until it connects. Refuses while anything listens on
#       the server's ports (3000 and one per worker). --local skips the tunnel
#       (http://localhost:3000 or the LAN); --rebuild builds even when nothing
#       changed.
#   game-night.sh stop      Stop the tunnel and the server.
#   game-night.sh status    Show what is running.
#   game-night.sh check     Validate the env file, then exit.
#
# Settings: .env.selfhost in the repository root (template:
# scripts/selfhost/selfhost.env.example), or the file SELFHOST_ENV_FILE names.
# Logs: .selfhost/server.log and tunnel.log; the previous run's are kept as
# server.log.1 and tunnel.log.1.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${SELFHOST_ENV_FILE:-$REPO_ROOT/.env.selfhost}"
RUN_DIR="$REPO_ROOT/.selfhost"
SERVER_PID_FILE="$RUN_DIR/server.pid"
TUNNEL_PID_FILE="$RUN_DIR/tunnel.pid"
BUILD_STAMP="$REPO_ROOT/static/.selfhost-commit"
MASTER_PORT=3000
HEALTH_URL="http://127.0.0.1:$MASTER_PORT/api/health"
# What each pid file's process runs (`ps` args): a pid the system has since
# handed to another program is not ours to signal.
SERVER_CMD="src/server/Server.ts"
TUNNEL_CMD="cloudflared"

die() {
    echo "game-night: $*" >&2
    exit 1
}

say() {
    echo "game-night: $*"
}

usage() {
    echo "usage: game-night.sh start [--local] [--rebuild] | stop | status | check"
}

load_env() {
    [[ -f "$ENV_FILE" ]] \
        || die "no env file at $ENV_FILE (copy scripts/selfhost/selfhost.env.example)"
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
    export NUM_WORKERS="${NUM_WORKERS:-2}"
    export INSTANCE_LETTER="${INSTANCE_LETTER:-a}"
    HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
}

check_env() {
    [[ "${SELF_HOSTED:-}" == "true" ]] \
        || die "SELF_HOSTED must be true (without it the server expects OpenFront's API and refuses guests)"
    [[ "${GAME_ENV:-}" == "prod" ]] || die "GAME_ENV must be prod"
    [[ -n "${DOMAIN:-}" ]] \
        || die "DOMAIN is not set (the hostname your friends open, e.g. play.example.com)"
    [[ "${DOMAIN,,}" != *openfront* ]] \
        || die "DOMAIN must be your own domain, not OpenFront's"
    [[ "$NUM_WORKERS" =~ ^[1-9][0-9]*$ ]] \
        || die "NUM_WORKERS must be a positive integer, got '$NUM_WORKERS'"
    [[ "$INSTANCE_LETTER" =~ ^[a-z]$ ]] \
        || die "INSTANCE_LETTER must be one lowercase letter, got '$INSTANCE_LETTER'"
    [[ "$HEALTH_TIMEOUT" =~ ^[1-9][0-9]*$ ]] \
        || die "HEALTH_TIMEOUT must be a positive number of seconds, got '$HEALTH_TIMEOUT'"
}

tunnel_config() {
    echo "${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"
}

check_tunnel() {
    [[ -n "${TUNNEL_NAME:-}" ]] \
        || die "TUNNEL_NAME is not set (or start with --local)"
    command -v cloudflared > /dev/null \
        || die "cloudflared is not installed (sudo pacman -S cloudflared)"
    [[ -f "$(tunnel_config)" ]] \
        || die "no cloudflared config at $(tunnel_config) (README, 처음 한 번)"
}

# is_running PID_FILE CMD: the pid file names a live process running CMD.
is_running() {
    local pid args
    [[ -f "$1" ]] || return 1
    pid="$(cat "$1")"
    [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
    args="$(ps -ww -o args= -p "$pid" 2> /dev/null)" || return 1
    [[ "$args" == *"$2"* ]]
}

# Whether anything listens on 127.0.0.1:PORT: curl exits 7 only when it
# could not connect at all.
port_in_use() {
    local code=0
    curl -sS -o /dev/null --max-time 3 "http://127.0.0.1:$1/" > /dev/null 2>&1 \
        || code=$?
    [[ "$code" != 7 ]]
}

# A new server cannot bind a taken port and exits, while whatever holds the
# port (npm run dev, a server started by hand) answers the health check in
# its place, and the tunnel would open onto it.
check_ports_free() {
    local port
    for port in $(seq "$MASTER_PORT" "$((MASTER_PORT + NUM_WORKERS))"); do
        if port_in_use "$port"; then
            die "port $port is already in use (npm run dev, or a server started another way?); stop it first"
        fi
    done
}

# A tracked file differs from HEAD. Untracked files alone are not part of
# the build.
tree_dirty() {
    [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]]
}

# A hash of everything uncommitted: the diff against HEAD and each untracked
# file (one may be imported by the changes).
changes_hash() {
    (
        cd "$REPO_ROOT"
        git diff --no-ext-diff --binary HEAD
        git ls-files -z --others --exclude-standard \
            | while IFS= read -r -d '' file; do
                echo "$(git hash-object -- "$file") $file"
            done
    ) | git -C "$REPO_ROOT" hash-object --stdin
}

# What a build is built from: HEAD's commit, or for uncommitted changes
# <commit>-dirty-<hash of the changes>. It is the server's GIT_COMMIT and the
# build stamp, so every edit is a build of its own: start rebuilds it, and a
# tab loaded from another build fails the server's version check and
# reloads instead of mis-decoding the game (src/server/Worker.ts). The
# source links name the commit part (packages/shared/src/Branding.ts).
build_id() {
    local head hash
    head="$(git -C "$REPO_ROOT" rev-parse HEAD)"
    if ! tree_dirty; then
        echo "$head"
        return 0
    fi
    hash="$(changes_hash)"
    echo "${head:0:12}-dirty-${hash:0:12}"
}

# The version label the build shows (nav bar, footer): the commit's date and
# short hash, e.g. 2026.10.15+3e5f4f7, ".dirty" for uncommitted changes.
# Untagged, it would show resources/version.txt's placeholder; vite.config.ts
# serves GAME_VERSION in the file's place (src/server/GameVersionOverride.ts).
game_version() {
    local head date
    head="$(git -C "$REPO_ROOT" rev-parse HEAD)"
    date="$(git -C "$REPO_ROOT" log -1 --format=%cd --date=format:%Y.%m.%d HEAD)"
    if tree_dirty; then
        echo "$date+${head:0:7}.dirty"
    else
        echo "$date+${head:0:7}"
    fi
}

needs_build() {
    [[ -f "$REPO_ROOT/static/index.html" && -f "$BUILD_STAMP" ]] || return 0
    [[ "$(cat "$BUILD_STAMP")" != "$1" ]]
}

# build BUILD_ID. The stamp goes first, so a failed build is never taken
# for a finished one.
build() {
    local version
    version="$(game_version)"
    rm -f "$BUILD_STAMP"
    say "building $version (npm run build-prod); this takes a few minutes"
    (cd "$REPO_ROOT" && GAME_VERSION="$version" npm run build-prod)
    echo "$1" > "$BUILD_STAMP"
}

warn_unpushed() {
    if tree_dirty; then
        echo "game-night: warning: the working tree has uncommitted changes. AGPL section 13: the source link must match the code that is running." >&2
    fi
    if [[ -z "$(git -C "$REPO_ROOT" branch -r --contains HEAD 2> /dev/null)" ]]; then
        echo "game-night: warning: this commit is not pushed. AGPL section 13: players must be able to get the source that is running (git push)." >&2
    fi
}

# Keeps the previous run's log as LOG.1.
rotate_log() {
    if [[ -f "$1" ]]; then
        mv -f "$1" "$1.1"
    fi
}

server_failed() {
    stop_group "$SERVER_PID_FILE" "$SERVER_CMD" server
    die "$1; see $RUN_DIR/server.log"
}

# The health URL answering counts only while our server is alive, before
# and after the answer: if it died, whatever answers is not ours.
wait_healthy() {
    local _
    for _ in $(seq 1 "$((HEALTH_TIMEOUT * 2))"); do
        is_running "$SERVER_PID_FILE" "$SERVER_CMD" \
            || server_failed "the server exited"
        if curl -fsS --max-time 2 "$HEALTH_URL" > /dev/null 2>&1; then
            is_running "$SERVER_PID_FILE" "$SERVER_CMD" \
                || server_failed "the server exited"
            return 0
        fi
        sleep 0.5
    done
    server_failed "the server did not become healthy in ${HEALTH_TIMEOUT}s"
}

# Waits for cloudflared to register a connection with Cloudflare. A tunnel
# that exits takes the server down with it, so start can simply be rerun.
wait_tunnel() {
    local _
    for _ in $(seq 1 60); do
        if ! is_running "$TUNNEL_PID_FILE" "$TUNNEL_CMD"; then
            stop_group "$TUNNEL_PID_FILE" "$TUNNEL_CMD" tunnel
            stop_group "$SERVER_PID_FILE" "$SERVER_CMD" server
            die "the tunnel exited; see $RUN_DIR/tunnel.log"
        fi
        if grep -q "Registered tunnel connection" "$RUN_DIR/tunnel.log" 2> /dev/null; then
            say "tunnel up: https://$DOMAIN"
            return 0
        fi
        sleep 0.5
    done
    echo "game-night: warning: the tunnel has not connected in 30s; see $RUN_DIR/tunnel.log" >&2
}

start() {
    local local_only=false rebuild=false arg node_major id
    for arg in "$@"; do
        case "$arg" in
            --local) local_only=true ;;
            --rebuild) rebuild=true ;;
            *) die "unknown option: $arg" ;;
        esac
    done
    load_env
    check_env
    if ! $local_only; then
        check_tunnel
    fi
    command -v curl > /dev/null || die "curl is not installed"
    node_major="$(node -p 'process.versions.node.split(".")[0]')"
    if [[ "$node_major" != "24" ]]; then
        echo "game-night: warning: Node $node_major; the project pins Node 24 (README)" >&2
    fi
    mkdir -p "$RUN_DIR"
    if is_running "$SERVER_PID_FILE" "$SERVER_CMD"; then
        die "already running (game-night.sh stop first)"
    fi
    # A tunnel whose server is gone, from an earlier start: a new one would
    # run beside it and its pid file be lost.
    stop_group "$TUNNEL_PID_FILE" "$TUNNEL_CMD" "leftover tunnel"
    check_ports_free
    warn_unpushed
    id="$(build_id)"
    if $rebuild || needs_build "$id"; then
        build "$id"
        # The build takes minutes; something may have taken a port meanwhile.
        check_ports_free
    fi

    export GIT_COMMIT="$id"
    rotate_log "$RUN_DIR/server.log"
    # setsid: the server becomes its own process group, so stop can signal it
    # together with tsx's node child and the cluster workers. NODE_ENV:
    # Express answers a bad request without its stack trace.
    (
        cd "$REPO_ROOT"
        NODE_ENV=production setsid node_modules/.bin/tsx src/server/Server.ts \
            > "$RUN_DIR/server.log" 2>&1 &
        echo $! > "$SERVER_PID_FILE"
    )
    say "server starting (log: $RUN_DIR/server.log)"
    wait_healthy
    say "server up on http://localhost:$MASTER_PORT"

    if ! $local_only; then
        rotate_log "$RUN_DIR/tunnel.log"
        setsid cloudflared tunnel --no-autoupdate --config "$(tunnel_config)" \
            run "$TUNNEL_NAME" > "$RUN_DIR/tunnel.log" 2>&1 &
        echo $! > "$TUNNEL_PID_FILE"
        say "tunnel starting (log: $RUN_DIR/tunnel.log)"
        wait_tunnel
    fi
}

# stop_group PID_FILE CMD NAME
stop_group() {
    local pid_file="$1" cmd="$2" name="$3" pid _
    if ! is_running "$pid_file" "$cmd"; then
        rm -f "$pid_file"
        return 0
    fi
    pid="$(cat "$pid_file")"
    kill -TERM -- "-$pid" 2> /dev/null || kill -TERM "$pid" 2> /dev/null || true
    for _ in $(seq 1 20); do
        kill -0 "$pid" 2> /dev/null || break
        sleep 0.5
    done
    # Whatever is left of the group (a worker the master re-forked while
    # shutting down) goes too.
    kill -KILL -- "-$pid" 2> /dev/null || true
    rm -f "$pid_file"
    say "stopped $name"
}

status() {
    local health
    if is_running "$SERVER_PID_FILE" "$SERVER_CMD"; then
        health="$(curl -fsS --max-time 2 "$HEALTH_URL" 2> /dev/null || echo "not answering")"
        echo "server: running (pid $(cat "$SERVER_PID_FILE")), health: $health"
    else
        echo "server: stopped"
    fi
    if is_running "$TUNNEL_PID_FILE" "$TUNNEL_CMD"; then
        echo "tunnel: running (pid $(cat "$TUNNEL_PID_FILE"))"
    else
        echo "tunnel: stopped"
    fi
}

case "${1:-}" in
    start)
        shift
        start "$@"
        ;;
    stop)
        stop_group "$TUNNEL_PID_FILE" "$TUNNEL_CMD" tunnel
        stop_group "$SERVER_PID_FILE" "$SERVER_CMD" server
        ;;
    status)
        status
        ;;
    check)
        load_env
        check_env
        say "$ENV_FILE looks good"
        ;;
    *)
        usage >&2
        exit 2
        ;;
esac
