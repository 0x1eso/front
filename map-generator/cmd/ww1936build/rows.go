package main

import "math"

// The row table of scenario.json version 4 (P4 plan decision 9): the engine
// has no trigonometry, so the tool gives each map row its centre latitude
// and the east-west great-circle length of one tile there, and engine-lib
// ScenarioIndex.kmBetween measures with them.

// Rows is scenario.json's rows: per map row, the centre latitude in
// hundredths of a degree and one tile's east-west km × 1000.
type Rows struct {
	LatC     []int `json:"latC"`
	KmxMilli []int `json:"kmxMilli"`
}

// equatorKm is the Earth's equatorial circumference in km.
const equatorKm = 40075.0

// buildRows computes the row table of the Miller map.
func buildRows(p Projection) Rows {
	r := Rows{LatC: make([]int, p.Height), KmxMilli: make([]int, p.Height)}
	for y := 0; y < p.Height; y++ {
		_, lat := p.LonLat(0, y)
		r.LatC[y] = hundredths(lat)
		r.KmxMilli[y] = int(math.Round(equatorKm * math.Cos(lat*math.Pi/180) / float64(p.Width) * 1000))
	}
	return r
}

// kmBetween is engine-lib ScenarioIndex.kmBetween on a map with a row table
// (plan decision 9): the east-west tiles wrap at the date line and count at
// the middle row's width, the north-south distance is 111.32 km a degree.
// Keep the two in step.
func kmBetween(r Rows, w, a, b int) int {
	xa, ya, xb, yb := a%w, a/w, b%w, b/w
	adx := xa - xb
	if adx < 0 {
		adx = -adx
	}
	dxTiles := min(adx, w-adx)
	dx := float64(dxTiles*r.KmxMilli[(ya+yb)>>1]) / 1000
	dlat := r.LatC[ya] - r.LatC[yb]
	if dlat < 0 {
		dlat = -dlat
	}
	dy := float64(dlat*11132) / 10000
	return int(math.Round(math.Sqrt(dx*dx + dy*dy)))
}
