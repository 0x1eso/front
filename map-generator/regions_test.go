package main

import (
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
	ids, err := finalizeRegions(packed, raw, w, h, nil)
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
	ids, err := finalizeRegions(packed, raw, w, h, nil)
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
	ids, err := finalizeRegions(packed, raw, w, h, nil)
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
	if _, err := finalizeRegions(packed, raw, w, h, nil); err == nil || !strings.Contains(err.Error(), "no region") {
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
	ids, err := finalizeRegions(packed, raw, w, h, owner)
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
	if out.Version != 2 {
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
	ids, err := finalizeRegions(packed, raw, w, h, map[uint16]string{1: "DEU", 2: "POL"})
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
