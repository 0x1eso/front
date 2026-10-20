package main

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// writeFile writes a test table and returns its path.
func writeFile(t *testing.T, dir, name, body string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(body), 0644); err != nil {
		t.Fatal(err)
	}
	return path
}

// The stamp grows breadth first from the point over water, neighbours up,
// left, right, down: the point, then its four neighbours, then the up
// neighbour's.
func TestStampIslandBFSOrder(t *testing.T) {
	w, n := 7, 49
	land := make([]bool, n)
	got := stampIsland(land, w, n, 24, 6)
	if want := []int32{24, 17, 23, 25, 31, 10}; !reflect.DeepEqual(got, want) {
		t.Fatalf("stamped %v, want %v", got, want)
	}
	for _, px := range got {
		if !land[px] {
			t.Fatalf("pixel %d is not land", px)
		}
	}
	// It goes round land, and a point on land stamps nothing.
	land2 := make([]bool, n)
	land2[17] = true
	if got := stampIsland(land2, w, n, 24, 3); !reflect.DeepEqual(got, []int32{24, 23, 25}) {
		t.Fatalf("around land: %v", got)
	}
	if got := stampIsland(land2, w, n, 17, 3); got != nil {
		t.Fatalf("on land: %v", got)
	}
}

// islandWorld: a 360-pixel-wide map (one degree a column) with a mainland at
// x < 40 and an island polygon of 2 × 2 degrees at lon 100..102, lat
// 10..12.
func islandWorld() (Projection, []bool, []Feature) {
	p := NewProjection(360, -60, 84)
	n := p.Width * p.Height
	land := make([]bool, n)
	for i := 0; i < n; i++ {
		if i%p.Width < 40 {
			land[i] = true
		}
	}
	isle := Feature{Polygons: []Polygon{{Ring{{100, 10}, {102, 10}, {102, 12}, {100, 12}, {100, 10}}}}}
	fillPolygon(p, isle.Polygons[0], func(px int) { land[px] = true })
	return p, land, []Feature{isle}
}

func TestPlaceIslandsKeepsOrStamps(t *testing.T) {
	p, land, feats := islandWorld()
	before := 0
	for _, l := range land {
		if l {
			before++
		}
	}
	rows := []IslandRow{
		{Key: "isle", Lon: 101, Lat: 11, Owner: "AAA", StampTiles: 2},
		{Key: "atoll", Lon: 150.5, Lat: 20, Owner: "AAA", StampTiles: 3},
	}
	places, stamped, err := placeIslands(p, land, feats, rows)
	if err != nil {
		t.Fatal(err)
	}
	isle, atoll := places[0], places[1]
	if isle.Stamped || len(isle.Pixels) != 4 {
		t.Fatalf("isle: stamped %v, %d pixels", isle.Stamped, len(isle.Pixels))
	}
	if !atoll.Stamped || len(atoll.Pixels) != 3 || atoll.Pixels[0] > atoll.Pixels[1] {
		t.Fatalf("atoll: stamped %v, pixels %v", atoll.Stamped, atoll.Pixels)
	}
	after, marks := 0, 0
	for i, l := range land {
		if l {
			after++
		}
		if stamped[i] {
			marks++
			if !land[i] {
				t.Fatalf("stamped pixel %d is not land", i)
			}
		}
	}
	if after != before+3 || marks != 3 {
		t.Fatalf("land %d → %d, %d stamped", before, after, marks)
	}
	// An island with no pixels of its own beside a large body of land fails
	// (there is no water to stamp on).
	if _, _, err := placeIslands(p, land, feats, []IslandRow{{Key: "shore", Lon: -140.5, Lat: 0, Owner: "AAA", StampTiles: 1}}); err == nil || !strings.Contains(err.Error(), "large land body") {
		t.Fatalf("err = %v", err)
	}
}

// The generator keeps a land body within keepRadius of a keep point,
// whatever its size; a small body farther off goes.
func TestGeneratorLandKeepsIslandsNearKeepPoints(t *testing.T) {
	w, h := 40, 20
	n := w * h
	land := make([]bool, n)
	land[5*w+5], land[5*w+6] = true, true     // near the keep point
	land[15*w+30], land[15*w+31] = true, true // far from it
	kept, water := generatorLand(land, w, n, 8*w+8)
	if !kept[5*w+5] || !kept[5*w+6] || water[5*w+5] {
		t.Fatal("the island near the keep point went")
	}
	if kept[15*w+30] || !water[15*w+30] {
		t.Fatal("the far islet stayed")
	}
	kept, _ = generatorLand(land, w, n)
	if kept[5*w+5] {
		t.Fatal("without keep points the islet stays")
	}
}

// An island is one region of its own, named after it, though the regions
// were drawn with it inside its owner's land (it is small and within
// reach): carving it out leaves the other region whole but for its pixels.
func TestIslandIsARegionOfItsOwn(t *testing.T) {
	p, land, feats := islandWorld()
	w := p.Width
	n := w * p.Height
	rows := []IslandRow{{Key: "isle", Name: "Isle", NameKo: "섬", Lon: 101, Lat: 11, Owner: "BBB", StampTiles: 1}}
	plain := append([]bool(nil), land...)
	places, _, err := placeIslands(p, land, feats, rows)
	if err != nil {
		t.Fatal(err)
	}
	owner := make([]uint8, n)
	adm := make([]int32, n)
	patch := make([]uint16, n)
	for i := 0; i < n; i++ {
		if plain[i] {
			owner[i], adm[i] = 1, 1
		}
	}
	tables := &Tables{
		Countries: []CountryRow{{Tag: "AAA"}, {Tag: "BBB"}},
		tagIndex:  map[string]int{"AAA": 1, "BBB": 2},
		lowDetail: map[string]bool{},
	}
	admin := []Feature{{Props: map[string]any{"adm0_a3": "AAA", "name": "Main"}}}
	prm := Params{MinCore: 200, MinLow: 3000, MaxRegion: 1 << 30, IslandReach: 400}
	ids, regions, err := buildRegions(p, plain, owner, adm, patch, admin, tables, prm)
	if err != nil {
		t.Fatal(err)
	}
	if len(regions) != 1 {
		t.Fatalf("%d regions before the carve, want the island inside the mainland's", len(regions))
	}
	whole := len(regions[0].Pixels)
	regions, donors := carveIslands(regions, ids, adm, owner, rows, places, tables)
	if err := finishNames(regions, adm, patch, admin, tables); err != nil {
		t.Fatal(err)
	}
	if len(regions) != 2 || len(donors["isle"]) != 1 || donors["isle"][0].Name != "Main" {
		t.Fatalf("%d regions, donors %v", len(regions), donors)
	}
	id := ids[places[0].Pixels[0]]
	r := regions[id-1]
	if r.ID != int(id) || r.Island != "isle" || r.Owner != 2 || r.Name != "Isle" || r.NameKo != "섬" || len(r.Pixels) != len(places[0].Pixels) {
		t.Fatalf("island region %+v", r)
	}
	main := regions[ids[0]-1]
	if main.ID != 1 || len(main.Pixels) != whole-len(r.Pixels) || main.Name != "Main" {
		t.Fatalf("mainland %d pixels of %d, %q", len(main.Pixels), whole, main.Name)
	}
}

func TestLoadIslandsChecksRows(t *testing.T) {
	dir := t.TempDir()
	tables := &Tables{tagIndex: map[string]int{"AAA": 1}}
	path := writeFile(t, dir, "islands.json", `[{"key":"a","name":"A","nameKo":"에이","lon":1,"lat":1,"owner":"AAA","port":true,"airBase":1,"navalBase":2,"coastalFort":0,"stampTiles":7}]`)
	if _, err := loadIslands(path, tables); err == nil || !strings.Contains(err.Error(), "stampTiles 7") {
		t.Fatalf("err = %v", err)
	}
	path = writeFile(t, dir, "islands2.json", `[{"key":"a","name":"A","nameKo":"에이","lon":1,"lat":1,"owner":"ZZZ","port":true,"airBase":1,"navalBase":2,"coastalFort":0,"stampTiles":1}]`)
	if _, err := loadIslands(path, tables); err == nil || !strings.Contains(err.Error(), "unknown owner") {
		t.Fatalf("err = %v", err)
	}
}
