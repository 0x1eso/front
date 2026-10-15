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

  // OpenFront's own marks outside proprietary/: served from resources/ even
  // when nothing references them.
  test("upstream's event artwork is not shipped", () => {
    for (const asset of ["images/OfmWintersLogo.png"]) {
      expect(fs.existsSync(path.join(ROOT, "resources", asset)), asset).toBe(
        false,
      );
    }
  });

  // OpenFront's ad-recovery tag (Admiral) carries its property key and loads
  // a third-party script with full page access. This fork shows no ads.
  test("no page loads OpenFront's ad-recovery tag", () => {
    const offenders = shippedSources().filter((file) =>
      /\/Admiral["']|loadAdmiral|window\.admiral|introjava\.com/.test(
        fs.readFileSync(path.join(ROOT, file), "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  // CC BY-SA 4.0: what this fork drew or changed is credited as its own.
  test("every asset this fork drew or modified is credited", () => {
    const credits = fs.readFileSync(path.join(ROOT, "CREDITS.md"), "utf8");
    for (const asset of [
      "resources/images/Emblem.svg",
      "resources/images/AdminOfficeIconWhite.svg",
      "resources/images/ResearchInstituteIconWhite.svg",
      "resources/atlases/src/admin-office.svg",
      "resources/atlases/src/research-institute.svg",
      "resources/atlases/icon-atlas.png",
    ]) {
      expect(fs.existsSync(path.join(ROOT, asset)), asset).toBe(true);
      expect(credits, asset).toContain(asset);
    }
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
