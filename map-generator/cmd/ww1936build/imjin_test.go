package main

import (
	"math"
	"testing"
)

// The default window is the globe: NewWindowProjection gives world1936's
// projection bit for bit, so its files do not move.
func TestWindowDefaultIsGlobe(t *testing.T) {
	a, b := NewProjection(4000, -60, 84), NewWindowProjection(4000, -180, 180, -60, 84)
	if a != b {
		t.Fatalf("default window %+v differs from the globe %+v", b, a)
	}
}

// A window maps its corners to the map's corners and back.
func TestWindowRoundTrip(t *testing.T) {
	p := NewWindowProjection(2400, 118, 136, 30.8, 43.3)
	if !p.Window || p.Width != 2400 || p.Height < 1800 || p.Height > 2000 {
		t.Fatalf("window %+v", p)
	}
	x, y := p.ToPixel(118, 43.3)
	if math.Abs(x) > 1e-9 || math.Abs(y) > 1e-9 {
		t.Fatalf("north-west corner at (%f, %f)", x, y)
	}
	x, _ = p.ToPixel(136, 40)
	if math.Abs(x-2400) > 1e-9 {
		t.Fatalf("east edge at x %f", x)
	}
	lon, lat := p.LonLat(1200, 900)
	px, ok := p.Pixel(lon, lat)
	if !ok || px != 900*2400+1200 {
		t.Fatalf("pixel (1200, 900) comes back as %d", px)
	}
	// One tile's east-west km at the middle row is the window's share of
	// the equator, by the cosine.
	r := buildRows(p)
	want := equatorKm * 18 / 360 * math.Cos(float64(r.LatC[900])/100*math.Pi/180) / 2400 * 1000
	if math.Abs(float64(r.KmxMilli[900])-want) > 2 {
		t.Fatalf("kmxMilli %d, want about %.0f", r.KmxMilli[900], want)
	}
}

func TestEncodeRuns(t *testing.T) {
	got := encodeRuns([]uint8{0, 0, 5, 5, 5, 0, 17})
	want := []int{2, 0, 3, 5, 1, 0, 1, 17}
	if len(got) != len(want) {
		t.Fatalf("runs %v, want %v", got, want)
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("runs %v, want %v", got, want)
		}
	}
}
