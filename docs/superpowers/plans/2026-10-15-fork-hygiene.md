# 포크 정비 (이름, 라이선스 고지, 자산, 자체 호스팅) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 친구들끼리 쓰는 OpenFront 포크를 라이선스에 맞게 정리하고(이름 변경, AGPL §13 소스 링크, 7(b) 저작권 고지, 7(c) 원작 표기, `proprietary/` 자산 제거), 원작의 비공개 API 없이 내 PC에서 프로덕션 빌드로 띄워 Cloudflare Tunnel로 공개하는 "자체 호스팅 모드"와 게임 나이트 스크립트를 만든다.

**Architecture:** 게임 이름과 저장소 주소는 `packages/shared/src/Branding.ts` 한 곳에 둔다. 서버는 `ServerEnv.selfHosted()`(환경 변수 `SELF_HOSTED=true`)로, 클라이언트는 `isSelfHosted()`(`window.BOOTSTRAP_CONFIG.selfHosted`)로 자체 호스팅을 판단하고, API를 부르는 지점마다 그 분기로 건너뛴다. 안전망은 두 개다. 서버의 `ServerEnv.jwtIssuer()`는 자체 호스팅이면 예외를 던지고, 클라이언트의 `getApiBase()`는 같은 서버의 `/selfhost-api/` 스텁을 가리킨다. 프로덕션에서 nginx가 하던 워커 라우팅(`/wN/...`, `create_game`, WebSocket)은 자체 호스팅일 때 마스터(포트 3000)가 대신한다.

**Tech Stack:** TypeScript 6, Vitest 4, Express 5 + ws, Lit + Tailwind 4, EJS(index.html), bash, cloudflared

**Spec:** `docs/superpowers/specs/2026-10-15-domestic-system-design.md` §14 (별도 트랙: 포크 정비). 라이선스 근거는 `LICENSE` 끝의 "ADDITIONAL TERMS (AGPL v3 Section 7)", `LICENSE-ASSETS`, `LICENSING.md`, `proprietary/LICENSE`다.

---

## Decisions

spec이 정하지 않은 선택을 모았다. 바꾸려면 여기와 해당 Task를 함께 고친다.

1. **게임 이름 (소유자 결정):** 영어 "Statecraft", 한국어 화면 "스테이트크래프트". 영어 이름은 `packages/shared/src/Branding.ts`의 `GAME_TITLE` 하나에서 나온다(`<title>`, Open Graph, JSON-LD, 링크 미리보기, 화면 워드마크는 en.json의 `"branding.title": "{name}"`을 통해). 한국어 표기는 `resources/lang/ko.json`의 `branding.title`에 따로 있다. 웹 앱 매니페스트(`resources/manifest.json`)도 이름을 담는데, `tests/Branding.test.ts`가 `GAME_TITLE`과 같은지 확인한다. 이름을 바꿀 때 고칠 곳은 이 세 파일이다.
2. **원작 표기 줄:** 영어 "Based on OpenFront"(소유자 결정), 한국어 "OpenFront 기반"(번역, 소유자가 바꿀 수 있음). 메뉴 워드마크, 푸터, 로딩 화면에 나온다.
3. **메뉴 로고:** 원작 로고 이미지 대신 텍스트 워드마크 컴포넌트 `<game-wordmark>`를 쓴다. 언어를 따라 바뀌고 이미지 파일이 필요 없다.
4. **파비콘:** 직접 그린 SVG `resources/images/Emblem.svg`(지구본 위 별, CC BY-SA 4.0). PNG/WebP 래스터는 만들지 않는다. 배경의 원작 로고 워터마크(`OpenFront.png`, `OF.png`)는 대체하지 않고 없앤다. PWA 아이콘(`resources/icons/icon512_*.png`, 원작 이름 없는 지구본, CC BY-SA)은 그대로 쓴다.
5. **폰트:** `OpenFront.ttf`를 지우고 글꼴 파일 없이 시스템 글꼴(`Inter, Arial, sans-serif`)을 쓴다.
6. **음악:** 넣지 않는다. 코드는 `sounds/music/gameplay.mp3`, `sounds/music/menu-theme.mp3` 경로를 그대로 쓰고, 파일이 없으면 기존 load-error 처리로 조용히 무음이 된다(음악 채널은 기본값이 꺼짐). 소유자가 CC0 MP3를 `resources/sounds/music/`에 넣고 `CREDITS.md`에 출처를 적을 수 있다. 출처가 없으면 `tests/ForkAssets.test.ts`가 실패한다.
7. **매칭 알림음:** 원작 `game-start-alert.mp3` 대신 이미 있는 `resources/sounds/effects/game-start.mp3`(CC BY-SA)를 쓴다.
8. **자체 호스팅 플래그:** `SELF_HOSTED=true`(정확히 이 문자열만 참)와 `GAME_ENV=prod`. 빌드는 `npm run build-prod`이고 Node 서버(`src/server/Server.ts`)가 `static/`을 서빙한다. Vite 개발 서버는 쓰지 않는다.
9. **API 대체:** 클라이언트가 API로 보내던 요청은 같은 서버의 `/selfhost-api/*`(상수 `SELF_HOST_API_PREFIX`)로 간다. 스텁은 `GET /news.json`에 `[]`를, 나머지에는 `404 {"error":"self_hosted"}`를 준다. 원작 뉴스(Discord 대회 등)가 이 서버의 소식처럼 보이지 않게 하기 위해서다.
10. **계정:** 자체 호스팅에서는 모두 게스트다. 서버는 브라우저의 persistent ID(UUID)를 받고(지금 `GAME_ENV=dev`가 하는 것과 같다), JWT는 키를 가져오지 않고 거절한다.
11. **워커 라우팅:** 자체 호스팅일 때만 마스터가 `/wN/...`를 워커 N(포트 3001+N, 접두사 제거)으로, `POST /api/create_game`(과 adminbot 생성 두 개)을 무작위 워커로, `/wN/` WebSocket 업그레이드를 같은 규칙으로 넘긴다. nginx도 cloudflared 경로 규칙도 필요 없다.
12. **숨기는 화면 (자체 호스팅):** 상점, 인벤토리, 리더보드, 클랜, 계정 메뉴(로그인), 랭크 버튼, 인증 이름 버튼, Steam 홍보, 승리 화면 홍보 박스, 구매 권유 창. 공통 CSS 클래스 `no-self-host`와 `<html class="self-hosted">`로 처리한다(랭크 버튼, Steam 홍보, 승리 화면, 구매 권유는 코드 분기).
13. **제3자 스크립트:** index.html에서 Google Ads/Analytics(gtag 두 개), googletag, Playwire ramp(설정과 ramp.js), Cloudflare Web Analytics 비콘, CrazyGames SDK를 모드와 상관없이 지운다. 모두 OpenFront 회사 계정 ID를 달고 있어서 포크 트래픽을 원작 계정에 보내게 된다. Turnstile 스크립트는 자체 호스팅이 아닐 때만 부트스트랩 스크립트가 동적으로 넣는다.
14. **광고:** 자체 호스팅에서는 `window.adsEnabled = false`(Admiral 광고 복구 스크립트도 안 불러옴).
15. **푸터 링크:** GitHub 아이콘은 이 포크 저장소(`SOURCE_URL`)로 바꾼다. Reddit/Discord 아이콘(원작 커뮤니티)과 이용약관/개인정보 링크(OpenFront Inc. 문서)는 뺀다. 위키(게임 규칙 설명)는 둔다. "Based on OpenFront"(원작 저장소 링크)와 "소스 코드"(포크 저장소 링크)를 저작권 문구 옆에 넣는다.
16. **저작권 문구:** 원작 그대로 둔다(`main.copyright`, 언어별 번역 포함). 푸터와 로딩 화면(`GameStartingModal`)에 이미 나오며 계속 나온다.
17. **`proprietary/`:** 자산 12개를 지우고 원작의 `proprietary/LICENSE`만 남긴다(병합 충돌을 줄이고 Dockerfile의 `COPY proprietary`도 그대로 동작). git 기록에는 자산이 남는다. 기록을 다시 쓰지는 않는다(소유자 판단 사항).
18. **문구:** 자체 호스팅에서 게스트에게 보이는 영어 문구 중 "OpenFront"를 게임 이름처럼 쓰는 8개를 en.json과 ko.json에서 중립 문구로 바꾼다(Task 2). 계정, Steam, 상점 화면 문구는 그 화면들이 숨겨지므로 그대로 둔다. 다른 언어 파일은 건드리지 않는다.
19. **게임 나이트 스크립트:** `scripts/selfhost/game-night.sh start [--local] [--rebuild] | stop | status | check`, npm 스크립트 `selfhost:start`, `selfhost:stop`, `selfhost:status`. 설정 파일은 저장소 루트의 `.env.selfhost`(기존 `.gitignore`의 `.env*`로 무시됨)이고 템플릿은 `scripts/selfhost/selfhost.env.example`이다. 실행 중 파일(PID, 로그)은 `.selfhost/`에 둔다.
20. **터널:** cloudflared 이름 있는 터널과 `~/.cloudflared/config.yml`의 ingress(`hostname → http://localhost:3000`). 스크립트는 `cloudflared tunnel --no-autoupdate --config <config> run <TUNNEL_NAME>`로 띄운다.
21. **수정본 고지:** README 맨 위 영어 고지, 날짜 2026-10-15. 한국어 운영 안내와 원작 동기화 절차도 README에 넣는다.
22. **CLAUDE.md는 건드리지 않는다.** 포크 규칙은 README와 테스트(`tests/Branding.test.ts`, `tests/ForkAssets.test.ts`)가 지킨다.

---

## 시작 전에 (환경)

- **작업 위치:** `/home/eser/dev/OpenFrontIO-fork`, 브랜치 `fork-hygiene`(이미 있는 worktree, 커밋 `b5d123e46`에서 시작). 같은 저장소의 `/home/eser/dev/OpenFrontIO`에서는 내정 트랙이 진행 중이니 그쪽 파일은 건드리지 않는다. 아래 경로는 모두 worktree 루트 기준이다.
- 프로젝트는 Node 24를 요구한다(`package.json` engines). 이 PC에는 Node 26이 있고, 의존성은 `npm ci --ignore-scripts --engine-strict=false`로 설치되어 있다. 테스트, 타입 검사, 빌드는 Node 26에서도 된다. 정식으로 맞추려면 `sudo pacman -S nodejs-lts-krypton` 후 `npm run inst`.
- 새 npm 의존성을 추가하지 않는다.
- 단일 테스트: `npx vitest tests/<경로>.test.ts --run`
- 커밋 전에 바꾼 파일에 `npx prettier --write <files>`를 실행한다. index.html도 포함한다. prettier가 줄을 바꿔도 테스트가 통과하면 그대로 둔다.
- `static/`이 있으면(`npm run build-prod`나 게임 나이트 후) `tests/server/RenderHtml.test.ts`의 일부가 실패한다. `assetManifest: {}`를 기대하는 원작 테스트라서다. 테스트는 빌드 전에 돌리거나 `rm -rf static` 후 돌린다.
- 내정 트랙(`domestic-system`)도 `resources/lang/en.json`, `resources/lang/ko.json`, `index.html`을 고친다. 나중에 두 브랜치를 합칠 때 충돌이 나면 양쪽 내용을 모두 살린다.

## Global Constraints

- 이 포크는 게임 이름으로 "OpenFront"를 쓰지 않는다(AGPL 추가 조항 7(c)). 이름 문자열은 `Branding.ts`의 `GAME_TITLE`, en.json `branding.title`(`"{name}"`), ko.json `branding.title`, `resources/manifest.json`에만 있다.
- "© OpenFront and Contributors"(`main.copyright`)는 푸터와 로딩 화면에 계속 보인다(7(b)).
- 이 포크의 소스 링크 `https://github.com/0x1eso/front`는 모든 플레이어가 누를 수 있어야 한다(AGPL §13). 푸터와 로딩 화면에 둔다.
- `proprietary/`에는 원작 `LICENSE` 외에 아무것도 두지 않고, 코드에서 원작 전용 자산 경로를 참조하지 않는다.
- `SELF_HOSTED`가 `true`가 아닐 때 동작은 바뀌지 않는다. 예외는 모드와 상관없는 포크 변경(이름, 고지, 자산, 제3자 스크립트 삭제, 중립 문구)이다. 기존 테스트의 기대값을 바꾸는 곳은 세 곳뿐이다: `tests/client/LangSelectorTranslate.test.ts`(제목 키), `tests/server/RenderHtml.test.ts`의 JSON-LD 이름, `tests/client/Matchmaking.test.ts`(알림음 경로). 기존 테스트 파일에 새 테스트를 더하는 것은 별개다.
- 자체 호스팅에서는 어떤 코드 경로도 `api.<DOMAIN>`이나 OpenFront 계정의 제3자 서비스에 요청하지 않는다.
- 자체 호스팅 여부는 서버에서 `ServerEnv.selfHosted()`, 클라이언트에서 `isSelfHosted()`(`src/client/SelfHosted.ts`)로만 읽는다.
- 패키지 경계(`tests/LayerBoundaries.test.ts`): 새 shared 모듈(`Branding.ts`, `SelfHost.ts`)은 아무것도 import하지 않는다. 홈페이지 청크(`Main.ts`와 정적 import)는 게임 클라이언트를 정적으로 import하지 않는다. 새 클라이언트 모듈은 작다.
- 화면 문구는 `translateText()` 또는 `data-i18n`을 거친다. 키는 `resources/lang/en.json`(모든 단계에서 키 정렬)과 `resources/lang/ko.json`에 넣는다. 다른 언어 파일은 건드리지 않는다. en.json의 키는 쓰이는 Task에서 추가하고, 쓰이지 않게 된 키는 그 Task에서 지운다(`tests/TranslationSystem.test.ts`가 미사용 키를 실패로 잡는다).

## Review Focus

1. **게스트 persistent ID가 방 만들기와 참가 사이에 바뀜:** API가 없을 때 `/auth/refresh`가 401을 받으면 `logOut()`이 저장된 ID를 지운다. 그러면 방장이 만든 방에 다른 ID로 들어가 방을 시작하지 못한다. 자체 호스팅에서는 refresh 요청이 없고 ID가 그대로여야 한다. 테스트: Task 9 "keeps the guest's persistent ID without asking any API".
2. **API가 없어 멀티플레이 버튼이 꺼짐:** 서버 목록 heartbeat가 두 번 실패하면 방 만들기, 코드로 참가, 매칭이 비활성화된다. 자체 호스팅에서는 목록을 아예 묻지 않고 버튼이 살아 있어야 한다. 테스트: Task 9 "never asks an API for the server list".
3. **터널 → 3000 → 워커 WebSocket과 워커 다운:** 로비 목록과 게임 소켓이 마스터 포트를 거쳐 접두사가 제거된 채 워커에 닿아야 하고, 워커가 죽었으면 멈추지 않고 바로 502로 끝나야 한다. 테스트: Task 7 "proxies a WebSocket upgrade to the worker, prefix stripped", "answers 502 when the worker is down".
4. **env 파일 실수:** `SELF_HOSTED`가 빠지면 prod 서버가 게스트를 "persistent ID not allowed in production"으로 거절한다. `DOMAIN=openfront.io`, `NUM_WORKERS` 오타도 시작 전에 분명한 메시지로 거절해야 한다. 테스트: Task 11 "refuses %s".
5. **upstream 병합이 원작 자산을 되살림:** 원작이 `proprietary/`에 파일을 추가하거나 코드가 다시 그 경로를 참조하거나, 음원이 출처 없이 들어오면 테스트가 실패해야 한다. 테스트: Task 4 "proprietary/ holds nothing but upstream's LICENSE", "no code or page references an upstream-only asset", "every music track in resources/ is credited".

---

## File Structure

| 파일 | 책임 |
|---|---|
| `packages/shared/src/Branding.ts` (새) | `GAME_TITLE`, `SOURCE_URL`, `UPSTREAM_URL`, `EMBLEM_ASSET` |
| `packages/shared/src/SelfHost.ts` (새) | `SELF_HOST_API_PREFIX` (클라이언트와 서버가 공유) |
| `src/client/SelfHosted.ts` (새) | `isSelfHosted()`, `selfHostApiBase()`, `turnstileRequired()` |
| `src/client/components/GameWordmark.ts` (새) | `<game-wordmark>` 텍스트 워드마크 |
| `src/server/SelfHostProxy.ts` (새) | 마스터의 워커 라우팅(HTTP, WebSocket) |
| `src/server/SelfHostApiStub.ts` (새) | `/selfhost-api/*` 응답 |
| `resources/images/Emblem.svg` (새) | 파비콘 |
| `scripts/selfhost/game-night.sh` (새) | 빌드, 서버, 터널 시작과 종료 |
| `scripts/selfhost/selfhost.env.example` (새) | env 파일 템플릿 |
| `tests/Branding.test.ts`, `tests/ForkAssets.test.ts`, `tests/SelfHostScript.test.ts` (새) | 이름, 자산, 스크립트 검사 |
| `tests/server/SelfHosted.test.ts`, `SelfHostedWiring.test.ts`, `SelfHostMaster.test.ts`, `RenderHtmlSelfHosted.test.ts`, `GamePreviewTitle.test.ts` (새) | 서버 쪽 검사 |
| `tests/client/SelfHosted.test.ts`, `SelfHostedClient.test.ts`, `SelfHostedUi.test.ts`, `components/ForkNotices.test.ts`, `components/GameWordmark.test.ts` (새) | 클라이언트 쪽 검사 |
| 기존 파일 수정 | 각 Task의 Files 목록 참고 |
| `proprietary/**` (12개 삭제) | `proprietary/LICENSE`만 남김 |

---

### Task 1: 게임 이름 한 곳에 두기, 페이지 제목과 메타 태그

**Files:**
- Create: `packages/shared/src/Branding.ts`
- Modify: `index.html` (`<title>`, SEO, Open Graph, JSON-LD)
- Modify: `src/server/RenderHtml.ts` (EJS 지역 변수 `gameTitle`)
- Modify: `vite.config.ts` (`htmlAssetData.gameTitle`)
- Modify: `src/client/LangSelector.ts` (`document.title`)
- Modify: `resources/lang/en.json`, `resources/lang/ko.json`, `resources/manifest.json`
- Test: `tests/Branding.test.ts` (새), `tests/server/RenderHtml.test.ts`, `tests/client/LangSelectorTranslate.test.ts`

**Interfaces:**
- Produces: `@openfront/shared/Branding`의 `GAME_TITLE: string`, `SOURCE_URL: string`, `UPSTREAM_URL: string`. 번역 키 `branding.title`(en `"{name}"`, 호출부는 `{ name: GAME_TITLE }`을 넘긴다). index.html EJS 지역 변수 `gameTitle`(문자열, 없으면 빈 문자열로 렌더).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/Branding.test.ts`:

```ts
import {
  GAME_TITLE,
  SOURCE_URL,
  UPSTREAM_URL,
} from "@openfront/shared/Branding";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");

function readJson(relativePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

// LICENSE, "ADDITIONAL TERMS (AGPL v3 Section 7)": a modified version keeps
// "© OpenFront and Contributors" visible (7(b)) and must not use "OpenFront"
// as its primary title (7(c)). AGPL section 13 obliges offering the source.
describe("fork branding", () => {
  test("the game is not titled OpenFront", () => {
    expect(GAME_TITLE.length).toBeGreaterThan(0);
    expect(GAME_TITLE).toBe(GAME_TITLE.trim());
    expect(GAME_TITLE).not.toMatch(/open\s*front/i);
  });

  test("the web app manifest carries the same name", () => {
    const manifest = readJson("resources/manifest.json");
    expect(manifest.name).toBe(GAME_TITLE);
    expect(manifest.short_name).toBe(GAME_TITLE);
  });

  test("English text takes the name from GAME_TITLE", () => {
    const en = readJson("resources/lang/en.json");
    expect(en.branding.title).toBe("{name}");
    expect(en.main.title).toBeUndefined();
  });

  test("Korean text spells the name its own way, and not as OpenFront", () => {
    const title = readJson("resources/lang/ko.json").branding.title;
    expect(typeof title).toBe("string");
    expect(title).not.toMatch(/open\s*front|오픈\s*프론트/i);
  });

  test("the upstream copyright notice is kept", () => {
    expect(readJson("resources/lang/en.json").main.copyright).toMatch(
      /^© OpenFront™? and Contributors$/,
    );
  });

  test("the source offer points at this fork's public repository", () => {
    expect(SOURCE_URL).toBe("https://github.com/0x1eso/front");
    expect(UPSTREAM_URL).toBe("https://github.com/openfrontio/OpenFrontIO");
  });
});
```

`tests/server/RenderHtml.test.ts`:
1. import 목록 끝(`import { ServerEnv } from "../../src/server/ServerEnv";` 다음)에 추가:

```ts
import { GAME_TITLE, UPSTREAM_URL } from "@openfront/shared/Branding";
```

2. 기존 테스트

```ts
    const data = JSON.parse(match![1]);
    expect(data["@type"]).toBe("VideoGame");
    expect(data.name).toBe("OpenFront");
  });
```

를 다음으로 바꾸고, 바로 뒤에 새 테스트를 추가한다:

```ts
    const data = JSON.parse(match![1]);
    expect(data["@type"]).toBe("VideoGame");
    expect(data.name).toBe(GAME_TITLE);
    expect(data.isBasedOn).toEqual({
      "@type": "VideoGame",
      name: "OpenFront",
      url: UPSTREAM_URL,
    });
  });

  it("titles the page with the game's name and links no openfront.io page", async () => {
    const html = await renderHtmlContent(REAL_TEMPLATE);
    expect(html).toContain(`<title>${GAME_TITLE}</title>`);
    expect(html).toMatch(
      new RegExp(`<meta\\s+property="og:title"\\s+content="${GAME_TITLE}"\\s*/>`),
    );
    expect(html).not.toContain("https://openfront.io/");
  });
```

`tests/client/LangSelectorTranslate.test.ts`:
1. 첫 줄 import 다음에 추가:

```ts
import { GAME_TITLE } from "@openfront/shared/Branding";
```

2. `makeSelector({` 안의 `"main.title": "OpenFront",`를 `"branding.title": "{name}",`로 바꾼다.
3. `expect(document.title).toBe("OpenFront");`를 `expect(document.title).toBe(GAME_TITLE);`로 바꾼다.
4. 같은 `describe("LangSelector applyTranslation", ...)` 안, 첫 `it` 다음에 추가:

```ts
  it("titles the page in the player's language", () => {
    const selector = makeSelector({ "branding.title": "스테이트크래프트" });

    (selector as unknown as { applyTranslation(): void }).applyTranslation();

    expect(document.title).toBe("스테이트크래프트");
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/Branding.test.ts tests/server/RenderHtml.test.ts tests/client/LangSelectorTranslate.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/shared/Branding'`

- [ ] **Step 3: 이름 상수 작성**

`packages/shared/src/Branding.ts`:

```ts
// This fork's identity, in one place.
//
// LICENSE, "ADDITIONAL TERMS (AGPL v3 Section 7)": a modified version must not
// use "OpenFront" as its primary title or imply endorsement (7(c)), and must
// keep "© OpenFront and Contributors" visible (7(b), the `main.copyright`
// translation). AGPL section 13 obliges offering every player the source.
//
// To rename the game, change GAME_TITLE here, `branding.title` in
// resources/lang/ko.json (the Korean spelling), and the two names in
// resources/manifest.json (tests/Branding.test.ts checks the manifest).
// English text reads the name from here: en.json's `branding.title` is
// "{name}", and its callers pass { name: GAME_TITLE }.

/** The game's display name: page title, meta tags, menus, link previews. */
export const GAME_TITLE = "Statecraft";

/** This fork's public source code (AGPL v3 section 13). */
export const SOURCE_URL = "https://github.com/0x1eso/front";

/** The project this fork is based on. */
export const UPSTREAM_URL = "https://github.com/openfrontio/OpenFrontIO";
```

- [ ] **Step 4: 번역과 매니페스트**

`resources/lang/en.json`:
1. 다음 부분을

```json
    "until": "Banned until {date}."
  },
  "build_menu": {
```

다음으로 바꾼다:

```json
    "until": "Banned until {date}."
  },
  "branding": {
    "title": "{name}"
  },
  "build_menu": {
```

2. `"main"` 안의 다음 줄을 지운다:

```json
    "title": "OpenFront (ALPHA)",
```

`resources/lang/ko.json`에서 다음 부분을

```json
    "until": "{date}까지 차단되었습니다."
  },
  "build_menu": {
```

다음으로 바꾼다(ko.json의 `main.title`은 다른 언어 파일처럼 남겨 둔다):

```json
    "until": "{date}까지 차단되었습니다."
  },
  "branding": {
    "title": "스테이트크래프트"
  },
  "build_menu": {
```

`resources/manifest.json`에서

```json
  "name": "OpenFront.io",
  "short_name": "OpenFront",
```

를 다음으로 바꾼다:

```json
  "name": "Statecraft",
  "short_name": "Statecraft",
```

- [ ] **Step 5: 언어 선택기의 페이지 제목**

`src/client/LangSelector.ts`:
1. import에 추가: `import { GAME_TITLE } from "@openfront/shared/Branding";`
2. 다음 줄을

```ts
    document.title = this.translateText("main.title") ?? document.title;
```

다음으로 바꾼다:

```ts
    document.title = this.translateText("branding.title", { name: GAME_TITLE });
```

- [ ] **Step 6: index.html 제목, 메타, JSON-LD**

`index.html`:
1. 다음 줄을

```html
    <title data-i18n="main.title">OpenFront (ALPHA)</title>
```

다음으로 바꾼다:

```html
    <!-- gameTitle: the game's name (packages/shared/src/Branding.ts), from
         RenderHtml.ts and vite.config.ts. Guarded like every other local. -->
    <title><%= typeof gameTitle !== 'undefined' ? gameTitle : '' %></title>
```

2. 다음 줄을 지운다:

```html
    <link rel="canonical" href="https://openfront.io/" />
```

3. 다음 두 줄을

```html
    <meta property="og:url" content="https://openfront.io/" />
    <meta property="og:title" content="OpenFront - Battle Royale" />
```

다음으로 바꾼다:

```html
    <meta
      property="og:title"
      content="<%= typeof gameTitle !== 'undefined' ? gameTitle : '' %>"
    />
```

4. `<script type="application/ld+json">` 블록 전체(여는 태그부터 닫는 `</script>`까지)를 다음으로 바꾼다:

```html
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": <%- JSON.stringify(typeof gameTitle !== 'undefined' ? gameTitle : '') %>,
        "description": "Conquer the world in this multiplayer battle royale! Expand your nation, eliminate opponents, and dominate the map in this fast-paced IO game.",
        "applicationCategory": "Game",
        "operatingSystem": "Any",
        "gamePlatform": ["Web Browser", "PC", "Mobile"],
        "genre": ["Strategy", "Multiplayer", "IO Game"],
        "playMode": "MultiPlayer",
        "inLanguage": "en",
        "isAccessibleForFree": true,
        "isBasedOn": {
          "@type": "VideoGame",
          "name": "OpenFront",
          "url": "https://github.com/openfrontio/OpenFrontIO"
        }
      }
    </script>
```

- [ ] **Step 7: 렌더러에 `gameTitle` 전달**

`src/server/RenderHtml.ts`:
1. import에 추가: `import { GAME_TITLE } from "@openfront/shared/Branding";`
2. `ejs.render` 지역 변수에서 `cdnBaseRaw: cdnBase,` 바로 다음에 추가:

```ts
    // The game's name for <title>, Open Graph and JSON-LD (Branding.ts).
    gameTitle: GAME_TITLE,
```

`vite.config.ts`:
1. import에 추가: `import { GAME_TITLE } from "@openfront/shared/Branding";`
2. `htmlAssetData`에서 `instanceId: JSON.stringify(env.INSTANCE_ID ?? "DEV_ID"),` 바로 다음에 추가:

```ts
    // Raw, not JSON: index.html escapes it itself (<%= %>).
    gameTitle: GAME_TITLE,
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/Branding.test.ts tests/server/RenderHtml.test.ts tests/client/LangSelectorTranslate.test.ts tests/TranslationSystem.test.ts tests/EnJsonSorted.test.ts --run`
Expected: PASS

Run: `npm run typecheck`
Expected: 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write packages/shared/src/Branding.ts index.html src/server/RenderHtml.ts vite.config.ts src/client/LangSelector.ts resources/lang/en.json resources/lang/ko.json resources/manifest.json tests/Branding.test.ts tests/server/RenderHtml.test.ts tests/client/LangSelectorTranslate.test.ts
git add packages/shared/src/Branding.ts index.html src/server/RenderHtml.ts vite.config.ts src/client/LangSelector.ts resources/lang/en.json resources/lang/ko.json resources/manifest.json tests/Branding.test.ts tests/server/RenderHtml.test.ts tests/client/LangSelectorTranslate.test.ts
git commit -m "chore(fork): name the game Statecraft in one place"
```

---

### Task 2: 게스트가 보는 문구에서 원작 이름 빼기

**Files:**
- Modify: `resources/lang/en.json`, `resources/lang/ko.json` (8개 키)
- Modify: `src/server/GamePreviewBuilder.ts` (링크 미리보기 기본 제목)
- Test: `tests/Branding.test.ts`, `tests/server/GamePreviewTitle.test.ts` (새)

**Interfaces:**
- Consumes: `GAME_TITLE` (Task 1)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/Branding.test.ts`의 `describe("fork branding", ...)` 블록 뒤에 추가:

```ts
// Text a guest meets on this server. These must not present the game as
// OpenFront. The rest of en.json's OpenFront mentions sit behind account,
// store and Steam screens, which a self-hosted server hides.
const GUEST_VISIBLE_KEYS = [
  "common.backend_unreachable",
  "mode_selector.servers_unreachable",
  "graphics_setting.preset_default_desc",
  "help_modal.troubleshooting_desc",
  "ios_banner.modal_desc",
  "ios_banner.text",
  "troubleshooting.chromium_tip",
  "update_available.message",
];

describe.each(["en", "ko"])("%s guest-visible text", (lang) => {
  test.each(GUEST_VISIBLE_KEYS)("%s does not name OpenFront", (key) => {
    const json = readJson(`resources/lang/${lang}.json`);
    const value = key.split(".").reduce((node, part) => node[part], json);
    expect(typeof value).toBe("string");
    expect(value).not.toMatch(/open\s*front|오픈\s*프론트/i);
  });
});
```

`tests/server/GamePreviewTitle.test.ts`:

```ts
import { GAME_TITLE } from "@openfront/shared/Branding";
import { describe, expect, test } from "vitest";
import { buildPreview } from "../../src/server/GamePreviewBuilder";

describe("game link preview", () => {
  test("names this game, not OpenFront, when it knows nothing else", async () => {
    const meta = await buildPreview(
      "abcdefgh",
      "https://play.example.com",
      "w0",
      null,
      null,
    );
    expect(meta.title).toBe(`${GAME_TITLE} game`);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/Branding.test.ts tests/server/GamePreviewTitle.test.ts --run`
Expected: FAIL — en과 ko의 8개 키가 OpenFront를 포함함, 미리보기 제목이 `OpenFront Game`

- [ ] **Step 3: en.json 문구**

`resources/lang/en.json`에서 각 줄을 통째로 바꾼다(Edit, 들여쓰기 그대로):

| 기존 줄 | 새 줄 |
|---|---|
| `"backend_unreachable": "Can't reach the OpenFront servers. Check your connection and try again.",` | `"backend_unreachable": "Can't reach the game servers. Check your connection and try again.",` |
| `"preset_default_desc": "The standard OpenFront look",` | `"preset_default_desc": "The standard look",` |
| `"troubleshooting_desc": "If you experience performance issues, crashes, or other problems while playing OpenFront, please visit our Troubleshooting page for help diagnosing and fixing common issues:",` | `"troubleshooting_desc": "If you experience performance issues, crashes, or other problems while playing, please visit our Troubleshooting page for help diagnosing and fixing common issues:",` |
| `"modal_desc": "Your browser doesn't support fullscreen, but you can add OpenFront to your Home Screen for an immersive experience:",` | `"modal_desc": "Your browser doesn't support fullscreen, but you can add this game to your Home Screen for an immersive experience:",` |
| `"text": "For fullscreen, add OpenFront to your Home Screen"` | `"text": "For fullscreen, add this game to your Home Screen"` |
| `"servers_unreachable": "Can't connect to the OpenFront servers",` | `"servers_unreachable": "Can't connect to the game servers",` |
| `"chromium_tip": "OpenFront runs best on Chromium-based browsers.",` | `"chromium_tip": "This game runs best on Chromium-based browsers.",` |
| `"message": "A new version of OpenFront is available. The page will now refresh to update."` | `"message": "A new version is available. The page will now refresh to update."` |

- [ ] **Step 4: ko.json 문구**

`resources/lang/ko.json`에서 각 줄을 통째로 바꾼다:

| 기존 줄 | 새 줄 |
|---|---|
| `"backend_unreachable": "OpenFront 서버에 연결할 수 없습니다. 네트워크 연결을 확인하고 다시 시도하세요.",` | `"backend_unreachable": "게임 서버에 연결할 수 없습니다. 네트워크 연결을 확인하고 다시 시도하세요.",` |
| `"preset_default_desc": "표준 OpenFront 스타일입니다",` | `"preset_default_desc": "표준 스타일입니다",` |
| `"troubleshooting_desc": "오픈프론트 플레이 중 성능 문제, 충돌 또는 기타 문제가 발생하는 경우, 일반적인 문제의 진단 및 해결에 대한 도움을 받으려면 문제 해결 페이지를 방문하세요.",` | `"troubleshooting_desc": "플레이 중 성능 문제, 충돌 또는 기타 문제가 발생하는 경우, 일반적인 문제의 진단 및 해결에 대한 도움을 받으려면 문제 해결 페이지를 방문하세요.",` |
| `"modal_desc": "현재 브라우저에서는 전체 화면을 지원하지 않지만, 더 몰입감 있는 플레이를 위해 OpenFront를 홈 화면에 추가할 수 있습니다:",` | `"modal_desc": "현재 브라우저에서는 전체 화면을 지원하지 않지만, 더 몰입감 있는 플레이를 위해 이 게임을 홈 화면에 추가할 수 있습니다:",` |
| `"text": "전체 화면을 이용하려면 OpenFront를 홈 화면에 추가하세요"` | `"text": "전체 화면을 이용하려면 이 게임을 홈 화면에 추가하세요"` |
| `"servers_unreachable": "OpenFront 서버에 연결할 수 없습니다",` | `"servers_unreachable": "게임 서버에 연결할 수 없습니다",` |
| `"chromium_tip": "오픈프론트는 크로미움 기반 브라우저에서 가장 잘 작동합니다.",` | `"chromium_tip": "이 게임은 크로미움 기반 브라우저에서 가장 잘 작동합니다.",` |
| `"message": "OpenFront의 새로운 버전을 이용할 수 있습니다. 업데이트를 위해 페이지를 새로고침합니다."` | `"message": "새로운 버전을 이용할 수 있습니다. 업데이트를 위해 페이지를 새로고침합니다."` |

- [ ] **Step 5: 링크 미리보기 기본 제목**

`src/server/GamePreviewBuilder.ts`:
1. import에 추가: `import { GAME_TITLE } from "@openfront/shared/Branding";`
2. `      : "OpenFront Game";`를 ``      : `${GAME_TITLE} game`; ``로 바꾼다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/Branding.test.ts tests/server/GamePreviewTitle.test.ts tests/TranslationSystem.test.ts tests/EnJsonSorted.test.ts --run`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
npx prettier --write resources/lang/en.json resources/lang/ko.json src/server/GamePreviewBuilder.ts tests/Branding.test.ts tests/server/GamePreviewTitle.test.ts
git add resources/lang/en.json resources/lang/ko.json src/server/GamePreviewBuilder.ts tests/Branding.test.ts tests/server/GamePreviewTitle.test.ts
git commit -m "chore(fork): keep the OpenFront name out of text guests see"
```

---

### Task 3: 워드마크, 푸터 고지, 로딩 화면 고지

**Files:**
- Create: `src/client/components/GameWordmark.ts`
- Modify: `src/client/components/DesktopNavBar.ts`, `src/client/components/MobileNavBar.ts`, `src/client/components/PlayPage.ts` (로고 이미지 → 워드마크)
- Modify: `src/client/components/Footer.ts` (전체 교체)
- Modify: `src/client/GameStartingModal.ts`
- Modify: `src/client/LangSelector.ts` (다시 그릴 컴포넌트 목록)
- Modify: `resources/lang/en.json`, `resources/lang/ko.json`
- Test: `tests/client/components/GameWordmark.test.ts` (새), `tests/client/components/ForkNotices.test.ts` (새), `tests/Branding.test.ts`

**Interfaces:**
- Consumes: `GAME_TITLE`, `SOURCE_URL`, `UPSTREAM_URL` (Task 1)
- Produces: `<game-wordmark>`(`compact: boolean` 속성, `.game-wordmark-title`, `.game-wordmark-based-on` 요소). 번역 키 `branding.based_on`, `branding.source_code`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/components/GameWordmark.test.ts`:

```ts
import { GAME_TITLE } from "@openfront/shared/Branding";
import { afterEach, describe, expect, it } from "vitest";
import { GameWordmark } from "../../../src/client/components/GameWordmark";

// translateText reads the <lang-selector> in the document; a plain element
// carrying the same fields stands in for it.
function installLanguage(lang: string, translations: Record<string, string>) {
  const fixture = document.createElement("lang-selector");
  Object.assign(fixture, {
    translations,
    defaultTranslations: translations,
    currentLang: lang,
  });
  document.body.appendChild(fixture);
}

async function mount(compact = false): Promise<GameWordmark> {
  const el = document.createElement("game-wordmark") as GameWordmark;
  el.compact = compact;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const text = (root: ParentNode, selector: string) =>
  root.querySelector(selector)?.textContent?.trim();

afterEach(() => {
  document.body.innerHTML = "";
});

describe("game-wordmark", () => {
  it("spells the name from GAME_TITLE, with the based-on line", async () => {
    installLanguage("en", {
      "branding.title": "{name}",
      "branding.based_on": "Based on OpenFront",
    });
    const el = await mount();
    expect(text(el, ".game-wordmark-title")).toBe(GAME_TITLE);
    expect(text(el, ".game-wordmark-based-on")).toBe("Based on OpenFront");
  });

  it("follows the player's language", async () => {
    installLanguage("ko", {
      "branding.title": "스테이트크래프트",
      "branding.based_on": "OpenFront 기반",
    });
    const el = await mount();
    expect(text(el, ".game-wordmark-title")).toBe("스테이트크래프트");
  });

  it("drops the based-on line when compact", async () => {
    installLanguage("en", { "branding.title": "{name}" });
    const el = await mount(true);
    expect(text(el, ".game-wordmark-title")).toBe(GAME_TITLE);
    expect(el.querySelector(".game-wordmark-based-on")).toBeNull();
  });
});
```

`tests/client/components/ForkNotices.test.ts`:

```ts
import { SOURCE_URL, UPSTREAM_URL } from "@openfront/shared/Branding";
import { afterEach, describe, expect, it } from "vitest";
import "../../../src/client/components/DesktopNavBar";
import "../../../src/client/components/Footer";
import "../../../src/client/components/MobileNavBar";
import "../../../src/client/components/PlayPage";
import "../../../src/client/GameStartingModal";

// jsdom has no ResizeObserver, and the mobile top bar shares a subtree with
// <steam-wishlist>, which constructs one on first update.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

type Mountable = HTMLElement & { updateComplete: Promise<unknown> };

async function mount(tag: string): Promise<Mountable> {
  const el = document.createElement(tag) as Mountable;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

// LICENSE, AGPL v3 section 7 and section 13. Without a <lang-selector> in the
// page, translateText answers with the key, which is what these look for.
describe("footer notices", () => {
  it("offers this fork's source to every player", async () => {
    const footer = await mount("page-footer");
    expect(
      footer.querySelector(
        `a[href="${SOURCE_URL}"][data-i18n="branding.source_code"]`,
      ),
    ).not.toBeNull();
    const github = footer.querySelector('img[data-i18n-alt="main.github"]');
    expect(github?.closest("a")?.getAttribute("href")).toBe(SOURCE_URL);
  });

  it("keeps the upstream copyright and says what the game is based on", async () => {
    const footer = await mount("page-footer");
    expect(footer.querySelector('[data-i18n="main.copyright"]')).not.toBeNull();
    expect(
      footer.querySelector(
        `a[href="${UPSTREAM_URL}"][data-i18n="branding.based_on"]`,
      ),
    ).not.toBeNull();
  });

  it("links none of upstream's community or legal pages as its own", async () => {
    const footer = await mount("page-footer");
    const hrefs = Array.from(footer.querySelectorAll("a")).map(
      (a) => a.getAttribute("href") ?? "",
    );
    expect(
      hrefs.filter((href) =>
        /discord\.gg\/openfront|reddit\.com\/r\/OpenFront|terms-of-service|privacy-policy/.test(
          href,
        ),
      ),
    ).toEqual([]);
  });
});

describe("loading screen notices", () => {
  it("shows the copyright, the based-on line and the source link", async () => {
    const modal = await mount("game-starting-modal");
    expect(modal.textContent).toContain("main.copyright");
    expect(modal.textContent).toContain("branding.based_on");
    expect(modal.querySelector(`a[href="${SOURCE_URL}"]`)).not.toBeNull();
    expect(
      modal.querySelector(`a[href="${SOURCE_URL}/blob/main/CREDITS.md"]`),
    ).not.toBeNull();
  });
});

describe("menus", () => {
  it.each(["desktop-nav-bar", "mobile-nav-bar", "play-page"])(
    "%s shows the wordmark, not upstream's logo",
    async (tag) => {
      const el = await mount(tag);
      expect(el.querySelector("game-wordmark")).not.toBeNull();
      expect(el.querySelector('img[src*="OpenFrontLogo"]')).toBeNull();
    },
  );
});
```

`tests/Branding.test.ts`의 `describe("fork branding", ...)` 안에 추가:

```ts
  test("every language file that has it carries the based-on line", () => {
    expect(readJson("resources/lang/en.json").branding.based_on).toBe(
      "Based on OpenFront",
    );
    expect(readJson("resources/lang/ko.json").branding.based_on).toContain(
      "OpenFront",
    );
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/components/GameWordmark.test.ts tests/client/components/ForkNotices.test.ts tests/Branding.test.ts --run`
Expected: FAIL — `Cannot find module '../../../src/client/components/GameWordmark'`, 푸터에 소스 링크 없음

- [ ] **Step 3: 워드마크 컴포넌트**

`src/client/components/GameWordmark.ts`:

```ts
import { GAME_TITLE } from "@openfront/shared/Branding";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { translateText } from "../Utils";

/**
 * The game's name in the menus, in place of upstream's logo image (whose
 * files are all-rights-reserved, proprietary/LICENSE). Text, so it follows
 * the player's language, with the "Based on OpenFront" line AGPL section
 * 7(c) asks a modified version to carry.
 */
@customElement("game-wordmark")
export class GameWordmark extends LitElement {
  /** The name alone, smaller, for the mobile top bar. */
  @property({ type: Boolean }) compact = false;

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="flex flex-col items-center leading-none select-none">
        <span
          class="game-wordmark-title font-extrabold uppercase tracking-[0.2em] text-white ${this
            .compact
            ? "text-lg"
            : "text-2xl"}"
          >${translateText("branding.title", { name: GAME_TITLE })}</span
        >
        ${this.compact
          ? null
          : html`<span
              class="game-wordmark-based-on mt-1 text-[0.65rem] uppercase tracking-widest text-white/60"
              >${translateText("branding.based_on")}</span
            >`}
      </div>
    `;
  }
}
```

- [ ] **Step 4: 메뉴의 로고 이미지 교체**

`src/client/components/DesktopNavBar.ts`:
1. `import { assetUrl } from "@openfront/shared/AssetUrls";`를 지우고 `import "./GameWordmark";`를 추가한다.
2. 다음 부분을

```ts
          <div class="h-8">
            <img
              class="block h-full aspect-[1364/259]"
              src=${assetUrl("images/OpenFrontLogo.svg")}
              alt="OpenFront"
            />
          </div>
```

`          <game-wordmark></game-wordmark>`로 바꾼다.

`src/client/components/MobileNavBar.ts`:
1. `import { assetUrl } from "@openfront/shared/AssetUrls";`를 지우고 `import "./GameWordmark";`를 추가한다.
2. 다음 부분을

```ts
            <img
              src=${assetUrl("images/OpenFrontLogo.svg")}
              alt="OpenFront"
              class="w-auto h-auto max-w-[220px] max-h-[4.5rem]"
            />
```

`            <game-wordmark></game-wordmark>`로 바꾼다.

`src/client/components/PlayPage.ts`:
1. `import { assetUrl } from "@openfront/shared/AssetUrls";`를 지우고 `import "./GameWordmark";`를 추가한다.
2. 다음 부분을

```ts
              <img
                src=${assetUrl("images/OpenFrontLogo.svg")}
                alt="OpenFront"
                class="h-full w-auto"
              />
```

`              <game-wordmark compact></game-wordmark>`로 바꾼다.

`src/client/LangSelector.ts`의 컴포넌트 목록에서 `      "tutorial-panel",` 다음 줄에 `      "game-wordmark",`를 추가한다.

- [ ] **Step 5: 푸터 교체**

`src/client/components/Footer.ts` 전체를 다음으로 바꾼다(버전 줄, Steam 홍보, 언어 선택기는 그대로다):

```ts
import { assetUrl } from "@openfront/shared/AssetUrls";
import { SOURCE_URL, UPSTREAM_URL } from "@openfront/shared/Branding";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { composeVersionDisplay, desktopVersion } from "../DesktopShell";
import { currentGameVersion } from "../GameVersion";
import "./SteamWishlistButton";

@customElement("page-footer")
export class Footer extends LitElement {
  // Per instance, not at module scope: currentGameVersion reads
  // BOOTSTRAP_CONFIG, which the server injects into the page and which is not
  // guaranteed to exist at the moment this module is first imported.
  private readonly gameVersion = currentGameVersion();

  // Starts as the game version alone and gains the shell version once the
  // bridge answers, so the line is never blank while that call is in flight.
  @state() private versionLabel = this.gameVersion;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // desktopVersion() resolves null off the desktop shell and on its own
    // timeout, so this can only ever leave the label as-is or extend it.
    void desktopVersion().then((shellVersion) => {
      this.versionLabel = composeVersionDisplay(this.gameVersion, shellVersion);
    });
  }

  render() {
    return html`
      <footer
        class="[.in-game_&]:hidden bg-zinc-900/90 backdrop-blur-md flex flex-col items-center justify-center gap-1 pt-1 pb-3 text-white/50 w-full border-t border-white/10 shrink-0 relative z-50 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-0"
      >
        <!-- Icons and notices stay centred on the bar; on desktop they share
             it with the Steam promo, which gets its own grid column so the
             two can never overlap however wide a translation runs. -->
        <div
          class="flex w-full flex-col items-center gap-1 lg:col-start-2 lg:w-auto"
        >
          <div
            class="flex items-center justify-center gap-4 lg:gap-6 pt-2 w-full relative"
          >
            <!-- This fork's source code (AGPL v3 section 13). -->
            <a
              href=${SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="opacity-60 hover:opacity-100 hover:scale-110 transition-all"
            >
              <img
                src=${assetUrl("icons/github-mark-white.svg")}
                data-i18n-alt="main.github"
                class="h-6 w-6 lg:h-7 lg:w-7 object-contain pointer-events-none"
                draggable="false"
              />
            </a>
            <!-- The rules of the game this one is based on. -->
            <a
              href="https://openfront.wiki/Main_Page"
              target="_blank"
              rel="noopener noreferrer"
              class="opacity-60 hover:opacity-100 hover:scale-110 transition-all"
            >
              <img
                src=${assetUrl("icons/wiki-logo.svg")}
                data-i18n-alt="main.wiki"
                class="h-6 w-6 lg:h-7 lg:w-7 object-contain pointer-events-none"
                draggable="false"
              />
            </a>
          </div>
          <!-- The nav bar shows the game version alone so it reads the same
               across web and Steam; the full string, shell version included,
               lives down here where a player can quote it in a bug report. -->
          <div class="footer-version text-xs mt-1 lg:mt-2 text-center px-4">
            ${this.versionLabel}
          </div>
          <!-- LICENSE, AGPL v3 section 7: upstream's copyright notice stays
               visible (7(b)) and the game says what it is based on (7(c)). -->
          <div
            class="text-xs mt-1 lg:mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4"
          >
            <span data-i18n="main.copyright"></span>
            <a
              href=${UPSTREAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-i18n="branding.based_on"
              class="hover:text-white transition-colors"
            ></a>
            <a
              href=${SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-i18n="branding.source_code"
              class="hover:text-white transition-colors"
            ></a>
          </div>
        </div>

        <!-- Phones keep the full store widget on the play page instead; there
             is no room for it here. -->
        <div
          class="hidden lg:flex lg:col-start-3 lg:items-center lg:justify-end lg:pt-2 lg:pr-20"
        >
          <steam-wishlist-button
            campaign="home_desktop"
            class="min-w-0 flex-1 max-w-[544px]"
          ></steam-wishlist-button>
        </div>

        <!-- Single instance: translateText() resolves the active language via
             document.querySelector("lang-selector"), so a second one would
             shadow it. -->
        <lang-selector
          class="absolute right-4 top-3 lg:top-1/2 lg:-translate-y-1/2"
        ></lang-selector>
      </footer>
    `;
  }
}
```

- [ ] **Step 6: 로딩 화면**

`src/client/GameStartingModal.ts`:
1. import에 추가: `import { SOURCE_URL } from "@openfront/shared/Branding";`
2. 다음 부분을

```ts
        <div
          class="text-base font-medium tracking-wider uppercase text-white/40 mb-3"
        >
          ${translateText("main.copyright")}
        </div>
        <a
          href="https://github.com/openfrontio/OpenFrontIO/blob/main/CREDITS.md"
```

다음으로 바꾼다:

```ts
        <div
          class="text-base font-medium tracking-wider uppercase text-white/40 mb-1"
        >
          ${translateText("main.copyright")}
        </div>
        <div class="text-sm tracking-wider text-white/40 mb-3">
          ${translateText("branding.based_on")}
        </div>
        <a
          href=${`${SOURCE_URL}/blob/main/CREDITS.md`}
```

3. 다음 부분을

```ts
        <p class="text-base text-white/40 mb-4">
          ${translateText("game_starting_modal.code_license")}
        </p>
```

다음으로 바꾼다:

```ts
        <p class="text-base text-white/40 mb-1">
          ${translateText("game_starting_modal.code_license")}
        </p>
        <!-- This fork's source code (AGPL v3 section 13). -->
        <a
          href=${SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          class="block mb-4 text-sm text-malibu-blue no-underline transition-colors duration-200 hover:text-aquarius"
          >${translateText("branding.source_code")}</a
        >
```

- [ ] **Step 7: 번역 키**

`resources/lang/en.json`:
1. `"branding"` 블록을 다음으로 바꾼다:

```json
  "branding": {
    "based_on": "Based on OpenFront",
    "source_code": "Source code",
    "title": "{name}"
  },
```

2. `"main"` 안의 다음 두 줄을 지운다(푸터에서 빠져 더는 쓰이지 않는다):

```json
    "privacy_policy": "Privacy Policy",
```

```json
    "terms_of_service": "Terms of Service",
```

`resources/lang/ko.json`의 `"branding"` 블록을 다음으로 바꾼다:

```json
  "branding": {
    "based_on": "OpenFront 기반",
    "source_code": "소스 코드",
    "title": "스테이트크래프트"
  },
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/client/components tests/Branding.test.ts tests/client/NavBars.settings.test.ts tests/TranslationSystem.test.ts tests/EnJsonSorted.test.ts --run`
Expected: PASS (`tests/client/components/Footer.test.ts` 포함)

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write src/client/components/GameWordmark.ts src/client/components/DesktopNavBar.ts src/client/components/MobileNavBar.ts src/client/components/PlayPage.ts src/client/components/Footer.ts src/client/GameStartingModal.ts src/client/LangSelector.ts resources/lang/en.json resources/lang/ko.json tests/client/components/GameWordmark.test.ts tests/client/components/ForkNotices.test.ts tests/Branding.test.ts
git add src/client/components/GameWordmark.ts src/client/components/DesktopNavBar.ts src/client/components/MobileNavBar.ts src/client/components/PlayPage.ts src/client/components/Footer.ts src/client/GameStartingModal.ts src/client/LangSelector.ts resources/lang/en.json resources/lang/ko.json tests/client/components/GameWordmark.test.ts tests/client/components/ForkNotices.test.ts tests/Branding.test.ts
git commit -m "feat(fork): wordmark, source link and based-on notice in menus, footer and loading screen"
```

---

### Task 4: `proprietary/` 자산 대체와 제거

**Files:**
- Create: `resources/images/Emblem.svg`
- Modify: `packages/shared/src/Branding.ts` (`EMBLEM_ASSET`)
- Modify: `src/server/RenderHtml.ts`, `vite.config.ts` (파비콘, 워터마크 지역 변수 삭제)
- Modify: `index.html` (워터마크)
- Modify: `src/client/Main.ts` (폰트 등록 삭제), `src/client/styles.css`, `src/client/GameVersion.ts`
- Modify: `src/client/components/GameStartAlertController.ts`, `src/client/components/SteamWishlistButton.ts`
- Modify: `README.md` (머리 로고)
- Delete: `proprietary/` 아래 자산 12개
- Test: `tests/ForkAssets.test.ts` (새), `tests/server/RenderHtml.test.ts`, `tests/client/Matchmaking.test.ts`

**Interfaces:**
- Produces: `EMBLEM_ASSET = "images/Emblem.svg"` (`@openfront/shared/Branding`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ForkAssets.test.ts`:

```ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");

// Upstream's all-rights-reserved assets (proprietary/LICENSE: "NOT licensed
// for use ... outside of OpenFront"). This fork ships none of them, and an
// upstream merge can bring them back without a conflict, so these tests are
// what notices.
const UPSTREAM_ONLY_ASSETS = [
  "images/Favicon.svg",
  "images/OF.png",
  "images/OF.webp",
  "images/OpenFrontLogoDark.svg",
  "images/OpenFrontLogo.png",
  "images/OpenFrontLogo.svg",
  "images/OpenFront.png",
  "images/OpenFront.webp",
  "fonts/OpenFront.ttf",
  "sounds/effects/game-start-alert.mp3",
];

function walk(dir: string, rel = ""): string[] {
  if (!fs.existsSync(path.join(dir, rel))) return [];
  return fs
    .readdirSync(path.join(dir, rel), { withFileTypes: true })
    .flatMap((entry) => {
      const child = rel === "" ? entry.name : `${rel}/${entry.name}`;
      return entry.isDirectory() ? walk(dir, child) : [child];
    })
    .sort();
}

function shippedSources(): string[] {
  const packageSources = fs
    .readdirSync(path.join(ROOT, "packages"))
    .flatMap((pkg) =>
      walk(path.join(ROOT, "packages", pkg, "src")).map(
        (file) => `packages/${pkg}/src/${file}`,
      ),
    );
  return [
    "index.html",
    "vite.config.ts",
    ...walk(path.join(ROOT, "src")).map((file) => `src/${file}`),
    ...packageSources,
  ].filter((file) => /\.(ts|css|html)$/.test(file));
}

describe("fork asset hygiene", () => {
  test("proprietary/ holds nothing but upstream's LICENSE", () => {
    expect(walk(path.join(ROOT, "proprietary"))).toEqual(["LICENSE"]);
  });

  test("no code or page references an upstream-only asset", () => {
    const offenders: string[] = [];
    for (const file of shippedSources()) {
      const content = fs.readFileSync(path.join(ROOT, file), "utf8");
      for (const asset of UPSTREAM_ONLY_ASSETS) {
        if (content.includes(asset)) offenders.push(`${file}: ${asset}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // The music slots (sounds/music/gameplay.mp3, menu-theme.mp3) ship empty.
  // A track dropped in must say where it came from.
  test("every music track in resources/ is credited", () => {
    const credits = fs.readFileSync(path.join(ROOT, "CREDITS.md"), "utf8");
    const tracks = walk(path.join(ROOT, "resources/sounds/music")).filter(
      (file) => !file.startsWith("."),
    );
    for (const track of tracks) {
      expect(credits, track).toContain(track);
    }
  });
});
```

`tests/server/RenderHtml.test.ts`, `describe("RenderHtml environment-only render", ...)` 블록의 마지막 테스트 뒤에 추가:

```ts
  it("uses the fork's emblem as the favicon and draws no upstream logo", async () => {
    const html = await renderHtmlContent(REAL_TEMPLATE);
    expect(html).toMatch(
      /<link rel="icon" type="image\/svg\+xml" href="[^"]*Emblem[^"]*" \/>/,
    );
    expect(html).not.toContain("logo-image-url");
  });
```

`tests/client/Matchmaking.test.ts`에서

```ts
      src: ["/sounds/effects/game-start-alert.mp3"],
```

를 다음으로 바꾼다:

```ts
      src: ["/sounds/effects/game-start.mp3"],
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/ForkAssets.test.ts tests/server/RenderHtml.test.ts tests/client/Matchmaking.test.ts --run`
Expected: FAIL — `proprietary/`에 파일 13개, 원작 자산 참조 9곳, 파비콘이 `Favicon.svg`, 알림음 경로

- [ ] **Step 3: 엠블럼**

`resources/images/Emblem.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- A star over a globe. Drawn for this fork; CC BY-SA 4.0 like the rest
       of resources/ (CREDITS.md). -->
  <rect width="64" height="64" rx="14" fill="#0a1628" />
  <g fill="none" stroke="#3fa9f5" stroke-width="3" stroke-linecap="round">
    <circle cx="32" cy="39" r="17" />
    <ellipse cx="32" cy="39" rx="7.5" ry="17" />
    <path d="M15 39h34M17.6 30h28.8M17.6 48h28.8" />
  </g>
  <path
    fill="#ffd700"
    d="M32 4l2.6 5.3 5.9.9-4.3 4.1 1 5.8L32 17.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
  />
</svg>
```

`packages/shared/src/Branding.ts` 끝에 추가:

```ts

/** Favicon (resources/images/Emblem.svg, drawn for this fork). */
export const EMBLEM_ASSET = "images/Emblem.svg";
```

- [ ] **Step 4: 파비콘과 워터마크**

`src/server/RenderHtml.ts`:
1. Branding import를 `import { EMBLEM_ASSET, GAME_TITLE } from "@openfront/shared/Branding";`로 바꾼다.
2. `faviconHref: buildAssetUrl("images/Favicon.svg", assetManifest, cdnBase),`를 `faviconHref: buildAssetUrl(EMBLEM_ASSET, assetManifest, cdnBase),`로 바꾼다.
3. 다음 부분을 지운다:

```ts
    desktopLogoImageUrl: buildAssetUrl(
      "images/OpenFront.png",
      assetManifest,
      cdnBase,
    ),
    mobileLogoImageUrl: buildAssetUrl("images/OF.png", assetManifest, cdnBase),
```

`vite.config.ts`:
1. Branding import를 `import { EMBLEM_ASSET, GAME_TITLE } from "@openfront/shared/Branding";`로 바꾼다.
2. `faviconHref: buildAssetUrl("images/Favicon.svg", assetManifest, cdnBase),`를 `faviconHref: buildAssetUrl(EMBLEM_ASSET, assetManifest, cdnBase),`로 바꾼다.
3. RenderHtml.ts와 같은 `desktopLogoImageUrl`, `mobileLogoImageUrl` 두 항목을 지운다.

`index.html`:
1. 다음 부분을 지운다:

```js
      document.documentElement.style.setProperty(
        "--desktop-logo-image-url",
        `url("<%- desktopLogoImageUrl %>")`,
      );
      document.documentElement.style.setProperty(
        "--mobile-logo-image-url",
        `url("<%- mobileLogoImageUrl %>")`,
      );
```

2. 다음 부분을 지운다(`#hex-grid` 안의 배경 레이어는 남긴다):

```html
      <div
        class="absolute inset-0 bg-center bg-no-repeat bg-contain hidden lg:block"
        style="background-image: var(--desktop-logo-image-url); opacity: 0.5"
      ></div>
      <div
        class="absolute inset-0 bg-center bg-no-repeat bg-contain lg:hidden"
        style="background-image: var(--mobile-logo-image-url); opacity: 0.5"
      ></div>
```

`src/client/halloween.css`의 `--desktop-logo-image-url`, `--mobile-logo-image-url` 규칙은 이제 맞는 요소가 없어 아무 일도 하지 않는다. 원작과의 병합 충돌을 줄이려고 그대로 둔다.

- [ ] **Step 5: 폰트**

`src/client/Main.ts`:
1. `import { assetUrl } from "@openfront/shared/AssetUrls";` 줄을 지운다(아래 블록이 유일한 사용처다).
2. 다음 블록(뒤의 빈 줄 포함)을 지운다:

```ts
    const openFrontFont = new FontFace(
      "OpenFront",
      `url(${assetUrl("fonts/OpenFront.ttf")})`,
    );
    document.fonts.add(openFrontFont);
    openFrontFont.load().catch(() => {});

```

`src/client/styles.css`에서 `  --font-display: "OpenFront", Inter, Arial, sans-serif;`를 `  --font-display: Inter, Arial, sans-serif;`로 바꾼다.

`src/client/GameVersion.ts`에서 다음 줄을 지운다(버전 줄은 주변 글꼴을 따른다):

```ts
    (el as HTMLElement).style.fontFamily = '"OpenFront", Inter, sans-serif';
```

- [ ] **Step 6: 알림음과 Steam 버튼 로고**

`src/client/components/GameStartAlertController.ts`에서

```ts
      src: [assetUrl("sounds/effects/game-start-alert.mp3")],
```

를 다음으로 바꾼다:

```ts
      // Upstream's own chime is all-rights-reserved (proprietary/); the
      // in-game start cue (resources/, CC BY-SA) stands in.
      src: [assetUrl("sounds/effects/game-start.mp3")],
```

`src/client/components/SteamWishlistButton.ts`:
1. `import { assetUrl } from "@openfront/shared/AssetUrls";` 줄을 지운다.
2. 다음 부분을 지운다:

```ts
        <img
          src=${assetUrl("images/OpenFrontLogo.svg")}
          alt=""
          class="hidden h-7 w-auto max-w-[120px] shrink-0 object-contain pointer-events-none min-[1600px]:block"
          draggable="false"
        />
```

- [ ] **Step 7: README 머리 로고**

`README.md` 맨 위의 다음 부분을

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="proprietary/images/OpenFrontLogoDark.svg">
    <source media="(prefers-color-scheme: light)" srcset="proprietary/images/OpenFrontLogo.svg">
    <img src="proprietary/images/OpenFrontLogo.svg" alt="OpenFrontIO Logo" width="300">
  </picture>
</p>
```

다음으로 바꾼다:

```html
<p align="center">
  <img src="resources/images/Emblem.svg" alt="" width="96">
</p>

<h1 align="center">Statecraft</h1>
```

- [ ] **Step 8: 원작 자산 삭제**

```bash
git rm proprietary/fonts/OpenFront.ttf \
  proprietary/images/Favicon.svg \
  proprietary/images/OF.png \
  proprietary/images/OF.webp \
  proprietary/images/OpenFrontLogoDark.svg \
  proprietary/images/OpenFrontLogo.png \
  proprietary/images/OpenFrontLogo.svg \
  proprietary/images/OpenFront.png \
  proprietary/images/OpenFront.webp \
  proprietary/sounds/effects/game-start-alert.mp3 \
  proprietary/sounds/music/gameplay.mp3 \
  proprietary/sounds/music/menu-theme.mp3
find proprietary -type f
```

Expected: `proprietary/LICENSE` 한 줄. 빈 디렉터리가 남았으면 `find proprietary -type d -empty -delete`로 지운다.

음악 경로(`sounds/music/gameplay.mp3`, `sounds/music/menu-theme.mp3`)는 코드에 그대로 둔다. 파일이 없으면 `SoundManager`와 `MenuMusic`의 기존 load-error 처리로 무음이 된다.

- [ ] **Step 9: 통과 확인**

Run: `npx vitest tests/ForkAssets.test.ts tests/server/RenderHtml.test.ts tests/client/Matchmaking.test.ts tests/client/sound tests/client/MainInitialize.test.ts tests/client/GameVersion.test.ts tests/client/components --run`
Expected: PASS

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음

- [ ] **Step 10: 커밋**

```bash
npx prettier --write packages/shared/src/Branding.ts src/server/RenderHtml.ts vite.config.ts index.html src/client/Main.ts src/client/styles.css src/client/GameVersion.ts src/client/components/GameStartAlertController.ts src/client/components/SteamWishlistButton.ts tests/ForkAssets.test.ts tests/server/RenderHtml.test.ts tests/client/Matchmaking.test.ts
git add resources/images/Emblem.svg packages/shared/src/Branding.ts src/server/RenderHtml.ts vite.config.ts index.html src/client/Main.ts src/client/styles.css src/client/GameVersion.ts src/client/components/GameStartAlertController.ts src/client/components/SteamWishlistButton.ts README.md tests/ForkAssets.test.ts tests/server/RenderHtml.test.ts tests/client/Matchmaking.test.ts
git commit -m "chore(fork): replace upstream's proprietary logo, font and sounds"
```

(`git rm`으로 지운 파일은 Step 8에서 이미 스테이징되어 있다.)

---

### Task 5: 서버의 자체 호스팅 플래그와 계정 확인

**Files:**
- Modify: `src/server/ServerEnv.ts`
- Modify: `src/server/jwt.ts`
- Modify: `src/server/ClusterCheckin.ts`
- Test: `tests/server/SelfHosted.test.ts` (새)

**Interfaces:**
- Produces: `ServerEnv.selfHosted(): boolean`(`process.env.SELF_HOSTED === "true"`, 호출할 때마다 읽음), `ServerEnv.skipsApiChecks(): boolean`(`ServerEnv.env() === GameEnv.Dev || ServerEnv.selfHosted()`). 자체 호스팅이면 `ServerEnv.jwtIssuer()`가 `/self-hosted/` 문구의 Error를 던지고, `ServerEnv.turnstileSiteKey()`는 키가 없을 때 `""`를 준다. `registeredSite()`는 `undefined`, `checkinBody()`는 `null`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/server/SelfHosted.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/server/SelfHosted.test.ts --run`
Expected: FAIL — `ServerEnv.selfHosted is not a function`

- [ ] **Step 3: ServerEnv**

`src/server/ServerEnv.ts`:
1. `static env(): GameEnv {` 앞에 추가:

```ts
  // SELF_HOSTED=true: this server runs without OpenFront's closed-source API
  // (README, "자체 호스팅"). Accounts, Turnstile, cosmetics, archives, the
  // server registry and every other api.<DOMAIN> call are skipped, and guests
  // play under their browser's persistent ID. Read on every call, like the
  // identity values below, so a test can stub it.
  static selfHosted(): boolean {
    return process.env.SELF_HOSTED === "true";
  }
  // Whether account, subscription, payment and Turnstile checks are skipped:
  // under local dev (no API to ask) and on a self-hosted server (no API at
  // all). Through env() so a test can stand in for the environment.
  static skipsApiChecks(): boolean {
    return ServerEnv.env() === GameEnv.Dev || ServerEnv.selfHosted();
  }
```

2. `turnstileSiteKey()`를 다음으로 바꾼다:

```ts
  static turnstileSiteKey(): string {
    const v = process.env.TURNSTILE_SITE_KEY;
    if (!v) {
      // A self-hosted page never loads Turnstile (index.html), so it needs
      // no key; ClientEnv only requires the field to be present.
      if (ServerEnv.selfHosted()) return "";
      throw new Error("TURNSTILE_SITE_KEY not set");
    }
    return v;
  }
```

3. `jwtIssuer()`를 다음으로 바꾼다:

```ts
  static jwtIssuer(): string {
    // Every api.<DOMAIN> URL is built from this, so refusing here is the
    // backstop for any call site the self-host gates missed: it fails inside
    // that caller's own error handling instead of reaching for an API that
    // does not exist.
    if (ServerEnv.selfHosted()) {
      throw new Error("self-hosted server has no API (SELF_HOSTED=true)");
    }
    const audience = ServerEnv.jwtAudience();
    return audience === "localhost"
      ? "http://localhost:8787"
      : `https://api.${audience}`;
  }
```

- [ ] **Step 4: 토큰 확인**

`src/server/jwt.ts`의 `verifyClientToken` 앞부분

```ts
  if (PersistentIdSchema.safeParse(token).success) {
    if (ServerEnv.env() === GameEnv.Dev) {
      return { type: "success", persistentId: token, claims: null };
    } else {
      return {
        type: "error",
        message: "persistent ID not allowed in production",
      };
    }
  }
  try {
```

를 다음으로 바꾼다:

```ts
  if (PersistentIdSchema.safeParse(token).success) {
    // A guest's browser-made id: fine where there is no API to vouch for
    // anyone (dev, and every player on a self-hosted server).
    if (ServerEnv.skipsApiChecks()) {
      return { type: "success", persistentId: token, claims: null };
    } else {
      return {
        type: "error",
        message: "persistent ID not allowed in production",
      };
    }
  }
  if (ServerEnv.selfHosted()) {
    // No API, so no keys to check an account token against: on a
    // self-hosted server everyone plays as a guest.
    return {
      type: "error",
      message: "account tokens are not accepted on a self-hosted server",
    };
  }
  try {
```

그 뒤 jwt.ts에서 `GameEnv`가 더 쓰이지 않으면 `import { GameEnv } from "@openfront/shared/configuration/Env";` 줄을 지운다(`grep -n "GameEnv" src/server/jwt.ts`로 확인).

- [ ] **Step 5: 등록 끄기**

`src/server/ClusterCheckin.ts`:
1. `registeredSite()`를 다음으로 바꾼다:

```ts
export function registeredSite(): string | undefined {
  // A self-hosted server registers nowhere: there is no API to register
  // with. This also keeps the lobby coordinator (coordinatorUrl) off.
  if (ServerEnv.selfHosted()) return undefined;
  return ServerEnv.siteHost() ?? ServerEnv.publicHost();
}
```

2. `checkinBody()`의 첫 줄 `const host = ServerEnv.publicHost();` 앞에 추가:

```ts
  // No check-in, so Master.ts neither registers nor polls map weights, and
  // schedules this server's public lobbies itself, as under local dev.
  if (ServerEnv.selfHosted()) return null;
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/server/SelfHosted.test.ts tests/server/ServerEnv.test.ts tests/server/ClusterCheckin.test.ts tests/server/UserMeFailureClose.test.ts --run`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/server/ServerEnv.ts src/server/jwt.ts src/server/ClusterCheckin.ts tests/server/SelfHosted.test.ts
git add src/server/ServerEnv.ts src/server/jwt.ts src/server/ClusterCheckin.ts tests/server/SelfHosted.test.ts
git commit -m "feat(selfhost): SELF_HOSTED flag, guest tokens and no API registration"
```

---

### Task 6: 워커와 게임 서버의 API 호출 끄기

**Files:**
- Modify: `src/server/PrivilegeRefresher.ts` (`startPrivilegeChecks`)
- Modify: `src/server/RankedCheckin.ts`
- Modify: `src/server/Worker.ts`
- Modify: `src/server/GameServer.ts` (`defaultGameServerDeps`)
- Modify: `src/server/GamePreviewRoute.ts`
- Test: `tests/server/SelfHostedWiring.test.ts` (새)

**Interfaces:**
- Consumes: `ServerEnv.selfHosted()`, `ServerEnv.skipsApiChecks()` (Task 5)
- Produces: `startPrivilegeChecks(log: Logger): () => PrivilegeChecker` (`src/server/PrivilegeRefresher.ts`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/server/SelfHostedWiring.test.ts`:

```ts
import express from "express";
import http from "http";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, test, vi } from "vitest";
import { defaultGameServerDeps } from "../../src/server/GameServer";
import { registerGamePreviewRoute } from "../../src/server/GamePreviewRoute";
import { FailOpenPrivilegeChecker } from "../../src/server/Privilege";
import { startPrivilegeChecks } from "../../src/server/PrivilegeRefresher";
import { startRankedCheckinLoops } from "../../src/server/RankedCheckin";

function spyLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

describe("self-hosted server wiring", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("polls no cosmetics catalog and lets every join through", () => {
    vi.stubEnv("SELF_HOSTED", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const privileges = startPrivilegeChecks(spyLog() as never);
    expect(privileges()).toBeInstanceOf(FailOpenPrivilegeChecker);
    expect(privileges().resolveClanTag("ABC", [])).toEqual({
      tag: "ABC",
      dropped: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("starts no ranked check-ins", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.useFakeTimers();
    const fetchFn = vi.fn();
    const log = spyLog();
    startRankedCheckinLoops({
      gm: {},
      playlist: {},
      workerId: 0,
      log,
      isActive: () => true,
      fetchFn,
    } as never);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  test("archives nothing and fetches no tribe names", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const deps = defaultGameServerDeps();
    await deps.archive({} as never);
    await expect(deps.fetchTribes([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a game link preview asks no API about the game", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    const log = spyLog();
    const app = express();
    registerGamePreviewRoute({
      app,
      gm: { game: () => null } as never,
      workerId: 0,
      log: log as never,
      baseDir: "/nonexistent",
    });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const res = await fetch(`${base}/game/abcdefgh`, { redirect: "manual" });
      expect(res.status).toBe(302);
      const outbound = fetchSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((url) => !url.startsWith(base));
      expect(outbound).toEqual([]);
      expect(log.warn).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/server/SelfHostedWiring.test.ts --run`
Expected: FAIL — `startPrivilegeChecks`가 없음. 랭크 루프가 오류를 로그로 남김. `fetchTribes`가 거부됨(Task 5의 `jwtIssuer` 예외). 미리보기가 `failed to fetch public game info`를 warn으로 남김.

- [ ] **Step 3: 권한 확인기**

`src/server/PrivilegeRefresher.ts`:
1. import에 추가: `import { ServerEnv } from "./ServerEnv";`
2. 파일 끝에 추가:

```ts

/**
 * The privilege checker a worker consults on every join: polls the API's
 * cosmetics catalog and clan registry, except on a self-hosted server, which
 * has neither and keeps the fail-open checker (catalog cosmetics dropped,
 * clan tags kept) for its whole life.
 */
export function startPrivilegeChecks(log: Logger): () => PrivilegeChecker {
  if (ServerEnv.selfHosted()) {
    const failOpen = new FailOpenPrivilegeChecker();
    return () => failOpen;
  }
  const refresher = new PrivilegeRefresher(
    ServerEnv.jwtIssuer() + "/cosmetics.json",
    ServerEnv.apiKey(),
    ServerEnv.jwtIssuer() + "/reserved_clan_tags",
    log,
  );
  void refresher.start();
  return () => refresher.get();
}
```

- [ ] **Step 4: 랭크 체크인**

`src/server/RankedCheckin.ts`의 `startRankedCheckinLoops` 첫 줄 앞에 추가:

```ts
  // Ranked matchmaking lives in the API; a self-hosted server has none.
  if (ServerEnv.selfHosted()) return;
```

- [ ] **Step 5: Worker.ts**

`src/server/Worker.ts`:
1. `import { GameEnv } from "@openfront/shared/configuration/Env";` 줄을 지운다(아래 세 곳이 유일한 사용처다).
2. `import { PrivilegeRefresher } from "./PrivilegeRefresher";`를 `import { startPrivilegeChecks } from "./PrivilegeRefresher";`로 바꾼다.
3. 다음 부분을

```ts
  const privilegeRefresher = new PrivilegeRefresher(
    ServerEnv.jwtIssuer() + "/cosmetics.json",
    ServerEnv.apiKey(),
    ServerEnv.jwtIssuer() + "/reserved_clan_tags",
    log,
  );
  privilegeRefresher.start();
```

`  const privileges = startPrivilegeChecks(log);`로 바꾼다.
4. 다음 두 부분을 바꾼다:

```ts
        const resolution = privilegeRefresher
          .get()
          .resolveClanTag(clanTag, ownedClanTags);
```

→

```ts
        const resolution = privileges().resolveClanTag(clanTag, ownedClanTags);
```

```ts
        const cosmeticResult = privilegeRefresher
          .get()
          .isAllowed(flares ?? [], clientMsg.cosmetics ?? {});
```

→

```ts
        const cosmeticResult = privileges().isAllowed(
          flares ?? [],
          clientMsg.cosmetics ?? {},
        );
```

5. 로비 공개 구독 확인:

```ts
      // Dev has no subscription backend; skip the check so the feature is
      // testable locally (same precedent as Turnstile).
      if (ServerEnv.env() !== GameEnv.Dev) {
```

→

```ts
      // Dev and self-hosted servers have no subscription backend; skip the
      // check (same precedent as Turnstile).
      if (!ServerEnv.skipsApiChecks()) {
```

6. 로비 대기열 결제:

```ts
      // Dev has no payment backend; skip the charge so the feature is
      // testable locally (same precedent as the listing subscription check).
      ServerEnv.env() === GameEnv.Dev
```

→

```ts
      // Dev and self-hosted servers have no payment backend; skip the charge
      // (same precedent as the listing subscription check).
      ServerEnv.skipsApiChecks()
```

7. Turnstile과 join_verify:

```ts
        let verifySkipped = false;
        if (ServerEnv.env() !== GameEnv.Dev) {
```

→

```ts
        let verifySkipped = false;
        // Dev and self-hosted servers have no join_verify to ask: the local
        // censorPlayer screen above stands.
        if (!ServerEnv.skipsApiChecks()) {
```

8. `grep -n "GameEnv\|privilegeRefresher" src/server/Worker.ts`의 출력이 비어 있는지 확인한다.

- [ ] **Step 6: 게임 기록과 부족 이름**

`src/server/GameServer.ts`의 `defaultGameServerDeps()`를 다음으로 바꾼다:

```ts
export function defaultGameServerDeps(): GameServerDeps {
  // A self-hosted server has no API to archive games to or to fetch bought
  // tribe names from: games end unarchived, bots keep their organic names.
  const selfHosted = ServerEnv.selfHosted();
  return {
    archive: selfHosted
      ? async () => {}
      : (record) => archive(finalizeGameRecord(record)),
    replayWinner: replayWinnerInChild,
    replayPending: () => winnerReplayMetrics.pending,
    fetchTribes: selfHosted ? async () => [] : fetchCustomTribes,
    env: () => ServerEnv.env(),
    turnIntervalMs: () => ServerEnv.turnIntervalMs(),
    telemetry: noopMatchTelemetryEmitter,
    telemetryBuildHash: "DEV",
    mintGroupToken,
  };
}
```

- [ ] **Step 7: 링크 미리보기**

`src/server/GamePreviewRoute.ts`의 `fetchPublicGameInfo` 안에서

```ts
    if (!gameIDSchema.safeParse(gameID).success) return null;
```

다음 줄에 추가:

```ts
    // Archived games live in the API, which a self-hosted server lacks: a
    // preview there shows live lobbies only.
    if (ServerEnv.selfHosted()) return null;
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/server --run`
Expected: PASS

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write src/server/PrivilegeRefresher.ts src/server/RankedCheckin.ts src/server/Worker.ts src/server/GameServer.ts src/server/GamePreviewRoute.ts tests/server/SelfHostedWiring.test.ts
git add src/server/PrivilegeRefresher.ts src/server/RankedCheckin.ts src/server/Worker.ts src/server/GameServer.ts src/server/GamePreviewRoute.ts tests/server/SelfHostedWiring.test.ts
git commit -m "feat(selfhost): no cosmetics, ranked, archive, tribe or preview API calls"
```

---

### Task 7: 마스터가 워커 라우팅과 API 스텁을 맡음

**Files:**
- Create: `packages/shared/src/SelfHost.ts`
- Create: `src/server/SelfHostProxy.ts`
- Create: `src/server/SelfHostApiStub.ts`
- Modify: `src/server/Master.ts`
- Test: `tests/server/SelfHostMaster.test.ts` (새)

**Interfaces:**
- Consumes: `ServerEnv.selfHosted()` (Task 5), `ServerEnv.numWorkers()`, `ServerEnv.workerPortByIndex(index)`
- Produces: `SELF_HOST_API_PREFIX = "/selfhost-api"` (`@openfront/shared/SelfHost`). `src/server/SelfHostProxy.ts`의 `interface WorkerRouting { numWorkers: number; portOf: (index: number) => number; pick: () => number }`, `interface WorkerTarget { port: number; path: string }`, `workerTarget(method: string, url: string, routing: WorkerRouting): WorkerTarget | null`, `proxyToWorkers(enabled: () => boolean, routing: () => WorkerRouting): RequestHandler`, `proxyUpgradeToWorker(req: http.IncomingMessage, socket: Duplex, head: Buffer, routing: WorkerRouting): boolean`. `src/server/SelfHostApiStub.ts`의 `selfHostApiStub(enabled: () => boolean): RequestHandler`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/server/SelfHostMaster.test.ts`:

```ts
import { SELF_HOST_API_PREFIX } from "@openfront/shared/SelfHost";
import express from "express";
import http from "http";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, test } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { selfHostApiStub } from "../../src/server/SelfHostApiStub";
import {
  proxyToWorkers,
  proxyUpgradeToWorker,
  workerTarget,
  type WorkerRouting,
} from "../../src/server/SelfHostProxy";

const ROUTING: WorkerRouting = {
  numWorkers: 2,
  portOf: (index) => 3001 + index,
  pick: () => 1,
};

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve((server.address() as AddressInfo).port),
    ),
  );
}

function close(server: http.Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    ws.once("message", (data) => resolve(String(data)));
    ws.once("error", reject);
  });
}

// nginx.conf's worker routing, which the master takes over when self-hosted.
describe("workerTarget", () => {
  test.each([
    ["GET", "/w0/lobbies", { port: 3001, path: "/lobbies" }],
    [
      "GET",
      "/w1/api/game/abcdefgh/exists?x=1",
      { port: 3002, path: "/api/game/abcdefgh/exists?x=1" },
    ],
    ["GET", "/w1", { port: 3002, path: "/" }],
    ["GET", "/w1?a=b", { port: 3002, path: "/?a=b" }],
    ["POST", "/api/create_game", { port: 3002, path: "/api/create_game" }],
    [
      "POST",
      "/api/adminbot/create_pool",
      { port: 3002, path: "/api/adminbot/create_pool" },
    ],
  ])("%s %s goes to a worker", (method, url, target) => {
    expect(workerTarget(method, url, ROUTING)).toEqual(target);
  });

  test.each([
    ["GET", "/"],
    ["GET", "/api/health"],
    ["GET", "/api/create_game"],
    ["GET", "/w2/lobbies"],
    ["GET", "/w0abc"],
    ["GET", "/_assets/images/Emblem.abc.svg"],
  ])("%s %s stays on the master", (method, url) => {
    expect(workerTarget(method, url, ROUTING)).toBeNull();
  });
});

describe("master in front of a worker", () => {
  let worker: http.Server;
  let wss: WebSocketServer;
  let master: http.Server;
  let masterHost: string;
  let enabled: boolean;
  const seen: { method: string; url: string; body: string }[] = [];

  beforeEach(async () => {
    seen.length = 0;
    enabled = true;

    worker = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        seen.push({ method: req.method ?? "", url: req.url ?? "", body });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ from: "worker", url: req.url }));
      });
    });
    wss = new WebSocketServer({ server: worker });
    wss.on("connection", (ws, req) => {
      ws.send(`hello ${req.url}`);
      ws.on("message", (message) => ws.send(`echo ${message}`));
    });
    const workerPort = await listen(worker);

    const routing = (): WorkerRouting => ({
      numWorkers: 1,
      portOf: () => workerPort,
      pick: () => 0,
    });
    const app = express();
    app.use(proxyToWorkers(() => enabled, routing));
    app.use(express.json());
    app.post("/api/echo", (req, res) => {
      res.json({ from: "master", body: req.body });
    });
    app.use(SELF_HOST_API_PREFIX, selfHostApiStub(() => enabled));
    app.get("/{*splat}", (_req, res) => {
      res.send("master shell");
    });
    master = http.createServer(app);
    master.on("upgrade", (req, socket, head) => {
      if (!enabled || !proxyUpgradeToWorker(req, socket, head, routing())) {
        socket.destroy();
      }
    });
    masterHost = `127.0.0.1:${await listen(master)}`;
  });

  afterEach(async () => {
    for (const client of wss.clients) client.terminate();
    wss.close();
    await close(master);
    await close(worker);
  });

  it("forwards /wN requests with the prefix stripped", async () => {
    const res = await fetch(
      `http://${masterHost}/w0/api/game/abcdefgh/exists?x=1`,
    );
    expect(await res.json()).toEqual({
      from: "worker",
      url: "/api/game/abcdefgh/exists?x=1",
    });
  });

  it("forwards game creation with its body intact", async () => {
    const res = await fetch(`http://${masterHost}/api/create_game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameMap: "World" }),
    });
    expect(res.status).toBe(200);
    expect(seen).toEqual([
      {
        method: "POST",
        url: "/api/create_game",
        body: JSON.stringify({ gameMap: "World" }),
      },
    ]);
  });

  it("leaves the master's own routes and bodies alone", async () => {
    expect(await (await fetch(`http://${masterHost}/`)).text()).toBe(
      "master shell",
    );
    const res = await fetch(`http://${masterHost}/api/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(await res.json()).toEqual({ from: "master", body: { a: 1 } });
    expect(seen).toEqual([]);
  });

  it("proxies a WebSocket upgrade to the worker, prefix stripped", async () => {
    const ws = new WebSocket(`ws://${masterHost}/w0/lobbies?platform=web`);
    expect(await nextMessage(ws)).toBe("hello /lobbies?platform=web");
    ws.send("ping");
    expect(await nextMessage(ws)).toBe("echo ping");
    ws.close();
  });

  it("answers 502 when the worker is down", async () => {
    await close(worker);
    const res = await fetch(`http://${masterHost}/w0/api/game/abcdefgh`);
    expect(res.status).toBe(502);
  });

  it("does nothing when the server is not self-hosted", async () => {
    enabled = false;
    expect(
      await (await fetch(`http://${masterHost}/w0/lobbies`)).text(),
    ).toBe("master shell");
    expect(
      await (
        await fetch(`http://${masterHost}${SELF_HOST_API_PREFIX}/news.json`)
      ).text(),
    ).toBe("master shell");
  });

  it("answers the page's API calls itself", async () => {
    const news = await fetch(
      `http://${masterHost}${SELF_HOST_API_PREFIX}/news.json`,
    );
    expect(news.status).toBe(200);
    expect(await news.json()).toEqual([]);

    for (const [method, path] of [
      ["GET", "/users/@me"],
      ["POST", "/auth/refresh"],
      ["GET", "/cosmetics.json?rail=web"],
    ]) {
      const res = await fetch(
        `http://${masterHost}${SELF_HOST_API_PREFIX}${path}`,
        { method },
      );
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(await res.json()).toEqual({ error: "self_hosted" });
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/server/SelfHostMaster.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/shared/SelfHost'`

- [ ] **Step 3: 공유 상수**

`packages/shared/src/SelfHost.ts`:

```ts
/**
 * Where a self-hosted page sends what would have gone to OpenFront's API
 * (src/client/SelfHosted.ts), and where the master answers it
 * (src/server/SelfHostApiStub.ts). Same origin, so nothing leaves for an
 * api.<domain> host that does not exist.
 */
export const SELF_HOST_API_PREFIX = "/selfhost-api";
```

- [ ] **Step 4: 워커 프록시**

`src/server/SelfHostProxy.ts`:

```ts
import type { NextFunction, Request, RequestHandler, Response } from "express";
import http from "http";
import net from "net";
import type { Duplex } from "stream";

/**
 * Stands in for nginx.conf on a self-hosted server, where the tunnel reaches
 * the master's port alone: /w<N>/... goes to worker N with the prefix
 * stripped (nginx's `proxy_pass http://127.0.0.1:$worker_port$2`), the
 * game-creating POSTs go to a worker picked at random (nginx's
 * openfront_workers upstream), and WebSocket upgrades follow the same rule.
 */
export interface WorkerRouting {
  numWorkers: number;
  /** Port worker `index` listens on (ServerEnv.workerPortByIndex). */
  portOf: (index: number) => number;
  /** Worker index for a new game, in [0, numWorkers). */
  pick: () => number;
}

export interface WorkerTarget {
  port: number;
  /** Path and query string to ask the worker for. */
  path: string;
}

// The POSTs nginx spreads across workers (nginx.conf `location =` blocks).
const RANDOM_WORKER_POSTS = new Set([
  "/api/create_game",
  "/api/adminbot/create_game",
  "/api/adminbot/create_pool",
]);

/** Which worker serves a request, or null when the master serves it. */
export function workerTarget(
  method: string,
  url: string,
  routing: WorkerRouting,
): WorkerTarget | null {
  const queryStart = url.indexOf("?");
  const pathname = queryStart === -1 ? url : url.slice(0, queryStart);
  const query = queryStart === -1 ? "" : url.slice(queryStart);

  const prefixed = /^\/w(\d+)(\/.*)?$/.exec(pathname);
  if (prefixed !== null) {
    const index = Number(prefixed[1]);
    if (index >= routing.numWorkers) return null;
    return {
      port: routing.portOf(index),
      path: `${prefixed[2] ?? "/"}${query}`,
    };
  }
  if (method === "POST" && RANDOM_WORKER_POSTS.has(pathname)) {
    return { port: routing.portOf(routing.pick()), path: url };
  }
  return null;
}

/**
 * Express middleware forwarding worker requests. Mount it before any body
 * parser: it streams the untouched request body to the worker.
 */
export function proxyToWorkers(
  enabled: () => boolean,
  routing: () => WorkerRouting,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled()) return next();
    const target = workerTarget(req.method, req.url, routing());
    if (target === null) return next();
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: target.port,
        method: req.method,
        path: target.path,
        headers: req.headers,
      },
      (workerRes) => {
        res.writeHead(workerRes.statusCode ?? 502, workerRes.headers);
        workerRes.pipe(res);
      },
    );
    upstream.on("error", (error) => {
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      res.status(502).json({ error: "worker unavailable" });
    });
    req.pipe(upstream);
  };
}

/**
 * Hands a WebSocket upgrade to its worker over a raw TCP connection, replaying
 * the request head with the worker path. False when the URL names no worker;
 * the caller then refuses the upgrade.
 */
export function proxyUpgradeToWorker(
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
  routing: WorkerRouting,
): boolean {
  const target = workerTarget(req.method ?? "GET", req.url ?? "", routing);
  if (target === null) return false;
  const upstream = net.connect(target.port, "127.0.0.1", () => {
    const lines = [`${req.method} ${target.path} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length > 0) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const closeBoth = () => {
    upstream.destroy();
    socket.destroy();
  };
  upstream.on("error", closeBoth);
  socket.on("error", closeBoth);
  upstream.on("close", () => socket.destroy());
  socket.on("close", () => upstream.destroy());
  return true;
}
```

- [ ] **Step 5: API 스텁**

`src/server/SelfHostApiStub.ts`:

```ts
import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * What a self-hosted page gets for every call it would have made to
 * OpenFront's API (getApiBase() points here, src/client/SelfHosted.ts). The
 * client already treats a missing API as an ordinary outcome -- signed out,
 * an empty store, no leaderboard -- so nearly everything is a plain 404.
 * News answers an empty list, so the client's bundled upstream news (its
 * Discord tournaments and the like) is not shown as this server's own.
 */
export function selfHostApiStub(enabled: () => boolean): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled()) return next();
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET" && req.path === "/news.json") {
      res.json([]);
      return;
    }
    res.status(404).json({ error: "self_hosted" });
  };
}
```

- [ ] **Step 6: Master.ts 연결**

`src/server/Master.ts`:
1. import에 추가:

```ts
import { SELF_HOST_API_PREFIX } from "@openfront/shared/SelfHost";
import { selfHostApiStub } from "./SelfHostApiStub";
import {
  proxyToWorkers,
  proxyUpgradeToWorker,
  type WorkerRouting,
} from "./SelfHostProxy";
```

2. `app.use(express.json());` 바로 앞에 추가:

```ts
// Self-hosted (SELF_HOSTED=true): the tunnel reaches only this port, so the
// master forwards worker traffic itself, in nginx.conf's place (see
// SelfHostProxy.ts). Ahead of express.json(), which would otherwise consume
// the bodies it forwards. Not self-hosted, every request passes through.
const selfHostRouting = (): WorkerRouting => ({
  numWorkers: ServerEnv.numWorkers(),
  portOf: (index) => ServerEnv.workerPortByIndex(index),
  pick: () => Math.floor(Math.random() * ServerEnv.numWorkers()),
});
app.use(proxyToWorkers(() => ServerEnv.selfHosted(), selfHostRouting));

```

3. 다음 블록 뒤에

```ts
app.use("/api", (_req, res, next) => {
  setNoStoreHeaders(res);
  next();
});
```

추가:

```ts

// Self-hosted pages send what would have gone to OpenFront's API here
// (src/client/SelfHosted.ts). Not self-hosted, it passes every request on.
app.use(
  SELF_HOST_API_PREFIX,
  selfHostApiStub(() => ServerEnv.selfHosted()),
);
```

4. `startMaster()` 안의 `const PORT = 3000;` 바로 앞에 추가. 업그레이드 처리는 dotenv가 env를 읽은 뒤인 여기서 붙인다. 자체 호스팅이 아닐 때 마스터의 업그레이드 동작은 그대로다:

```ts
  if (ServerEnv.selfHosted()) {
    log.info(
      "Self-hosted: forwarding worker traffic and answering API calls locally",
    );
    server.on("upgrade", (req, socket, head) => {
      if (!proxyUpgradeToWorker(req, socket, head, selfHostRouting())) {
        socket.destroy();
      }
    });
  }

```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/server/SelfHostMaster.test.ts tests/LayerBoundaries.test.ts --run`
Expected: PASS

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/shared/src/SelfHost.ts src/server/SelfHostProxy.ts src/server/SelfHostApiStub.ts src/server/Master.ts tests/server/SelfHostMaster.test.ts
git add packages/shared/src/SelfHost.ts src/server/SelfHostProxy.ts src/server/SelfHostApiStub.ts src/server/Master.ts tests/server/SelfHostMaster.test.ts
git commit -m "feat(selfhost): master routes worker traffic and stubs the API"
```

---

### Task 8: 페이지 부트스트랩과 제3자 스크립트

**Files:**
- Modify: `index.html` (BOOTSTRAP_CONFIG `selfHosted`, `<html class="self-hosted">`, Turnstile 동적 로드, 제3자 스크립트 삭제)
- Modify: `src/server/RenderHtml.ts`, `vite.config.ts` (EJS 지역 변수 `selfHosted`)
- Modify: `packages/shared/src/configuration/Env.ts` (BOOTSTRAP_CONFIG 타입)
- Create: `src/client/SelfHosted.ts`
- Test: `tests/server/RenderHtmlSelfHosted.test.ts` (새), `tests/client/SelfHosted.test.ts` (새)

**Interfaces:**
- Consumes: `SELF_HOST_API_PREFIX` (Task 7), `ServerEnv.selfHosted()` (Task 5)
- Produces: `window.BOOTSTRAP_CONFIG.selfHosted?: boolean`, `<html>`의 `self-hosted` 클래스. `src/client/SelfHosted.ts`의 `isSelfHosted(): boolean`, `selfHostApiBase(): string`(`${location.origin}/selfhost-api`), `turnstileRequired(): boolean`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/server/RenderHtmlSelfHosted.test.ts`:

```ts
// @vitest-environment jsdom
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAppShellContentCache,
  renderHtmlContent,
} from "../../src/server/RenderHtml";

const REAL_TEMPLATE = path.resolve(__dirname, "../../index.html");

// Runs the page's inline bootstrap script against this test's document, the
// way the browser runs it before any bundle loads.
function runBootstrapScript(html: string): void {
  const match = /<script>\s*(window\.BOOTSTRAP_CONFIG = [\s\S]*?)<\/script>/.exec(
    html,
  );
  if (match === null) throw new Error("rendered page has no bootstrap script");
  new Function(match[1])();
}

describe("index.html as a self-hosted server renders it", () => {
  beforeEach(() => {
    vi.stubEnv("INSTANCE_LETTER", "a");
    vi.stubEnv("NUM_WORKERS", "2");
    vi.stubEnv("DOMAIN", "play.example.com");
    vi.stubEnv("GIT_COMMIT", "abc");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearAppShellContentCache();
    document.documentElement.className = "";
    document.head
      .querySelectorAll("script")
      .forEach((script) => script.remove());
    window.BOOTSTRAP_CONFIG = undefined;
  });

  it("marks the page self-hosted and loads no Turnstile", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    runBootstrapScript(await renderHtmlContent(REAL_TEMPLATE));
    expect(window.BOOTSTRAP_CONFIG?.selfHosted).toBe(true);
    expect(window.BOOTSTRAP_CONFIG?.turnstileSiteKey).toBe("");
    expect(document.documentElement.classList.contains("self-hosted")).toBe(
      true,
    );
    expect(
      document.querySelector('script[src*="challenges.cloudflare.com"]'),
    ).toBeNull();
  });

  it("keeps Turnstile on a server that is not self-hosted", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "key");
    runBootstrapScript(await renderHtmlContent(REAL_TEMPLATE));
    expect(window.BOOTSTRAP_CONFIG?.selfHosted).toBeUndefined();
    expect(document.documentElement.classList.contains("self-hosted")).toBe(
      false,
    );
    expect(
      document.querySelector('script[src*="challenges.cloudflare.com"]'),
    ).not.toBeNull();
  });

  it.each([["true"], [""]])(
    "loads none of OpenFront's ad, analytics or portal tags (SELF_HOSTED=%j)",
    async (selfHosted) => {
      vi.stubEnv("SELF_HOSTED", selfHosted);
      vi.stubEnv("TURNSTILE_SITE_KEY", "key");
      const html = await renderHtmlContent(REAL_TEMPLATE);
      expect(html).not.toMatch(
        /googletagmanager|googletag|cloudflareinsights|intergient|crazygames-sdk|window\.ramp/,
      );
    },
  );
});
```

`tests/client/SelfHosted.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/server/RenderHtmlSelfHosted.test.ts tests/client/SelfHosted.test.ts --run`
Expected: FAIL — `Cannot find module '../../src/client/SelfHosted'`, `selfHosted`가 BOOTSTRAP_CONFIG에 없음, googletagmanager가 있음

- [ ] **Step 3: BOOTSTRAP_CONFIG 타입**

`packages/shared/src/configuration/Env.ts`에서 다음 부분을

```ts
      // The load-balancer apex this deployment sits behind; absent for
      // standalone deployments (beta, branch previews, dev), desktop, and
      // static pages.
      siteHost?: string;
    };
```

다음으로 바꾼다:

```ts
      // The load-balancer apex this deployment sits behind; absent for
      // standalone deployments (beta, branch previews, dev), desktop, and
      // static pages.
      siteHost?: string;
      // True on a self-hosted server (SELF_HOSTED=true), one with no
      // OpenFront API behind it; absent everywhere else. Read through
      // src/client/SelfHosted.ts.
      selfHosted?: boolean;
    };
```

- [ ] **Step 4: 클라이언트 모듈**

`src/client/SelfHosted.ts`:

```ts
import { SELF_HOST_API_PREFIX } from "@openfront/shared/SelfHost";

/**
 * Whether this page was served by a self-hosted server (SELF_HOSTED=true,
 * README "자체 호스팅"): one with no OpenFront API behind it.
 *
 * Read straight from BOOTSTRAP_CONFIG rather than through ClientEnv: many
 * tests replace ClientEnv with a partial mock, and a gate that called a method
 * those mocks lack would throw in the code paths they exercise. A page with
 * no config reads as not self-hosted, which is upstream's behaviour.
 */
export function isSelfHosted(): boolean {
  return (
    typeof window !== "undefined" &&
    window.BOOTSTRAP_CONFIG?.selfHosted === true
  );
}

/**
 * Where a self-hosted page sends what would have gone to the API: its own
 * server's stub (src/server/SelfHostApiStub.ts).
 */
export function selfHostApiBase(): string {
  return `${window.location.origin}${SELF_HOST_API_PREFIX}`;
}

/** Whether this page asks Cloudflare Turnstile for a token before a join. */
export function turnstileRequired(): boolean {
  return !isSelfHosted();
}
```

- [ ] **Step 5: 렌더러에 `selfHosted` 전달**

`src/server/RenderHtml.ts`의 `ejs.render` 지역 변수에서 `gameTitle: GAME_TITLE,` 다음에 추가:

```ts
    // Only when self-hosted: the guarded template line drops out otherwise,
    // leaving every other deployment's page byte-for-byte as it was.
    selfHosted: ServerEnv.selfHosted() ? true : undefined,
```

`vite.config.ts`의 `htmlAssetData`에서 `gameTitle: GAME_TITLE,` 다음에 추가:

```ts
    // Dev preview of a self-hosted page: SELF_HOSTED=true npm run dev.
    selfHosted: env.SELF_HOSTED === "true" ? true : undefined,
```

- [ ] **Step 6: index.html 부트스트랩**

`index.html`:
1. BOOTSTRAP_CONFIG의 긴 줄에서

```
<%- typeof siteHost !== "undefined" && siteHost ? "\n        siteHost: " + siteHost + "," : "" %>
```

를 다음으로 바꾼다(같은 줄 안에서 뒤에 이어 붙임):

```
<%- typeof siteHost !== "undefined" && siteHost ? "\n        siteHost: " + siteHost + "," : "" %><%- typeof selfHosted !== "undefined" && selfHosted ? "\n        selfHosted: true," : "" %>
```

2. 다음 부분을

```js
        document.documentElement.classList.add("desktop-shell");
      }
```

다음으로 바꾼다:

```js
        document.documentElement.classList.add("desktop-shell");
      }
      // A self-hosted server (SELF_HOSTED=true) has no account API:
      // styles.css hides everything marked .no-self-host, and no Turnstile
      // token is ever asked for, so its script is not loaded either.
      if (window.BOOTSTRAP_CONFIG.selfHosted) {
        document.documentElement.classList.add("self-hosted");
      } else {
        const turnstile = document.createElement("script");
        turnstile.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        turnstile.async = true;
        turnstile.defer = true;
        document.head.appendChild(turnstile);
      }
```

3. `</head>` 앞의 다음 블록 전체를(`<!-- CrazyGames SDK -->`부터 두 번째 gtag `</script>`까지)

```html
    <!-- CrazyGames SDK -->
    <script
      src="https://sdk.crazygames.com/crazygames-sdk-v3.js"
      async
    ></script>

    <!-- Cloudflare Turnstile -->
    <script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js"
      async
      defer
    ></script>

    <script data-cfasync="false">
      window.ramp = window.ramp || {};
      window.ramp.que = window.ramp.que || [];
      window.ramp.passiveMode = true;
    </script>

    <script>
      window.googletag = window.googletag || { cmd: [] };
      googletag.cmd.push(function () {
        googletag.pubads().set("page_url", "http://openfront.io ");
      });
    </script>

    <!-- Analytics -->
    <script
      async
      src="https://www.googletagmanager.com/gtag/js?id=AW-16702609763"
    ></script>
    <script>
      window.dataLayer = window.dataLayer || [];

      function gtag() {
        dataLayer.push(arguments);
      }

      gtag("js", new Date());
      gtag("config", "AW-16702609763");
    </script>
    <!-- Google tag (gtag.js) -->
    <script
      async
      src="https://www.googletagmanager.com/gtag/js?id=G-WQGQQ8RDN4"
    ></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("js", new Date());

      gtag("config", "G-WQGQQ8RDN4");
    </script>
```

다음으로 바꾼다:

```html
    <!--
      This fork loads none of upstream's ad, analytics or portal tags: they
      carry OpenFront's own account IDs. Turnstile is loaded by the bootstrap
      script above, and only when the server is not self-hosted.
    -->
```

4. `</body>` 앞의 다음 부분을

```html
    <!-- Analytics -->
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon='{"token": "03d93e6fefb349c28ee69b408fa25a13"}'
    ></script>
    <script type="module" src="/src/client/Main.ts"></script>
    <footer>
      <script
        data-cfasync="false"
        async
        src="//cdn.intergient.com/1025558/75940/ramp.js"
      ></script>
    </footer>
```

다음으로 바꾼다:

```html
    <script type="module" src="/src/client/Main.ts"></script>
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/server/RenderHtmlSelfHosted.test.ts tests/client/SelfHosted.test.ts tests/server/RenderHtml.test.ts tests/client/MainInitialize.test.ts tests/client/HomepagePromos.test.ts tests/TranslationSystem.test.ts --run`
Expected: PASS (`RenderHtml.test.ts`의 "still emits every guarded line" 포함. `SELF_HOSTED`가 없으면 새 줄이 없다)

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
npx prettier --write index.html src/server/RenderHtml.ts vite.config.ts packages/shared/src/configuration/Env.ts src/client/SelfHosted.ts tests/server/RenderHtmlSelfHosted.test.ts tests/client/SelfHosted.test.ts
git add index.html src/server/RenderHtml.ts vite.config.ts packages/shared/src/configuration/Env.ts src/client/SelfHosted.ts tests/server/RenderHtmlSelfHosted.test.ts tests/client/SelfHosted.test.ts
git commit -m "feat(selfhost): self-hosted page bootstrap; drop upstream's ad and analytics tags"
```

---

### Task 9: 클라이언트의 API 호출 돌리기

**Files:**
- Modify: `src/client/ApiBase.ts`
- Modify: `src/client/ClientEnv.ts` (`jwtIssuer`)
- Modify: `src/client/ServerList.ts`
- Modify: `src/client/Auth.ts` (`doRefreshJwt`)
- Modify: `src/client/Main.ts` (Turnstile, 광고)
- Test: `tests/client/SelfHostedClient.test.ts` (새)

**Interfaces:**
- Consumes: `isSelfHosted()`, `selfHostApiBase()`, `turnstileRequired()` (Task 8)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/SelfHostedClient.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiBase } from "../../src/client/ApiBase";
import { getPlayToken, userAuth } from "../../src/client/Auth";
import { ClientEnv } from "../../src/client/ClientEnv";
import {
  backendReachable,
  backendUnreachableConfirmed,
  ensureServerList,
  resetServerList,
  startServerListPolling,
} from "../../src/client/ServerList";

const GUEST_ID = "11111111-1111-4111-8111-111111111111";
// Written by the client, and removed only by clearLocalSession().
const PERSISTENT_ID_KEY = "player_persistent_id";

// The page a game server renders: its own one-entry map and letter.
function boot(selfHosted: boolean) {
  window.BOOTSTRAP_CONFIG = {
    gameEnv: "prod",
    cluster: { a: { host: "play.example.com", numWorkers: 2 } },
    instanceLetter: "a",
    turnstileSiteKey: "",
    jwtAudience: "play.example.com",
    instanceId: "test",
    gitCommit: "abc",
    ...(selfHosted ? { selfHosted: true } : {}),
  };
  ClientEnv.reset();
  resetServerList();
}

afterEach(() => {
  resetServerList();
  window.BOOTSTRAP_CONFIG = undefined;
  ClientEnv.reset();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a self-hosted page's API traffic", () => {
  it("sends API calls to this server's stub", () => {
    boot(true);
    const stub = `${window.location.origin}/selfhost-api`;
    expect(getApiBase()).toBe(stub);
    expect(ClientEnv.jwtIssuer()).toBe(stub);
  });

  it("control: a page that is not self-hosted still uses api.<domain>", () => {
    boot(false);
    expect(getApiBase()).toBe("https://api.play.example.com");
  });

  it("never asks an API for the server list", async () => {
    boot(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    startServerListPolling();
    expect(await ensureServerList()).toBe("fallback");
    expect(await ensureServerList()).toBe("fallback");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(backendReachable()).toBeNull();
    expect(backendUnreachableConfirmed()).toBe(false);
  });

  it("control: a page that is not self-hosted does ask", async () => {
    boot(false);
    const fetchMock = vi.fn(async () => ({
      status: 404,
      ok: false,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await ensureServerList();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "https://api.play.example.com/cluster.json",
    );
  });

  it("keeps the guest's persistent ID without asking any API", async () => {
    boot(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem(PERSISTENT_ID_KEY, GUEST_ID);

    expect(await userAuth()).toBe(false);
    expect(await getPlayToken()).toBe(GUEST_ID);
    expect(await getPlayToken()).toBe(GUEST_ID);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(PERSISTENT_ID_KEY)).toBe(GUEST_ID);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/SelfHostedClient.test.ts --run`
Expected: FAIL — `getApiBase()`가 `https://api.play.example.com`, 서버 목록과 `/auth/refresh`를 fetch함

- [ ] **Step 3: API 주소**

`src/client/ApiBase.ts`:
1. import에 추가: `import { isSelfHosted, selfHostApiBase } from "./SelfHosted";`
2. `getApiBase()`의 첫 줄 `const domainname = getAudience();` 앞에 추가:

```ts
  // A self-hosted page has no API: its calls go to its own server's stub.
  if (isSelfHosted()) return selfHostApiBase();
```

`src/client/ClientEnv.ts`:
1. import에 추가: `import { isSelfHosted, selfHostApiBase } from "./SelfHosted";`
2. `jwtIssuer()`의 첫 줄 `const audience = ClientEnv.jwtAudience();` 앞에 추가:

```ts
    // Same as getApiBase(): a self-hosted page asks its own server's stub.
    if (isSelfHosted()) return selfHostApiBase();
```

- [ ] **Step 4: 서버 목록**

`src/client/ServerList.ts`:
1. import에 추가: `import { isSelfHosted } from "./SelfHosted";`
2. `startServerListPolling()` 안의 다음 부분을

```ts
  try {
    if (safeSite() === undefined) return;
```

다음으로 바꾼다:

```ts
  try {
    // A self-hosted server is the only server there is, and no API lists
    // it: the page's own values answer (apply() -> "fallback"), and with no
    // attempts the reachability gate never closes multiplayer.
    if (isSelfHosted()) return;
    if (safeSite() === undefined) return;
```

3. `fetchOnce()` 안의 다음 부분을

```ts
  if (inflight !== null) return inflight;
  const site = safeSite();
```

다음으로 바꾼다:

```ts
  if (inflight !== null) return inflight;
  // See startServerListPolling: nothing to ask on a self-hosted page.
  if (isSelfHosted()) return Promise.resolve(null);
  const site = safeSite();
```

- [ ] **Step 5: 세션 갱신**

`src/client/Auth.ts`:
1. import에 추가: `import { isSelfHosted } from "./SelfHosted";`
2. `async function doRefreshJwt(): Promise<void> {` 바로 다음에 추가:

```ts
  // A self-hosted server has no accounts: every player is a guest under
  // their persistent ID, so there is no session to refresh. Never reaching
  // /auth/refresh also means no 401 can log the guest out, which would
  // delete that ID between creating a lobby and joining it.
  if (isSelfHosted()) {
    __jwt = null;
    return;
  }
```

- [ ] **Step 6: Main.ts의 Turnstile과 광고**

`src/client/Main.ts`:
1. import에 추가: `import { isSelfHosted, turnstileRequired } from "./SelfHosted";`
2. 미리 받는 Turnstile 토큰:

```ts
    const turnstilePrefetch =
      isDesktopShell() || isReplayShellHost(window.location.hostname)
        ? null
        : getTurnstileToken();
```

→

```ts
    const turnstilePrefetch =
      isDesktopShell() ||
      isReplayShellHost(window.location.hostname) ||
      !turnstileRequired()
        ? null
        : getTurnstileToken();
```

3. 참가할 때의 토큰(`private async getTurnstileToken(`):

```ts
    if (
      ClientEnv.env() === GameEnv.Dev ||
      isDesktopShell() ||
```

→

```ts
    if (
      ClientEnv.env() === GameEnv.Dev ||
      // A self-hosted server verifies no token (ServerEnv.skipsApiChecks).
      !turnstileRequired() ||
      isDesktopShell() ||
```

4. 광고:

```ts
      window.adsEnabled =
        !isAdFree && !gamePortal.isOnGamePortal() && !isDesktopShell();
```

→

```ts
      // A self-hosted page shows no ads: the ad tags belong to OpenFront.
      window.adsEnabled =
        !isSelfHosted() &&
        !isAdFree &&
        !gamePortal.isOnGamePortal() &&
        !isDesktopShell();
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/client/SelfHostedClient.test.ts tests/client/ServerList.test.ts tests/core/ServerList.test.ts tests/client/AuthRefreshFailure.test.ts tests/client/MainInitialize.test.ts tests/client/ClientEnvStatic.test.ts --run`
Expected: PASS

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
npx prettier --write src/client/ApiBase.ts src/client/ClientEnv.ts src/client/ServerList.ts src/client/Auth.ts src/client/Main.ts tests/client/SelfHostedClient.test.ts
git add src/client/ApiBase.ts src/client/ClientEnv.ts src/client/ServerList.ts src/client/Auth.ts src/client/Main.ts tests/client/SelfHostedClient.test.ts
git commit -m "feat(selfhost): client sends API calls to the local stub and skips the server list, sessions, Turnstile and ads"
```

---

### Task 10: API가 필요한 화면 숨기기

**Files:**
- Modify: `src/client/styles.css`
- Modify: `src/client/components/DesktopNavBar.ts`, `src/client/components/MobileNavBar.ts`, `src/client/components/PlayPage.ts`
- Modify: `src/client/UsernameInput.ts`
- Modify: `src/client/GameModeSelector.ts`
- Modify: `src/client/components/SteamWishlist.ts`, `src/client/components/SteamWishlistButton.ts`
- Modify: `src/client/hud/layers/WinModal.ts`
- Modify: `src/client/components/PurchaseNudgeModal.ts`
- Test: `tests/client/SelfHostedUi.test.ts` (새), `tests/client/PurchaseNudgeModal.test.ts`

**Interfaces:**
- Consumes: `isSelfHosted()` (Task 8), `<html class="self-hosted">` (Task 8)
- Produces: CSS 클래스 `no-self-host`(자체 호스팅 페이지에서 `display: none`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/SelfHostedUi.test.ts`:

```ts
import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientEnv } from "../../src/client/ClientEnv";

vi.mock("../../src/client/LobbySocket", () => ({
  PublicLobbySocket: class {
    start(): void {}
    stop(): void {}
  },
}));

vi.mock("../../src/client/UserMeBroadcast", () => ({
  lastUserMeResponse: () => null,
}));

import "../../src/client/components/DesktopNavBar";
import "../../src/client/components/MobileNavBar";
import "../../src/client/components/PlayPage";
import "../../src/client/components/SteamWishlistButton";
// Registers <game-mode-selector> as a side effect.
import "../../src/client/GameModeSelector";

// jsdom has no ResizeObserver, and the mobile top bar shares a subtree with
// <steam-wishlist>, which constructs one on first update.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

type Mountable = HTMLElement & {
  updateComplete: Promise<unknown>;
  requestUpdate(): void;
};

async function mount(tag: string): Promise<Mountable> {
  const el = document.createElement(tag) as Mountable;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function boot(selfHosted: boolean) {
  window.BOOTSTRAP_CONFIG = {
    gameEnv: "dev",
    numWorkers: 1,
    turnstileSiteKey: "",
    jwtAudience: "test",
    instanceId: "test",
    gitCommit: "test",
    ...(selfHosted ? { selfHosted: true } : {}),
  };
  ClientEnv.reset();
}

afterEach(() => {
  document.body.innerHTML = "";
  window.BOOTSTRAP_CONFIG = undefined;
  ClientEnv.reset();
});

describe("what a self-hosted page hides", () => {
  it("styles.css hides .no-self-host under html.self-hosted", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "../../src/client/styles.css"),
      "utf8",
    );
    expect(css).toMatch(
      /html\.self-hosted \.no-self-host\s*\{\s*display:\s*none !important;\s*\}/,
    );
  });

  it.each(["desktop-nav-bar", "mobile-nav-bar"])(
    "%s marks the pages that need the account API",
    async (tag) => {
      boot(true);
      const bar = await mount(tag);
      for (const page of [
        "page-item-store",
        "page-inventory",
        "page-leaderboard",
        "page-clan",
      ]) {
        expect(
          bar.querySelector(`[data-page="${page}"]`)?.closest(".no-self-host"),
          page,
        ).not.toBeNull();
      }
      expect(
        bar.querySelector('[data-page="page-play"]')?.closest(".no-self-host"),
      ).toBeNull();
    },
  );

  it.each(["desktop-nav-bar", "play-page"])(
    "%s marks the account menu",
    async (tag) => {
      boot(true);
      const el = await mount(tag);
      expect(
        el.querySelector("nav-account-menu")?.classList.contains("no-self-host"),
      ).toBe(true);
    },
  );

  it("offers no Ranked button, and keeps Create and Join", async () => {
    boot(true);
    const selector = await mount("game-mode-selector");
    expect(selector.textContent).not.toContain("mode_selector.ranked_title");
    expect(selector.textContent).toContain("main.create");
    expect(selector.textContent).toContain("main.join");
  });

  it("control: a page that is not self-hosted keeps Ranked", async () => {
    boot(false);
    const selector = await mount("game-mode-selector");
    expect(selector.textContent).toContain("mode_selector.ranked_title");
  });

  it("shows no Steam promo", async () => {
    boot(true);
    const promo = await mount("steam-wishlist-button");
    expect(promo.querySelector("a")).toBeNull();
    boot(false);
    promo.requestUpdate();
    await promo.updateComplete;
    expect(promo.querySelector("a")).not.toBeNull();
  });
});
```

`tests/client/PurchaseNudgeModal.test.ts`의 `describe("purchase-nudge-modal", ...)` 안, `it("shows for logged-out players", ...)` 다음에 추가:

```ts
  it("never shows on a self-hosted server, which has no store", async () => {
    window.BOOTSTRAP_CONFIG = { selfHosted: true };
    try {
      fireUserMe(null);
      expect(await shown()).toBe(false);
    } finally {
      window.BOOTSTRAP_CONFIG = undefined;
    }
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/SelfHostedUi.test.ts tests/client/PurchaseNudgeModal.test.ts --run`
Expected: FAIL — CSS 규칙 없음, `no-self-host` 표시 없음, 랭크 버튼과 Steam 홍보가 보임, 구매 권유 창이 뜸

- [ ] **Step 3: CSS 규칙**

`src/client/styles.css`에서 `@custom-variant desktop (&:where(.desktop-shell, .desktop-shell *));` 줄 다음에 추가:

```css

/* A self-hosted server has no account API (src/client/SelfHosted.ts):
   index.html sets html.self-hosted, and whatever needs the API carries
   .no-self-host. */
html.self-hosted .no-self-host {
  display: none !important;
}
```

- [ ] **Step 4: 내비게이션 표시**

`src/client/components/DesktopNavBar.ts`:
1. `<div class="relative no-game-portal">`를 `<div class="relative no-game-portal no-self-host">`로 바꾼다.
2. 인벤토리 버튼

```ts
        <button
          class="nav-menu-item ${currentPage === "page-inventory"
```

→

```ts
        <button
          class="no-self-host nav-menu-item ${currentPage === "page-inventory"
```

3. 리더보드 버튼

```ts
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
          data-page="page-leaderboard"
```

→

```ts
        <button
          class="no-self-host nav-menu-item text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
          data-page="page-leaderboard"
```

4. 클랜 버튼의 `class="no-game-portal nav-menu-item text-white/70 hover:text-blue-500`를 `class="no-game-portal no-self-host nav-menu-item text-white/70 hover:text-blue-500`로 바꾼다.
5. `<nav-account-menu variant="desktop"></nav-account-menu>`를 `<nav-account-menu variant="desktop" class="no-self-host"></nav-account-menu>`로 바꾼다.

`src/client/components/MobileNavBar.ts`:
1. `class="no-game-portal nav-menu-item flex items-center w-full cursor-pointer"`를 `class="no-game-portal no-self-host nav-menu-item flex items-center w-full cursor-pointer"`로 바꾼다.
2. 인벤토리

```ts
        <button
          class="${MOBILE_ITEM} ${currentPage === "page-inventory"
```

→

```ts
        <button
          class="no-self-host ${MOBILE_ITEM} ${currentPage === "page-inventory"
```

3. 리더보드

```ts
        <button
          class="${MOBILE_ITEM}"
          data-page="page-leaderboard"
```

→

```ts
        <button
          class="no-self-host ${MOBILE_ITEM}"
          data-page="page-leaderboard"
```

4. 클랜의 `class="no-game-portal ${MOBILE_ITEM}"`를 `class="no-game-portal no-self-host ${MOBILE_ITEM}"`로 바꾼다.

`src/client/components/PlayPage.ts`에서 `<nav-account-menu variant="mobile"></nav-account-menu>`를 `<nav-account-menu variant="mobile" class="no-self-host"></nav-account-menu>`로 바꾼다.

`src/client/UsernameInput.ts`에서 인증 이름 버튼을 감싸는 `<div class="no-game-portal shrink-0 h-full max-h-[44px]">`를 `<div class="no-game-portal no-self-host shrink-0 h-full max-h-[44px]">`로 바꾼다(인증 이름은 계정이 있어야 한다).

- [ ] **Step 5: 랭크 버튼**

`src/client/GameModeSelector.ts`:
1. import에 추가: `import { isSelfHosted } from "./SelfHosted";`
2. 다음 부분을

```ts
        <div class="grid grid-cols-3 gap-4 h-14 sm:col-span-2 sm:row-start-4">
          ${this.renderSmallActionCard(
            translateText("main.create"),
            this.openHostLobby,
            SECONDARY_ACTION,
            undefined,
            true,
          )}
          ${this.renderSmallActionCard(
            translateText("mode_selector.ranked_title"),
            this.openRankedMenu,
            SECONDARY_ACTION,
            undefined,
            true,
            // Ranked admits trusted accounts only. A trusted viewer gets the
            // green open lock; anyone else meets the red locks and the trust
            // popup inside the ranked modal. Small, so it clears the label on
            // narrow (mobile) buttons.
            this.viewerTrusted
              ? trustLockIcon(true, {
                  tooltipTitle: translateText(
                    "mode_selector.ranked_trust_tooltip_title",
                  ),
                  position: "top-1 right-1",
                  small: true,
                })
              : nothing,
          )}
```

다음으로 바꾼다:

```ts
        <div
          class="grid ${isSelfHosted()
            ? "grid-cols-2"
            : "grid-cols-3"} gap-4 h-14 sm:col-span-2 sm:row-start-4"
        >
          ${this.renderSmallActionCard(
            translateText("main.create"),
            this.openHostLobby,
            SECONDARY_ACTION,
            undefined,
            true,
          )}
          ${isSelfHosted()
            ? // Ranked matchmaking lives in OpenFront's API.
              nothing
            : this.renderSmallActionCard(
                translateText("mode_selector.ranked_title"),
                this.openRankedMenu,
                SECONDARY_ACTION,
                undefined,
                true,
                // Ranked admits trusted accounts only. A trusted viewer gets
                // the green open lock; anyone else meets the red locks and
                // the trust popup inside the ranked modal. Small, so it
                // clears the label on narrow (mobile) buttons.
                this.viewerTrusted
                  ? trustLockIcon(true, {
                      tooltipTitle: translateText(
                        "mode_selector.ranked_trust_tooltip_title",
                      ),
                      position: "top-1 right-1",
                      small: true,
                    })
                  : nothing,
              )}
```

- [ ] **Step 6: Steam 홍보, 승리 화면 홍보, 구매 권유**

`src/client/components/SteamWishlistButton.ts`:
1. import에 추가: `import { isSelfHosted } from "../SelfHosted";`
2. `    if (steamSDK.isOnSteam()) return nothing;`를 다음으로 바꾼다:

```ts
    // Steam sells OpenFront, not this fork: no promo on a self-hosted page.
    if (steamSDK.isOnSteam() || isSelfHosted()) return nothing;
```

`src/client/components/SteamWishlist.ts`도 같은 import를 추가하고, `render()` 첫 줄 `    if (steamSDK.isOnSteam()) return nothing;`를 같은 두 줄로 바꾼다.

`src/client/hud/layers/WinModal.ts`:
1. import에 추가: `import { isSelfHosted } from "../../SelfHosted";`
2. `innerHtml() {` 바로 다음 줄에 추가:

```ts
    // Every promo here is OpenFront's (its Steam page, its Discord, its
    // store), so a self-hosted page shows none of them.
    if (isSelfHosted()) return html``;
```

`src/client/components/PurchaseNudgeModal.ts`:
1. import에 추가: `import { isSelfHosted } from "../SelfHosted";`
2. 조건을

```ts
    if (
      gamePortal.isOnGamePortal() ||
```

다음으로 바꾼다:

```ts
    if (
      // No store on a self-hosted server.
      isSelfHosted() ||
      gamePortal.isOnGamePortal() ||
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/client/SelfHostedUi.test.ts tests/client/PurchaseNudgeModal.test.ts tests/client/NavBars.settings.test.ts tests/client/RankedTrustLock.test.ts tests/GameModeSelectorGating.test.ts tests/GameModeSelectorGatingWiring.test.ts tests/client/components --run`
Expected: PASS

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
npx prettier --write src/client/styles.css src/client/components/DesktopNavBar.ts src/client/components/MobileNavBar.ts src/client/components/PlayPage.ts src/client/UsernameInput.ts src/client/GameModeSelector.ts src/client/components/SteamWishlist.ts src/client/components/SteamWishlistButton.ts src/client/hud/layers/WinModal.ts src/client/components/PurchaseNudgeModal.ts tests/client/SelfHostedUi.test.ts tests/client/PurchaseNudgeModal.test.ts
git add src/client/styles.css src/client/components/DesktopNavBar.ts src/client/components/MobileNavBar.ts src/client/components/PlayPage.ts src/client/UsernameInput.ts src/client/GameModeSelector.ts src/client/components/SteamWishlist.ts src/client/components/SteamWishlistButton.ts src/client/hud/layers/WinModal.ts src/client/components/PurchaseNudgeModal.ts tests/client/SelfHostedUi.test.ts tests/client/PurchaseNudgeModal.test.ts
git commit -m "feat(selfhost): hide account, store, ranked and upstream promo UI"
```

---

### Task 11: 게임 나이트 스크립트

**Files:**
- Create: `scripts/selfhost/game-night.sh`
- Create: `scripts/selfhost/selfhost.env.example`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`
- Test: `tests/SelfHostScript.test.ts` (새)

**Interfaces:**
- Consumes: `SELF_HOSTED`, `GAME_ENV`, `DOMAIN`, `NUM_WORKERS`, `INSTANCE_LETTER`, `GIT_COMMIT` (서버가 읽는 환경 변수), `GET /api/health` (Master)
- Produces: `bash scripts/selfhost/game-night.sh start [--local] [--rebuild] | stop | status | check`. 종료 코드: 성공 0, 설정 오류 1, 사용법 오류 2. env 파일 경로는 `SELFHOST_ENV_FILE` 또는 `<repo>/.env.selfhost`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/SelfHostScript.test.ts`:

```ts
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
    ["GAME_ENV=dev", VALID.replace("GAME_ENV=prod", "GAME_ENV=dev"), /GAME_ENV must be prod/],
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
    ["NUM_WORKERS=two", `${VALID}NUM_WORKERS=two\n`, /NUM_WORKERS must be a positive integer/],
    ["INSTANCE_LETTER=AB", `${VALID}INSTANCE_LETTER=AB\n`, /INSTANCE_LETTER must be one lowercase letter/],
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/SelfHostScript.test.ts --run`
Expected: FAIL — `ENOENT ... selfhost.env.example`, bash가 스크립트를 찾지 못함(status 127)

- [ ] **Step 3: env 템플릿**

`scripts/selfhost/selfhost.env.example`:

```sh
# Settings for scripts/selfhost/game-night.sh (README, "자체 호스팅").
# Copy to .env.selfhost in the repository root (git ignores it) and fill in
# DOMAIN. Then check it: bash scripts/selfhost/game-night.sh check

# Required: run without OpenFront's API, as a production server.
SELF_HOSTED=true
GAME_ENV=prod

# Required: the hostname your friends open, the one routed to the tunnel
# with `cloudflared tunnel route dns`. Example: play.example.com
DOMAIN=

# Required unless you start with --local: the cloudflared tunnel's name.
TUNNEL_NAME=statecraft

# Optional: where the tunnel's ingress config lives.
# CLOUDFLARED_CONFIG=/home/you/.cloudflared/config.yml

# Optional: worker processes, and the letter every game id starts with.
NUM_WORKERS=2
INSTANCE_LETTER=a
```

- [ ] **Step 4: 스크립트**

`scripts/selfhost/game-night.sh`:

```bash
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
  [[ -f "$ENV_FILE" ]] ||
    die "no env file at $ENV_FILE (copy scripts/selfhost/selfhost.env.example)"
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  export NUM_WORKERS="${NUM_WORKERS:-2}"
  export INSTANCE_LETTER="${INSTANCE_LETTER:-a}"
}

check_env() {
  [[ "${SELF_HOSTED:-}" == "true" ]] ||
    die "SELF_HOSTED must be true (without it the server expects OpenFront's API and refuses guests)"
  [[ "${GAME_ENV:-}" == "prod" ]] || die "GAME_ENV must be prod"
  [[ -n "${DOMAIN:-}" ]] ||
    die "DOMAIN is not set (the hostname your friends open, e.g. play.example.com)"
  [[ "${DOMAIN,,}" != *openfront* ]] ||
    die "DOMAIN must be your own domain, not OpenFront's"
  [[ "$NUM_WORKERS" =~ ^[1-9][0-9]*$ ]] ||
    die "NUM_WORKERS must be a positive integer, got '$NUM_WORKERS'"
  [[ "$INSTANCE_LETTER" =~ ^[a-z]$ ]] ||
    die "INSTANCE_LETTER must be one lowercase letter, got '$INSTANCE_LETTER'"
}

tunnel_config() {
  echo "${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"
}

check_tunnel() {
  [[ -n "${TUNNEL_NAME:-}" ]] ||
    die "TUNNEL_NAME is not set (or start with --local)"
  command -v cloudflared >/dev/null ||
    die "cloudflared is not installed (sudo pacman -S cloudflared)"
  [[ -f "$(tunnel_config)" ]] ||
    die "no cloudflared config at $(tunnel_config) (README, 처음 한 번)"
}

is_running() {
  [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2>/dev/null
}

needs_build() {
  [[ -f "$REPO_ROOT/static/index.html" && -f "$BUILD_STAMP" ]] || return 0
  [[ "$(cat "$BUILD_STAMP")" == "$(git -C "$REPO_ROOT" rev-parse HEAD)" ]] ||
    return 0
  [[ -z "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]] ||
    return 0
  return 1
}

build() {
  say "building (npm run build-prod); this takes a few minutes"
  (cd "$REPO_ROOT" && npm run build-prod)
  git -C "$REPO_ROOT" rev-parse HEAD >"$BUILD_STAMP"
}

warn_unpushed() {
  if [[ -z "$(git -C "$REPO_ROOT" branch -r --contains HEAD 2>/dev/null)" ]]; then
    echo "game-night: warning: this commit is not pushed. AGPL section 13: players must be able to get the source that is running (git push)." >&2
  fi
}

wait_healthy() {
  local _
  for _ in $(seq 1 120); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    is_running "$SERVER_PID_FILE" ||
      die "the server exited; see $RUN_DIR/server.log"
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
  command -v curl >/dev/null || die "curl is not installed"
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
    setsid node_modules/.bin/tsx src/server/Server.ts >"$RUN_DIR/server.log" 2>&1 &
    echo $! >"$SERVER_PID_FILE"
  )
  say "server starting (log: $RUN_DIR/server.log)"
  wait_healthy
  say "server up on http://localhost:3000"

  if ! $local_only; then
    setsid cloudflared tunnel --no-autoupdate --config "$(tunnel_config)" \
      run "$TUNNEL_NAME" >"$RUN_DIR/tunnel.log" 2>&1 &
    echo $! >"$TUNNEL_PID_FILE"
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
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
  done
  # Whatever is left of the group (a worker the master re-forked while
  # shutting down) goes too.
  kill -KILL -- "-$pid" 2>/dev/null || true
  rm -f "$pid_file"
  say "stopped $name"
}

status() {
  local health
  if is_running "$SERVER_PID_FILE"; then
    health="$(curl -fsS "$HEALTH_URL" 2>/dev/null || echo "not answering")"
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
```

```bash
chmod +x scripts/selfhost/game-night.sh
bash -n scripts/selfhost/game-night.sh
```

Expected: 출력 없음(문법 오류 없음)

- [ ] **Step 5: npm 스크립트와 .gitignore**

`package.json`에서 다음 줄 뒤에

```json
    "tunnel": "npm run build-prod && npm run start:server",
```

다음 세 줄을 추가한다:

```json
    "selfhost:start": "bash scripts/selfhost/game-night.sh start",
    "selfhost:stop": "bash scripts/selfhost/game-night.sh stop",
    "selfhost:status": "bash scripts/selfhost/game-night.sh status",
```

`.gitignore` 끝에 추가(`.env.selfhost`는 이미 `.env*`로 무시된다):

```
# Game-night PIDs and logs (scripts/selfhost/game-night.sh)
.selfhost/
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/SelfHostScript.test.ts --run && npm run selfhost:status`
Expected: PASS, 그다음 `server: stopped`와 `tunnel: stopped`

- [ ] **Step 7: 커밋**

```bash
npx prettier --write scripts/selfhost/game-night.sh package.json tests/SelfHostScript.test.ts
bash -n scripts/selfhost/game-night.sh
git add scripts/selfhost/game-night.sh scripts/selfhost/selfhost.env.example package.json .gitignore tests/SelfHostScript.test.ts
git commit -m "feat(selfhost): game-night start/stop script with env checks"
```

---

### Task 12: README 고지, 운영 안내, CREDITS

**Files:**
- Modify: `README.md`
- Modify: `CREDITS.md`
- Test: 기존 `tests/ForkAssets.test.ts`, 아래 grep 확인

**Interfaces:**
- Consumes: Task 4의 README 머리(`<h1 align="center">Statecraft</h1>`), Task 11의 명령 이름

- [ ] **Step 1: 수정본 고지 (영어)**

`README.md`에서 `<h1 align="center">Statecraft</h1>` 다음에 빈 줄 하나를 두고 추가한다(원작 소개 문단 `[OpenFront.io](https://openfront.io/) is an online...` 앞). 아래 블록은 바깥 펜스가 백틱 네 개다. 안쪽의 세 개짜리 펜스까지 그대로 넣는다:

````markdown
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

터널 없이 이 PC나 같은 네트워크에서 시험하려면 `bash scripts/selfhost/game-night.sh start --local` 후 `http://localhost:3000`. 빌드를 강제하려면 `--rebuild`.

### 음악

원작의 음악 두 곡과 매칭 알림음은 원작 회사 소유라 뺐다. 음악이 없어도 게임은 정상이다. 넣고 싶으면 CC0(또는 CC BY, CC BY-SA) MP3를 `resources/sounds/music/gameplay.mp3`와 `resources/sounds/music/menu-theme.mp3`로 넣고, `CREDITS.md`의 Music 항목에 파일 이름, 작가, 출처, 라이선스를 적은 뒤 `--rebuild`로 시작한다. 출처가 적혀 있지 않으면 `tests/ForkAssets.test.ts`가 실패한다.

## 원작 동기화 (upstream)

`upstream` 리모트(`https://github.com/openfrontio/OpenFrontIO`)는 이미 등록되어 있다.

```bash
git fetch upstream
git switch main
git merge upstream/main
npm ci --ignore-scripts --engine-strict=false   # package-lock.json이 바뀌었을 때만
npm test && npm run typecheck && npm run lint
git push
```

- 충돌이 자주 나는 곳은 `index.html`, `resources/lang/en.json`, `resources/lang/ko.json`, `src/client/components/Footer.ts`, 내비게이션 바, `src/server/Worker.ts`, `src/server/Master.ts`다. 원작의 변경을 받되 포크의 변경(이름 상수, 자체 호스팅 분기, 고지, 지운 스크립트)은 살린다.
- `tests/ForkAssets.test.ts`가 실패하면 원작이 `proprietary/`에 자산을 다시 넣었거나 코드가 그 경로를 다시 참조한다. 파일은 `git rm`하고, 참조는 이 포크의 자산으로 바꾸거나 없앤다.
- `tests/Branding.test.ts`나 `tests/server/RenderHtmlSelfHosted.test.ts`가 실패하면 원작이 OpenFront 이름이나 제3자 스크립트를 새로 넣은 것이다. 같은 방식으로 고친다.
- 원작이 새 API 호출을 추가해도 클라이언트 쪽은 `getApiBase()`를 거치면 자체 호스팅에서 스텁으로 간다. 서버 쪽 새 `ServerEnv.jwtIssuer()` 호출은 자체 호스팅에서 예외를 던진다. `.selfhost/server.log`에 `self-hosted server has no API`가 보이면 그 호출 앞에 `ServerEnv.selfHosted()` 분기를 넣는다.
- 그다음 기능 브랜치에 main을 합친다. 예: `git switch domestic-system && git merge main`.
````

- [ ] **Step 2: CREDITS.md**

`CREDITS.md`에서 맨 위의 `# Credits` 다음, `## Code` 앞에 추가:

```markdown

## This fork (Statecraft)

Statecraft is a modified version of OpenFront, © OpenFront and Contributors, https://github.com/openfrontio/OpenFrontIO. Its code is used under the AGPL-3.0 with the additional terms in [LICENSE](LICENSE); its assets in `resources/` under CC BY-SA 4.0 (attribution: "OpenFront"). Source code of this fork: https://github.com/0x1eso/front.

- `resources/images/Emblem.svg`: drawn for this fork, CC BY-SA 4.0.
- Upstream's all-rights-reserved assets (`proprietary/`: logos, the OpenFront font, music and the matchmaking chime) are not included.

### Music

None is shipped. A track added to `resources/sounds/music/` must be listed here by file name, with its author, source and license (`tests/ForkAssets.test.ts` checks).
```

- [ ] **Step 3: 확인**

Run: `grep -c "2026-10-15" README.md && grep -c "github.com/0x1eso/front" README.md CREDITS.md && npx vitest tests/ForkAssets.test.ts --run && npx prettier --check README.md CREDITS.md`
Expected: README에서 `1`, 두 파일 각각 1 이상, PASS. prettier가 형식을 지적하면 `npx prettier --write README.md CREDITS.md` 후 다시 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add README.md CREDITS.md
git commit -m "docs(fork): modified-version notice, self-hosting guide, upstream sync and credits"
```

---

### Task 13: 전체 검증과 로컬 실행 확인

**Files:** 없음(문제가 나오면 해당 Task의 파일을 고친다)

- [ ] **Step 1: 전체 테스트, 타입, 린트 (빌드 전에)**

Run: `rm -rf static && npm test 2>&1 | tail -15 && npm run typecheck && npm run lint`
Expected: 모든 테스트 PASS, typecheck와 lint 오류 없음. 원작 테스트가 깨지면 자체 호스팅이 꺼진 경로가 바뀐 것이다(Global Constraints의 세 예외 제외). 해당 Task로 돌아가 고친다.

- [ ] **Step 2: 자체 호스팅으로 로컬 시작**

```bash
cat > /tmp/selfhost-smoke.env <<'EOF'
SELF_HOSTED=true
GAME_ENV=prod
DOMAIN=localhost
NUM_WORKERS=2
INSTANCE_LETTER=a
EOF
SELFHOST_ENV_FILE=/tmp/selfhost-smoke.env bash scripts/selfhost/game-night.sh start --local
```

Expected: 빌드 로그 다음에 `game-night: server up on http://localhost:3000`. 커밋을 아직 푸시하지 않았다면 AGPL 경고 한 줄이 먼저 나온다(정상).

- [ ] **Step 3: HTTP 확인**

```bash
curl -s localhost:3000/ | grep -c "selfHosted: true"
curl -s localhost:3000/ | grep -cE "googletagmanager|cloudflareinsights|intergient|crazygames" || true
curl -s localhost:3000/ | grep -o "<title>[^<]*</title>"
curl -s localhost:3000/selfhost-api/news.json; echo
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/selfhost-api/users/@me
curl -s localhost:3000/w0/api/game/abcdefgh/exists; echo
TOKEN="$(node -e 'console.log(crypto.randomUUID())')"
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}' localhost:3000/api/create_game | head -c 200; echo
grep -c "self-hosted server has no API" .selfhost/server.log || true
```

Expected 순서대로: `1`, `0`, `<title>Statecraft</title>`, `[]`, `404`, `{"exists":false}`, `gameID`가 든 JSON, `0`. Turnstile 주소는 부트스트랩 스크립트 안에 문자열로 남아 있으므로(자체 호스팅이 아닐 때 쓰는 분기) 여기서 세지 않는다. 실제로 로드되지 않는지는 Step 4의 Network 탭에서 본다.

- [ ] **Step 4: 브라우저 확인**

`run-openfront` 스킬의 브라우저 조작 방법으로 `http://localhost:3000`을 연다. Vite 개발 서버가 아니라 이 프로덕션 서버를 쓴다. 다음을 확인한다:
1. 탭 제목 "Statecraft", 파비콘이 엠블럼, 메뉴에 "STATECRAFT"와 "Based on OpenFront" 워드마크.
2. 푸터에 "© OpenFront™ and Contributors", "Based on OpenFront"(원작 저장소 링크), "Source code"(`https://github.com/0x1eso/front`). Reddit, Discord, 이용약관, 개인정보 링크가 없다.
3. 상점, 인벤토리, 리더보드, 클랜, 로그인 메뉴, 랭크 버튼, Steam 홍보가 보이지 않는다. 방 만들기와 참가 버튼은 켜져 있다.
4. 언어를 한국어로 바꾸면 워드마크가 "스테이트크래프트"와 "OpenFront 기반"이 되고 탭 제목도 바뀐다.
5. 혼자 하기로 게임을 시작하면 로딩 화면에 저작권 문구, "Based on OpenFront", 소스 코드 링크가 나오고 게임이 진행된다.
6. 방 만들기 → 링크 복사 → 다른 브라우저 프로필(또는 시크릿 창)에서 링크로 참가 → 방장이 시작 → 두 화면 모두 게임이 진행된다.
7. 개발자 도구 Network 탭에 `api.`, `googletagmanager`, `challenges.cloudflare.com`, `cloudflareinsights`, `intergient`, `crazygames`, `introjava` 요청이 하나도 없다.

결과(스크린샷 포함)를 기록한다. 문제가 있으면 해당 Task로 돌아가 고친 뒤 이 Task를 다시 한다.

- [ ] **Step 5: 종료**

```bash
npm run selfhost:stop
npm run selfhost:status
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/ || true
rm -rf static /tmp/selfhost-smoke.env
```

Expected: `stopped server`, `server: stopped`, `tunnel: stopped`, curl은 `000`(연결 거부)

- [ ] **Step 6: 마무리 커밋 (고친 것이 있을 때만)**

```bash
git status --short
git add -A
git commit -m "fix(fork): issues found in full verification"
```

고친 것이 없으면 이 단계는 건너뛴다. Cloudflare Tunnel을 통한 확인(`https://<DOMAIN>`)은 소유자가 README "처음 한 번"을 마친 뒤 직접 한다.
