import { GameType } from "@openfront/engine-api/game/GameTypes";
import { PublicGames } from "@openfront/shared/WireSchemas";
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getDesktopSessionState } from "./Auth";
import "./components/InstallAppPrompt";
import "./components/OpenRoomsList";
import type { OpenRoomJoinDetail } from "./components/OpenRoomsList";
import {
  getDesktopUpdateState,
  isDesktopShell,
  multiplayerAllowed,
  multiplayerAllowedForSession,
  type DesktopSessionState,
  type DesktopUpdateState,
} from "./DesktopShell";
import type { HostLobbyModal } from "./HostLobbyModal";
import { showInGameAlert } from "./InGameModal";
import type { JoinLobbyModal } from "./JoinLobbyModal";
import { whenModalLoaded } from "./LazyModals";
import { PublicLobbySocket } from "./LobbySocket";
import { JoinLobbyEvent } from "./Main";
import { isOffline, onOfflineChange } from "./pwa/OfflineState";
import {
  backendUnreachableConfirmed,
  isPinnedToAVersion,
  manualRetryAvailable,
  retryServerList,
  type BackendReachabilityDetail,
} from "./ServerList";
import type { SinglePlayerModal } from "./SinglePlayerModal";
import { UsernameInput } from "./UsernameInput";
import { reloadForUpdate, showToast, translateText } from "./Utils";
import { isReplayShellHost } from "./VersionedReplay";

// The home menu (Statecraft is played among friends, so the homepage is
// just the three ways into a game; atlas.css draws the buttons).
const PRIMARY_ACTION = "atlas-action atlas-action-primary";
const SECONDARY_ACTION = "atlas-action atlas-action-secondary";

/**
 * THE REACHABILITY RULE (OPE-439). Stated once, here; every other call site
 * in this feature points back at this comment rather than restating it.
 *
 * The backend-reachability signal is the health of ONE thing: the server-list
 * API (`/cluster.json`), as observed by ServerList's heartbeat. It is not a
 * general "is the internet up" light, and in particular it says nothing about
 * whether any given GAME server is up.
 *
 * So it may gate exactly one category of action: the ones that cannot even
 * begin without that API answering first, because nothing has yet told the
 * client which server to talk to.
 *
 *   GATED (API-dependent): creating/hosting a lobby, entering matchmaking,
 *   opening the join-by-code modal. Each has to resolve a server for
 *   something the client has heard nothing about, so a dead list API really
 *   does mean the click cannot work. These dim, and refuse with
 *   reportMultiplayerRefusal.
 *
 *   NOT GATED (socket-sourced): anything whose target arrived over a live
 *   game-server socket -- every card in the detailed lobby browser -- and
 *   every join that reaches Main's funnel (shouldBlockJoin). The card's very
 *   existence is proof that the game server behind it is up and talking to
 *   us, which is the only liveness that join needs. Refusing there could
 *   only ever reject a join that is already under way, over the health of an
 *   unrelated API. These neither dim nor refuse on reachability: they call
 *   shouldBlockSocketSourcedAction, which is the same predicate with the
 *   reachability input nailed shut.
 *
 * The other two inputs (desktop update state, desktop session state) apply to
 * both categories, which is why the two predicates differ only in this one
 * argument.
 *
 * ---
 *
 * Whether multiplayer should be available given what we know about the
 * backend.
 *
 * The parameter is ServerList.backendUnreachableConfirmed(), NOT the raw
 * backendReachable(), and the difference is load-bearing. That accessor is
 * already false for the two states this must never gate:
 *
 *   - before the first attempt settles. A page is in that state for its first
 *     few hundred milliseconds, and gating there would lock every player out
 *     of multiplayer on every load over a suspicion we have not tested yet.
 *   - after a single missed heartbeat. The cached list is still serving and
 *     the next request would very likely have worked; taking the game away
 *     for a retry interval over one blip is worse than the blip.
 *
 * It is also false when the API answered with anything short of a 5xx -- a
 * 404 for a site with no list is a reachable backend.
 */
export function multiplayerAllowedForBackend(backendOutage: boolean): boolean {
  return !backendOutage;
}

/**
 * Whether a multiplayer entry point should refuse to act. Exported for tests
 * and kept free of component state so the rule is checkable in isolation.
 * A null update/session means that bridge is absent (the web build), so it
 * gates nothing; any one of the three alone is enough to block.
 *
 * `backendOutage` is the only one of the three that also applies on the web,
 * which is why it is a required parameter rather than an optional one: an
 * entry point that forgets to pass it would silently stay ungated, and a
 * compile error is the cheapest way to notice. Pass
 * backendUnreachableConfirmed() only from an API-dependent entry point; a
 * socket-sourced one calls shouldBlockSocketSourcedAction instead, so that
 * "reachability does not apply here" is a named decision rather than a
 * `false` literal someone has to interpret.
 */
export function shouldBlockMultiplayerAction(
  update: DesktopUpdateState | null,
  session: DesktopSessionState | null,
  backendOutage: boolean,
): boolean {
  if (update !== null && !multiplayerAllowed(update)) return true;
  if (session !== null && !multiplayerAllowedForSession(session)) return true;
  if (!multiplayerAllowedForBackend(backendOutage)) return true;
  return false;
}

/**
 * Whether the public-lobby feed should be closed rather than kept open.
 *
 * A gated desktop session refuses every join the feed could offer, so keeping
 * the socket open only spends a connection on rooms nobody can join. Close it
 * instead; it reopens when the session comes back.
 *
 * Reachability is deliberately NOT an input, by the rule at the top of this
 * file: the feed is socket-sourced, and the list API's health says nothing
 * about the game server behind it. The update state is not either -- a
 * pending update is not "offline".
 */
export function lobbyFeedSuspended(
  session: DesktopSessionState | null,
): boolean {
  return session !== null && !multiplayerAllowedForSession(session);
}

/**
 * The same gate for an action whose target arrived over a live game-server
 * socket: a public or hosted lobby card, in either browser, and every join
 * that reaches Main's funnel (shouldBlockJoin below wraps this).
 *
 * Reachability is not an input, by the rule at the top of this file: the card
 * is in front of the player because a game server sent it over a socket that
 * is still open, so the server-list API's health cannot make joining it
 * wrong. The desktop update and session states still apply -- they are
 * statements about this client, not about any server.
 *
 * A function rather than `shouldBlockMultiplayerAction(u, s, false)` at four
 * call sites so the dimming and the click-through of a given control cannot
 * drift apart, and so grep finds every place the rule is exercised.
 */
export function shouldBlockSocketSourcedAction(
  update: DesktopUpdateState | null,
  session: DesktopSessionState | null,
): boolean {
  return shouldBlockMultiplayerAction(update, session, false);
}

/**
 * Tells the player why a multiplayer action was refused -- and, on the web,
 * acts as the retry it tells them to make.
 *
 * On desktop the status bar is already showing the reason and its remedy, so
 * the click lands there as a wiggle rather than as a message that would say
 * the same thing twice. The web has no status bar, so an unreachable backend
 * would refuse in complete silence -- which reads as a broken button -- and
 * gets a transient message instead.
 *
 * Only reachability needs the web half: every other reason to refuse here is
 * desktop-only, and on desktop the bar always carries it.
 *
 * The refused click also PROBES on the web, and that is the point rather than
 * a nicety. Desktop has a Retry button; the web has nothing, so without this
 * the only way out of the gated state is the heartbeat's own next beat --
 * which backs off to as much as RETRY_MAX_MS once an outage has run a while.
 * A message reading "try again" over a button where trying again provably did
 * nothing is worse than no message. So the click the player makes IS the
 * retry, and the message is true.
 *
 * Throttled by ServerList.manualRetryAvailable(), the same policy (and the
 * same clock) as the desktop button's disabled state: nothing while an
 * attempt is already out, nothing for MANUAL_RETRY_COOLDOWN_MS after the last
 * one. A player clicking at an outage gets the message every time and a
 * request at most every few seconds. Nothing is rendered from the result: a
 * successful probe flips the reachability signal, which is what un-dims the
 * buttons -- the feedback is the gate going away.
 */
export function reportMultiplayerRefusal(backendOutage: boolean): void {
  // Optional-call the method rather than dispatching an event: the bar is a
  // sibling custom element that may not have upgraded yet, and `?.wiggle?.()`
  // degrades to a silent no-op in that case instead of firing an event with
  // no listener.
  (
    document.querySelector("desktop-status-bar") as
      | (HTMLElement & { wiggle?: () => void })
      | null
  )?.wiggle?.();
  // Keyed on the shell, not on the element: <desktop-status-bar> is in
  // index.html on every build and simply renders nothing on the web, so its
  // presence proves nothing about whether the player can see a reason.
  if (!isDesktopShell() && backendOutage) {
    if (manualRetryAvailable()) {
      retryServerList().catch((err: unknown) => {
        // retryServerList never rejects; belt and braces, so a change there
        // cannot surface as an unhandled rejection from a click handler.
        console.warn("server list retry from a refused click failed", err);
      });
    }
    showToast(translateText("common.backend_unreachable"), "red");
  }
}

/**
 * Whether the multiplayer gate applies to a given join at all. Single-player
 * runs entirely in-client and a replay simulates from an archived record, so
 * neither needs a session, an up-to-date build, or a backend that is up.
 * getTurnstileToken in Main.ts exempts the same pair (alongside two
 * conditions irrelevant here), and calls this so the two cannot drift.
 * Exported for tests and kept free of component state, like
 * shouldBlockMultiplayerAction above.
 */
export function joinIsGateable(lobby: JoinLobbyEvent): boolean {
  return (
    lobby.gameStartInfo?.config.gameType !== GameType.Singleplayer &&
    lobby.gameRecord === undefined
  );
}

/**
 * The whole gate decision for one join, as a pure function so it is testable
 * without mounting Main's client. Main adds only the shell check (which
 * decides whether the two desktop states are even read) and the refusal
 * feedback around it. Both halves it does weigh -- the update state and the
 * session state -- are desktop-only.
 *
 * Backend reachability is deliberately NOT an input here -- the rule at the
 * top of this file, which is why this defers to
 * shouldBlockSocketSourcedAction. Every source that dispatches a join has
 * already reached a server to produce it: "private" only after
 * checkActiveLobby read `exists` from the game's own server, "host" only
 * after createLobby minted the id, "public" from a lobby list arriving over a
 * live server socket, and "matchmaking" only after the queue matched and
 * checkGame confirmed the game exists. The outage signal tracks the separate
 * server-list API, whose health says nothing about those servers, so refusing
 * here could only reject a join that is already under way. Worst case it
 * ejects a player mid-game: a reload during a list-API blip proves the game
 * is live, then the refusal closes the join modal, which leaves the lobby and
 * resets the URL.
 *
 * The controls one step earlier in the funnel -- the lobby cards in
 * DetailedGameViewModal, which are where a "public" join comes from -- hold
 * to the same rule for the same reason, so a card is
 * neither dimmed nor refused over a list-API outage.
 */
export function shouldBlockJoin(
  lobby: JoinLobbyEvent,
  update: DesktopUpdateState | null,
  session: DesktopSessionState | null,
): boolean {
  if (!joinIsGateable(lobby)) return false;
  return shouldBlockSocketSourcedAction(update, session);
}

@customElement("game-mode-selector")
export class GameModeSelector extends LitElement {
  @state() private lobbies: PublicGames | null = null;
  @state() private inputValid: boolean = true;
  @state() private desktopUpdateState: DesktopUpdateState | null = null;
  @state() private desktopSessionState: DesktopSessionState | null = null;
  // The DEBOUNCED outage signal, not the raw per-attempt one: see
  // multiplayerAllowedForBackend for why one missed heartbeat must not dim
  // these buttons.
  @state() private backendOutage = false;
  // No network (pwa/OfflineState.ts): only Solo works, so Create and Join
  // are off and the room list is gone; the menu's banner says why.
  @state() private offline = isOffline();
  private unsubscribeOffline: (() => void) | null = null;

  // True from join-lobby until leave-lobby: the player is waiting in (or
  // loading into) a lobby. This socket is NOT scoped to the homepage — Main.ts
  // only stops it when a game actually starts (prestart/join), so it is still
  // listening during the whole lobby wait.
  private inLobby = false;
  // Whether Main wants the feed open at all (false from game start until the
  // player is back at the menu). Kept apart from the socket's own state so a
  // session change can close and reopen the feed without forgetting that.
  private feedWanted = false;
  // An update/drain signal arrived during a lobby wait; prompt on leave-lobby.
  private updateDeferred = false;

  private lobbySocket = new PublicLobbySocket(
    (lobbies) => this.handleLobbiesUpdate(lobbies),
    {
      onUpdateAvailable: () => this.handleUpdateAvailable(),
      onGaveUp: () => {
        // A feed that has died no longer knows which rooms are open.
        this.lobbies = null;
      },
    },
  );

  private handleUpdateAvailable() {
    // The desktop shell runs the bundle from a local overlay and updates it
    // itself (download, stage, then its own reload button, see
    // DesktopUpdateBar). Reloading here would only re-run the old overlay,
    // reconnect, and trigger this again until the download finishes.
    if (isDesktopShell()) return;
    // A versioned replay shell is pinned to the archived game's build on
    // purpose (VersionedReplay.ts), but its baked-in serverHost points at a
    // live deployment running a newer build — so the lobby socket's commit
    // compare (or a drain signal) fires on every load. "Update" is
    // meaningless here, and reloading re-serves the same immutable shell,
    // which would loop the prompt forever.
    if (isReplayShellHost(window.location.hostname)) return;
    // A page pinned under /v/<commit>/ is on that build because the game it
    // opened runs there (redirectToGameVersion), and its build's servers are
    // draining by definition -- so the lobby feed's drain signal fires on
    // every load. Reloading would strip the pin, land on latest, and be
    // re-pinned straight back: the same loop as the replay shell, closed the
    // same way. Leaving to the menu goes to the version-free root anyway.
    if (isPinnedToAVersion()) return;
    // A blocking reload prompt during a lobby wait would eject the player
    // from a lobby the draining deployment deliberately lets finish — and a
    // private lobby's members are all pinned to the same deployment, so they
    // would all be prompted out at once. Defer until they leave the lobby;
    // if the game starts instead, Main.ts stops this socket, and every exit
    // from a started game is a full navigation that picks up the new shell
    // anyway.
    if (this.inLobby) {
      this.updateDeferred = true;
      return;
    }
    showInGameAlert(translateText("update_available.message")).then(() => {
      reloadForUpdate();
    });
  }

  createRenderRoot() {
    return this;
  }

  // Silent backstop; the buttons are already disabled while input is invalid.
  private validateUsername(): boolean {
    const usernameInput = document.querySelector(
      "username-input",
    ) as UsernameInput | null;
    return usernameInput ? usernameInput.canPlay() : true;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(
      "username-validity-change",
      this.handleValidityChange,
    );
    document.addEventListener(
      "desktop-update-state",
      this.onDesktopUpdateState,
    );
    if (isDesktopShell()) {
      // Seed BOTH from their current values. This element is rendered by
      // <play-page> on a Lit microtask, so it cannot exist yet when the status
      // bar dispatches the update bridge's synchronous replay -- without the
      // seed the update half of the gate stays null and silently never
      // applies (OPE-396).
      this.desktopUpdateState = getDesktopUpdateState();
      this.desktopSessionState = getDesktopSessionState();
    }
    // After the session seed above: a shell that already knows it has no
    // session must not open a feed it will close on the next tick.
    this.start();
    document.addEventListener(
      "desktop-session-state",
      this.onDesktopSessionState,
    );
    // Seeded unconditionally, unlike the two above: the backend is just as
    // unreachable on the web, and the heartbeat's first attempts often settle
    // before this element exists (it is started in Main's initialize, we are
    // rendered by <play-page> later), so the event alone would miss them.
    this.backendOutage = backendUnreachableConfirmed();
    document.addEventListener(
      "backend-reachability",
      this.onBackendReachability,
    );
    document.addEventListener("join-lobby", this.onJoinLobby);
    document.addEventListener("leave-lobby", this.onLeaveLobby);
    this.offline = isOffline();
    this.unsubscribeOffline = onOfflineChange(this.onOfflineChange);
    // Pick up the current value in case username-input validated before us.
    const usernameInput = document.querySelector(
      "username-input",
    ) as UsernameInput | null;
    if (usernameInput) {
      this.inputValid = usernameInput.canPlay();
    }
  }

  disconnectedCallback() {
    this.stop();
    window.removeEventListener(
      "username-validity-change",
      this.handleValidityChange,
    );
    document.removeEventListener(
      "desktop-update-state",
      this.onDesktopUpdateState,
    );
    document.removeEventListener(
      "desktop-session-state",
      this.onDesktopSessionState,
    );
    document.removeEventListener(
      "backend-reachability",
      this.onBackendReachability,
    );
    document.removeEventListener("join-lobby", this.onJoinLobby);
    document.removeEventListener("leave-lobby", this.onLeaveLobby);
    this.unsubscribeOffline?.();
    this.unsubscribeOffline = null;
    super.disconnectedCallback();
  }

  private onJoinLobby = () => {
    this.inLobby = true;
  };

  private onLeaveLobby = () => {
    this.inLobby = false;
    if (this.updateDeferred) {
      this.updateDeferred = false;
      this.handleUpdateAvailable();
    }
  };

  private handleValidityChange = (e: Event) => {
    this.inputValid = (e as CustomEvent).detail?.isValid ?? true;
  };

  private onDesktopUpdateState = (e: Event) => {
    this.desktopUpdateState = (e as CustomEvent<DesktopUpdateState>).detail;
  };

  private onDesktopSessionState = (e: Event) => {
    const next = (e as CustomEvent<DesktopSessionState>).detail;
    const wasSuspended = lobbyFeedSuspended(this.desktopSessionState);
    this.desktopSessionState = next;
    const suspended = lobbyFeedSuspended(next);
    if (suspended === wasSuspended || !this.feedWanted) return;
    if (suspended) {
      this.closeLobbyFeed();
    } else {
      this.lobbySocket.start();
    }
  };

  // The feed follows the network: closed while offline (it could only fail
  // and retry), reopened when the network is back if Main still wants it.
  private onOfflineChange = (offline: boolean) => {
    this.offline = offline;
    if (offline) {
      this.closeLobbyFeed();
    } else if (this.feedWanted) {
      this.openLobbyFeed();
    }
  };

  private onBackendReachability = (e: Event) => {
    this.backendOutage = (
      e as CustomEvent<BackendReachabilityDetail>
    ).detail.confirmed;
  };

  public stop() {
    this.feedWanted = false;
    this.lobbySocket.stop();
  }

  // Also drops the snapshot: a feed we have closed no longer knows which
  // rooms are open.
  private closeLobbyFeed() {
    this.lobbySocket.stop();
    this.lobbies = null;
  }

  /**
   * Re-open the public-lobby socket after stop().
   *
   * connectedCallback() used to be the only caller of lobbySocket.start(),
   * which was fine while every exit from a started game reloaded the page. It
   * is not fine for an exit that leaves in place (openInvite, OPE-255): this
   * element is never disconnected, so connectedCallback never runs again and
   * the lobby list stayed frozen on whatever it last received.
   *
   * Safe to call when already running -- PublicLobbySocket.start() closes any
   * existing socket before opening a new one -- but callers should still only
   * use it to undo a stop(), since a needless reconnect drops the cached
   * snapshot and re-primes the list from the server.
   */
  public start() {
    this.openLobbyFeed();
  }

  private openLobbyFeed() {
    this.feedWanted = true;
    if (this.offline || lobbyFeedSuspended(this.desktopSessionState)) {
      // The session may have dropped while Main had the feed stopped, in
      // which case the snapshot from before the game is still here.
      this.lobbies = null;
      return;
    }
    this.lobbySocket.start();
  }

  private handleLobbiesUpdate(lobbies: PublicGames) {
    this.lobbies = lobbies;
    document.dispatchEvent(
      new CustomEvent("public-lobbies-update", {
        detail: { payload: lobbies },
      }),
    );
  }

  /**
   * The home menu: Solo, then the two ways into a room among friends. The
   * public lobby list, the upcoming column, Ranked and the tutorial card are
   * gone from this fork's homepage (the tutorial stays on the help page).
   */
  render() {
    return html`
      <div class="flex flex-col gap-3 w-full">
        <install-app-prompt
          class="no-game-portal flex justify-center [&:empty]:hidden"
        ></install-app-prompt>
        ${this.renderAction(
          translateText("main.solo"),
          this.openSinglePlayerModal,
          PRIMARY_ACTION,
          SOLO_ICON,
        )}
        <div class="grid grid-cols-2 gap-3">
          ${this.renderAction(
            translateText("main.create"),
            this.openHostLobby,
            SECONDARY_ACTION,
            CREATE_ICON,
            undefined,
            true,
          )}
          ${this.renderAction(
            translateText("main.join"),
            this.openJoinLobby,
            SECONDARY_ACTION,
            JOIN_ICON,
            this.hostedLobbyCount(),
            true,
          )}
        </div>
        ${this.offline
          ? nothing
          : html`<open-rooms-list
              .rooms=${this.lobbies?.games?.hosted ?? []}
              .loaded=${this.lobbies !== null}
              .disabled=${!this.inputValid}
              @open-room-join=${this.onOpenRoomJoin}
            ></open-rooms-list>`}
      </div>
    `;
  }

  // One tap on a row joins exactly like typing its code: the join modal
  // opens on the id and runs the same exists/version check and join.
  private onOpenRoomJoin = (e: CustomEvent<OpenRoomJoinDetail>) => {
    if (this.blockedFromApiAction()) return;
    if (!this.validateUsername()) return;
    const lobbyId = e.detail.gameID;
    whenModalLoaded("join-lobby-modal", () =>
      (document.querySelector("join-lobby-modal") as JoinLobbyModal)?.open({
        lobbyId,
      }),
    );
  };

  /**
   * Refuses an API-DEPENDENT action (Create, Join by code) and tells the
   * player why. Returns true when the caller should stop.
   *
   * The reachability half applies here -- see the rule at the top of this
   * file: neither can resolve a server without the list API.
   *
   * Deliberately NOT implemented with the `disabled` attribute the way
   * renderAction handles invalid input: a disabled control (and
   * `pointer-events-none` alongside it) swallows the click, leaving nothing to
   * trigger the wiggle -- and, on the web, nothing to trigger the retry that
   * reportMultiplayerRefusal makes of it. The button stays clickable and
   * merely stops being actionable.
   */
  private blockedFromApiAction(): boolean {
    if (this.offline) {
      showToast(translateText("pwa.offline_banner"), "red");
      return true;
    }
    if (
      !shouldBlockMultiplayerAction(
        this.desktopUpdateState,
        this.desktopSessionState,
        this.backendOutage,
      )
    )
      return false;
    reportMultiplayerRefusal(this.backendOutage);
    return true;
  }

  private openSinglePlayerModal = () => {
    if (!this.validateUsername()) return;
    whenModalLoaded("single-player-modal", () =>
      (
        document.querySelector("single-player-modal") as SinglePlayerModal
      )?.open(),
    );
  };

  private openHostLobby = () => {
    if (this.blockedFromApiAction()) return;
    if (!this.validateUsername()) return;
    whenModalLoaded("host-lobby-modal", () =>
      (document.querySelector("host-lobby-modal") as HostLobbyModal)?.open(),
    );
  };

  private openJoinLobby = () => {
    if (this.blockedFromApiAction()) return;
    if (!this.validateUsername()) return;
    whenModalLoaded("join-lobby-modal", () =>
      (document.querySelector("join-lobby-modal") as JoinLobbyModal)?.open(),
    );
  };

  // Rooms other players host and list, waiting in the browser; shown as a
  // count on the Join button.
  private hostedLobbyCount(): number {
    return this.lobbies?.games?.hosted?.length ?? 0;
  }

  private renderAction(
    title: string,
    onClick: () => void,
    variantClass: string,
    icon: TemplateResult,
    badge?: number,
    // Only the multiplayer actions (create/join) pass this; Solo is never
    // gated (see openSinglePlayerModal) and must never show as disabled here.
    gated: boolean = false,
  ) {
    const offline = gated && this.offline;
    const blocked =
      offline ||
      (gated &&
        shouldBlockMultiplayerAction(
          this.desktopUpdateState,
          this.desktopSessionState,
          this.backendOutage,
        ));
    return html`
      <button
        @click=${onClick}
        ?disabled=${!this.inputValid}
        aria-disabled=${blocked}
        title=${offline ? translateText("pwa.offline_banner") : nothing}
        class="${variantClass} ${blocked ? "atlas-action-blocked" : ""}"
      >
        ${icon}
        <span>${title}</span>
        ${badge
          ? html`<span class="atlas-action-badge">${badge}</span>`
          : nothing}
      </button>
    `;
  }
}

/** A single figure: playing alone. */
const SOLO_ICON = html`<svg
  viewBox="0 0 24 24"
  class="atlas-action-icon"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <circle cx="12" cy="8" r="3.5" />
  <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
</svg>`;

/** A plus: opening a new room. */
const CREATE_ICON = html`<svg
  viewBox="0 0 24 24"
  class="atlas-action-icon"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
  <path d="M12 8v8M8 12h8" />
</svg>`;

/** Walking through a door: entering a friend's room. */
const JOIN_ICON = html`<svg
  viewBox="0 0 24 24"
  class="atlas-action-icon"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
  <path d="M9 16l4-4-4-4" />
  <path d="M13 12H3" />
</svg>`;
