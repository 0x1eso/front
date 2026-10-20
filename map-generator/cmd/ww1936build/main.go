// Command ww1936build draws the World War 1936 map sources (spec §4.3):
//
//	assets/maps/world1936/image.png        terrain, read by the map generator
//	scenarios/world1936/regions.png        region and sea-zone ids (R<<8 | G)
//	scenarios/world1936/scenario.src.json  regions, sea zones, countries, and
//	                                       the land and sea graphs (version 3)
//
// from Natural Earth and NASA files fetched by scenarios/world1936/fetch.sh
// and the tables in scenarios/world1936/src (the P1 economy: economy1936.json,
// resources1936.json, industry1936.json; economy.go; the P2 land graph:
// rail1936.json, forts1936.json, terrain1936.json, land.go; the P4 map
// fixes folded into P2:
// islands1936.json, seasplit1936.json, straits1936.json, islands.go,
// seasplit.go, seaedges.go; the P4 version 4 fields: seaRegions1936.json,
// landRegions1936.json, navalBases1936.json, coastalForts1936.json,
// strategic.go, bases.go, rows.go). Region ids are stable: the committed
// scenario.json numbers the regions it holds (land.go stableIDs). Run from
// map-generator/:
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
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

func main() {
	cache := flag.String("cache", ".cache/ww1936", "folder with the fetched Natural Earth and NASA files")
	src := flag.String("src", "scenarios/world1936/src", "folder with countries.json, owners1936.json, vp_cities.json, economy1936.json, resources1936.json, industry1936.json, islands1936.json, seasplit1936.json, straits1936.json, rail1936.json, forts1936.json, terrain1936.json, seaRegions1936.json, landRegions1936.json, navalBases1936.json, coastalForts1936.json")
	idTable := flag.String("ids", "../resources/maps/world1936/scenario.json", "the committed scenario.json whose region ids stay")
	outImage := flag.String("out-image", "assets/maps/world1936/image.png", "terrain image")
	outDir := flag.String("out-dir", "scenarios/world1936", "folder for regions.png and scenario.src.json")
	width := flag.Int("width", 4000, "map width in pixels")
	minCore := flag.Int("min-core", 200, "smallest region of a home country, in pixels")
	minLow := flag.Int("min-low", 3000, "smallest region of low-detail land, in pixels")
	maxRegion := flag.Int("max-region", 12000, "largest land region, in pixels")
	minSea := flag.Int("min-sea", 3000, "smallest sea zone, in pixels")
	maxSea := flag.Int("max-sea", 60000, "largest sea zone, in pixels")
	islandReach := flag.Int("island-reach", 40, "a small island joins same-owner land this many pixels away")
	srRegions := flag.Int("sr-regions", srMaxRegions, "most regions in a land strategic region's share while seeds are added")
	srTiles := flag.Int("sr-tiles", srMaxTiles, "most land tiles in a land strategic region's share while seeds are added")
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
	must := func(err error) {
		if err != nil {
			log.Fatal(err)
		}
	}

	if *bootstrap {
		must(bootstrapCities(ne("ne_10m_populated_places_simple"), filepath.Join(*src, "vp_cities.json")))
		return
	}

	t, err := loadTables(*src)
	must(err)
	ecoRows, err := loadEconomy(filepath.Join(*src, "economy1936.json"), t)
	must(err)
	sites, err := loadSites(filepath.Join(*src, "resources1936.json"), t)
	must(err)
	industry, err := loadIndustry(filepath.Join(*src, "industry1936.json"), t)
	must(err)
	islandRows, err := loadIslands(filepath.Join(*src, "islands1936.json"), t)
	must(err)
	seaSplit, err := loadSeaSplit(filepath.Join(*src, "seasplit1936.json"))
	must(err)
	straits, err := loadStraits(filepath.Join(*src, "straits1936.json"))
	must(err)
	railPath, fortPath := filepath.Join(*src, "rail1936.json"), filepath.Join(*src, "forts1936.json")
	var railTbl, fortTbl RegionLevels
	must(decodeStrict(railPath, &railTbl))
	must(decodeStrict(fortPath, &fortTbl))
	terrPath := filepath.Join(*src, "terrain1936.json")
	var terrTbl TerrainTable
	must(decodeStrict(terrPath, &terrTbl))
	seaRegions, err := loadSeaRegions(filepath.Join(*src, "seaRegions1936.json"))
	must(err)
	seeds, err := loadLandSeeds(filepath.Join(*src, "landRegions1936.json"))
	must(err)
	baseTbl, err := loadBases(filepath.Join(*src, "navalBases1936.json"), filepath.Join(*src, "coastalForts1936.json"))
	must(err)
	table, err := loadIDTable(*idTable)
	must(err)
	p := NewProjection(*width, -60, 84)
	w, n := p.Width, p.Width*p.Height
	log.Printf("map %dx%d", p.Width, p.Height)
	prm := Params{MinCore: *minCore, MinLow: *minLow, MaxRegion: *maxRegion, MinSea: *minSea, MaxSea: *maxSea, IslandReach: *islandReach}

	lakes := ne("ne_10m_lakes")
	landFeats := ne("ne_10m_land")
	land0 := buildLand(p, landFeats, lakes)
	// The owners, regions and sea zones are drawn on the land before the
	// islands are stamped, as version 2 drew them, so their numbering and
	// shapes stay; the islands are carved out of the regions afterwards
	// and the stamped pixels leave the sea zones.
	land := append([]bool(nil), land0...)
	places, stamped, err := placeIslands(p, land, landFeats, islandRows)
	must(err)
	step("land")
	elev, err := loadGray(filepath.Join(*cache, "gebco_08_rev_elev_21600x10800.png"))
	must(err)
	mag, err := writeTerrain(*outImage, p, land, elev, stamped)
	must(err)
	step("terrain")
	admin := ne("ne_10m_admin_1_states_provinces")
	owner, adm, patch, err := assignOwners(p, land0, admin, t)
	must(err)
	// A stamped pixel takes the owner and admin-1 unit of the nearest land,
	// as the owners drawn on the stamped land give it.
	stampOwner, stampAdm, _, err := assignOwners(p, land, admin, t)
	must(err)
	for i, s := range stamped {
		if s {
			owner[i], adm[i] = stampOwner[i], stampAdm[i]
		}
	}
	step("owners")
	if *crosscheck != "" {
		must(crossCheck(p, land0, owner, t, *crosscheck))
		return
	}
	landIDs, regions, err := buildRegions(p, land0, owner, adm, patch, admin, t, prm)
	must(err)
	regions, donors := carveIslands(regions, landIDs, adm, owner, islandRows, places, t)
	islandOrder := map[string]int{}
	for k, r := range islandRows {
		islandOrder[r.Key] = k
	}
	step("regions")
	if *debugPNG != "" {
		must(writeOwnerPNG(*debugPNG, p, land, owner, landIDs))
	}
	seaIDs, seas, err := buildSeas(p, land0, ne("ne_10m_geography_marine_polys"), lakes, prm)
	must(err)
	for i, s := range stamped {
		if s {
			seaIDs[i] = 0
		}
	}
	seas, cut, moves, err := applySeaSplit(p, seaIDs, seas, seaSplit)
	must(err)
	step("sea zones")
	capitals, err := assignVP(p, land, landIDs, regions, t)
	must(err)
	must(finishNames(regions, adm, patch, admin, t))
	keep := keepPoints(places)
	eco, ecoSum, err := buildEconomy(p, land, landIDs, regions, capitals, admin, t, EconomyInput{
		Rows: ecoRows, Sites: sites, Places: placesOf(ne("ne_10m_populated_places_simple")), Industry: industry, Adm: adm, Keep: keep,
	})
	must(err)
	step("economy")

	// Stable ids, then the map the generator will make.
	tags := make([]string, len(t.Countries))
	for i, c := range t.Countries {
		tags[i] = c.Tag
	}
	regionTags := make([]string, len(regions))
	dropped := make([]bool, len(regions))
	for i, r := range regions {
		regionTags[i] = tags[r.Owner-1]
		dropped[i] = eco[i].Dropped
	}
	newIDs, fresh, err := stableIDs(regions, regionTags, dropped, table, islandOrder)
	must(err)
	idOf := make([]uint16, len(regions)+1)
	for i, r := range regions {
		idOf[r.ID] = uint16(newIDs[i])
	}
	for i, id := range landIDs {
		if id != 0 {
			landIDs[i] = idOf[id]
		}
	}
	ecoByID := map[int]*EcoRegion{}
	for i, r := range regions {
		r.ID = newIDs[i]
		ecoByID[r.ID] = eco[i]
	}
	renumberSummary(&ecoSum, idOf)
	_, water := generatorLand(land, w, n, keep...)
	finalLand := make([]bool, n)
	raw := make([]uint16, n)
	for i := 0; i < n; i++ {
		finalLand[i] = !water[i]
		raw[i] = landIDs[i]
		if raw[i] == 0 {
			raw[i] = seaIDs[i]
		}
	}
	ownerOf := map[uint16]string{}
	islandSet := map[uint16]bool{}
	for _, r := range regions {
		ownerOf[uint16(r.ID)] = tags[r.Owner-1]
		if r.Island != "" {
			islandSet[uint16(r.ID)] = true
		}
	}
	final, err := finalMap(raw, finalLand, w, p.Height, ownerOf, islandSet)
	must(err)
	lists := buildTileLists(final)
	byName := map[string]int{}
	for _, r := range regions {
		if len(lists.of(r.ID)) > 0 {
			byName[tags[r.Owner-1]+":"+r.Name] = r.ID
		}
	}
	for _, r := range regions {
		if r.Island != "" && len(lists.of(r.ID)) == 0 {
			log.Fatalf("island %s (%s) does not survive the generator", r.Island, r.Name)
		}
	}
	step("final map")
	modis, mw, mh, err := loadModis(filepath.Join(*cache, "modis_igbp_2024_3600x1800.png"), filepath.Join(*cache, "modis_igbp_colormap.xml"))
	must(err)
	rivers, err := readRivers(filepath.Join(*cache, "ne_10m_rivers_lake_centerlines.geojson"))
	must(err)
	lg, err := buildLandGraph(p, final, lists, LandInput{
		Regions: regions, Eco: ecoByID, Tags: tags, Mag: mag, Modis: modis, ModisW: mw, ModisH: mh,
		Rivers: rivers, Straits: straits.Land, Rail: railTbl, Forts: fortTbl, Terrain: terrTbl, ByName: byName,
		RailPath: railPath, FortPath: fortPath, TerrPath: terrPath,
	})
	must(err)
	sg, err := buildSeaGraph(p, final, lists, seas, straits, byName)
	must(err)
	step("graphs")
	sr, err := buildStrategic(p, final, lists, StrategicInput{
		Regions: regions, Tags: tags, Seas: seas, Land: lg, Sea: sg, SeaRows: seaRegions, Seeds: seeds,
		MaxRegions: *srRegions, MaxTiles: *srTiles,
	})
	must(err)
	survivorOwner := map[int]string{}
	for _, r := range regions {
		if len(lists.of(r.ID)) > 0 {
			survivorOwner[r.ID] = tags[r.Owner-1]
		}
	}
	bases, err := resolveBases(p, final, sr.Harbor, baseTbl, islandRows, regions, survivorOwner)
	must(err)
	rows := buildRows(p)
	step("strategic regions")

	sort.Slice(regions, func(a, b int) bool { return regions[a].ID < regions[b].ID })
	must(os.MkdirAll(*outDir, 0755))
	must(writeRegionsPNG(filepath.Join(*outDir, "regions.png"), p, landIDs, seaIDs))
	must(writeScenarioSrc(filepath.Join(*outDir, "scenario.src.json"), ScenarioSrcInput{
		P: p, T: t, Rows: ecoRows, Capitals: capitals, Regions: regions, Eco: ecoByID, Seas: seas,
		Land: lg, Sea: sg, Islands: islandRows, Places: places, SR: sr, Bases: bases, RowTable: rows,
	}))
	step("written")

	fmt.Printf("%d land regions, %d sea zones; regions per country:\n", len(regions), len(seas))
	summary(t, regions)
	printEconomy(t, ecoSum)
	printGraphs(t, regions, ecoByID, lists, lg, sg, seas, cut, islandRows, places, fresh, final)
	fmt.Println("regions that gave land to an island (survivors: their VP tile may move):")
	for _, r := range islandRows {
		var list []string
		for _, d := range donors[r.Key] {
			name := t.Countries[d.Owner-1].Tag + ":" + d.Name
			switch {
			case len(d.Pixels) == 0:
				list = append(list, name+" (left empty, gone)")
			case len(lists.of(d.ID)) > 0:
				list = append(list, fmt.Sprintf("%d %s (survives)", d.ID, name))
			default:
				list = append(list, name+" (the generator drops it)")
			}
		}
		if len(list) > 0 {
			fmt.Printf("  %s: %s\n", r.Key, strings.Join(list, ", "))
		}
	}
	fmt.Printf("sea pieces moved by the split: %d\n", len(moves))
	for _, m := range moves {
		fmt.Println("  " + m)
	}
	printV4(sr, bases, ecoSum, t, *srRegions, *srTiles)
	if sr.LandN < srMinCount || sr.LandN > srMaxCount {
		log.Fatalf("land strategic regions %d are outside %d..%d: change -sr-regions/-sr-tiles (and srMaxRegions/srMaxTiles)", sr.LandN, srMinCount, srMaxCount)
	}
	if len(regions) < 1000 || len(regions) > 1800 {
		log.Fatalf("land regions %d are outside 1000..1800: change -min-core/-min-low/-max-region", len(regions))
	}
	if len(seas) < 120 || len(seas) > 300 {
		log.Fatalf("sea zones %d are outside 120..300: change -max-sea", len(seas))
	}
}

// summaryID is a region id in an economy summary line (economy.go writes
// them before the ids are made stable).
var summaryID = regexp.MustCompile(`(→ |^[A-Z]{3} )(\d+)( ")`)

// renumberSummary turns the tool's region ids in the summary's lines into
// the stable ones.
func renumberSummary(sum *EconomySummary, idOf []uint16) {
	fix := func(lines []string) {
		for k, line := range lines {
			lines[k] = summaryID.ReplaceAllStringFunc(line, func(m string) string {
				parts := summaryID.FindStringSubmatch(m)
				id, err := strconv.Atoi(parts[2])
				if err != nil || id >= len(idOf) {
					return m
				}
				return parts[1] + strconv.Itoa(int(idOf[id])) + parts[3]
			})
		}
	}
	fix(sum.Points)
	fix(sum.ForeignCore)
}

// printGraphs prints what P2 plan Task 2 asks the tool to report.
func printGraphs(t *Tables, regions []*Region, eco map[int]*EcoRegion, lists tileLists, lg LandGraph, sg SeaGraph, seas []*Region, cut map[int]int, islands []IslandRow, places []IslandPlace, fresh []int, final []uint16) {
	name := map[int]string{}
	for _, r := range regions {
		name[r.ID] = t.Countries[r.Owner-1].Tag + ":" + r.Name
	}
	for _, z := range seas {
		name[z.ID] = z.Name
	}
	land := 0
	for _, id := range final {
		if id != 0 && id < seaZoneBase {
			land++
		}
	}
	survivors := 0
	for _, r := range regions {
		if len(lists.of(r.ID)) > 0 {
			survivors++
		}
	}
	fmt.Printf("final map: %d land tiles, %d land regions, %d sea zones\n", land, survivors, len(seas))
	fmt.Printf("land edges: %d (%d across straits), big-river edges: %d\n", len(lg.Edges), len(lg.Straits), lg.BigRivers)
	var rivers []string
	for _, k := range []string{"Rhine", "Vistula", "Danube", "Volga", "Dnieper", "Don", "Yangtze", "Huang He"} {
		rivers = append(rivers, fmt.Sprintf("%s %d", k, lg.Rivers[k]))
	}
	fmt.Println("river edges by river: " + strings.Join(rivers, ", "))
	fmt.Printf("straits (at most %d water tiles):\n", straitWater)
	for _, e := range lg.Straits {
		fmt.Printf("  %d %s – %d %s, %d km\n", e.A, name[e.A], e.B, name[e.B], e.Km)
	}
	var ter []string
	for _, k := range []string{terPlains, terForest, terHills, terMountain, terMarsh, terJungle, terDesert, terUrban} {
		ter = append(ter, fmt.Sprintf("%s %d", k, lg.Terrain[k]))
	}
	fmt.Println("regions by terrain: " + strings.Join(ter, ", "))
	for _, h := range lg.HandLand {
		fmt.Println("  hand terrain " + h)
	}
	small := 0
	for _, e := range lg.Edges {
		if e.River == 1 {
			small++
		}
	}
	fmt.Printf("river edges: %d big, %d small, %d of %d land edges\n", lg.BigRivers, small, lg.BigRivers+small, len(lg.Edges))
	fmt.Printf("sea zones: %d, sea edges: %d\n", len(seas), len(sg.Edges))
	for _, z := range seas {
		if c, ok := cut[z.ID]; ok {
			fmt.Printf("  new zone %d %s: %d tiles cut, %d on the final map\n", z.ID, z.Name, c, len(lists.of(z.ID)))
		}
	}
	for _, s := range sg.Hand {
		fmt.Println("  hand edge " + s)
	}
	for _, e := range sg.DateLine {
		fmt.Printf("  date line %d %s – %d %s, %d km\n", e.A, name[e.A], e.B, name[e.B], e.Km)
	}
	has := map[int]bool{}
	for _, e := range sg.Edges {
		has[e.A], has[e.B] = true, true
	}
	for _, z := range seas {
		if !z.Lake && !has[z.ID] {
			fmt.Printf("  zone %d %s has no sea edge\n", z.ID, z.Name)
		}
	}
	fmt.Printf("islands: %d\n", len(islands))
	for k, r := range islands {
		id := 0
		for _, rg := range regions {
			if rg.Island == r.Key {
				id = rg.ID
			}
		}
		how := "kept"
		if places[k].Stamped {
			how = "stamped"
		}
		fmt.Printf("  %d %s (%s) %s, %d pixels, %d final tiles, vp %d\n", id, r.Key, r.Owner, how, len(places[k].Pixels), len(lists.of(id)), eco[id].R.VP)
	}
	for _, id := range fresh {
		fmt.Printf("new region %d %s, %d final tiles\n", id, name[id], len(lists.of(id)))
	}
}

// printV4 prints what P4 plan Task 2 asks the tool to report: the land
// strategic regions and their thresholds, the sea strategic regions, the
// naval bases by level and the dockyards per country.
func printV4(sr StrategicResult, hb HandBases, eco EconomySummary, t *Tables, maxRegions, maxTiles int) {
	sea := 0
	for _, s := range sr.List {
		if s.Kind == "sea" {
			sea++
		}
	}
	fmt.Printf("land strategic regions: %d (shares of at most %d regions or %d tiles, small islands within %d km), sea strategic regions: %d\n", sr.LandN, maxRegions, maxTiles, srIslandKm, sea)
	for _, line := range sr.Report {
		fmt.Println("  " + line)
	}
	for _, s := range sr.List {
		if s.Kind == "land" {
			fmt.Printf("  %d %s / %s: %d regions, centre %v\n", s.ID, s.Name, s.NameKo, len(s.Members), s.Center)
		}
	}
	fmt.Printf("small islands joined: %d\n", len(sr.Merged))
	for _, m := range sr.Merged {
		fmt.Println("  " + m)
	}
	var levels []string
	for lv := 10; lv >= 1; lv-- {
		if n := hb.ByLevel[lv]; n > 0 {
			levels = append(levels, fmt.Sprintf("%d: %d", lv, n))
		}
	}
	fmt.Println("hand naval bases by level (the generator adds the ports' formula): " + strings.Join(levels, ", "))
	for _, line := range hb.Report {
		fmt.Println("  " + line)
	}
	var docks []string
	for c, ct := range t.Countries {
		if eco.Dock[c] > 0 {
			docks = append(docks, fmt.Sprintf("%s %d", ct.Tag, eco.Dock[c]))
		}
	}
	fmt.Println("dockyards per country: " + strings.Join(docks, ", "))
}
