package main

import (
	"encoding/json"
	"math"
	"reflect"
	"sort"
	"strings"
	"testing"
)

// gridIDs builds a w×h id raster from rows of runes: digits are land
// regions 1..9, '~' sea zone 40001, '=' sea zone 40002.
func gridIDs(rows ...string) ([]uint16, int, int) {
	h, w := len(rows), len(rows[0])
	ids := make([]uint16, w*h)
	for y, row := range rows {
		for x, c := range row {
			switch {
			case c >= '1' && c <= '9':
				ids[y*w+x] = uint16(c - '0')
			case c == '=':
				ids[y*w+x] = 40002
			default:
				ids[y*w+x] = 40001
			}
		}
	}
	return ids, w, h
}

func TestEdgesAreSortedSymmetricAndUnique(t *testing.T) {
	ids, w, h := gridIDs(
		"1112222",
		"1112222",
		"3333444",
		"~~~~444",
	)
	borders := borderPairs(ids, w, h, nil)
	var edges []Edge
	for k, b := range borders {
		edges = append(edges, Edge{A: int(k >> 16), B: int(k & 0xffff), Border: b})
	}
	sortEdges(edges)
	want := []Edge{{A: 1, B: 2, Border: 2}, {A: 1, B: 3, Border: 3}, {A: 2, B: 3, Border: 1}, {A: 2, B: 4, Border: 3}, {A: 3, B: 4, Border: 1}}
	if !reflect.DeepEqual(edges, want) {
		t.Fatalf("edges %+v, want %+v", edges, want)
	}
	for i, e := range edges {
		if e.A >= e.B {
			t.Fatalf("edge %+v is not a < b", e)
		}
		if i > 0 && (edges[i-1].A > e.A || (edges[i-1].A == e.A && edges[i-1].B >= e.B)) {
			t.Fatalf("edges not sorted or repeated at %+v", e)
		}
	}
	// The same pair counted from either side is one key.
	if pairKey(3, 1) != pairKey(1, 3) {
		t.Fatal("pairKey is not symmetric")
	}
}

func TestGreatCircleParisBerlin(t *testing.T) {
	km := greatCircleKm(2.35, 48.86, 13.40, 52.52)
	if math.Abs(km-880) > 880*0.05 {
		t.Fatalf("Paris–Berlin %.0f km", km)
	}
	// The short way across the date line.
	if d := greatCircleKm(179.5, 0, -179.5, 0); d > 120 {
		t.Fatalf("across the date line %.0f km", d)
	}
}

// A border of ten tile pairs (a vertical edge between regions 1 and 2): a
// river within two tiles of four of them makes a river edge, of three none;
// scalerank 3 is a big river, 6 a small one.
func TestRiverRule(t *testing.T) {
	rows := make([]string, 10)
	for y := range rows {
		rows[y] = "1111122222"
	}
	ids, w, h := gridIDs(rows...)
	// run draws a river at x = 7 (two tiles right of the border's right
	// tile, x = 5) on rows 0..riverRows-1: it reaches the pairs of rows
	// 0..riverRows+1.
	run := func(riverRows int, rank uint8) RiverEdge {
		raw := make([]uint8, w*h)
		line := make([]int32, w*h)
		for i := range raw {
			raw[i], line[i] = noRiver, -1
		}
		for y := 0; y < riverRows; y++ {
			raw[y*w+7], line[y*w+7] = rank, 0
		}
		near, nearLine := spreadMin(raw, line, w, h, riverReach)
		borders, rivers := riverEdges(ids, w, h, near, nearLine)
		if borders[pairKey(1, 2)] != 10 {
			t.Fatalf("border %d, want 10", borders[pairKey(1, 2)])
		}
		return rivers[pairKey(1, 2)]
	}
	if r := run(2, 3); r.River != 2 || r.Line != 0 {
		t.Fatalf("4 of 10 pairs, rank 3: %+v, want a big river", r)
	}
	if r := run(2, 6); r.River != 1 {
		t.Fatalf("4 of 10 pairs, rank 6: %+v, want a small river", r)
	}
	if r := run(1, 3); r.River != 0 {
		t.Fatalf("3 of 10 pairs: %+v, want none", r)
	}
	if riverOf(4, 10, bigRiverRank) != 2 || riverOf(4, 10, bigRiverRank+1) != 1 || riverOf(3, 10, 0) != 0 || riverOf(0, 0, 0) != 0 {
		t.Fatal("riverOf thresholds")
	}
}

// Two landmasses six water tiles apart get a strait; seven tiles apart none.
// Regions on one landmass get none from the rule, however close.
func TestStraitRule(t *testing.T) {
	for _, c := range []struct {
		row  string
		want bool
	}{
		{"11~~~~~~22", true},
		{"11~~~~~~~2", false},
	} {
		ids, w, h := gridIDs(c.row, c.row)
		lists := buildTileLists(ids)
		borders := borderPairs(ids, w, h, nil)
		mass := landmasses([]int{1, 2}, borders)
		if mass[1] == mass[2] {
			t.Fatal("the two sides are one landmass")
		}
		got := straitPairs(ids, w, h, lists, []int{1, 2}, borders)
		if _, ok := got[pairKey(1, 2)]; ok != c.want {
			t.Fatalf("%q: strait %v, want %v (%v)", c.row, ok, c.want, got)
		}
		if c.want && got[pairKey(1, 2)] != 6 {
			t.Fatalf("water crossed %d, want 6", got[pairKey(1, 2)])
		}
	}
	// Regions 1 and 3 face each other across a bay but 2 joins them by land:
	// one landmass.
	ids, w, h := gridIDs(
		"1~3",
		"222",
	)
	borders := borderPairs(ids, w, h, nil)
	mass := landmasses([]int{1, 2, 3}, borders)
	if mass[1] != mass[3] {
		t.Fatal("the bay's shores are two landmasses")
	}
	near := straitPairs(ids, w, h, buildTileLists(ids), []int{1, 2, 3}, borders)
	if _, ok := near[pairKey(1, 3)]; !ok {
		t.Fatal("the bay's shores are not within reach")
	}
}

func TestTerrainMajorityAndUrban(t *testing.T) {
	var counts [256]int
	counts[1], counts[16] = 5, 5
	if c := majorityClass(&counts); c != 1 {
		t.Fatalf("tie went to class %d, want the smaller 1", c)
	}
	cases := []struct {
		major, v1, latC, tier, tiles int
		want                         string
	}{
		{4, 0, 5000, 0, 1000, terForest},
		{2, 0, 1000, 0, 1000, terJungle},
		{2, 0, 3000, 0, 1000, terForest},
		{2, 0, -2349, 0, 1000, terJungle},
		{11, 1, 5000, 0, 1000, terMarsh},
		{16, 2, 2500, 0, 1000, terDesert},
		{10, 0, 5000, 0, 1000, terPlains},
		{10, 1, 5000, 0, 1000, terHills},
		{12, 2, 5000, 0, 1000, terMountain},
		{modisWater, 0, 5000, 0, 1000, terPlains},
		{4, 0, 5000, 10, 399, terUrban},
		{4, 0, 5000, 10, 400, terForest},
		{4, 0, 5000, 5, 100, terForest},
	}
	for _, c := range cases {
		if got := landTerrain(c.major, c.v1, c.latC, c.tier, c.tiles); got != c.want {
			t.Fatalf("%+v: %s, want %s", c, got, c.want)
		}
	}
	if v1Class([3]int{3, 3, 1}) != 0 || v1Class([3]int{1, 2, 3}) != 2 || magClass(19) != 1 || magClass(20) != 2 {
		t.Fatal("v1 class")
	}
}

// The weather cell matches engine-lib Weather.weatherCell (the test map's
// Paris and London rows).
func TestWeatherCell(t *testing.T) {
	if c := weatherCell(235, 4886); c != 378 {
		t.Fatalf("Paris %d", c)
	}
	if c := weatherCell(-13, 5151); c != 413 {
		t.Fatalf("London %d", c)
	}
	if c := weatherCell(-18000, -9000); c != 0 {
		t.Fatalf("south-west corner %d", c)
	}
	if c := weatherCell(18000, 9000); c != 35+36*14 {
		t.Fatalf("north-east corner %d", c)
	}
}

func TestNearestCentroidTiesToTheSmallerTile(t *testing.T) {
	// Tiles (0,0) and (2,0): the centroid (1,0) is equally near both.
	if c := nearestCentroid([]int32{0, 2}, 10); c != 0 {
		t.Fatalf("center %d", c)
	}
	if c := nearestCentroid([]int32{0, 1, 2, 10, 11, 12, 20, 21, 22}, 10); c != 11 {
		t.Fatalf("center %d, want the middle 11", c)
	}
}

// The generator's cleanup as the tool repeats it: an island region under
// minRegionFragment tiles keeps its tiles and takes none; another small
// piece joins its owner's neighbour.
func TestFinalMapKeepsIslandRegions(t *testing.T) {
	ids, w, h := gridIDs(
		"11111111111111111111111122223",
		"11111111111111111111111111113",
	)
	land := make([]bool, w*h)
	for i, id := range ids {
		land[i] = id < seaZoneBase
	}
	owner := map[uint16]string{1: "AAA", 2: "AAA", 3: "AAA"}
	count := func(island map[uint16]bool) map[uint16]int {
		out, err := finalMap(ids, land, w, h, owner, island)
		if err != nil {
			t.Fatal(err)
		}
		c := map[uint16]int{}
		for _, id := range out {
			c[id]++
		}
		return c
	}
	// Region 3 touches the island and region 1: it joins region 1.
	if c := count(map[uint16]bool{2: true}); c[1] != 54 || c[2] != 4 || c[3] != 0 {
		t.Fatalf("with the island: %v", c)
	}
	if c := count(nil); c[1] != 58 || c[2] != 0 {
		t.Fatalf("without: %v", c)
	}
}

// The existing regions keep their ids (P2 plan Task 2 Step 2): the table's
// owner and name give the id, new islands follow the table's largest id in
// list order, then other new survivors, then the regions the generator
// drops.
func TestExistingRegionIdsAreKept(t *testing.T) {
	regions := []*Region{
		{Name: "South"}, {Name: "Rock", Island: "rock"}, {Name: "North"},
		{Name: "Islet"}, {Name: "Hatay"}, {Name: "Reef", Island: "reef"},
	}
	tags := []string{"AAA", "AAA", "AAA", "AAA", "BBB", "AAA"}
	dropped := []bool{false, false, false, true, false, false}
	table := map[string]int{idKey("AAA", "South"): 2, idKey("AAA", "North"): 5}
	order := map[string]int{"reef": 0, "rock": 1}
	ids, fresh, err := stableIDs(regions, tags, dropped, table, order)
	if err != nil {
		t.Fatal(err)
	}
	if want := []int{2, 7, 5, 9, 8, 6}; !reflect.DeepEqual(ids, want) {
		t.Fatalf("ids %v, want %v", ids, want)
	}
	if !reflect.DeepEqual(fresh, []int{8}) {
		t.Fatalf("new survivors %v", fresh)
	}
	// A table region that is gone, or that the generator would drop, fails.
	table[idKey("AAA", "East")] = 3
	if _, _, err := stableIDs(regions, tags, dropped, table, order); err == nil || !strings.Contains(err.Error(), `"East" of scenario.json has no region now`) {
		t.Fatalf("err = %v", err)
	}
	delete(table, idKey("AAA", "East"))
	table[idKey("AAA", "Islet")] = 4
	if _, _, err := stableIDs(regions, tags, dropped, table, order); err == nil || !strings.Contains(err.Error(), "would drop it") {
		t.Fatalf("err = %v", err)
	}
}

// landWorld is a 360-pixel-wide map for buildLandGraph: a region of DEU
// (x < 100) and one of AAA (x 100..199) side by side, and an island of DEU
// (x 204..209) four water tiles off AAA's coast.
func landWorld() (Projection, []uint16, LandInput) {
	p := NewProjection(360, -60, 84)
	w := p.Width
	n := w * p.Height
	ids := make([]uint16, n)
	for i := range ids {
		ids[i] = 40001
	}
	for y := 10; y < 60; y++ {
		for x := 0; x < 200; x++ {
			ids[y*w+x] = 1
			if x >= 100 {
				ids[y*w+x] = 2
			}
		}
		if y >= 30 && y < 36 {
			for x := 204; x < 210; x++ {
				ids[y*w+x] = 3
			}
		}
	}
	regions := []*Region{{ID: 1, Owner: 1, Name: "West"}, {ID: 2, Owner: 2, Name: "East", MaxTier: 10}, {ID: 3, Owner: 1, Name: "Isle", Island: "isle"}}
	eco := map[int]*EcoRegion{1: {Core: true, Infra: 5}, 2: {Core: true, Infra: 3}, 3: {Core: false, Infra: 4}}
	modis := make([]uint8, 36*18)
	for i := range modis {
		modis[i] = 4 // deciduous broadleaf forest everywhere
	}
	in := LandInput{
		Regions: regions, Eco: eco, Tags: []string{"DEU", "AAA"}, Mag: make([]uint8, n),
		Modis: modis, ModisW: 36, ModisH: 18, ByName: map[string]int{"DEU:West": 1, "AAA:East": 2, "DEU:Isle": 3},
	}
	return p, ids, in
}

func TestBuildLandGraph(t *testing.T) {
	p, ids, in := landWorld()
	lon0, lat0 := p.LonLat(100, 5)
	lon1, lat1 := p.LonLat(100, 65)
	in.Rivers = []riverLine{{Name: "Border", Rank: 3, Parts: [][][2]float64{{{lon0, lat0}, {lon1, lat1}}}}}
	in.Rail.Rows = []LevelRow{{Note: "axis", Level: 2, Regions: []string{"AAA:East"}}}
	in.Forts.Rows = []LevelRow{{Note: "line", Level: 5, Regions: []string{"DEU:West"}}}
	g, err := buildLandGraph(p, ids, buildTileLists(ids), in)
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Edges) != 2 {
		t.Fatalf("edges %+v", g.Edges)
	}
	land, strait := g.Edges[0], g.Edges[1]
	if land.A != 1 || land.B != 2 || land.Border != 50 || land.River != 2 || land.Strait != 0 {
		t.Fatalf("land edge %+v", land)
	}
	if strait.A != 2 || strait.B != 3 || strait.Border != 0 || strait.Strait != 1 || strait.River != 0 {
		t.Fatalf("strait edge %+v", strait)
	}
	west, east, isle := g.V3[1], g.V3[2], g.V3[3]
	// DEU is a major: core rail max(1, 5 − 1) = 4; AAA's core infra 3 gives
	// 1, the table 2; the island colony with infra 4 gets 1.
	if west.Rail != 4 || east.Rail != 2 || isle.Rail != 1 {
		t.Fatalf("rail %d %d %d", west.Rail, east.Rail, isle.Rail)
	}
	if west.Fort != 5 || east.Fort != 0 {
		t.Fatalf("forts %d %d", west.Fort, east.Fort)
	}
	if west.Land != terForest || east.Land != terForest || isle.Land != terForest {
		t.Fatalf("terrain %s %s %s", west.Land, east.Land, isle.Land)
	}
	cx, cy := west.Center%p.Width, west.Center/p.Width
	if cx != 49 || cy != 34 {
		t.Fatalf("west center (%d,%d)", cx, cy)
	}
	_, lat := p.LonLat(cx, cy)
	if west.LatC != hundredths(lat) {
		t.Fatalf("latC %d", west.LatC)
	}
	// The same input gives the same graph.
	g2, err := buildLandGraph(p, ids, buildTileLists(ids), in)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(g, g2) {
		t.Fatal("two runs gave different graphs")
	}
}

func TestLandStraitHandTable(t *testing.T) {
	p, ids, in := landWorld()
	in.Straits.Remove = [][2]string{{"AAA:East", "DEU:Isle"}}
	g, err := buildLandGraph(p, ids, buildTileLists(ids), in)
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Straits) != 0 {
		t.Fatalf("the removed strait stays: %+v", g.Straits)
	}
	in.Straits.Remove = nil
	in.Straits.Add = [][2]string{{"DEU:West", "AAA:East"}}
	if _, err := buildLandGraph(p, ids, buildTileLists(ids), in); err == nil || !strings.Contains(err.Error(), "joined by land") {
		t.Fatalf("adding a strait between touching regions: err = %v", err)
	}
	in.Straits.Add = [][2]string{{"DEU:West", "DEU:Nowhere"}}
	if _, err := buildLandGraph(p, ids, buildTileLists(ids), in); err == nil || !strings.Contains(err.Error(), "no such region") {
		t.Fatalf("an unknown region: err = %v", err)
	}
}

func TestResolveLevelsFailsOnUnknownNames(t *testing.T) {
	var tbl RegionLevels
	if err := json.Unmarshal([]byte(`{"rows":[{"note":"a","level":3,"regions":["AAA:X","AAA:Y"]},{"note":"b","level":1,"regions":["AAA:X"]}]}`), &tbl); err != nil {
		t.Fatal(err)
	}
	got, err := resolveLevels("t.json", tbl, map[string]int{"AAA:X": 1, "AAA:Y": 2})
	if err != nil || got[1] != 3 || got[2] != 3 {
		t.Fatalf("%v %v", got, err)
	}
	if _, err := resolveLevels("t.json", tbl, map[string]int{"AAA:X": 1}); err == nil || !strings.Contains(err.Error(), `no region "AAA:Y"`) {
		t.Fatalf("err = %v", err)
	}
	keys := []string{}
	for k := range riverGroups {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	if len(keys) == 0 {
		t.Fatal("no river groups")
	}
}

// The hand terrain table sets a region's terrain over the MODIS rule (the
// drained Pripyat marshes); an unknown terrain or region, or a region named
// twice, fails.
func TestHandTerrainTable(t *testing.T) {
	p, ids, in := landWorld()
	in.Terrain.Rows = []TerrainRow{{Note: "marsh", Land: terMarsh, Regions: []string{"AAA:East"}}}
	g, err := buildLandGraph(p, ids, buildTileLists(ids), in)
	if err != nil {
		t.Fatal(err)
	}
	if g.V3[2].Land != terMarsh || g.V3[1].Land != terForest || g.Terrain[terMarsh] != 1 || g.Terrain[terForest] != 2 {
		t.Fatalf("terrain %s %s, counts %v", g.V3[2].Land, g.V3[1].Land, g.Terrain)
	}
	if len(g.HandLand) != 1 || g.HandLand[0] != "2 AAA:East forest → marsh" {
		t.Fatalf("hand %v", g.HandLand)
	}
	for _, c := range []struct {
		rows []TerrainRow
		want string
	}{
		{[]TerrainRow{{Note: "x", Land: "swamp", Regions: []string{"AAA:East"}}}, `terrain "swamp"`},
		{[]TerrainRow{{Note: "x", Land: terMarsh, Regions: []string{"AAA:Nowhere"}}}, `no region "AAA:Nowhere"`},
		{[]TerrainRow{{Note: "x", Land: terMarsh, Regions: []string{"AAA:East"}}, {Note: "y", Land: terHills, Regions: []string{"AAA:East"}}}, "twice"},
	} {
		in.Terrain.Rows = c.rows
		if _, err := buildLandGraph(p, ids, buildTileLists(ids), in); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("%v: err = %v", c.rows, err)
		}
	}
}
