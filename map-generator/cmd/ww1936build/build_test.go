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
