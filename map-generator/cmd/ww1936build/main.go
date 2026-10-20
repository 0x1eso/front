// Command ww1936build draws the World War 1936 map sources (spec §4.3):
//
//	assets/maps/world1936/image.png        terrain, read by the map generator
//	scenarios/world1936/regions.png        region and sea-zone ids (R<<8 | G)
//	scenarios/world1936/scenario.src.json  regions, sea zones, countries
//
// from Natural Earth and NASA files fetched by scenarios/world1936/fetch.sh
// and the tables in scenarios/world1936/src (the P1 economy: economy1936.json,
// resources1936.json, industry1936.json; economy.go). Run from map-generator/:
//
//	go run ./cmd/ww1936build
//
// then `go run -tags nodynamic . --maps=world1936` to make the map files.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

func main() {
	cache := flag.String("cache", ".cache/ww1936", "folder with the fetched Natural Earth and NASA files")
	src := flag.String("src", "scenarios/world1936/src", "folder with countries.json, owners1936.json, vp_cities.json, economy1936.json, resources1936.json, industry1936.json")
	outImage := flag.String("out-image", "assets/maps/world1936/image.png", "terrain image")
	outDir := flag.String("out-dir", "scenarios/world1936", "folder for regions.png and scenario.src.json")
	width := flag.Int("width", 4000, "map width in pixels")
	minCore := flag.Int("min-core", 200, "smallest region of a home country, in pixels")
	minLow := flag.Int("min-low", 3000, "smallest region of low-detail land, in pixels")
	maxRegion := flag.Int("max-region", 12000, "largest land region, in pixels")
	minSea := flag.Int("min-sea", 3000, "smallest sea zone, in pixels")
	maxSea := flag.Int("max-sea", 60000, "largest sea zone, in pixels")
	islandReach := flag.Int("island-reach", 40, "a small island joins same-owner land this many pixels away")
	crosscheck := flag.String("crosscheck", "", "a historical-basemaps GeoJSON to compare the owners with (prints a report, writes nothing)")
	bootstrap := flag.Bool("bootstrap-cities", false, "write src/vp_cities.json from Natural Earth populated places and exit")
	debugPNG := flag.String("debug-png", "", "also draw owners and region edges to this PNG")
	flag.Parse()

	start := time.Now()
	step := func(what string) { log.Printf("%-28s %6.1fs", what, time.Since(start).Seconds()) }
	ne := func(name string) []Feature {
		f, err := readFeatures(filepath.Join(*cache, name+".geojson"))
		if err != nil {
			log.Fatal(err)
		}
		return f
	}

	if *bootstrap {
		if err := bootstrapCities(ne("ne_10m_populated_places_simple"), filepath.Join(*src, "vp_cities.json")); err != nil {
			log.Fatal(err)
		}
		return
	}

	t, err := loadTables(*src)
	if err != nil {
		log.Fatal(err)
	}
	ecoRows, err := loadEconomy(filepath.Join(*src, "economy1936.json"), t)
	if err != nil {
		log.Fatal(err)
	}
	sites, err := loadSites(filepath.Join(*src, "resources1936.json"), t)
	if err != nil {
		log.Fatal(err)
	}
	industry, err := loadIndustry(filepath.Join(*src, "industry1936.json"), t)
	if err != nil {
		log.Fatal(err)
	}
	p := NewProjection(*width, -60, 84)
	log.Printf("map %dx%d", p.Width, p.Height)
	prm := Params{MinCore: *minCore, MinLow: *minLow, MaxRegion: *maxRegion, MinSea: *minSea, MaxSea: *maxSea, IslandReach: *islandReach}

	lakes := ne("ne_10m_lakes")
	land := buildLand(p, ne("ne_10m_land"), lakes)
	step("land")
	elev, err := loadGray(filepath.Join(*cache, "gebco_08_rev_elev_21600x10800.png"))
	if err != nil {
		log.Fatal(err)
	}
	if err := writeTerrain(*outImage, p, land, elev); err != nil {
		log.Fatal(err)
	}
	step("terrain")
	admin := ne("ne_10m_admin_1_states_provinces")
	owner, adm, patch, err := assignOwners(p, land, admin, t)
	if err != nil {
		log.Fatal(err)
	}
	step("owners")
	if *crosscheck != "" {
		if err := crossCheck(p, land, owner, t, *crosscheck); err != nil {
			log.Fatal(err)
		}
		return
	}
	landIDs, regions, err := buildRegions(p, land, owner, adm, patch, admin, t, prm)
	if err != nil {
		log.Fatal(err)
	}
	step("regions")
	if *debugPNG != "" {
		if err := writeOwnerPNG(*debugPNG, p, land, owner, landIDs); err != nil {
			log.Fatal(err)
		}
	}
	seaIDs, seas, err := buildSeas(p, land, ne("ne_10m_geography_marine_polys"), lakes, prm)
	if err != nil {
		log.Fatal(err)
	}
	step("sea zones")
	capitals, err := assignVP(p, land, landIDs, regions, t)
	if err != nil {
		log.Fatal(err)
	}
	if err := finishNames(regions, adm, patch, admin, t); err != nil {
		log.Fatal(err)
	}
	eco, ecoSum, err := buildEconomy(p, land, landIDs, regions, capitals, admin, t, EconomyInput{
		Rows: ecoRows, Sites: sites, Places: placesOf(ne("ne_10m_populated_places_simple")), Industry: industry, Adm: adm,
	})
	if err != nil {
		log.Fatal(err)
	}
	step("economy")
	if err := os.MkdirAll(*outDir, 0755); err != nil {
		log.Fatal(err)
	}
	if err := writeRegionsPNG(filepath.Join(*outDir, "regions.png"), p, landIDs, seaIDs); err != nil {
		log.Fatal(err)
	}
	if err := writeScenarioSrc(filepath.Join(*outDir, "scenario.src.json"), p, t, capitals, regions, eco, seas); err != nil {
		log.Fatal(err)
	}
	step("written")
	fmt.Printf("%d land regions, %d sea zones; regions per country:\n", len(regions), len(seas))
	summary(t, regions)
	printEconomy(t, ecoSum)
	if len(regions) < 1000 || len(regions) > 1800 {
		log.Fatalf("land regions %d are outside 1000..1800: change -min-core/-min-low/-max-region", len(regions))
	}
	if len(seas) < 120 || len(seas) > 300 {
		log.Fatalf("sea zones %d are outside 120..300: change -max-sea", len(seas))
	}
}
