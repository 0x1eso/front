import {
  DomesticData,
  VICTORY_PROJECT_KINDS,
  VictoryProjectKind,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  ColoredTeams,
  GameMode,
  Team,
} from "@openfront/engine-api/game/GameTypes";
import {
  MILLI,
  POLITICAL_PROJECT_POLITICAL,
  PROJECT_HOST_MIN_LEVEL,
} from "@openfront/engine-lib/domestic/Balance";
import { projectProgress } from "@openfront/engine-lib/domestic/Score";
import {
  projectQualified,
  VICTORY_PROJECTS,
  victoryProjectBlock,
} from "@openfront/engine-lib/domestic/Victory";
import { renderNumber } from "@openfront/engine-lib/Format";
import { html, TemplateResult } from "lit";
import { formatPercentage, renderDuration, translateText } from "../../Utils";
import type { GameView } from "../../view";
import { domesticScoreMap } from "../../view/DomesticScores";
import type { PlayerView } from "../../view/PlayerView";

export interface HostChoice {
  id: number;
  level: number;
}

/** Own finished buildings at level 3+, highest level first (ties: lower id). */
export function projectHostChoices(
  units: readonly {
    id(): number;
    level(): number;
    isUnderConstruction(): boolean;
  }[],
): HostChoice[] {
  return units
    .filter(
      (u) => !u.isUnderConstruction() && u.level() >= PROJECT_HOST_MIN_LEVEL,
    )
    .map((u) => ({ id: u.id(), level: u.level() }))
    .sort((a, b) => b.level - a.level || a.id - b.id);
}

/** Where the side the engine judges for me stands (spec §8). */
export interface VictoryStanding {
  /** Team game: my team is judged, by its summed land and score. */
  team: boolean;
  tiles: number;
  score: number;
  /** 1-based rank by score among the sides, of `count`. */
  rank: number;
  count: number;
}

/**
 * Like the engine's win check (DomesticWinCheck): in team games each team's
 * alive players' land and scores add up (the bot team never wins); in a
 * free-for-all every scored player stands alone.
 */
export function victoryStanding(
  game: GameView,
  me: PlayerView,
): VictoryStanding {
  const scores = domesticScoreMap(game);
  const myTeam =
    game.config().gameConfig().gameMode === GameMode.Team ? me.team() : null;
  if (myTeam === null) {
    const ranked = [...scores.entries()].sort(
      (a, b) => b[1].total - a[1].total,
    );
    return {
      team: false,
      tiles: me.numTilesOwned(),
      score: scores.get(me.smallID())?.total ?? 0,
      rank: ranked.findIndex(([id]) => id === me.smallID()) + 1,
      count: ranked.length,
    };
  }
  const sides = new Map<Team, { tiles: number; score: number }>();
  for (const p of game.playerViews()) {
    const team = p.team();
    if (!p.isAlive() || team === null || team === ColoredTeams.Bot) continue;
    const side = sides.get(team) ?? { tiles: 0, score: 0 };
    side.tiles += p.numTilesOwned();
    side.score += scores.get(p.smallID())?.total ?? 0;
    sides.set(team, side);
  }
  const ranked = [...sides.entries()].sort(
    (a, b) => b[1].score - a[1].score || b[1].tiles - a[1].tiles,
  );
  const mine = sides.get(myTeam) ?? { tiles: 0, score: 0 };
  return {
    team: true,
    tiles: mine.tiles,
    score: mine.score,
    rank: ranked.findIndex(([team]) => team === myTeam) + 1,
    count: ranked.length,
  };
}

const BUILDING_KEY: Readonly<Record<VictoryProjectKind, string>> = {
  science: "unit_type.research_institute",
  political: "unit_type.admin_office",
};

/** The domestic panel's victory tab (spec §10.7). */
export function renderVictoryTab(
  game: GameView,
  me: PlayerView,
  d: DomesticData,
  onStart: (kind: VictoryProjectKind, unitId: number) => void,
): TemplateResult {
  const standing = victoryStanding(game, me);
  return html`
    <div class="flex flex-col gap-3 text-sm">
      ${renderConquest(game, standing)}
      ${VICTORY_PROJECT_KINDS.map((kind) =>
        renderProject(kind, me, d, onStart),
      )}
      ${renderScore(game, standing)} ${renderActive(game)}
    </div>
  `;
}

function renderConquest(
  game: GameView,
  standing: VictoryStanding,
): TemplateResult {
  const land = game.numLandTiles() - game.numTilesWithFallout();
  const share = land > 0 ? standing.tiles / land : 0;
  const key = standing.team
    ? "domestic.victory.team_conquest"
    : "domestic.victory.conquest";
  return html`<div>
    ${translateText(key, {
      pct: formatPercentage(share),
      target: game.config().conquestPercent(),
    })}
  </div>`;
}

function renderProject(
  kind: VictoryProjectKind,
  me: PlayerView,
  d: DomesticData,
  onStart: (kind: VictoryProjectKind, unitId: number) => void,
): TemplateResult {
  const def = VICTORY_PROJECTS[kind];
  const qualified = projectQualified(
    kind,
    d.techs.includes("space_program"),
    d.governmentTier,
  );
  const hosts = projectHostChoices(me.units(def.hostType));
  const cost =
    kind === "science"
      ? translateText("domestic.victory.cost_science", {
          gold: renderNumber(def.goldCost),
        })
      : translateText("domestic.victory.cost_political", {
          gold: renderNumber(def.goldCost),
          political: POLITICAL_PROJECT_POLITICAL,
        });
  return html`
    <div class="border border-gray-600 rounded-md p-3 flex flex-col gap-1">
      <div class="text-base font-bold">
        ${translateText(`domestic.project.${kind}.name`)}
      </div>
      <div class="text-gray-300">
        ${translateText(`domestic.project.${kind}.desc`)}
      </div>
      <div class="text-gray-400">${cost}</div>
      <div class=${qualified ? "text-green-400" : "text-gray-400"}>
        ${translateText(`domestic.victory.requirement_${kind}`)}
      </div>
      ${hosts.length === 0
        ? html`<div class="text-gray-400">
            ${translateText("domestic.victory.no_hosts")}
          </div>`
        : hosts.map((host) => {
            const block = victoryProjectBlock(kind, {
              busy: d.project !== undefined,
              qualified,
              hostLevel: host.level,
              gold: me.gold(),
              politicalMilli: d.political * MILLI,
            });
            return html`<div class="flex items-center gap-2 flex-wrap">
              <span
                >${translateText("domestic.victory.host_level", {
                  building: translateText(BUILDING_KEY[kind]),
                  level: host.level,
                })}</span
              >
              <button
                type="button"
                class="min-h-11 px-4 rounded-md text-sm font-semibold bg-amber-700 hover:bg-amber-600 disabled:opacity-40"
                ?disabled=${block !== null}
                @click=${() => onStart(kind, host.id)}
              >
                ${translateText("domestic.victory.start")}
              </button>
              ${block === null
                ? null
                : html`<span data-victory-block class="text-sm text-red-300"
                    >${translateText(`domestic.victory.blocked.${block}`)}</span
                  >`}
            </div>`;
          })}
    </div>
  `;
}

function renderScore(
  game: GameView,
  standing: VictoryStanding,
): TemplateResult {
  const limit = game.config().maxTimerMinutes();
  const left =
    limit === null
      ? null
      : Math.max(0, limit * 60 - Math.floor(game.elapsedGameSeconds()));
  return html`<div>
    ${translateText(
      standing.team ? "domestic.victory.team_score" : "domestic.victory.score",
      {
        score: standing.score.toFixed(1),
        rank: standing.rank,
        count: standing.count,
      },
    )}
    ${left === null
      ? ""
      : html` ·
        ${translateText("domestic.victory.time_left", {
          time: renderDuration(left),
        })}`}
  </div>`;
}

function renderActive(game: GameView): TemplateResult {
  const rows = game.playerViews().flatMap((p) => {
    const project = p.isAlive() ? p.domesticData()?.project : undefined;
    return project === undefined ? [] : [{ p, project }];
  });
  return html`<div class="flex flex-col gap-1">
    <div class="font-bold">${translateText("domestic.victory.active")}</div>
    ${rows.length === 0
      ? html`<div class="text-gray-400">
          ${translateText("domestic.victory.none_active")}
        </div>`
      : rows.map(
          ({ p, project }) =>
            html`<div>
              ${translateText("domestic.victory.progress", {
                name: p.displayName(),
                project: translateText(`domestic.project.${project.kind}.name`),
                pct: Math.floor(projectProgress(project) * 100),
              })}
              ${project.paused ? translateText("domestic.victory.paused") : ""}
            </div>`,
        )}
  </div>`;
}
