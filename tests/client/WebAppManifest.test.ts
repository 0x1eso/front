import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(__dirname, "..", "..");

describe("home-screen web app", () => {
  it("launches standalone in landscape", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, "resources", "manifest.json"), "utf8"),
    );
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("landscape");
  });

  it("asks iOS and Android to run it without browser chrome", () => {
    const doc = new DOMParser().parseFromString(
      fs.readFileSync(path.join(ROOT, "index.html"), "utf8"),
      "text/html",
    );
    const meta = (name: string) =>
      doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content");
    expect(meta("apple-mobile-web-app-capable")).toBe("yes");
    expect(meta("mobile-web-app-capable")).toBe("yes");
    expect(meta("apple-mobile-web-app-status-bar-style")).toBe(
      "black-translucent",
    );
    expect(doc.querySelector('link[rel="manifest"]')).not.toBeNull();
  });
});
