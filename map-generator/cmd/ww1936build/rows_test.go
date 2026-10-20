package main

import (
	"math"
	"testing"
)

func TestRowTable(t *testing.T) {
	p := NewProjection(4000, -60, 84)
	r := buildRows(p)
	if len(r.LatC) != p.Height || len(r.KmxMilli) != p.Height {
		t.Fatalf("%d, %d rows for %d", len(r.LatC), len(r.KmxMilli), p.Height)
	}
	for y := 1; y < p.Height; y++ {
		if r.LatC[y] >= r.LatC[y-1] || r.KmxMilli[y] == 0 {
			t.Fatalf("row %d: latC %d after %d, kmx %d", y, r.LatC[y], r.LatC[y-1], r.KmxMilli[y])
		}
	}
	if r.LatC[0] < 8380 || r.LatC[0] > 8400 || r.LatC[p.Height-1] > -5980 || r.LatC[p.Height-1] < -6000 {
		t.Fatalf("top %d, bottom %d", r.LatC[0], r.LatC[p.Height-1])
	}
	// At the equator a tile is 40075 / 4000 km wide; at 60° half that.
	_, y0 := p.ToPixel(0, 0)
	if kmx := r.KmxMilli[int(y0)]; kmx < 10010 || kmx > 10019 {
		t.Fatalf("equator %d", kmx)
	}
	_, y60 := p.ToPixel(0, 60)
	if kmx := r.KmxMilli[int(y60)]; kmx < 4990 || kmx > 5030 {
		t.Fatalf("60°N %d", kmx)
	}
}

// kmBetween stays within 1% of the great circle: fixed pairs of places, as
// far apart as a land-based plane flies (most under 2,000 km; Tokyo–Guam,
// Oahu–Midway and Wake–Guam a little more), one across the date line.
func TestKmBetweenStaysWithinOnePercentOfTheGreatCircle(t *testing.T) {
	p := NewProjection(4000, -60, 84)
	r := buildRows(p)
	pairs := []struct {
		name                   string
		lon1, lat1, lon2, lat2 float64
	}{
		{"Paris–Berlin", 2.35, 48.86, 13.40, 52.52},
		{"London–Gibraltar", -0.13, 51.51, -5.35, 36.14},
		{"Tokyo–Guam", 139.69, 35.69, 144.79, 13.45},
		{"Oahu–Midway (not across the date line)", -157.98, 21.48, -177.37, 28.21},
		{"Wake–Guam", 166.63, 19.29, 144.79, 13.45},
		{"Midway–Wake (across the date line)", -177.37, 28.21, 166.63, 19.29},
		{"London–Berlin", -0.13, 51.51, 13.40, 52.52},
		{"Malta–Sicily (Catania)", 14.51, 35.89, 15.09, 37.50},
		{"Malta–Alexandria", 14.51, 35.89, 29.92, 31.20},
		{"Rome–Athens", 12.50, 41.90, 23.73, 37.98},
		{"Scapa Flow–Bergen", -3.10, 58.90, 5.32, 60.39},
		{"Murmansk–Arkhangelsk", 33.08, 68.97, 40.54, 64.54},
		{"Leningrad–Moscow", 30.32, 59.94, 37.62, 55.75},
		{"Sevastopol–Istanbul", 33.52, 44.62, 28.98, 41.01},
		{"Truk–Saipan", 151.85, 7.45, 145.75, 15.18},
		{"Singapore–Saigon", 103.82, 1.35, 106.70, 10.78},
		{"Manila–Taipei", 120.98, 14.60, 121.56, 25.04},
		{"Darwin–Port Moresby", 130.84, -12.46, 147.18, -9.44},
		{"Reykjavik–Faroe", -21.94, 64.15, -6.95, 62.05},
		{"Attu–Kiska", 173.18, 52.90, 177.50, 51.98},
	}
	for _, c := range pairs {
		a, okA := p.Pixel(c.lon1, c.lat1)
		b, okB := p.Pixel(c.lon2, c.lat2)
		if !okA || !okB {
			t.Fatalf("%s: off the map", c.name)
		}
		lon1, lat1 := p.LonLat(a%p.Width, a/p.Width)
		lon2, lat2 := p.LonLat(b%p.Width, b/p.Width)
		dl := lon2 - lon1
		if dl > 180 {
			dl -= 360
		} else if dl < -180 {
			dl += 360
		}
		gc := greatCircleKm(lon1, lat1, lon1+dl, lat2)
		km := kmBetween(r, p.Width, a, b)
		if math.Abs(float64(km)-gc) > 0.01*gc {
			t.Fatalf("%s: %d km, great circle %.0f km", c.name, km, gc)
		}
		t.Logf("%s: %d km, great circle %.0f km (%+.2f%%)", c.name, km, gc, (float64(km)-gc)/gc*100)
	}
}
