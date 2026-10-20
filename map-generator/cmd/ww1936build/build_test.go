package main

import (
	"math"
	"testing"
)

func TestProjectionSizeAndRoundTrip(t *testing.T) {
	p := NewProjection(4000, -60, 84)
	if p.Width != 4000 || p.Height != 2036 {
		t.Fatalf("size %dx%d, want 4000x2036", p.Width, p.Height)
	}
	for _, c := range [][2]float64{{13.4, 52.52}, {-77.04, 38.91}, {139.69, 35.69}, {0, 0}, {174.78, -41.29}} {
		px, ok := p.Pixel(c[0], c[1])
		if !ok {
			t.Fatalf("%v is off the map", c)
		}
		lon, lat := p.LonLat(px%p.Width, px/p.Width)
		if math.Abs(lon-c[0]) > 0.1 || math.Abs(lat-c[1]) > 0.1 {
			t.Fatalf("%v came back as %.3f, %.3f", c, lon, lat)
		}
	}
	if _, ok := p.Pixel(0, -70); ok {
		t.Fatal("Antarctica is on the map")
	}
}

func TestFillPolygonEvenOdd(t *testing.T) {
	p := NewProjection(360, -60, 84)
	square := Ring{{0, 0}, {10, 0}, {10, 10}, {0, 10}, {0, 0}}
	hole := Ring{{2, 2}, {8, 2}, {8, 8}, {2, 8}, {2, 2}}
	full, holed := 0, 0
	fillPolygon(p, Polygon{square}, func(int) { full++ })
	fillPolygon(p, Polygon{square, hole}, func(int) { holed++ })
	if full == 0 || holed == 0 || holed >= full {
		t.Fatalf("square %d pixels, with a hole %d", full, holed)
	}
	// 10 degrees of longitude are 10 pixels at this width.
	x0, _ := p.ToPixel(0, 5)
	x1, _ := p.ToPixel(10, 5)
	if math.Abs((x1-x0)-10) > 1e-9 {
		t.Fatalf("10 degrees are %.3f pixels", x1-x0)
	}
}

func TestTerrainBlueBands(t *testing.T) {
	cases := map[int]uint8{0: 140, 19: 158, 20: 160, 59: 178, 60: 180, 255: 200}
	for e, want := range cases {
		if got := terrainBlue(e); got != want {
			t.Fatalf("elevation %d: blue %d, want %d", e, got, want)
		}
	}
}

func TestSplitPixelsCoversEverything(t *testing.T) {
	w, h := 60, 20
	n := w * h
	var pix []int32
	for i := 0; i < n; i++ {
		pix = append(pix, int32(i))
	}
	mark := make([]int32, n)
	parts := splitPixels(pix, 3, w, n, mark, 1)
	if len(parts) != 3 {
		t.Fatalf("%d parts", len(parts))
	}
	total := 0
	for _, part := range parts {
		if len(part) < n/6 {
			t.Fatalf("a part of %d pixels", len(part))
		}
		total += len(part)
	}
	if total != n {
		t.Fatalf("parts cover %d of %d pixels", total, n)
	}
}

// A region of a mainland and an island joined across the water: the island
// holds the set's first pixel, but the seeds must still cut the mainland
// into even parts instead of all landing on the island.
func TestSplitPixelsSeedsTheLargestPieces(t *testing.T) {
	w, h := 60, 22
	n := w * h
	var pix []int32
	for x := 0; x < 4; x++ {
		pix = append(pix, int32(x)) // the island, row 0
	}
	for i := 2 * w; i < n; i++ {
		pix = append(pix, int32(i)) // the mainland, rows 2..21
	}
	mark := make([]int32, n)
	parts := splitPixels(pix, 3, w, n, mark, 1)
	if len(parts) != 3 {
		t.Fatalf("%d parts", len(parts))
	}
	total := 0
	for _, part := range parts {
		if len(part) < len(pix)/6 || len(part) > len(pix)/2 {
			t.Fatalf("a part of %d of %d pixels", len(part), len(pix))
		}
		total += len(part)
	}
	if total != len(pix) {
		t.Fatalf("parts cover %d of %d pixels", total, len(pix))
	}
}

// Spec §7.5 as amended: a region gets its base victory point only when it
// holds a city or a capital; empty regions are worth nothing.
func TestVPBaseOnlyForRegionsWithACity(t *testing.T) {
	p := NewProjection(360, -60, 84)
	n := p.Width * p.Height
	land := make([]bool, n)
	ids := make([]uint16, n)
	for i := 0; i < n; i++ {
		land[i] = true
		ids[i] = uint16(1 + (i%p.Width)/120) // 1: -180..-60, 2: -60..60, 3: 60..180
	}
	regions := []*Region{
		{ID: 1, Owner: 1, VPTile: -1},
		{ID: 2, Owner: 1, VPTile: -1},
		{ID: 3, Owner: 1, VPTile: -1},
	}
	tables := &Tables{
		Countries: []CountryRow{{Tag: "AAA", Capital: [2]float64{-100, 10}}},
		Cities:    []City{{Name: "Middle", Lon: 0, Lat: 10, Tier: 5}},
	}
	if _, err := assignVP(p, land, ids, regions, tables); err != nil {
		t.Fatal(err)
	}
	for k, want := range []int{1 + capitalVP, 1 + 5, 0} {
		if regions[k].VP != want {
			t.Fatalf("region %d has %d VP, want %d", k+1, regions[k].VP, want)
		}
	}
}

// A small island joins same-owner land across the water, but not across
// another owner's land: the search stops at land it may not cross.
func TestNearestGroupCrossesOnlyWhatItMay(t *testing.T) {
	w, h := 20, 1
	n := w * h
	// x=0 the piece, x=1..2 water, x=3 foreign land, x=4..5 water, x=6 target.
	land := make([]bool, n)
	land[0], land[3], land[6] = true, true, true
	groupOf := func(j int) int32 {
		if j == 6 {
			return 7
		}
		return 0
	}
	water := func(j int) bool { return !land[j] }
	if g := nearestGroup([]int32{0}, w, n, 40, water, groupOf); g != 0 {
		t.Fatalf("crossed foreign land to group %d", g)
	}
	if g := nearestGroup([]int32{0}, w, n, 40, func(int) bool { return true }, groupOf); g != 7 {
		t.Fatalf("over land and water found %d, want 7", g)
	}
}
