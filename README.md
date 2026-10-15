<p align="center">
  <img src="resources/images/Emblem.svg" alt="" width="96">
</p>

<h1 align="center">Statecraft</h1>

> **Statecraft is a modified version of [OpenFront](https://github.com/openfrontio/OpenFrontIO)** (© OpenFront and Contributors), distributed under the GNU AGPL v3 with the additional terms in [LICENSE](LICENSE). It is not OpenFront and is not endorsed by OpenFront. Source code of this version: https://github.com/0x1eso/front
>
> Modified since 2026-10-15 (every change is in the git history): renamed; OpenFront's all-rights-reserved assets and its ad, analytics and portal tags removed; a self-hosted mode that runs without OpenFront's API; new gameplay (domestic mode). The text below the next two sections is upstream's README.

## 자체 호스팅 (게임 나이트)

이 포크는 원작의 비공개 API 없이 내 PC에서 돌릴 수 있다. `SELF_HOSTED=true`로 띄운 서버는 이렇게 동작한다.

- 로그인, 계정, 상점, 인벤토리, 클랜, 랭크, 리더보드가 없다(화면에서 숨김). 모두 게스트로 플레이한다.
- Turnstile(봇 확인), 서버 목록, 코스메틱, 게임 기록 보관, 광고와 분석 스크립트를 쓰지 않는다. 브라우저가 API로 보내던 요청은 이 서버의 `/selfhost-api/`가 받는다.
- 혼자 하기, 방 만들기(비공개 로비)와 링크로 참가하기, 이 서버 안의 공개 로비가 된다.
- 국기와 패턴 같은 코스메틱은 보이지 않고, 지난 게임 리플레이는 없다.

### 처음 한 번

1. Node와 의존성: 프로젝트는 Node 24를 요구한다. Node 26에서도 돌지만 시작할 때 경고가 뜬다. 맞추려면 `sudo pacman -S nodejs-lts-krypton`. 의존성 설치는 `npm ci --ignore-scripts --engine-strict=false`(Node 24라면 `npm run inst`).
2. 도메인을 Cloudflare에 연결해 둔다(네임서버가 Cloudflare여야 한다).
3. `sudo pacman -S cloudflared`
4. `cloudflared tunnel login`: 브라우저에서 도메인을 고른다. `~/.cloudflared/cert.pem`이 생긴다.
5. `cloudflared tunnel create statecraft`: 터널 UUID와 자격 증명 파일 `~/.cloudflared/<UUID>.json`이 생긴다.
6. `cloudflared tunnel route dns statecraft play.example.com`: 친구들이 열 주소를 터널에 연결한다(`play.example.com`은 예시).
7. `~/.cloudflared/config.yml`을 만든다.

   ```yaml
   tunnel: statecraft
   credentials-file: /home/<사용자>/.cloudflared/<UUID>.json
   ingress:
     - hostname: play.example.com
       service: http://localhost:3000
     - service: http_status:404
   ```

8. `cp scripts/selfhost/selfhost.env.example .env.selfhost`를 실행하고 `DOMAIN=play.example.com`(6번 주소)을 채운다. 터널 이름이 다르면 `TUNNEL_NAME`도 고친다. 확인은 `bash scripts/selfhost/game-night.sh check`.

### 게임 나이트마다

1. 바뀐 코드를 `git push`한다. AGPL §13에 따라 플레이어가 지금 돌아가는 소스를 받을 수 있어야 한다(푸터와 로딩 화면의 "소스 코드" 링크). 푸시하지 않은 커밋이면 시작할 때 경고가 뜬다.
2. `npm run selfhost:start`: 처음이거나 커밋이 바뀌었으면 먼저 빌드한다(몇 분 걸림). 서버가 응답하면 터널을 연다.
3. 친구들에게 `https://play.example.com`을 알려 준다. 방 만들기 → 링크 복사 → 공유.
4. 상태는 `npm run selfhost:status`, 로그는 `.selfhost/server.log`와 `.selfhost/tunnel.log`.
5. 끝나면 `npm run selfhost:stop`.

강퇴(kick)는 쉽게 피할 수 있다. 쫓겨난 손님이 브라우저 ID를 새로 만들어 링크로 다시 들어올 수 있다(원작의 `GAME_ENV=dev`와 같다). 정말 막으려면 방을 새로 만든다.

터널 없이 이 PC나 같은 네트워크에서 시험하려면 `bash scripts/selfhost/game-night.sh start --local` 후 `http://localhost:3000`. 빌드를 강제하려면 `--rebuild`.

### 음악

원작의 음악 두 곡과 매칭 알림음은 원작 회사 소유라 뺐다. 음악이 없어도 게임은 정상이다. 넣고 싶으면 CC0(또는 CC BY, CC BY-SA) MP3를 `resources/sounds/music/gameplay.mp3`와 `resources/sounds/music/menu-theme.mp3`로 넣고, `CREDITS.md`의 Music 항목에 파일 이름, 작가, 출처, 라이선스를 적은 뒤 `--rebuild`로 시작한다. 출처가 적혀 있지 않으면 `tests/ForkAssets.test.ts`가 실패한다.

## 원작 동기화 (upstream)

`upstream` 리모트(`https://github.com/openfrontio/OpenFrontIO`)는 이미 등록되어 있다.

```bash
git fetch upstream
git switch main
git merge upstream/main
npm ci --ignore-scripts --engine-strict=false # package-lock.json이 바뀌었을 때만
npm test && npm run typecheck && npm run lint
git push
```

- 충돌이 자주 나는 곳은 `index.html`, `resources/lang/en.json`, `resources/lang/ko.json`, `src/client/components/Footer.ts`, 내비게이션 바, `src/server/Worker.ts`, `src/server/Master.ts`다. 원작의 변경을 받되 포크의 변경(이름 상수, 자체 호스팅 분기, 고지, 지운 스크립트)은 살린다.
- `tests/ForkAssets.test.ts`가 실패하면 원작이 `proprietary/`에 자산을 다시 넣었거나 코드가 그 경로를 다시 참조한다. 파일은 `git rm`하고, 참조는 이 포크의 자산으로 바꾸거나 없앤다.
- `tests/Branding.test.ts`나 `tests/server/RenderHtmlSelfHosted.test.ts`가 실패하면 원작이 OpenFront 이름이나 제3자 스크립트를 새로 넣은 것이다. 같은 방식으로 고친다.
- 원작이 새 API 호출을 추가해도 클라이언트 쪽은 `getApiBase()`를 거치면 자체 호스팅에서 스텁으로 간다. 서버 쪽 새 `ServerEnv.jwtIssuer()` 호출은 자체 호스팅에서 예외를 던진다. `.selfhost/server.log`에 `self-hosted server has no API`가 보이면 그 호출 앞에 `ServerEnv.selfHosted()` 분기를 넣는다.
- 그다음 기능 브랜치에 main을 합친다. 예: `git switch domestic-system && git merge main`.

[OpenFront.io](https://openfront.io/) is an online real-time strategy game focused on territorial control and alliance building. Players compete to expand their territory, build structures, and form strategic alliances in various maps based on real-world geography.

This is a fork/rewrite of WarFront.io. Credit to https://github.com/WarFrontIO.

![CI](https://github.com/openfrontio/OpenFrontIO/actions/workflows/ci.yml/badge.svg)
[![Crowdin](https://badges.crowdin.net/openfront-mls/localized.svg)](https://crowdin.com/project/openfront-mls)
[![CLA assistant](https://cla-assistant.io/readme/badge/openfrontio/OpenFrontIO)](https://cla-assistant.io/openfrontio/OpenFrontIO)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Assets: CC BY-SA 4.0](https://img.shields.io/badge/Assets-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

## License

OpenFront source code is licensed under the **GNU Affero General Public License v3.0**

Current copyright notices appear in:

- Footer: "© OpenFront and Contributors"
- Loading screen: "© OpenFront and Contributors"

Modified versions must preserve these notices in reasonably visible locations.

See the [LICENSE](LICENSE) for complete requirements.

For asset licensing, see [LICENSE-ASSETS](LICENSE-ASSETS).  
For license history, see [LICENSING.md](LICENSING.md).

## 🌟 Features

- **Real-time Strategy Gameplay**: Expand your territory and engage in strategic battles
- **Alliance System**: Form alliances with other players for mutual defense
- **Multiple Maps**: Play across various geographical regions including Europe, Asia, Africa, and more
- **Resource Management**: Balance your expansion with defensive capabilities
- **Cross-platform**: Play in any modern web browser

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v24.15.0 or newer in the Node 24 release line
- [npm](https://www.npmjs.com/) v12.1.0 or newer in the npm 12 release line
- A modern web browser (Chrome, Firefox, Edge, etc.)

Node.js may bundle an older npm version. Upgrade it before installing project dependencies:

```bash
npm install --global --ignore-scripts npm@12.1.0
```

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/openfrontio/OpenFrontIO.git
   cd OpenFrontIO
   ```

2. **Install dependencies**

   ```bash
   npm run inst
   ```

   Do NOT use `npm install` nor `npm i` for project dependencies. Use `npm run inst`; it runs the safer `npm ci --ignore-scripts` to install exactly the versions in `package-lock.json` without running lifecycle scripts.

   The repository also rejects dependency releases less than seven days old and dependencies sourced from Git, remote URLs, local tarballs, or directories. Wait until a new release passes the seven-day window before updating it; security exceptions require explicit maintainer review.

## 🎮 Running the Game

### Development Mode

Run both the client and server in development mode with live reloading:

```bash
npm run dev
```

This will:

- Start the webpack dev server for the client
- Launch the game server with development settings
- Open the game in your default browser (to disable this behavior, set `SKIP_BROWSER_OPEN=true` in your environment)

### Client Only

To run just the client with hot reloading:

```bash
npm run start:client
```

### Server Only

To run just the server with development settings:

```bash
npm run start:server-dev
```

### Connecting to staging or production backends

Sometimes it's useful to connect to production servers when replaying a game, testing user profiles, purchases, or login flow.

> To replay a production game, make sure you're on the same commit that the game you want to replay was executed on, you can find the `gitCommit` value via `https://api.openfront.io/game/[gameId]`.
> Unfinished games cannot be replayed on localhost.

To connect to staging api servers:

```bash
npm run dev:staging
```

To connect to production api servers:

```bash
npm run dev:prod
```

## 🛠️ Development Tools

- **Format code**:

  ```bash
  npm run format
  ```

- **Lint code with Oxlint and ESLint**:

  ```bash
  npm run lint
  ```

- **Lint and fix code with Oxlint and ESLint**:

  ```bash
  npm run lint:fix
  ```

- **Testing**
  ```bash
  npm test
  ```

## 🏗️ Project Structure

- `/src/client` - Frontend game client
- `/src/server` - Backend game server
- `/packages/engine` - Deterministic game simulation (`@openfront/engine`)
- `/packages/engine-api` - The engine's contract: types, schemas, game updates and the worker protocol (`@openfront/engine-api`)
- `/packages/engine-lib` - Engine code also used outside the engine: map grid, rules, helpers (`@openfront/engine-lib`)
- `/packages/shared` - Code shared by client and server: wire schemas, env, asset URLs (`@openfront/shared`)
- `/packages/zbin` - Compact binary wire format for zod schemas (self-contained, zod-only)
- `/resources` - Static assets (images, maps, etc.)

## 🤝 Contributing

Contributions and translations are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, the approved-issue process, project governance, and translation info.
