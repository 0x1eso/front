package main

import (
	"fmt"
	"math"
	"sort"
)

// Kept and stamped islands (P4 spec §3.2, folded into the P2 rebuild): the
// map generator deletes land bodies under 30 tiles, which took Malta, Oahu,
// Guam, Okinawa… off the map. Each island of src/islands1936.json becomes a
// region of its own: its Natural Earth land pixels, or, when the rasteriser
// gave it none (Midway, Wake), stampTiles pixels of water turned into land
// around its point. The generator keeps every land body within keepRadius
// tiles of an island's point (map-generator/map_generator.go
// removeSmallIslands), and the region-size rules leave these regions alone.

// IslandRow is one line of src/islands1936.json. Port, AirBase, NavalBase
// and CoastalFort are the P4 start values (P4 spec §3.5, §6.4, §12.4): P2
// copies them; only Port is used now (a harbour, P2 spec §3.1).
type IslandRow struct {
	Key         string  `json:"key"`
	Name        string  `json:"name"`
	NameKo      string  `json:"nameKo"`
	Lon         float64 `json:"lon"`
	Lat         float64 `json:"lat"`
	Owner       string  `json:"owner"`
	Port        bool    `json:"port"`
	AirBase     int     `json:"airBase"`
	NavalBase   int     `json:"navalBase"`
	CoastalFort int     `json:"coastalFort"`
	StampTiles  int     `json:"stampTiles"`
}

// keepRadius is how far (Chebyshev, in tiles) from an island's point a land
// body may lie and still be kept (map_generator.go keepIslandRadius).
const keepRadius = 3

// islandPolyMaxDeg: a Natural Earth land polygon wider or taller than this
// is no small island (Singapore's is 0.4°, Okinawa's 0.8°).
const islandPolyMaxDeg = 3.0

// islandPolyReachDeg: a polygon whose box comes within this of the point is
// the island's, so a point in an atoll's lagoon still finds its islets.
const islandPolyReachDeg = 0.1

// loadIslands reads islands1936.json: unique keys, known owners, values in
// their ranges (P4 spec §3.6), 1..6 stamp tiles.
func loadIslands(path string, t *Tables) ([]IslandRow, error) {
	var rows []IslandRow
	if err := decodeStrict(path, &rows); err != nil {
		return nil, err
	}
	var bad []string
	seen := map[string]bool{}
	for _, r := range rows {
		if r.Key == "" || seen[r.Key] {
			bad = append(bad, fmt.Sprintf("key %q empty or twice", r.Key))
		}
		seen[r.Key] = true
		if _, ok := t.tagIndex[r.Owner]; !ok {
			bad = append(bad, r.Key+": unknown owner "+r.Owner)
		}
		if r.Name == "" || r.NameKo == "" {
			bad = append(bad, r.Key+": empty name")
		}
		if r.StampTiles < 1 || r.StampTiles > 6 {
			bad = append(bad, fmt.Sprintf("%s: stampTiles %d not in 1..6", r.Key, r.StampTiles))
		}
		if r.AirBase < 0 || r.AirBase > 10 || r.NavalBase < 0 || r.NavalBase > 10 || r.CoastalFort < 0 || r.CoastalFort > 5 {
			bad = append(bad, r.Key+": a base level is out of range")
		}
		if r.Lat < -60 || r.Lat > 84 || r.Lon < -180 || r.Lon > 180 {
			bad = append(bad, r.Key+": off the map")
		}
	}
	if len(bad) > 0 {
		return nil, fmt.Errorf("%s:\n  %v", path, bad)
	}
	return rows, nil
}

// IslandPlace is where an island lies on the tool's raster.
type IslandPlace struct {
	Point  int     // the pixel of its lon/lat
	Pixels []int32 // its own land pixels (its polygons' or the stamped), ascending
	// Near are the pixels of the small land bodies near it (touching its
	// pixels or within keepRadius of its point), ascending: the generator
	// keeps them, and they join the island when their owner is the
	// island's (carveIslands).
	Near    []int32
	Stamped bool // Pixels were water and are now land
}

// polyBox is a polygon's lon/lat box.
func polyBox(poly Polygon) (minLon, minLat, maxLon, maxLat float64) {
	minLon, minLat, maxLon, maxLat = math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)
	for _, ring := range poly {
		for _, pt := range ring {
			minLon, maxLon = math.Min(minLon, pt[0]), math.Max(maxLon, pt[0])
			minLat, maxLat = math.Min(minLat, pt[1]), math.Max(maxLat, pt[1])
		}
	}
	return
}

// landBodies labels the 4-neighbour land bodies (1-based, in pixel order)
// and returns their sizes (index = label).
func landBodies(land []bool, w, n int) ([]int32, []int) {
	body := make([]int32, n)
	sizes := []int{0}
	queue := make([]int32, 0, 1<<12)
	for i := 0; i < n; i++ {
		if !land[i] || body[i] != 0 {
			continue
		}
		id := int32(len(sizes))
		body[i] = id
		queue = append(queue[:0], int32(i))
		for head := 0; head < len(queue); head++ {
			forNeighbours4(int(queue[head]), w, n, func(j int) {
				if land[j] && body[j] == 0 {
					body[j] = id
					queue = append(queue, int32(j))
				}
			})
		}
		sizes = append(sizes, len(queue))
	}
	return body, sizes
}

// inBox calls fn for the pixels within keepRadius (Chebyshev) of px.
func inBox(px, w, h int, fn func(j int)) {
	x0, y0 := px%w, px/w
	for y := max(0, y0-keepRadius); y <= min(h-1, y0+keepRadius); y++ {
		for x := max(0, x0-keepRadius); x <= min(w-1, x0+keepRadius); x++ {
			fn(y*w + x)
		}
	}
}

// stampIsland turns up to count water pixels into land, breadth first from
// px over water (neighbours up, left, right, down), px first. Returns the
// pixels in the order it stamped them.
func stampIsland(land []bool, w, n, px, count int) []int32 {
	if land[px] {
		return nil
	}
	seen := map[int]bool{px: true}
	queue := []int{px}
	var out []int32
	for head := 0; head < len(queue) && len(out) < count; head++ {
		i := queue[head]
		land[i] = true
		out = append(out, int32(i))
		forNeighbours4(i, w, n, func(j int) {
			if !seen[j] && !land[j] {
				seen[j] = true
				queue = append(queue, j)
			}
		})
	}
	return out
}

// placeIslands finds each island's pixels and stamps the ones the
// rasteriser missed, in list order. land gains the stamped pixels; stamped
// marks them. An island's pixels are the land pixels inside the small Natural
// Earth land polygons near its point, plus every land body under minIsland
// pixels that touches those or lies within keepRadius of the point (the
// bodies the generator keeps for it). Fails when an island has no pixels of
// its own but touches a large body (no water to stamp), or when two islands
// share a pixel.
func placeIslands(p Projection, land []bool, landFeats []Feature, rows []IslandRow) ([]IslandPlace, []bool, error) {
	w, h := p.Width, p.Height
	n := w * h
	stamped := make([]bool, n)
	places := make([]IslandPlace, len(rows))
	owner := map[int32]string{}
	var bad []string
	body, sizes := landBodies(land, w, n)
	for k, r := range rows {
		pt, ok := p.Pixel(r.Lon, r.Lat)
		if !ok {
			bad = append(bad, r.Key+": off the map")
			continue
		}
		set := map[int32]bool{}
		for _, f := range landFeats {
			for _, poly := range f.Polygons {
				a, b, c, d := polyBox(poly)
				if c-a > islandPolyMaxDeg || d-b > islandPolyMaxDeg {
					continue
				}
				if r.Lon < a-islandPolyReachDeg || r.Lon > c+islandPolyReachDeg || r.Lat < b-islandPolyReachDeg || r.Lat > d+islandPolyReachDeg {
					continue
				}
				fillPolygon(p, poly, func(px int) {
					if land[px] {
						set[int32(px)] = true
					}
				})
			}
		}
		small := map[int32]bool{}
		for px := range set {
			if b := body[px]; sizes[b] < minIsland {
				small[b] = true
			}
		}
		near := map[int32]bool{}
		big := false
		inBox(pt, w, h, func(j int) {
			if !land[j] {
				return
			}
			if sizes[body[j]] < minIsland {
				small[body[j]] = true
			} else if len(set) == 0 {
				big = true
			}
		})
		if big {
			bad = append(bad, r.Key+": no island pixels, but a large land body lies within the keep radius")
			continue
		}
		if len(small) > 0 {
			for i := 0; i < n; i++ {
				if land[i] && small[body[i]] && !set[int32(i)] {
					near[int32(i)] = true
				}
			}
		}
		pl := IslandPlace{Point: pt}
		for px := range near {
			pl.Near = append(pl.Near, px)
		}
		sort.Slice(pl.Near, func(a, b int) bool { return pl.Near[a] < pl.Near[b] })
		if len(set) == 0 {
			pl.Pixels = stampIsland(land, w, n, pt, r.StampTiles)
			pl.Stamped = true
			for _, px := range pl.Pixels {
				stamped[px] = true
			}
			body, sizes = landBodies(land, w, n)
		} else {
			for px := range set {
				pl.Pixels = append(pl.Pixels, px)
			}
		}
		sort.Slice(pl.Pixels, func(a, b int) bool { return pl.Pixels[a] < pl.Pixels[b] })
		for _, list := range [][]int32{pl.Pixels, pl.Near} {
			for _, px := range list {
				if other, ok := owner[px]; ok {
					bad = append(bad, fmt.Sprintf("%s and %s share pixel %d", other, r.Key, px))
				}
				owner[px] = r.Key
			}
		}
		places[k] = pl
	}
	if len(bad) > 0 {
		return nil, nil, fmt.Errorf("islands1936.json:\n  %v", bad)
	}
	return places, stamped, nil
}

// carveIslands makes each island a region of its own (P4 spec §3.2). The
// regions are drawn first on the land before the stamps, as version 2 drew
// them, so every other region keeps its shape and merges; then each
// island's pixels, and the pixels near it of its own owner (owner is the
// 1936 owner per pixel), leave the region they fell in and form the
// island's region: the table's owner and name, its main admin-1 unit the
// most frequent of its pixels' (ties: the smaller unit). A region left
// without pixels goes, and all are numbered again from 1 in the order of
// their first pixel. ids (the region per pixel) is rewritten. Returns the
// regions and, per island key, the regions that gave it land.
func carveIslands(regions []*Region, ids []uint16, adm []int32, owner []uint8, rows []IslandRow, places []IslandPlace, t *Tables) ([]*Region, map[string][]*Region) {
	isle := map[int32]int{}
	own := make([][]int32, len(places))
	for k, pl := range places {
		tag := uint8(t.tagIndex[rows[k].Owner])
		own[k] = append([]int32(nil), pl.Pixels...)
		for _, px := range pl.Near {
			if owner[px] == tag {
				own[k] = append(own[k], px)
			}
		}
		sort.Slice(own[k], func(a, b int) bool { return own[k][a] < own[k][b] })
		for _, px := range own[k] {
			isle[px] = k
		}
	}
	donors := map[string][]*Region{}
	var out []*Region
	for _, r := range regions {
		kept := r.Pixels[:0:0]
		gave := map[int]bool{}
		for _, px := range r.Pixels {
			if k, ok := isle[px]; ok {
				gave[k] = true
				continue
			}
			kept = append(kept, px)
		}
		for k := range rows {
			if gave[k] {
				donors[rows[k].Key] = append(donors[rows[k].Key], r)
			}
		}
		r.Pixels = kept
		if len(kept) > 0 {
			out = append(out, r)
		}
	}
	for k, row := range rows {
		pix := own[k]
		counts := map[int32]int{}
		for _, px := range pix {
			if a := adm[px]; a > 0 {
				counts[a]++
			}
		}
		var main int32
		for a, c := range counts {
			if c > counts[main] || (c == counts[main] && a < main) {
				main = a
			}
		}
		out = append(out, &Region{
			Owner: t.tagIndex[row.Owner], Pixels: pix, Name: row.Name, NameKo: row.NameKo,
			VPTile: -1, MainAdm: main, Island: row.Key,
		})
	}
	sort.Slice(out, func(a, b int) bool { return out[a].Pixels[0] < out[b].Pixels[0] })
	for i := range ids {
		ids[i] = 0
	}
	for k, r := range out {
		r.ID = k + 1
		for _, px := range r.Pixels {
			ids[px] = uint16(r.ID)
		}
	}
	return out, donors
}

// keepPoints are the islands' points, the bodies near which the generator
// keeps.
func keepPoints(places []IslandPlace) []int {
	out := make([]int, len(places))
	for k, pl := range places {
		out[k] = pl.Point
	}
	return out
}
