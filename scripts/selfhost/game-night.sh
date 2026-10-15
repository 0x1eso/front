#!/usr/bin/env bash
# Game night on a self-hosted server (README, "자체 호스팅 (게임 나이트)").
#
#   game-night.sh start [--local] [--rebuild]
#       Build when the commit changed, start the game server with the
#       self-host settings, wait until it answers, then open the Cloudflare
#       Tunnel. --local skips the tunnel (http://localhost:3000 or the LAN);
#       --rebuild builds even when nothing changed.
#   game-night.sh stop      Stop the tunnel and the server.
#   game-night.sh status    Show what is running.
#   game-night.sh check     Validate the env file, then exit.
#
# Settings: .env.selfhost in the repository root (template:
# scripts/selfhost/selfhost.env.example), or the file SELFHOST_ENV_FILE names.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${SELFHOST_ENV_FILE:-$REPO_ROOT/.env.selfhost}"
RUN_DIR="$REPO_ROOT/.selfhost"
SERVER_PID_FILE="$RUN_DIR/server.pid"
TUNNEL_PID_FILE="$RUN_DIR/tunnel.pid"
BUILD_STAMP="$REPO_ROOT/static/.selfhost-commit"
HEALTH_URL="http://127.0.0.1:3000/api/health"

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

is_running() {
    [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2> /dev/null
}

needs_build() {
    [[ -f "$REPO_ROOT/static/index.html" && -f "$BUILD_STAMP" ]] || return 0
    [[ "$(cat "$BUILD_STAMP")" == "$(git -C "$REPO_ROOT" rev-parse HEAD)" ]] \
        || return 0
    [[ -z "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]] \
        || return 0
    return 1
}

build() {
    say "building (npm run build-prod); this takes a few minutes"
    (cd "$REPO_ROOT" && npm run build-prod)
    git -C "$REPO_ROOT" rev-parse HEAD > "$BUILD_STAMP"
}

warn_unpushed() {
    if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]]; then
        echo "game-night: warning: the working tree has uncommitted changes. AGPL section 13: the source link must match the code that is running." >&2
    fi
    if [[ -z "$(git -C "$REPO_ROOT" branch -r --contains HEAD 2> /dev/null)" ]]; then
        echo "game-night: warning: this commit is not pushed. AGPL section 13: players must be able to get the source that is running (git push)." >&2
    fi
}

wait_healthy() {
    local _
    for _ in $(seq 1 120); do
        if curl -fsS "$HEALTH_URL" > /dev/null 2>&1; then
            return 0
        fi
        is_running "$SERVER_PID_FILE" \
            || die "the server exited; see $RUN_DIR/server.log"
        sleep 0.5
    done
    die "the server did not become healthy in 60s; see $RUN_DIR/server.log"
}

start() {
    local local_only=false rebuild=false arg node_major
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
    if is_running "$SERVER_PID_FILE"; then
        die "already running (game-night.sh stop first)"
    fi
    warn_unpushed
    if $rebuild || needs_build; then
        build
    fi

    GIT_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
    export GIT_COMMIT
    # setsid: the server becomes its own process group, so stop can signal it
    # together with tsx's node child and the cluster workers.
    (
        cd "$REPO_ROOT"
        setsid node_modules/.bin/tsx src/server/Server.ts > "$RUN_DIR/server.log" 2>&1 &
        echo $! > "$SERVER_PID_FILE"
    )
    say "server starting (log: $RUN_DIR/server.log)"
    wait_healthy
    say "server up on http://localhost:3000"

    if ! $local_only; then
        setsid cloudflared tunnel --no-autoupdate --config "$(tunnel_config)" \
            run "$TUNNEL_NAME" > "$RUN_DIR/tunnel.log" 2>&1 &
        echo $! > "$TUNNEL_PID_FILE"
        say "tunnel starting: https://$DOMAIN (log: $RUN_DIR/tunnel.log)"
    fi
}

stop_group() {
    local pid_file="$1" name="$2" pid _
    if ! is_running "$pid_file"; then
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
    if is_running "$SERVER_PID_FILE"; then
        health="$(curl -fsS "$HEALTH_URL" 2> /dev/null || echo "not answering")"
        echo "server: running (pid $(cat "$SERVER_PID_FILE")), health: $health"
    else
        echo "server: stopped"
    fi
    if is_running "$TUNNEL_PID_FILE"; then
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
        stop_group "$TUNNEL_PID_FILE" tunnel
        stop_group "$SERVER_PID_FILE" server
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
