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
#   game-night.sh stop      Stop the tunnel and the server. With no pid file,
#       a server of this checkout still listening on the port (its pid file
#       lost) is found by the port and stopped too.
#   game-night.sh status    Show what is running.
#   game-night.sh check     Validate the env file, then exit.
#
# Settings: .env.selfhost in the repository root (template:
# scripts/selfhost/selfhost.env.example), or the file SELFHOST_ENV_FILE names.
# Logs: .selfhost/server.log and tunnel.log; the previous run's are kept as
# server.log.1 and tunnel.log.1.
#
# For tests only, from the environment: SELFHOST_RUN_DIR (pid files and logs,
# default .selfhost), MASTER_PORT (default 3000; workers take the ports after
# it) and SELFHOST_TEST_EXEC_DELAY (seconds the launched child waits before it
# execs the server, to make the machine look slow).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${SELFHOST_ENV_FILE:-$REPO_ROOT/.env.selfhost}"
RUN_DIR="${SELFHOST_RUN_DIR:-$REPO_ROOT/.selfhost}"
SERVER_PID_FILE="$RUN_DIR/server.pid"
TUNNEL_PID_FILE="$RUN_DIR/tunnel.pid"
BUILD_STAMP="$REPO_ROOT/static/.selfhost-commit"
MASTER_PORT="${MASTER_PORT:-3000}"
[[ "$MASTER_PORT" =~ ^[1-9][0-9]{0,4}$ ]] && ((MASTER_PORT <= 65535)) \
    || { echo "game-night: MASTER_PORT must be a port number, got '$MASTER_PORT'" >&2; exit 1; }
# The server reads it too (ServerEnv.masterPort).
export MASTER_PORT
HEALTH_URL="http://127.0.0.1:$MASTER_PORT/api/health"
# What each pid file's process runs (`ps` args). Pid files hold "PID
# STARTTIME" (see is_running); this is checked only for an older one that
# holds just the pid, and for a server found by its port.
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

# stat_field PID N: field N of /proc/PID/stat (3 state, 5 process group,
# 22 start time). The command name, field 2, may hold spaces and
# parentheses, so the fields are counted from after its last ")".
stat_field() {
    local stat fields
    stat="$(cat "/proc/$1/stat" 2> /dev/null)" || return 1
    read -ra fields <<< "${stat##*) }"
    echo "${fields[$(($2 - 3))]}"
}

# record_pid PID PID_FILE: writes "PID STARTTIME". The start time (clock
# ticks since boot) is set when the process forks and kept when it execs,
# so the pair names this one process from the moment start launches it,
# while it is still a copy of this script about to exec setsid, until it
# exits; a later process given the same pid has another start time.
record_pid() {
    echo "$1 $(stat_field "$1" 22 || echo 0)" > "$2"
}

# pid_of PID_FILE: the pid it holds.
pid_of() {
    local pid _
    read -r pid _ < "$1" || true
    echo "$pid"
}

# is_running PID_FILE CMD: the pid file names a live process, the one start
# launched. Checking what the process runs instead would fail while it has
# not yet exec'd (a slow machine, right after a build): start then took a
# booting server for a dead one, and the server stayed up with no pid file.
is_running() {
    local pid start args
    [[ -f "$1" ]] || return 1
    read -r pid start < "$1" || true
    [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
    if [[ -n "$start" ]]; then
        [[ "$(stat_field "$pid" 3)" != [ZX] && "$(stat_field "$pid" 22)" == "$start" ]]
        return
    fi
    # A pid file written before start times were recorded.
    args="$(ps -ww -o args= -p "$pid" 2> /dev/null)" || return 1
    [[ "$args" == *"$2"* ]]
}

# port_listener PORT: the pid listening on PORT, from ss; "?" when
# something listens but ss may not name it (another user's process);
# nothing when the port is free or ss is missing.
port_listener() {
    local line
    command -v ss > /dev/null || return 0
    line="$(ss -ltnpH "sport = :$1" 2> /dev/null | head -n 1)"
    [[ -n "$line" ]] || return 0
    if [[ "$line" =~ pid=([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo "?"
    fi
}

# this_checkouts_server PID: PID is a server start launched from this
# checkout: it runs SERVER_CMD in REPO_ROOT, and everything in its process
# group (the group setsid made) is part of the server: tsx, its node child,
# the cluster workers and tsx's esbuild service. A server started any other
# way (npm run dev, by hand in a terminal) shares its group with other
# programs, and is not stopped.
this_checkouts_server() {
    local pid="$1" group args cwd member_args
    args="$(ps -ww -o args= -p "$pid" 2> /dev/null)" || return 1
    [[ "$args" == *"$SERVER_CMD"* ]] || return 1
    cwd="$(readlink "/proc/$pid/cwd" 2> /dev/null)" || return 1
    [[ "$cwd" == "$REPO_ROOT" ]] || return 1
    group="$(stat_field "$pid" 5)" || return 1
    [[ "$group" =~ ^[1-9][0-9]*$ && "$group" != 1 ]] || return 1
    while IFS= read -r member_args; do
        [[ "$member_args" == *"$SERVER_CMD"* || "$member_args" == *"esbuild --service"* ]] \
            || return 1
    done < <(ps -e -ww -o pgid=,args= | awk -v g="$group" '$1 == g { sub(/^ *[0-9]+ /, ""); print }')
}

# Whether anything listens on 127.0.0.1:PORT: curl exits 7 only when it
# could not connect at all.
port_in_use() {
    local code=0
    curl -sS --noproxy '*' -o /dev/null --max-time 3 "http://127.0.0.1:$1/" > /dev/null 2>&1 \
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
        if curl -fsS --noproxy '*' --max-time 2 "$HEALTH_URL" > /dev/null 2>&1; then
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
        (
            if [[ -n "${SELFHOST_TEST_EXEC_DELAY:-}" ]]; then
                sleep "$SELFHOST_TEST_EXEC_DELAY"
            fi
            export NODE_ENV=production
            exec setsid node_modules/.bin/tsx src/server/Server.ts
        ) > "$RUN_DIR/server.log" 2>&1 &
        record_pid $! "$SERVER_PID_FILE"
    )
    say "server starting (log: $RUN_DIR/server.log)"
    wait_healthy
    say "server up on http://localhost:$MASTER_PORT"

    if ! $local_only; then
        rotate_log "$RUN_DIR/tunnel.log"
        setsid cloudflared tunnel --no-autoupdate --config "$(tunnel_config)" \
            run "$TUNNEL_NAME" > "$RUN_DIR/tunnel.log" 2>&1 &
        record_pid $! "$TUNNEL_PID_FILE"
        say "tunnel starting (log: $RUN_DIR/tunnel.log)"
        wait_tunnel
    fi
}

# kill_group PID: stops the process group PID leads (setsid made it): TERM,
# up to 10 s for PID to exit, then KILL for whatever is left.
kill_group() {
    local pid="$1" _
    # Launched a moment ago, it may not have exec'd setsid yet, and a group
    # signal would miss what it is about to start. Wait until it leads its
    # group (or is gone).
    for _ in $(seq 1 20); do
        [[ "$(stat_field "$pid" 5)" != "$pid" ]] || break
        kill -0 "$pid" 2> /dev/null || break
        sleep 0.25
    done
    kill -TERM -- "-$pid" 2> /dev/null || kill -TERM "$pid" 2> /dev/null || true
    for _ in $(seq 1 20); do
        kill -0 "$pid" 2> /dev/null || break
        sleep 0.5
    done
    # Whatever is left of the group (a worker the master re-forked while
    # shutting down) goes too. Then wait until the group is gone, so the
    # ports are free when stop returns.
    kill -KILL -- "-$pid" 2> /dev/null || true
    for _ in $(seq 1 20); do
        kill -0 -- "-$pid" 2> /dev/null || break
        sleep 0.25
    done
}

# stop_group PID_FILE CMD NAME
stop_group() {
    local pid_file="$1" cmd="$2" name="$3"
    if ! is_running "$pid_file" "$cmd"; then
        rm -f "$pid_file"
        return 0
    fi
    kill_group "$(pid_of "$pid_file")"
    rm -f "$pid_file"
    say "stopped $name"
}

# stop_untracked: no pid file names a running server, yet something may
# listen on the master's port: this checkout's server whose pid file was
# lost is stopped; anything else is only named.
stop_untracked() {
    local pid group
    pid="$(port_listener "$MASTER_PORT")"
    [[ -n "$pid" ]] || return 0
    if [[ "$pid" == "?" ]]; then
        say "port $MASTER_PORT is in use by a process ss cannot name (another user's?); left alone"
        return 0
    fi
    if ! this_checkouts_server "$pid"; then
        say "port $MASTER_PORT is in use by pid $pid, not a server game-night.sh started here; left alone (kill $pid to stop it)"
        return 0
    fi
    group="$(stat_field "$pid" 5)"
    kill_group "$group"
    say "stopped a server with no pid file (process group $group, port $MASTER_PORT)"
}

status() {
    local health listener
    if is_running "$SERVER_PID_FILE" "$SERVER_CMD"; then
        health="$(curl -fsS --noproxy '*' --max-time 2 "$HEALTH_URL" 2> /dev/null || echo "not answering")"
        echo "server: running (pid $(pid_of "$SERVER_PID_FILE")), health: $health"
    else
        echo "server: stopped"
        listener="$(port_listener "$MASTER_PORT")"
        if [[ -n "$listener" ]]; then
            echo "port $MASTER_PORT: in use by pid $listener, with no pid file (game-night.sh stop stops it if it is a server started here)"
        fi
    fi
    if is_running "$TUNNEL_PID_FILE" "$TUNNEL_CMD"; then
        echo "tunnel: running (pid $(pid_of "$TUNNEL_PID_FILE"))"
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
        if is_running "$SERVER_PID_FILE" "$SERVER_CMD"; then
            stop_group "$SERVER_PID_FILE" "$SERVER_CMD" server
        else
            rm -f "$SERVER_PID_FILE"
            stop_untracked
        fi
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
