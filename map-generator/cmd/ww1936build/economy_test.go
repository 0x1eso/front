package main

import (
	"bytes"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func intp(v int) *int { return &v }

func TestApportionLargestRemainder(t *testing.T) {
	if got := apportion(10, []int64{1, 1, 1}); !reflect.DeepEqual(got, []int{4, 3, 3}) {
		t.Fatalf("apportion(10, 1:1:1) = %v, want [4 3 3]", got)
	}
	// The largest remainders take the rest: 7 × 1/6 = 1.17, 7 × 2/6 = 2.33,
	// 7 × 3/6 = 3.5 → 1, 2, 3 and the one left goes to the 0.5.
	if got := apportion(7, []int64{1, 2, 3}); !reflect.DeepEqual(got, []int{1, 2, 4}) {
		t.Fatalf("apportion(7, 1:2:3) = %v", got)
	}
	if got := apportion(5, []int64{0, 0}); !reflect.DeepEqual(got, []int{5, 0}) {
		t.Fatalf("all weights 0: %v, want everything at index 0", got)
	}
	if got := apportion(0, []int64{3, 4}); !reflect.DeepEqual(got, []int{0, 0}) {
		t.Fatalf("nothing to split: %v", got)
	}
}

func TestCategoryRows(t *testing.T) {
	cases := []struct {
		pop, tier int
		capital   bool
		want      string
	}{
		{9000, 20, false, "megalopolis"},
		{7000, 20, false, "metropolis"},
		{6000, 0, false, "metropolis"},
		{100, 10, false, "large_city"},
		{100, 0, true, "city"},
		{100, 5, false, "city"},
		{2500, 3, false, "city"},
		{1500, 3, false, "large_town"},
		{700, 0, false, "town"},
		{200, 0, false, "rural"},
		{30, 0, false, "pastoral"},
		{10, 0, false, "wasteland"},
	}
	for _, c := range cases {
		if got := category(c.pop, c.tier, c.capital); got != c.want {
			t.Fatalf("category(%d, %d, %v) = %s, want %s", c.pop, c.tier, c.capital, got, c.want)
		}
	}
}

func TestInfraOf(t *testing.T) {
	cases := []struct {
		base, tiers, tiles int
		core, waste        bool
		want               int
	}{
		{4, 0, 100, true, false, 4},   // as given
		{4, 10, 100, true, false, 5},  // a 10 city adds one
		{4, 9, 100, true, false, 4},   // tiers under 10 add nothing
		{5, 23, 100, true, false, 5},  // clamped at 5
		{3, 0, 7000, true, false, 2},  // large: one less
		{4, 0, 6000, true, false, 4},  // 6000 is not over 6000
		{2, 10, 9000, true, false, 2}, // +1 −1
		{1, 0, 9000, true, false, 1},  // clamped at 1
		{3, 0, 100, false, false, 1},  // a colony: base − 2
		{5, 20, 100, false, false, 3}, // no city bonus for a colony
		{5, 20, 100, true, true, 1},   // wasteland
	}
	for _, c := range cases {
		if got := infraOf(c.base, c.tiers, c.tiles, c.core, c.waste); got != c.want {
			t.Fatalf("infraOf(%+v) = %d, want %d", c, got, c.want)
		}
	}
}

func TestFactoryCountsFormula(t *testing.T) {
	// Poland: 34,000 × 0.22 = 7.48 → 7 civ, (7+2)/4 = 2 mil, (7+5)/10 = 1 dock.
	pol := EconomyRow{Tag: "POL", PopCore: 34000, Dev: 3}
	if c, m, d := factoryCounts(pol, true); c != 7 || m != 2 || d != 1 {
		t.Fatalf("POL %d/%d/%d, want 7/2/1", c, m, d)
	}
	// A country with inland regions only gets no dockyard.
	if _, _, d := factoryCounts(pol, false); d != 0 {
		t.Fatalf("an inland country got %d dockyards", d)
	}
	// One million people and more get at least one civ.
	if c, _, _ := factoryCounts(EconomyRow{PopCore: 1000, Dev: 1}, false); c != 1 {
		t.Fatalf("1,000 thousand at dev 1: civ %d, want 1", c)
	}
	if c, _, _ := factoryCounts(EconomyRow{PopCore: 999, Dev: 1}, false); c != 0 {
		t.Fatalf("999 thousand at dev 1: civ %d, want 0", c)
	}
	// The table's values win (Czechoslovakia's Škoda mil 6).
	csk := EconomyRow{PopCore: 15000, Dev: 4, Mil: intp(6)}
	if c, m, d := factoryCounts(csk, false); c != 6 || m != 6 || d != 0 {
		t.Fatalf("CSK %d/%d/%d, want 6/6/0", c, m, d)
	}
	deu := EconomyRow{PopCore: 67000, Dev: 5, Civ: intp(32), Mil: intp(16), Dock: intp(3)}
	if c, m, d := factoryCounts(deu, true); c != 32 || m != 16 || d != 3 {
		t.Fatalf("DEU %d/%d/%d", c, m, d)
	}
}

// ecoRegion is a region for placeFactories: its w2 is pop (halved off the
// homeland).
func ecoRegion(id, cat, pop int, core, coastal bool) *EcoRegion {
	return &EcoRegion{R: &Region{ID: id}, Cat: cat, Pop: pop, Core: core, Coastal: coastal}
}

// Two regions of 6 slots and 13 factories: one category step is added.
func TestPlaceFactoriesBumpsWhenSlotsRunOut(t *testing.T) {
	regions := []*EcoRegion{ecoRegion(1, catCity, 900, true, false), ecoRegion(2, catCity, 900, true, false)}
	bumps, err := placeFactories(regions, 10, 3, 0)
	if err != nil {
		t.Fatal(err)
	}
	if bumps != 1 {
		t.Fatalf("%d bumps, want 1", bumps)
	}
	placed := 0
	for _, e := range regions {
		placed += e.Civ + e.Mil + e.Dock
		if e.Civ+e.Mil+e.Dock > categorySlots[e.Cat] {
			t.Fatalf("region %d: %d factories in %d slots", e.R.ID, e.Civ+e.Mil+e.Dock, categorySlots[e.Cat])
		}
	}
	if placed != 13 || regions[0].Cat != catCity+1 || regions[1].Cat != catCity {
		t.Fatalf("placed %d, categories %d %d", placed, regions[0].Cat, regions[1].Cat)
	}
}

// D'Hondt on the population: the region with more people takes more, ties
// go to the earlier region.
func TestPlaceFactoriesDHondt(t *testing.T) {
	a := ecoRegion(1, catTop, 3000, true, false)
	b := ecoRegion(2, catTop, 1000, true, false)
	if _, err := placeFactories([]*EcoRegion{a, b}, 6, 0, 0); err != nil {
		t.Fatal(err)
	}
	// a 3000, a 1500, a 1000 (tie with b's 1000: a is earlier), b 1000,
	// a 750, a 600.
	if a.Civ != 5 || b.Civ != 1 {
		t.Fatalf("a %d, b %d, want 5 and 1", a.Civ, b.Civ)
	}
}

// Dockyards go first, to the coast; the civ fill in around them.
func TestDockyardsTakeThePortsFirst(t *testing.T) {
	port := ecoRegion(1, catCity, 4000, true, true)
	inland := ecoRegion(2, catCity, 900, true, false)
	bumps, err := placeFactories([]*EcoRegion{port, inland}, 9, 0, 3)
	if err != nil {
		t.Fatal(err)
	}
	if bumps != 0 || port.Dock != 3 || inland.Dock != 0 || port.Civ+inland.Civ != 9 {
		t.Fatalf("bumps %d, port %+v, inland %+v", bumps, port, inland)
	}
}

// A colony takes a factory only when the homeland has no room.
func TestHomelandBeforeColonies(t *testing.T) {
	home := ecoRegion(1, catRural, 300, true, false)    // w2 300, 2 slots
	colony := ecoRegion(2, catCity, 4000, false, false) // w2 2000
	if _, err := placeFactories([]*EcoRegion{home, colony}, 3, 0, 0); err != nil {
		t.Fatal(err)
	}
	if home.Civ != 2 || colony.Civ != 1 {
		t.Fatalf("home %d, colony %d, want 2 and 1", home.Civ, colony.Civ)
	}
}

const catRural = 2

func TestPlaceFactoriesFailsWithoutACoast(t *testing.T) {
	if _, err := placeFactories([]*EcoRegion{ecoRegion(1, catCity, 100, true, false)}, 0, 0, 1); err == nil {
		t.Fatal("a dockyard found an inland region")
	}
}

func TestIsqrt(t *testing.T) {
	for v, want := range map[int]int{0: 0, 1: 1, 3: 1, 4: 2, 99: 9, 100: 10, 12000: 109, 27227: 165} {
		if got := isqrt(v); got != want {
			t.Fatalf("isqrt(%d) = %d, want %d", v, got, want)
		}
	}
}

// testWorld is a 360-pixel-wide map: country AAA on the land x < 200 (two
// homeland regions, inland, then a coastal colony on modern CCC land) and an
// islet of 4 pixels the map generator drops; country BBB on an island of
// 30×30 at x 250..279.
func testWorld() (Projection, []bool, []uint16, []*Region, []int, []Feature, *Tables) {
	p := NewProjection(360, -60, 84)
	w := p.Width
	n := w * p.Height
	land := make([]bool, n)
	ids := make([]uint16, n)
	regions := []*Region{
		{ID: 1, Owner: 1, VPTile: -1, MainAdm: 1, Name: "West"},
		{ID: 2, Owner: 1, VPTile: -1, MainAdm: 1, Name: "Middle"},
		{ID: 3, Owner: 1, VPTile: -1, MainAdm: 2, Name: "Colony"},
		{ID: 4, Owner: 1, VPTile: -1, MainAdm: 1, Name: "Islet"},
		{ID: 5, Owner: 2, VPTile: -1, MainAdm: 3, Name: "Island"},
	}
	add := func(x, y int, id uint16) {
		i := y*w + x
		land[i] = true
		ids[i] = id
		regions[id-1].Pixels = append(regions[id-1].Pixels, int32(i))
	}
	for y := 0; y < p.Height; y++ {
		for x := 0; x < 200; x++ {
			switch {
			case x < 70:
				add(x, y, 1)
			case x < 140:
				add(x, y, 2)
			default:
				add(x, y, 3)
			}
		}
	}
	for y := 50; y < 52; y++ {
		for x := 300; x < 302; x++ {
			add(x, y, 4)
		}
	}
	for y := 100; y < 130; y++ {
		for x := 250; x < 280; x++ {
			add(x, y, 5)
		}
	}
	regions[0].Tiers, regions[0].MaxTier = 20, 20
	admin := []Feature{
		{Props: map[string]any{"adm0_a3": "AAA", "name": "Westland"}},
		{Props: map[string]any{"adm0_a3": "CCC", "name": "Colony"}},
		{Props: map[string]any{"adm0_a3": "BBB", "name": "Island"}},
		{Props: map[string]any{"adm0_a3": "AAA", "name": "Eastland"}},
	}
	aaa, bbb := "AAA", "BBB"
	tables := &Tables{
		Countries: []CountryRow{{Tag: "AAA"}, {Tag: "BBB"}},
		Owners:    OwnerTables{Adm0: map[string]*string{"AAA": &aaa, "BBB": &bbb, "CCC": &aaa}},
		tagIndex:  map[string]int{"AAA": 1, "BBB": 2},
		lowDetail: map[string]bool{"CCC": true},
	}
	capitals := []int{10*w + 10, 110*w + 260}
	return p, land, ids, regions, capitals, admin, tables
}

// testPlaces: a town of a million in West; a place in the sea and one on
// the dropped islet, which count for no region.
func testPlaces(p Projection) []Place {
	place := func(x, y int, pop int64) Place {
		lon, lat := p.LonLat(x, y)
		return Place{Lon: lon, Lat: lat, Pop: pop}
	}
	return []Place{place(10, 10, 1_000_000), place(340, 20, 5_000_000), place(300, 50, 5_000_000)}
}

func testRows() []EconomyRow {
	return []EconomyRow{
		{Tag: "AAA", PopCore: 10000, PopColonial: 2000, Dev: 3, Civ: intp(4), Mil: intp(2), Dock: intp(1)},
		{Tag: "BBB", PopCore: 2000, Dev: 5},
	}
}

// siteAt is a site on pixel (x, y).
func siteAt(p Projection, tag, res string, amount, x, y int) Site {
	lon, lat := p.LonLat(x, y)
	return Site{Tag: tag, Res: res, Amount: amount, Lon: lon, Lat: lat, Note: tag + " " + res}
}

func TestBuildEconomyOnATestWorld(t *testing.T) {
	p, land, ids, regions, capitals, admin, tables := testWorld()
	sites := []Site{
		siteAt(p, "AAA", "steel", 5, 30, 40),
		siteAt(p, "AAA", "steel", 3, 31, 41),
		siteAt(p, "AAA", "rubber", 4, 170, 60),
		// Off BBB's coast, within reach of its island.
		siteAt(p, "BBB", "oil", 2, 284, 110),
	}
	eco, sum, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: testRows(), Sites: sites, Places: testPlaces(p)})
	if err != nil {
		t.Fatal(err)
	}
	west, middle, colony, islet, island := eco[0], eco[1], eco[2], eco[3], eco[4]
	if !west.Core || !middle.Core || colony.Core || !island.Core {
		t.Fatalf("core: %v %v %v %v", west.Core, middle.Core, colony.Core, island.Core)
	}
	if west.Coastal || middle.Coastal || !colony.Coastal || !island.Coastal {
		t.Fatalf("coastal: %v %v %v %v", west.Coastal, middle.Coastal, colony.Coastal, island.Coastal)
	}
	if !islet.Dropped || sum.Dropped != 1 || islet.Pop != 0 || islet.Civ+islet.Mil+islet.Dock != 0 {
		t.Fatalf("the islet: %+v", islet)
	}
	if !west.Capital || middle.Capital || !island.Capital {
		t.Fatal("capitals")
	}
	if got := west.Pop + middle.Pop; got != 10000 || colony.Pop != 2000 || island.Pop != 2000 {
		t.Fatalf("population: home %d, colony %d, island %d", got, colony.Pop, island.Pop)
	}
	// The homeland's people go by the places in each region plus 2,000 per
	// isqrt(tiles): West (12,600 tiles, a town of 1,000,000) 1,224,000
	// against Middle's 224,000: 8,453.04 and 1,546.96, the rest to Middle.
	if len(regions[0].Pixels) != 12600 || len(regions[1].Pixels) != 12600 {
		t.Fatalf("tiles %d %d", len(regions[0].Pixels), len(regions[1].Pixels))
	}
	if west.Pop != 8453 || middle.Pop != 1547 || categories[west.Cat] != "megalopolis" {
		t.Fatalf("west %d (%s), middle %d", west.Pop, categories[west.Cat], middle.Pop)
	}
	// The factories follow the people; AAA's homeland is inland, so its
	// dockyard goes to the colony.
	if west.Civ != 4 || west.Mil != 1 || middle.Mil != 1 || colony.Dock != 1 {
		t.Fatalf("factories: west %+v middle %+v colony %+v", west, middle, colony)
	}
	// BBB: 2,000 × 0.7 = 1.4 → 1 civ, no mil, (1+5)/10 = 0 docks.
	if island.Civ != 1 || island.Mil != 0 || island.Dock != 0 {
		t.Fatalf("island %+v", island)
	}
	if west.Res[4] != 8 || colony.Res[2] != 4 || island.Res[0] != 2 || sum.Sites != 4 {
		t.Fatalf("resources: %v %v %v", west.Res, colony.Res, island.Res)
	}
	// West: dev 3, +1 for its tier-20 city, −1 for its 12,600 pixels.
	if west.Infra != 3 || colony.Infra != 1 || island.Infra != 5 {
		t.Fatalf("infra %d %d %d", west.Infra, colony.Infra, island.Infra)
	}
	if !reflect.DeepEqual(sum.Civ, []int{4, 1}) || !reflect.DeepEqual(sum.Dock, []int{1, 0}) {
		t.Fatalf("summary %+v", sum)
	}
}

func TestNonCoreListMakesAColony(t *testing.T) {
	p, land, ids, regions, capitals, admin, tables := testWorld()
	rows := testRows()
	rows[1].NonCore = []string{"BBB"}
	eco, _, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: rows, Places: testPlaces(p)})
	if err != nil {
		t.Fatal(err)
	}
	// BBB has no homeland left: its whole population goes to the colony.
	if eco[4].Core || eco[4].Pop != 2000 {
		t.Fatalf("%+v", eco[4])
	}
}

func TestSitesThatMissTheirCountryFail(t *testing.T) {
	p, land, ids, regions, capitals, admin, tables := testWorld()
	for name, s := range map[string]Site{
		"in the sea":           siteAt(p, "AAA", "oil", 1, 340, 20),
		"in another country":   siteAt(p, "AAA", "oil", 1, 260, 120),
		"on the dropped islet": siteAt(p, "AAA", "oil", 1, 300, 50),
	} {
		_, _, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: testRows(), Sites: []Site{s}})
		if err == nil || !strings.Contains(err.Error(), "resource sites") {
			t.Fatalf("a site %s: err = %v", name, err)
		}
	}
}

func TestADockyardWithoutACoastFails(t *testing.T) {
	p, land, ids, regions, capitals, admin, tables := testWorld()
	// A strip of BBB land along AAA's shore: AAA keeps no coast for its
	// dockyard.
	w := p.Width
	for y := 0; y < p.Height; y++ {
		for x := 200; x < 205; x++ {
			land[y*w+x] = true
			ids[y*w+x] = 5
			regions[4].Pixels = append(regions[4].Pixels, int32(y*w+x))
		}
	}
	_, _, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: testRows()})
	if err == nil || !strings.Contains(err.Error(), "AAA: 1 dockyards but no coastal region") {
		t.Fatalf("err = %v", err)
	}
}

// The same input gives the same scenario.src.json, byte for byte.
func TestEconomyIsDeterministic(t *testing.T) {
	dir := t.TempDir()
	var outs [][]byte
	for k := 0; k < 2; k++ {
		p, land, ids, regions, capitals, admin, tables := testWorld()
		sites := []Site{siteAt(p, "AAA", "steel", 5, 30, 40), siteAt(p, "BBB", "oil", 2, 260, 110)}
		eco, _, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: testRows(), Sites: sites, Places: testPlaces(p)})
		if err != nil {
			t.Fatal(err)
		}
		path := filepath.Join(dir, "scenario.src.json")
		byID := map[int]*EcoRegion{}
		for i, r := range regions {
			byID[r.ID] = eco[i]
		}
		in := ScenarioSrcInput{P: p, T: tables, Rows: testRows(), Capitals: capitals, Regions: regions, Eco: byID}
		if err := writeScenarioSrc(path, in); err != nil {
			t.Fatal(err)
		}
		b, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		outs = append(outs, b)
	}
	if !bytes.Equal(outs[0], outs[1]) {
		t.Fatal("two runs wrote different files")
	}
	if !bytes.Contains(outs[0], []byte(`"version": 3`)) || !bytes.Contains(outs[0], []byte(`"cat": "megalopolis"`)) {
		t.Fatalf("not a version 3 file:\n%s", outs[0])
	}
}

func TestLoadEconomyChecksTheTable(t *testing.T) {
	dir := t.TempDir()
	_, _, _, _, _, _, tables := testWorld()
	write := func(body string) string {
		path := filepath.Join(dir, "economy1936.json")
		if err := os.WriteFile(path, []byte(body), 0644); err != nil {
			t.Fatal(err)
		}
		return path
	}
	rows, err := loadEconomy(write(`[{"tag":"BBB","popCore":2000,"popColonial":0,"dev":5},{"tag":"AAA","popCore":1,"popColonial":0,"dev":1,"nonCore":["CCC"]}]`), tables)
	if err != nil {
		t.Fatal(err)
	}
	if rows[0].Tag != "AAA" || rows[1].Tag != "BBB" {
		t.Fatalf("rows not in countries.json order: %+v", rows)
	}
	for name, body := range map[string]string{
		"a missing country": `[{"tag":"AAA","popCore":1,"popColonial":0,"dev":1}]`,
		"an unknown tag":    `[{"tag":"AAA","popCore":1,"popColonial":0,"dev":1},{"tag":"BBB","popCore":1,"popColonial":0,"dev":1},{"tag":"ZZZ","popCore":1,"popColonial":0,"dev":1}]`,
		"dev 6":             `[{"tag":"AAA","popCore":1,"popColonial":0,"dev":6},{"tag":"BBB","popCore":1,"popColonial":0,"dev":1}]`,
		"an unknown field":  `[{"tag":"AAA","popCore":1,"popColonial":0,"dev":1,"pop":3},{"tag":"BBB","popCore":1,"popColonial":0,"dev":1}]`,
		"a bad nonCore":     `[{"tag":"AAA","popCore":1,"popColonial":0,"dev":1,"nonCore":["XYZ"]},{"tag":"BBB","popCore":1,"popColonial":0,"dev":1}]`,
	} {
		if _, err := loadEconomy(write(body), tables); err == nil {
			t.Fatalf("%s passed", name)
		}
	}
}

func TestLoadSitesChecksNames(t *testing.T) {
	dir := t.TempDir()
	_, _, _, _, _, _, tables := testWorld()
	path := filepath.Join(dir, "resources1936.json")
	for body, ok := range map[string]bool{
		`[{"tag":"AAA","res":"steel","amount":3,"lon":1,"lat":2,"note":"x"}]`: true,
		`[{"tag":"AAA","res":"coal","amount":3,"lon":1,"lat":2,"note":"x"}]`:  false,
		`[{"tag":"ZZZ","res":"oil","amount":3,"lon":1,"lat":2,"note":"x"}]`:   false,
		`[{"tag":"AAA","res":"oil","amount":0,"lon":1,"lat":2,"note":"x"}]`:   false,
	} {
		if err := os.WriteFile(path, []byte(body), 0644); err != nil {
			t.Fatal(err)
		}
		if _, err := loadSites(path, tables); (err == nil) != ok {
			t.Fatalf("%s: err = %v", body, err)
		}
	}
}

// The generator's cleanup as the tool repeats it: an islet under 30 pixels
// goes, a pond under 200 becomes land, the ocean stays.
func TestGeneratorLand(t *testing.T) {
	w, h := 40, 20
	n := w * h
	land := make([]bool, n)
	for y := 0; y < h; y++ {
		for x := 0; x < 20; x++ {
			land[y*w+x] = true
		}
	}
	land[5*w+5] = false // a one-pixel pond
	land[5*w+30] = true // a one-pixel islet
	kept, water := generatorLand(land, w, n)
	if kept[5*w+30] || water[5*w+5] || kept[5*w+5] {
		t.Fatal("the islet stayed or the pond stayed water")
	}
	if !kept[0] || !water[5*w+35] || !water[5*w+30] {
		t.Fatal("the land or the ocean went")
	}
}

// A place counts for the region it lies in, at most placePopCap; places in
// the sea or on a dropped islet count for none.
func TestPlacesWeighTheirRegions(t *testing.T) {
	places := placesOf([]Feature{
		{Props: map[string]any{"name": "Megacity", "pop_max": 35_676_000.0}, Point: &[2]float64{0, 0}},
		{Props: map[string]any{"name": "Town", "pop_max": 50_000.0}, Point: &[2]float64{1, 1}},
		{Props: map[string]any{"name": "Nowhere", "pop_max": 0.0}, Point: &[2]float64{2, 2}},
		{Props: map[string]any{"name": "No point", "pop_max": 9.0}},
	})
	if len(places) != 2 || places[0].Pop != placePopCap || places[1].Pop != 50_000 {
		t.Fatalf("%+v", places)
	}
	p, land, ids, regions, _, _, _ := testWorld()
	kept, _ := generatorLand(land, p.Width, p.Width*p.Height)
	people := regionPeople(placeHits(testPlaces(p), p, kept, ids, nil), len(regions))
	if !reflect.DeepEqual(people, []int64{0, 1_000_000, 0, 0, 0, 0}) {
		t.Fatalf("people per region %v", people)
	}
	if popWeight(0, 100) != 20_000 || popWeight(7, 0) != 7 {
		t.Fatal("popWeight")
	}
}

// testAdm gives every pixel of a region its region's main admin-1 unit.
func testAdm(p Projection, regions []*Region) []int32 {
	adm := make([]int32, p.Width*p.Height)
	for _, r := range regions {
		for _, px := range r.Pixels {
			adm[px] = r.MainAdm
		}
	}
	return adm
}

// admPop spreads the homeland by the census of its admin-1 units: Eastland's
// 9,000 against Westland's 1,000 outweigh the town in Westland.
func TestCensusSpreadsTheHomeland(t *testing.T) {
	p, land, ids, regions, capitals, admin, tables := testWorld()
	regions[1].MainAdm = 4 // Middle is Eastland
	rows := testRows()
	rows[0].AdmPop = map[string]int{"Westland": 1000, "Eastland": 9000}
	eco, _, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: rows, Places: testPlaces(p), Adm: testAdm(p, regions)})
	if err != nil {
		t.Fatal(err)
	}
	if eco[0].Pop != 1000 || eco[1].Pop != 9000 || eco[2].Pop != 2000 {
		t.Fatalf("West %d, Middle %d, colony %d", eco[0].Pop, eco[1].Pop, eco[2].Pop)
	}
}

// A unit across two regions spreads over them by the places and area in it,
// as without a census.
func TestCensusSpreadsAUnitByItsTowns(t *testing.T) {
	p, land, ids, regions, capitals, admin, tables := testWorld()
	rows := testRows()
	rows[0].AdmPop = map[string]int{"Westland": 5}
	eco, _, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: rows, Places: testPlaces(p), Adm: testAdm(p, regions)})
	if err != nil {
		t.Fatal(err)
	}
	if eco[0].Pop != 8453 || eco[1].Pop != 1547 {
		t.Fatalf("West %d, Middle %d, want 8453 and 1547", eco[0].Pop, eco[1].Pop)
	}
}

func TestCensusChecksItsUnits(t *testing.T) {
	p, land, ids, regions, capitals, admin, tables := testWorld()
	regions[1].MainAdm = 4
	cases := []struct {
		tag  int // row
		pop  map[string]int
		want string
	}{
		{0, map[string]int{"Westland": 1000}, `"Eastland" has no admPop`},
		{0, map[string]int{"Westland": 1, "Eastland": 1, "Nowhere": 3}, `"Nowhere": no such admin-1 unit of AAA`},
		// Colony's modern country (CCC) is AAA's, not BBB's.
		{1, map[string]int{"Island": 1, "Colony": 3}, `"Colony": no such admin-1 unit of BBB`},
	}
	for _, c := range cases {
		rows := testRows()
		rows[c.tag].AdmPop = c.pop
		_, _, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: rows, Adm: testAdm(p, regions)})
		if err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("want %s, err = %v", c.want, err)
		}
	}
	rows := testRows()
	rows[0].AdmPop = map[string]int{"Westland": 1, "Eastland": 1}
	if _, _, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: rows}); err == nil || !strings.Contains(err.Error(), "admin-1 raster") {
		t.Fatalf("no raster: err = %v", err)
	}
}

// An industry point multiplies its region's factory weight, and its
// category reads the multiplied population.
func TestIndustryDrawsTheFactories(t *testing.T) {
	p, land, ids, regions, capitals, admin, tables := testWorld()
	lon, lat := p.LonLat(100, 50)
	ind := Industry{Industry: []IndustryPoint{{Tag: "AAA", Mult: 10, Lon: lon, Lat: lat, Note: "works"}}}
	eco, sum, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: testRows(), Places: testPlaces(p), Industry: ind})
	if err != nil {
		t.Fatal(err)
	}
	west, middle := eco[0], eco[1]
	// Middle 1,547 × 10 = 15,470 against West's 8,453: civ m, w, m, m;
	// mil w (8,453/2 > 15,470/4), m.
	if middle.Mult != 10 || middle.Civ != 3 || middle.Mil != 1 || west.Civ != 1 || west.Mil != 1 {
		t.Fatalf("west %+v, middle %+v", west, middle)
	}
	if categories[middle.Cat] != "metropolis" || len(sum.Points) != 1 {
		t.Fatalf("middle %s, points %v", categories[middle.Cat], sum.Points)
	}
}

// A naval yard takes the dockyards first, by its weight, even from a
// region with more people.
func TestYardsTakeTheDockyards(t *testing.T) {
	big := ecoRegion(1, catCity, 5000, true, true)
	small := ecoRegion(2, catCity, 100, true, true)
	other := ecoRegion(3, catCity, 100, true, true)
	small.Yard, other.Yard = 2, 1
	if _, err := placeFactories([]*EcoRegion{big, small, other}, 0, 0, 3); err != nil {
		t.Fatal(err)
	}
	if big.Dock != 0 || small.Dock != 2 || other.Dock != 1 {
		t.Fatalf("docks %d %d %d, want 0 2 1", big.Dock, small.Dock, other.Dock)
	}
	// A full yard region passes the rest to the usual rule.
	small = ecoRegion(2, 1, 100, true, true) // pastoral: 1 slot
	small.Yard = 5
	big = ecoRegion(1, catCity, 5000, true, true)
	if _, err := placeFactories([]*EcoRegion{big, small}, 0, 0, 3); err != nil {
		t.Fatal(err)
	}
	if small.Dock != 1 || big.Dock != 2 {
		t.Fatalf("docks %d %d, want 1 2", small.Dock, big.Dock)
	}
}

func TestIndustryPointsMustLandOnTheirCountry(t *testing.T) {
	p, land, ids, regions, capitals, admin, tables := testWorld()
	at := func(x, y int) (float64, float64) { return p.LonLat(x, y) }
	for want, ind := range map[string]Industry{
		"has no coast": {Yards: []Yard{{Tag: "AAA", Weight: 1, Note: "inland"}}},
		"falls in BBB": {Industry: []IndustryPoint{{Tag: "AAA", Mult: 2, Note: "abroad"}}},
		"no land":      {Industry: []IndustryPoint{{Tag: "AAA", Mult: 2, Note: "at sea"}}},
	} {
		switch want {
		case "has no coast":
			ind.Yards[0].Lon, ind.Yards[0].Lat = at(30, 40)
		case "falls in BBB":
			ind.Industry[0].Lon, ind.Industry[0].Lat = at(260, 120)
		default:
			ind.Industry[0].Lon, ind.Industry[0].Lat = at(340, 20)
		}
		_, _, err := buildEconomy(p, land, ids, regions, capitals, admin, tables, EconomyInput{Rows: testRows(), Industry: ind})
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("want %q, err = %v", want, err)
		}
	}
}

func TestLoadIndustryChecksTheTable(t *testing.T) {
	_, _, _, _, _, _, tables := testWorld()
	path := filepath.Join(t.TempDir(), "industry1936.json")
	for body, ok := range map[string]bool{
		`{"industry":[{"tag":"AAA","mult":3,"lon":1,"lat":2,"note":"x"}],"yards":[{"tag":"BBB","weight":2,"lon":1,"lat":2,"note":"y"}]}`: true,
		`{"industry":[{"tag":"AAA","mult":0,"lon":1,"lat":2,"note":"x"}],"yards":[]}`:                                                    false,
		`{"industry":[],"yards":[{"tag":"ZZZ","weight":1,"lon":1,"lat":2,"note":"y"}]}`:                                                  false,
		`{"industry":[],"yards":[],"extra":1}`:                                                                                           false,
	} {
		if err := os.WriteFile(path, []byte(body), 0644); err != nil {
			t.Fatal(err)
		}
		if _, err := loadIndustry(path, tables); (err == nil) != ok {
			t.Fatalf("%s: err = %v", body, err)
		}
	}
}
