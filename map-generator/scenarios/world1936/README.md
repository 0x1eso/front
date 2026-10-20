# World War 1936 map sources

See docs/superpowers/specs/2026-10-19-world-war-1936-design.md §4. From map-generator/:

1. `bash scenarios/world1936/fetch.sh` — Natural Earth and NASA files into `.cache/ww1936` (not committed).
2. `go run ./cmd/ww1936build -bootstrap-cities` — only when the city lists in `cmd/ww1936build/cities.go` change; writes `src/vp_cities.json`.
3. `go run ./cmd/ww1936build` — writes `assets/maps/world1936/image.png`, `regions.png` and `scenario.src.json` here. `-debug-png .cache/ww1936/owners.png` also draws the owners for checking by eye.
4. `go run -tags nodynamic . --maps=world1936` — the map files in `resources/maps/world1936`.

The committed files were made on linux/amd64 with Go 1.27.2. Steps 2–4 are deterministic there: running them again gives the same bytes. Other architectures can round floating point differently (fused multiply-add on arm64, for example) and move a pixel here and there, so regenerate on linux/amd64 with that Go version, run Prettier on `scenario.src.json` and `src/vp_cities.json` (the generator formats its own JSON), and byte-compare: `git status` must show no change.

`src/owners1936.json` gives every modern country (Natural Earth `adm0_a3`) its 1936 owner, overrides admin-1 units (`"ADM0:name"`), and patches the borders that cut through modern units with hand-drawn polygons (each patch limited to the listed modern countries or units). `src/region_names.json` renames a generated region (`"TAG:name": [name, nameKo]`).

Cross-check (optional): with aourednik/historical-basemaps' `world_1938.geojson` (GPL-3.0) in `.cache/ww1936`, `go run ./cmd/ww1936build -crosscheck .cache/ww1936/world_1938.geojson` prints how much of each country lies in its best match. It writes no file; nothing derived from that data is committed.
