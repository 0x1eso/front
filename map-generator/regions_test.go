package main

import (
	"context"
	"encoding/binary"
	"strings"
	"testing"
)

// grid builds packed terrain from rows of 'L' (land, plains), 'M' (land,
// magnitude 25), '~' (water) and '#' (impassable).
func grid(rows ...string) ([]byte, int, int) {
	h := len(rows)
	w := len(rows[0])
	packed := make([]byte, w*h)
	for y, row := range rows {
		for x, c := range row {
			switch c {
			case 'L':
				packed[y*w+x] = 0x80
			case 'M':
				packed[y*w+x] = 0x80 | 25
			case '#':
				packed[y*w+x] = impassableByte
			default:
				packed[y*w+x] = 0x20
			}
		}
	}
	return packed, w, h
}

func decodeRLE(t *testing.T, bin []byte, w, h int) []uint16 {
	t.Helper()
	if string(bin[:4]) != "RGN1" {
		t.Fatalf("magic %q", bin[:4])
	}
	if int(binary.LittleEndian.Uint32(bin[4:])) != w || int(binary.LittleEndian.Uint32(bin[8:])) != h {
		t.Fatalf("size")
	}
	runs := int(binary.LittleEndian.Uint32(bin[12:]))
	out := make([]uint16, 0, w*h)
	pos := 16
	for r := 0; r < runs; r++ {
		l, k := binary.Uvarint(bin[pos:])
		pos += k
		id, k2 := binary.Uvarint(bin[pos:])
		pos += k2
		for i := uint64(0); i < l; i++ {
			out = append(out, uint16(id))
		}
	}
	if pos != len(bin) || len(out) != w*h {
		t.Fatalf("runs cover %d of %d tiles", len(out), w*h)
	}
	return out
}

func TestFinalizeFillsLandAndWaterFromNeighbours(t *testing.T) {
	packed, w, h := grid(
		"LLLLLLLLLLLLLLLLLLLL~~~~",
		"LLLLLLLLLLLLLLLLLLLL~~~~",
		"LLLLLLLLLLLLLLLLLLLL~~~~",
	)
	raw := make([]uint16, w*h)
	raw[0] = 1      // region 1 seed at the left
	raw[19] = 2     // region 2 seed at x=19
	raw[23] = 40001 // a sea zone seed
	raw[20] = 1     // a land id on water: dropped
	ids, err := finalizeRegions(packed, raw, w, h, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < w*h; i++ {
		if packedIsWater(packed[i]) && ids[i] != 40001 {
			t.Fatalf("water tile %d has %d", i, ids[i])
		}
		if packedIsLand(packed[i]) && ids[i] != 1 && ids[i] != 2 {
			t.Fatalf("land tile %d has %d", i, ids[i])
		}
	}
	if ids[0] != 1 || ids[19] != 2 || ids[20] != 40001 {
		t.Fatalf("seeds moved: %v", ids)
	}
}

func TestFinalizeGivesUnseededLakesNewZones(t *testing.T) {
	packed, w, h := grid(
		"~~LLLLLLLLLLLLLLLLLLLLLL~~",
		"~~LLLLLL~~~~~LLLLLLLLLLL~~",
		"~~LLLLLL~~~~~LLLLLLLLLLL~~",
		"~~LLLLLLLLLLLLLLLLLLLLLL~~",
	)
	raw := make([]uint16, w*h)
	raw[2] = 3
	raw[0] = 40005
	ids, err := finalizeRegions(packed, raw, w, h, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	// New zones are numbered in tile order: the right-hand strip (row 0)
	// comes before the lake (row 1).
	if ids[25] != 40006 {
		t.Fatalf("right-hand water %d, want 40006", ids[25])
	}
	if lake := ids[1*w+8]; lake != 40007 {
		t.Fatalf("lake id %d, want 40007", lake)
	}
}

func TestSmallPiecesJoinTheirLongestNeighbour(t *testing.T) {
	packed, w, h := grid(
		"LLLLLLLLLLLLLLLLLLLL",
		"LLLLLLLLLLLLLLLLLLLL",
		"LLLLLLLLLLLLLLLLLLLL",
		"LLLLLLLLLLLLLLLLLLLL",
	)
	raw := make([]uint16, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			switch {
			case x < 10:
				raw[y*w+x] = 1
			default:
				raw[y*w+x] = 2
			}
		}
	}
	// A 2x2 piece of region 5 inside region 2, and one tile of region 1
	// stranded inside region 2.
	raw[1*w+14], raw[1*w+15], raw[2*w+14], raw[2*w+15] = 5, 5, 5, 5
	raw[0*w+18] = 1
	ids, err := finalizeRegions(packed, raw, w, h, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, i := range []int{1*w + 14, 1*w + 15, 2*w + 14, 2*w + 15, 0*w + 18} {
		if ids[i] != 2 {
			t.Fatalf("tile %d is %d, want 2", i, ids[i])
		}
	}
}

func TestLandWithoutAnyRegionIsAnError(t *testing.T) {
	packed, w, h := grid("LL~~LL")
	raw := []uint16{1, 1, 0, 0, 0, 0}
	if _, err := finalizeRegions(packed, raw, w, h, nil, nil); err == nil || !strings.Contains(err.Error(), "no region") {
		t.Fatalf("err = %v", err)
	}
}

func TestRegionsRLERoundTrip(t *testing.T) {
	ids := []uint16{1, 1, 1, 2, 2, 40001, 40001, 0, 300, 300, 300, 300}
	bin := encodeRegionsRLE(ids, 4, 3)
	got := decodeRLE(t, bin, 4, 3)
	for i := range ids {
		if got[i] != ids[i] {
			t.Fatalf("tile %d: %d != %d", i, got[i], ids[i])
		}
	}
}

func TestBuildScenarioCountsTilesAndChecksCapitals(t *testing.T) {
	packed, w, h := grid(
		"LLLLMMMM~~",
		"LLLLMMMM~~",
		"LLLLMMMM~~",
	)
	ids := make([]uint16, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			switch {
			case x < 4:
				ids[y*w+x] = 1
			case x < 8:
				ids[y*w+x] = 2
			default:
				ids[y*w+x] = 40001
			}
		}
	}
	src := scenarioSrc{
		Version:   scenarioVersion,
		Countries: []srcCountry{{Tag: "DEU", Capital: [2]int{1, 1}}, {Tag: "POL", Capital: [2]int{5, 1}}},
		Regions: []srcRegion{
			{ID: 1, Name: "Berlin", NameKo: "베를린", Owner: "DEU", VP: 21, VPTile: &[2]int{1, 1}},
			{ID: 2, Name: "Warsaw", NameKo: "바르샤바", Owner: "POL", VP: 3, VPTile: &[2]int{0, 0}},
			{ID: 3, Name: "Gone", NameKo: "사라짐", Owner: "POL", VP: 1},
		},
		SeaZones: []srcSea{{ID: 40001, Name: "Baltic Sea", NameKo: "발트해"}},
	}
	out, notes, err := buildScenario(src, ids, packed, w, h)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Regions) != 2 || len(notes) != 1 {
		t.Fatalf("regions %v notes %v", out.Regions, notes)
	}
	if out.Regions[0].Tiles != 12 || out.Regions[0].Terrain != "plains" || out.Regions[0].VPTile != [2]int{1, 1} {
		t.Fatalf("region 1: %+v", out.Regions[0])
	}
	// Warsaw's given VP tile is in region 1, so it gets its centre instead.
	if out.Regions[1].Terrain != "mountain" || ids[out.Regions[1].VPTile[1]*w+out.Regions[1].VPTile[0]] != 2 {
		t.Fatalf("region 2: %+v", out.Regions[1])
	}
	if len(out.SeaZones) != 1 || out.SeaZones[0].Tiles != 6 {
		t.Fatalf("seas %v", out.SeaZones)
	}

	src.Countries[1].Capital = [2]int{1, 2}
	if _, _, err := buildScenario(src, ids, packed, w, h); err == nil || !strings.Contains(err.Error(), "own land") {
		t.Fatalf("capital check: %v", err)
	}
}

// A capital region holds at most a third of its country's points: it keeps
// min(its VP, max(1, floor(rest / 2))). A country with no other points keeps 1.
func TestCapitalHoldsAtMostAThirdOfItsCountry(t *testing.T) {
	packed, w, h := grid(
		"LLLLLLLLLL",
		"LLLLLLLLLL",
	)
	ids := make([]uint16, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			ids[y*w+x] = uint16(1 + x/2)
		}
	}
	src := scenarioSrc{
		Version: scenarioVersion,
		Countries: []srcCountry{
			{Tag: "DEU", Capital: [2]int{0, 0}},
			{Tag: "POL", Capital: [2]int{6, 0}},
			{Tag: "DZG", Capital: [2]int{8, 0}},
		},
		Regions: []srcRegion{
			{ID: 1, Name: "Berlin", Owner: "DEU", VP: 36},
			{ID: 2, Name: "Hamburg", Owner: "DEU", VP: 11},
			{ID: 3, Name: "Munich", Owner: "DEU", VP: 16},
			{ID: 4, Name: "Warsaw", Owner: "POL", VP: 4},
			{ID: 5, Name: "Danzig", Owner: "DZG", VP: 21},
		},
	}
	// Poland and Danzig have no other points: they keep 1.
	out, _, err := buildScenario(src, ids, packed, w, h)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]int{}
	for _, r := range out.Regions {
		got[r.Name] = r.VP
	}
	want := map[string]int{"Berlin": 13, "Hamburg": 11, "Munich": 16, "Warsaw": 1, "Danzig": 1}
	for name, vp := range want {
		if got[name] != vp {
			t.Fatalf("%s: VP %d, want %d (all %v)", name, got[name], vp, got)
		}
	}
	// A capital already under the cap keeps its points.
	src.Regions[0].VP = 5
	out, _, err = buildScenario(src, ids, packed, w, h)
	if err != nil {
		t.Fatal(err)
	}
	if out.Regions[0].VP != 5 {
		t.Fatalf("Berlin under the cap: VP %d, want 5", out.Regions[0].VP)
	}
}

// A small piece joins a neighbour of its own owner only. With none (Gibraltar,
// Hong Kong, a sliver left by a border patch) it stays, keeping its owner.
func TestSmallPiecesKeepTheirOwner(t *testing.T) {
	packed, w, h := grid(
		"LLLLLLLLLLLLLLLLLLLL",
		"LLLLLLLLLLLLLLLLLLLL",
		"LLLLLLLLLLLLLLLLLLLL",
		"LLLLLLLLLLLLLLLLLLLL",
	)
	raw := make([]uint16, w*h)
	for i := range raw {
		raw[i] = 2
		if i%w < 10 {
			raw[i] = 1
		}
	}
	raw[1*w+12] = 3                                                 // one tile of a third owner
	raw[1*w+15], raw[1*w+16], raw[2*w+15], raw[2*w+16] = 4, 4, 4, 4 // B's other region
	raw[0*w+18] = 1                                                 // A stranded inside B
	owner := map[uint16]string{1: "A", 2: "B", 3: "C", 4: "B"}
	ids, err := finalizeRegions(packed, raw, w, h, owner, nil)
	if err != nil {
		t.Fatal(err)
	}
	if ids[1*w+12] != 3 || ids[0*w+18] != 1 {
		t.Fatalf("foreign pieces: %d, %d", ids[1*w+12], ids[0*w+18])
	}
	for _, i := range []int{1*w + 15, 1*w + 16, 2*w + 15, 2*w + 16} {
		if ids[i] != 2 {
			t.Fatalf("tile %d is %d, want 2", i, ids[i])
		}
	}
}

// economyGrid is a 10×3 map: region 1 (DEU, x 0..3, its capital at (1,1)),
// region 2 (POL, x 4..7, its capital at (5,1)), sea at x 8..9.
func economyGrid() ([]byte, []uint16, int, int, scenarioSrc) {
	packed, w, h := grid(
		"LLLLLLLL~~",
		"LLLLLLLL~~",
		"LLLLLLLL~~",
	)
	ids := make([]uint16, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			switch {
			case x < 4:
				ids[y*w+x] = 1
			case x < 8:
				ids[y*w+x] = 2
			default:
				ids[y*w+x] = 40001
			}
		}
	}
	src := scenarioSrc{
		Version:   scenarioVersion,
		Countries: []srcCountry{{Tag: "DEU", Capital: [2]int{1, 1}}, {Tag: "POL", Capital: [2]int{5, 1}}},
		Regions: []srcRegion{
			{ID: 1, Name: "Berlin", NameKo: "베를린", Owner: "DEU", VP: 21, Economy: Economy{Cat: "metropolis", Pop: 4000, Infra: 5, Core: true, Coastal: true, Civ: 5, Mil: 3, Res: [6]int{0, 6, 0, 0, 0, 0}}},
			{ID: 2, Name: "Warsaw", NameKo: "바르샤바", Owner: "POL", VP: 3, Economy: Economy{Cat: "city", Pop: 1200, Infra: 3, Core: false, Coastal: false, Civ: 2, Dock: 1, Res: [6]int{1, 0, 0, 0, 8, 0}}},
		},
		SeaZones: []srcSea{{ID: 40001, Name: "Baltic Sea", NameKo: "발트해"}},
	}
	return packed, ids, w, h, src
}

// v2 fields are copied: everything of the economy goes to scenario.json as
// scenario.src.json gives it, but the coast.
func TestScenarioCopiesTheEconomy(t *testing.T) {
	packed, ids, w, h, src := economyGrid()
	out, _, err := buildScenario(src, ids, packed, w, h)
	if err != nil {
		t.Fatal(err)
	}
	if out.Version != 3 {
		t.Fatalf("version %d", out.Version)
	}
	berlin, warsaw := out.Regions[0].Economy, out.Regions[1].Economy
	want := src.Regions[0].Economy
	want.Coastal = false // Berlin does not touch the sea
	if berlin != want {
		t.Fatalf("Berlin %+v, want %+v", berlin, want)
	}
	want = src.Regions[1].Economy
	want.Coastal = true
	if warsaw != want {
		t.Fatalf("Warsaw %+v, want %+v", warsaw, want)
	}
}

// coastal is recomputed after cleanup: a region whose only water was a pond
// the generator filled is inland, and one the cleanup gave a shore is coastal.
func TestCoastIsRecomputedAfterCleanup(t *testing.T) {
	// The pond at (1,0) the tool drew Berlin's coast on is land now (its raw
	// id is a sea zone's); Warsaw, drawn inland, touches the sea at x 8.
	packed, w, h := grid(
		"LLLLLLLL~~",
		"LLLLLLLL~~",
		"LLLLLLLL~~",
	)
	raw := make([]uint16, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			switch {
			case x < 4:
				raw[y*w+x] = 1
			case x < 8:
				raw[y*w+x] = 2
			default:
				raw[y*w+x] = 40001
			}
		}
	}
	raw[0*w+1] = 40002 // the filled pond: a sea id on land
	ids, err := finalizeRegions(packed, raw, w, h, map[uint16]string{1: "DEU", 2: "POL"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	_, _, _, _, src := economyGrid()
	src.Regions[0].Coastal = true // drawn next to the pond
	src.Regions[1].Coastal = false
	out, _, err := buildScenario(src, ids, packed, w, h)
	if err != nil {
		t.Fatal(err)
	}
	if out.Regions[0].Coastal || !out.Regions[1].Coastal {
		t.Fatalf("coastal: %v, %v", out.Regions[0].Coastal, out.Regions[1].Coastal)
	}
}

// a dockyard inland fails: the region lost its coast in the cleanup.
func TestADockyardInlandFails(t *testing.T) {
	packed, ids, w, h, src := economyGrid()
	src.Regions[0].Dock = 1
	if _, _, err := buildScenario(src, ids, packed, w, h); err == nil || !strings.Contains(err.Error(), "dockyards but no coast") {
		t.Fatalf("err = %v", err)
	}
}

// A region that lost every tile leaves its people and resources to its
// country's capital region, so the country totals stay exact.
func TestADroppedRegionLeavesItsPeopleToTheCapital(t *testing.T) {
	packed, ids, w, h, src := economyGrid()
	src.Regions = append(src.Regions,
		srcRegion{ID: 3, Name: "Islet", NameKo: "섬", Owner: "DEU", VP: 4, Economy: Economy{Cat: "rural", Pop: 300, Infra: 4, Core: true, Res: [6]int{2, 0, 0, 0, 1, 0}}},
		srcRegion{ID: 4, Name: "Rock", NameKo: "바위", Owner: "DEU", Economy: Economy{Cat: "rural", Pop: 50, Infra: 4, Core: false, Res: [6]int{0, 0, 3, 0, 0, 0}}},
	)
	out, notes, err := buildScenario(src, ids, packed, w, h)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Regions) != 2 || len(notes) != 2 || !strings.Contains(notes[0], "go to the capital region") {
		t.Fatalf("regions %d, notes %v", len(out.Regions), notes)
	}
	berlin := out.Regions[0]
	if berlin.Pop != 4350 || berlin.Res != [6]int{2, 6, 3, 0, 1, 0} {
		t.Fatalf("Berlin pop %d res %v", berlin.Pop, berlin.Res)
	}
	if out.Regions[1].Pop != 1200 {
		t.Fatalf("Warsaw pop %d", out.Regions[1].Pop)
	}
}

// A region with factories that loses every tile fails the build: the tool
// must not put factories there.
func TestADroppedRegionWithFactoriesFails(t *testing.T) {
	packed, ids, w, h, src := economyGrid()
	src.Regions = append(src.Regions, srcRegion{ID: 3, Name: "Islet", NameKo: "섬", Owner: "DEU", Economy: Economy{Cat: "city", Pop: 300, Infra: 4, Core: true, Civ: 1}})
	if _, _, err := buildScenario(src, ids, packed, w, h); err == nil || !strings.Contains(err.Error(), "lost every tile but has 1 factories") {
		t.Fatalf("err = %v", err)
	}
}

// v3 fields are copied (P2 spec §3.1): the land graph fields, the edges, sea
// edges, straits and historicalOob go to scenario.json as scenario.src.json
// gives them; the port is the formula's on the final tiles (or a hand
// harbour), dev stays with the country.
func TestV3FieldsAreCopied(t *testing.T) {
	packed, ids, w, h, src := economyGrid()
	src.Countries[0].Dev = 5
	src.Regions[0].LandGraph = LandGraph{Land: "urban", Center: &[2]int{1, 1}, LatC: 5252, WCell: 415, Rail: 4, Fort: 0}
	src.Regions[1].LandGraph = LandGraph{Land: "forest", Center: &[2]int{6, 2}, LatC: 5223, WCell: 416, Rail: 1, Fort: 2}
	src.Regions[1].Island = "rock"
	src.Edges = []landEdge{{1, 2, 3, 520, 2, 0}}
	src.SeaZones = append(src.SeaZones, srcSea{ID: 40002, Name: "Lake", NameKo: "호수", Lake: true})
	src.SeaEdges = []seaEdge{{40001, 40002, 300, 1}}
	src.Straits = []strait{{ID: "narrows", Kind: "strait", A: 40001, B: 40002, Shore: []int{2}}}
	src.HistoricalOob = true
	ids[9] = 40002 // one tile of the second zone
	out, _, err := buildScenario(src, ids, packed, w, h)
	if err != nil {
		t.Fatal(err)
	}
	berlin, warsaw := out.Regions[0], out.Regions[1]
	if berlin.outLand != (outLand{Land: "urban", Center: [2]int{1, 1}, LatC: 5252, WCell: 415, Rail: 4}) {
		t.Fatalf("Berlin %+v", berlin.outLand)
	}
	// Warsaw: coastal, a dockyard: a port.
	if warsaw.outLand != (outLand{Land: "forest", Center: [2]int{6, 2}, LatC: 5223, WCell: 416, Rail: 1, Fort: 2, Port: true, Island: "rock"}) {
		t.Fatalf("Warsaw %+v", warsaw.outLand)
	}
	if berlin.Port {
		t.Fatal("inland Berlin has a port")
	}
	if len(out.Edges) != 1 || out.Edges[0] != (landEdge{1, 2, 3, 520, 2, 0}) || len(out.SeaEdges) != 1 || len(out.Straits) != 1 || !out.HistoricalOob {
		t.Fatalf("graphs %v %v %v %v", out.Edges, out.SeaEdges, out.Straits, out.HistoricalOob)
	}
	if out.Countries[0].Dev != 5 || !out.SeaZones[1].Lake || out.Version != 3 {
		t.Fatalf("dev %d, lake %v, version %d", out.Countries[0].Dev, out.SeaZones[1].Lake, out.Version)
	}
	// A hand harbour makes a port of a coastal region without a dockyard or
	// points; inland it does not. (Without the land graph: with it, the
	// colony rule gives the coast of a region set without a port one.)
	src.Regions[1].Dock = 0
	src.Edges = nil
	out, _, err = buildScenario(src, ids, packed, w, h)
	if err != nil || out.Regions[1].Port {
		t.Fatalf("no dock, no hand port: port %v, %v", out.Regions[1].Port, err)
	}
	src.Regions[1].Port = true
	out, _, _ = buildScenario(src, ids, packed, w, h)
	if !out.Regions[1].Port {
		t.Fatal("a hand harbour on the coast is no port")
	}
}

// P2 Task 11 (controller ruling 2): every set of a country's regions joined
// by land that touches the open sea gets a port when it has none: its
// region on the open sea with the most points (then people, then the
// smaller id). A set with a port, a lake shore and a strait do not count.
func TestEveryCoastalRegionSetGetsAPort(t *testing.T) {
	packed, w, h := grid(
		"LLLLLLLL~~",
		"LLLLLLLL~~",
		"LLLLLLLL~~",
	)
	// Region 1 inland (x < 4); 2, 3, 4 a column of rows (x 4..7); the sea
	// east of them, but beside region 3 a lake.
	ids := make([]uint16, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			switch {
			case x < 4:
				ids[y*w+x] = 1
			case x < 8:
				ids[y*w+x] = uint16(2 + y)
			case y == 1:
				ids[y*w+x] = 40002
			default:
				ids[y*w+x] = 40001
			}
		}
	}
	eco := func(pop int) Economy { return Economy{Cat: "rural", Pop: pop, Infra: 2, Core: true} }
	src := scenarioSrc{
		Version:   scenarioVersion,
		Countries: []srcCountry{{Tag: "ITA", Capital: [2]int{1, 1}}},
		Regions: []srcRegion{
			{ID: 1, Name: "Inland", NameKo: "내륙", Owner: "ITA", Economy: eco(10)},
			{ID: 2, Name: "North", NameKo: "북", Owner: "ITA", VP: 1, Economy: eco(10)},
			{ID: 3, Name: "Lakeside", NameKo: "호숫가", Owner: "ITA", VP: 4, Economy: eco(99)},
			{ID: 4, Name: "South", NameKo: "남", Owner: "ITA", VP: 1, Economy: eco(20)},
		},
		SeaZones: []srcSea{{ID: 40001, Name: "Sea", NameKo: "바다"}, {ID: 40002, Name: "Lake", NameKo: "호수", Lake: true}},
		Edges:    []landEdge{{1, 2, 1, 100, 0, 0}, {1, 3, 1, 100, 0, 0}, {1, 4, 1, 100, 0, 0}, {2, 3, 4, 100, 0, 0}, {3, 4, 4, 100, 0, 0}},
	}
	ports := func(out scenarioOut) []int {
		var p []int
		for _, r := range out.Regions {
			if r.Port {
				p = append(p, r.ID)
			}
		}
		return p
	}
	out, notes, err := buildScenario(src, ids, packed, w, h)
	if err != nil {
		t.Fatal(err)
	}
	// One set (all Italian, joined by land); the lakeside is no harbour:
	// South beats North on people.
	if p := ports(out); len(p) != 1 || p[0] != 4 {
		t.Fatalf("ports %v, notes %v", p, notes)
	}
	if !strings.Contains(strings.Join(notes, "\n"), "port added: region 4") {
		t.Fatalf("notes %v", notes)
	}
	// A dockyard in the set already makes its port: none added.
	src.Regions[1].Dock = 1
	out, _, err = buildScenario(src, ids, packed, w, h)
	if p := ports(out); err != nil || len(p) != 1 || p[0] != 2 {
		t.Fatalf("ports %v, %v", p, err)
	}
	// Two owners: each coastal set gets its own.
	src.Regions[1].Dock = 0
	src.Countries = append(src.Countries, srcCountry{Tag: "FRA", Capital: [2]int{5, 2}})
	src.Regions[3].Owner = "FRA"
	out, _, err = buildScenario(src, ids, packed, w, h)
	if p := ports(out); err != nil || len(p) != 2 || p[0] != 2 || p[1] != 4 {
		t.Fatalf("ports %v, %v", p, err)
	}
}

// The tool's borders must be the final map's: a wrong count, a touching pair
// without an edge, a center off the region all fail.
func TestV3GraphsMustMatchTheFinalTiles(t *testing.T) {
	packed, ids, w, h, src := economyGrid()
	src.Edges = []landEdge{{1, 2, 4, 520, 0, 0}}
	if _, _, err := buildScenario(src, ids, packed, w, h); err == nil || !strings.Contains(err.Error(), "border 4 in scenario.src.json, 3 on the final map") {
		t.Fatalf("err = %v", err)
	}
	src.Edges = []landEdge{}
	if _, _, err := buildScenario(src, ids, packed, w, h); err == nil || !strings.Contains(err.Error(), "touch on the final map but have no edge") {
		t.Fatalf("err = %v", err)
	}
	src.Edges = nil
	src.Regions[0].Center = &[2]int{5, 1} // Warsaw's tile
	if _, _, err := buildScenario(src, ids, packed, w, h); err == nil || !strings.Contains(err.Error(), "is not one of its tiles") {
		t.Fatalf("err = %v", err)
	}
}

// The cleanup drops a region: its edges and its place on a strait's shore
// go with it.
func TestEdgesOfADroppedRegionAreRemoved(t *testing.T) {
	packed, ids, w, h, src := economyGrid()
	src.Regions = append(src.Regions, srcRegion{ID: 3, Name: "Islet", NameKo: "섬", Owner: "DEU", Economy: Economy{Cat: "rural", Infra: 4, Core: true}})
	src.Edges = []landEdge{{1, 2, 3, 520, 0, 0}, {2, 3, 0, 40, 0, 1}}
	src.Straits = []strait{{ID: "narrows", Kind: "strait", A: 40001, B: 40001, Shore: []int{2, 3}}}
	out, notes, err := buildScenario(src, ids, packed, w, h)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Edges) != 1 || out.Edges[0][1] != 2 {
		t.Fatalf("edges %v", out.Edges)
	}
	if len(out.Straits) != 1 || len(out.Straits[0].Shore) != 1 || out.Straits[0].Shore[0] != 2 {
		t.Fatalf("straits %+v", out.Straits)
	}
	joined := strings.Join(notes, "\n")
	if !strings.Contains(joined, "edge 2-3 dropped") || !strings.Contains(joined, "shore region 3 dropped") {
		t.Fatalf("notes %v", notes)
	}
}

// Kept islands survive the cleanup (P4 spec §3.2): removeSmallIslands keeps a
// small body within keepIslandRadius of a keep point and drops one farther
// off; finalizeRegions leaves an island region under minRegionFragment tiles
// alone, though a same-owner region touches it.
func TestKeptIslandsSurviveTheCleanup(t *testing.T) {
	w, h := 20, 10
	terrain := make([][]Terrain, w)
	for x := range terrain {
		terrain[x] = make([]Terrain, h)
		for y := range terrain[x] {
			terrain[x][y] = Terrain{Type: Water}
		}
	}
	terrain[2][2] = Terrain{Type: Land}
	terrain[15][7] = Terrain{Type: Land}
	ctx := context.Background()
	removeSmallIslands(ctx, terrain, minIslandSize, true, []Coord{{X: 5, Y: 4}})
	if terrain[2][2].Type != Land {
		t.Fatal("the island near the keep point went")
	}
	if terrain[15][7].Type != Water {
		t.Fatal("the far islet stayed")
	}

	packed, gw, gh := grid(
		"LLLLLLLLLLLLLLLLLLLLLLLLL~~",
		"LLLLLLLLLLLLLLLLLLLLLLLLL~~",
	)
	raw := make([]uint16, gw*gh)
	for i := range raw {
		raw[i] = 1
		if i%gw >= 22 {
			raw[i] = 2
		}
		if i%gw >= 25 {
			raw[i] = 40001
		}
	}
	owner := map[uint16]string{1: "GBR", 2: "GBR"}
	ids, err := finalizeRegions(packed, raw, gw, gh, owner, map[uint16]bool{2: true})
	if err != nil {
		t.Fatal(err)
	}
	if ids[23] != 2 || ids[gw+24] != 2 {
		t.Fatal("the island region joined its neighbour")
	}
	ids, _ = finalizeRegions(packed, raw, gw, gh, owner, nil)
	if ids[23] != 1 {
		t.Fatal("without the exemption the piece stays")
	}
}
