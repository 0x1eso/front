package main

import (
	"fmt"
	"sort"
)

// minExclave is the smallest piece of a country that touches only other
// countries' land and stays a region of its own (the map generator's
// fragment size, map-generator/regions.go minRegionFragment).
const minExclave = 20

// Params are the region and sea-zone sizes (spec §4.5, §4.6).
type Params struct {
	MinCore     int // pieces of home countries smaller than this join a neighbour
	MinLow      int // the same for low-detail (colonial) land
	MaxRegion   int // regions larger than this are split
	MinSea      int // sea zones smaller than this join a neighbour
	MaxSea      int // sea zones larger than this are split
	IslandReach int // a small island joins same-owner land this many pixels away
}

// Region is one land region or sea zone as the tool builds it.
type Region struct {
	ID       int
	Owner    int // 1-based country index; 0 for sea zones
	Pixels   []int32
	Name     string
	NameKo   string
	VP       int
	VPTile   int // pixel, -1 when none
	vpWeight int
	suffixEn string // " (N)" … for a part of a split group
	suffixKo string
	// MainAdm is the admin-1 unit (feature index + 1, 0 = none) holding
	// most of the region's pixels: its adm0_a3 decides whether the region is
	// part of its owner's homeland (P1 spec §3.3).
	MainAdm int32
	// Tiers is the sum of the tiers of the victory-point cities in the
	// region, MaxTier the highest of them (0 without a city; assignVP).
	Tiers   int
	MaxTier int
}

type group struct {
	owner   int
	pixels  []int32
	mainAdm int32 // admin-1 feature of the largest atom, + 1
	mainLen int
	own     int // the Own patch (index + 1) the group is, or 0
}

// buildRegions cuts the land into regions: pieces of one admin-1 unit with
// one 1936 owner, small pieces joined to their same-owner neighbour, large
// ones split. Returns a region id per pixel (0 on water) and the regions,
// numbered from 1 in the order of their first pixel.
func buildRegions(p Projection, land []bool, owner []uint8, adm []int32, patch []uint16, admin []Feature, t *Tables, prm Params) ([]uint16, []*Region, error) {
	w := p.Width
	n := w * p.Height
	// ownOf is the Own patch a pixel lies on (index + 1), or 0.
	ownOf := func(i int) int {
		if k := int(patch[i]); k > 0 && t.Owners.Patches[k-1].Own {
			return k
		}
		return 0
	}
	atom := make([]int32, n)
	var groups []*group
	for i := 0; i < n; i++ {
		if !land[i] || atom[i] != 0 || owner[i] == 0 {
			continue
		}
		id := int32(len(groups) + 1)
		atom[i] = id
		pix := []int32{int32(i)}
		for head := 0; head < len(pix); head++ {
			k := int(pix[head])
			forNeighbours4(k, w, n, func(j int) {
				if atom[j] == 0 && land[j] && owner[j] == owner[k] && adm[j] == adm[k] && ownOf(j) == ownOf(k) {
					atom[j] = id
					pix = append(pix, int32(j))
				}
			})
		}
		groups = append(groups, &group{owner: int(owner[i]), pixels: pix, mainAdm: adm[i], mainLen: len(pix), own: ownOf(i)})
	}
	parent := make([]int32, len(groups)+1)
	for i := range parent {
		parent[i] = int32(i)
	}
	var find func(int32) int32
	find = func(a int32) int32 {
		for parent[a] != a {
			parent[a] = parent[parent[a]]
			a = parent[a]
		}
		return a
	}
	// The pieces of an Own patch make one region, whatever their size, and
	// take no other land: they stay out of the merging below.
	firstOwn := map[int]int32{}
	for i, g := range groups {
		if g.own == 0 {
			continue
		}
		r, ok := firstOwn[g.own]
		if !ok {
			firstOwn[g.own] = int32(i + 1)
			continue
		}
		tg := groups[r-1]
		tg.pixels = append(tg.pixels, g.pixels...)
		g.pixels = nil
		parent[i+1] = r
	}
	threshold := func(g *group) int {
		if g.mainAdm > 0 && t.lowDetail[admin[g.mainAdm-1].Str("adm0_a3")] {
			return prm.MinLow
		}
		return prm.MinCore
	}
	for {
		roots := make([]int32, 0, len(groups))
		for i := range groups {
			if find(int32(i+1)) == int32(i+1) {
				roots = append(roots, int32(i+1))
			}
		}
		sort.Slice(roots, func(a, b int) bool {
			la, lb := len(groups[roots[a]-1].pixels), len(groups[roots[b]-1].pixels)
			if la != lb {
				return la < lb
			}
			return roots[a] < roots[b]
		})
		merged := false
		for _, r := range roots {
			if find(r) != r {
				continue
			}
			g := groups[r-1]
			if g.own > 0 || len(g.pixels) >= threshold(g) {
				continue
			}
			edges := map[int32]int{}
			island := true
			for _, px := range g.pixels {
				forNeighbours4(int(px), w, n, func(j int) {
					if atom[j] == 0 {
						return
					}
					o := find(atom[j])
					if o == r {
						return
					}
					island = false
					if groups[o-1].owner == g.owner && groups[o-1].own == 0 {
						edges[o]++
					}
				})
			}
			// The smallest same-owner neighbour (then the longest shared
			// edge, then the smaller id), so small pieces gather into
			// regions of about the threshold instead of feeding one giant.
			best, bestN, bestLen := int32(0), 0, 0
			for o, k := range edges {
				l := len(groups[o-1].pixels)
				if best == 0 || l < bestLen || (l == bestLen && (k > bestN || (k == bestN && o < best))) {
					best, bestN, bestLen = o, k, l
				}
			}
			// A piece with no same-owner neighbour: an island joins the
			// nearest same-owner land within reach across the water; a
			// sliver of a border (under minExclave) the nearest within
			// reach over any ground. An exclave of minExclave or more
			// (Kwantung) stays a region of its own.
			pass := func(j int) bool { return !land[j] }
			if !island {
				pass = func(int) bool { return true }
			}
			if best == 0 && (island || len(g.pixels) < minExclave) {
				best = nearestGroup(g.pixels, w, n, prm.IslandReach, pass, func(j int) int32 {
					if atom[j] == 0 {
						return 0
					}
					o := find(atom[j])
					if o == r || groups[o-1].owner != g.owner || groups[o-1].own > 0 {
						return 0
					}
					return o
				})
			}
			if best == 0 {
				continue
			}
			tg := groups[best-1]
			tg.pixels = append(tg.pixels, g.pixels...)
			if g.mainLen > tg.mainLen {
				tg.mainAdm, tg.mainLen = g.mainAdm, g.mainLen
			}
			g.pixels = nil
			parent[r] = best
			merged = true
		}
		if !merged {
			break
		}
	}

	type piece struct {
		owner  int
		pixels []int32
		parent []int32 // the pixels of the group it was split from
		split  bool
	}
	var pieces []piece
	mark := make([]int32, n)
	for i, g := range groups {
		if find(int32(i+1)) != int32(i+1) {
			continue
		}
		if len(g.pixels) <= prm.MaxRegion {
			pieces = append(pieces, piece{owner: g.owner, pixels: g.pixels})
			continue
		}
		k := (len(g.pixels) + prm.MaxRegion - 1) / prm.MaxRegion
		for _, part := range splitPixels(g.pixels, k, w, n, mark, int32(i+1)) {
			pieces = append(pieces, piece{owner: g.owner, pixels: part, parent: g.pixels, split: true})
		}
	}
	for _, pc := range pieces {
		sort.Slice(pc.pixels, func(a, b int) bool { return pc.pixels[a] < pc.pixels[b] })
	}
	sort.Slice(pieces, func(a, b int) bool { return pieces[a].pixels[0] < pieces[b].pixels[0] })
	if len(pieces) >= 40000 {
		return nil, nil, fmt.Errorf("%d land regions do not fit below the sea-zone ids", len(pieces))
	}
	ids := make([]uint16, n)
	regions := make([]*Region, len(pieces))
	for k, pc := range pieces {
		id := k + 1
		for _, px := range pc.pixels {
			ids[px] = uint16(id)
		}
		counts := map[int32]int{}
		for _, px := range pc.pixels {
			counts[adm[px]]++
		}
		var main int32
		for a, c := range counts {
			if c > counts[main] || (c == counts[main] && a < main) {
				main = a
			}
		}
		r := &Region{ID: id, Owner: pc.owner, Pixels: pc.pixels, VPTile: -1, MainAdm: main}
		setAdminName(r, admin, main)
		if pc.split {
			en, ko := direction(pc.pixels, pc.parent, w)
			r.suffixEn, r.suffixKo = " ("+en+")", " "+ko
		}
		regions[k] = r
	}
	return ids, regions, nil
}

// setAdminName names a region after an admin-1 unit (feature index + 1).
func setAdminName(r *Region, admin []Feature, unit int32) {
	r.Name, r.NameKo = "", ""
	if unit > 0 {
		f := admin[unit-1]
		r.Name = f.Str("name")
		r.NameKo = f.Str("name_ko")
	}
	if r.Name == "" {
		r.Name = "Unnamed"
	}
	if r.NameKo == "" {
		r.NameKo = r.Name
	}
}

// finishNames names each region after the admin-1 unit of its victory-point
// tile (its capital or biggest city) when it has one, or after a named patch
// that holds most of its land, applies the hand renames (keyed "TAG:name"),
// adds the split suffixes and numbers repeats. Fails on a rename that matches
// no region.
func finishNames(regions []*Region, adm []int32, patch []uint16, admin []Feature, t *Tables) error {
	used := map[string]bool{}
	for _, r := range regions {
		if r.VPTile >= 0 && adm[r.VPTile] > 0 {
			setAdminName(r, admin, adm[r.VPTile])
		}
		if k := namedPatch(r.Pixels, patch, t); k > 0 {
			name := t.Owners.Patches[k-1].Name
			r.Name, r.NameKo = name[0], name[1]
		}
		key := t.Countries[r.Owner-1].Tag + ":" + r.Name
		if names, ok := t.RegionNames[key]; ok {
			r.Name, r.NameKo = names[0], names[1]
			used[key] = true
		}
		r.Name += r.suffixEn
		r.NameKo += r.suffixKo
	}
	for key := range t.RegionNames {
		if !used[key] {
			return fmt.Errorf("region_names.json: %q matches no region", key)
		}
	}
	dedupeNames(regions)
	return nil
}

// namedPatch is the named patch (index + 1) that holds more than half of
// pixels (the most pixels; ties: the first patch), or 0.
func namedPatch(pixels []int32, patch []uint16, t *Tables) int {
	counts := map[int]int{}
	for _, px := range pixels {
		if k := int(patch[px]); k > 0 && t.Owners.Patches[k-1].Name != nil {
			counts[k]++
		}
	}
	best, bestN := 0, 0
	for k, c := range counts {
		if c > bestN || (c == bestN && k < best) {
			best, bestN = k, c
		}
	}
	if 2*bestN <= len(pixels) {
		return 0
	}
	return best
}

// splitPixels cuts a set of pixels into k parts around k seeds, by
// multi-source BFS. The set can be several pieces (islands joined across the
// water): the seeds go to the pieces by the D'Hondt rule on their sizes
// (ties: the piece with the smaller first pixel), and each piece's seeds are
// picked farthest-first from its smallest pixel (ties: the smaller pixel).
// Pieces without a seed join the nearest seed as the crow flies.
func splitPixels(pixels []int32, k, w, n int, mark []int32, tag int32) [][]int32 {
	for _, px := range pixels {
		mark[px] = tag
	}
	in := func(j int) bool { return mark[j] == tag }
	bfs := func(seeds []int32) map[int32]int32 {
		dist := make(map[int32]int32, len(pixels))
		queue := append([]int32(nil), seeds...)
		for _, s := range seeds {
			dist[s] = 0
		}
		for head := 0; head < len(queue); head++ {
			i := queue[head]
			forNeighbours4(int(i), w, n, func(j int) {
				if !in(j) {
					return
				}
				if _, seen := dist[int32(j)]; !seen {
					dist[int32(j)] = dist[i] + 1
					queue = append(queue, int32(j))
				}
			})
		}
		return dist
	}
	// The connected pieces, in the order of their smallest pixel; each
	// piece's first pixel is its smallest.
	sorted := append([]int32(nil), pixels...)
	sort.Slice(sorted, func(a, b int) bool { return sorted[a] < sorted[b] })
	seen := make(map[int32]bool, len(pixels))
	var pieces [][]int32
	for _, px := range sorted {
		if seen[px] {
			continue
		}
		seen[px] = true
		piece := []int32{px}
		for head := 0; head < len(piece); head++ {
			forNeighbours4(int(piece[head]), w, n, func(j int) {
				if in(j) && !seen[int32(j)] {
					seen[int32(j)] = true
					piece = append(piece, int32(j))
				}
			})
		}
		pieces = append(pieces, piece)
	}
	quota := make([]int, len(pieces))
	for s := 0; s < k; s++ {
		best := 0
		for c := 1; c < len(pieces); c++ {
			if len(pieces[c])*(quota[best]+1) > len(pieces[best])*(quota[c]+1) {
				best = c
			}
		}
		quota[best]++
	}
	var seeds []int32
	for c, piece := range pieces {
		if quota[c] == 0 {
			continue
		}
		own := []int32{piece[0]}
		for len(own) < quota[c] {
			dist := bfs(own)
			best, bestD := int32(-1), int32(-1)
			for _, px := range piece {
				if d := dist[px]; d > bestD || (d == bestD && px < best) {
					best, bestD = px, d
				}
			}
			if bestD <= 0 {
				break
			}
			own = append(own, best)
		}
		seeds = append(seeds, own...)
	}
	owner := make(map[int32]int, len(pixels))
	queue := append([]int32(nil), seeds...)
	for s, px := range seeds {
		owner[px] = s
	}
	for head := 0; head < len(queue); head++ {
		i := queue[head]
		forNeighbours4(int(i), w, n, func(j int) {
			if !in(j) {
				return
			}
			if _, seen := owner[int32(j)]; !seen {
				owner[int32(j)] = owner[i]
				queue = append(queue, int32(j))
			}
		})
	}
	parts := make([][]int32, len(seeds))
	for _, px := range pixels {
		s, ok := owner[px]
		if !ok {
			// A part of the set the seeds cannot reach (an island joined
			// across the water): the nearest seed as the crow flies.
			x, y := int(px)%w, int(px)/w
			bestD := -1
			for k, sd := range seeds {
				dx, dy := int(sd)%w-x, int(sd)/w-y
				if d := dx*dx + dy*dy; bestD < 0 || d < bestD {
					s, bestD = k, d
				}
			}
		}
		parts[s] = append(parts[s], px)
	}
	return parts
}

var directionNames = map[string][2]string{
	"N": {"N", "북부"}, "NE": {"NE", "북동부"}, "E": {"E", "동부"}, "SE": {"SE", "남동부"},
	"S": {"S", "남부"}, "SW": {"SW", "남서부"}, "W": {"W", "서부"}, "NW": {"NW", "북서부"}, "C": {"C", "중부"},
}

// direction names where a part lies in the group it was split from.
func direction(part, whole []int32, w int) (string, string) {
	cx, cy := centroid(part, w)
	gx, gy := centroid(whole, w)
	minX, minY, maxX, maxY := bbox(whole, w)
	dx := (cx - gx) / float64(maxX-minX+1)
	dy := (cy - gy) / float64(maxY-minY+1)
	key := ""
	if dy < -1.0/6 {
		key = "N"
	} else if dy > 1.0/6 {
		key = "S"
	}
	if dx < -1.0/6 {
		key += "W"
	} else if dx > 1.0/6 {
		key += "E"
	}
	if key == "" {
		key = "C"
	}
	d := directionNames[key]
	return d[0], d[1]
}

func centroid(pix []int32, w int) (float64, float64) {
	var sx, sy float64
	for _, px := range pix {
		sx += float64(int(px) % w)
		sy += float64(int(px) / w)
	}
	return sx / float64(len(pix)), sy / float64(len(pix))
}

func bbox(pix []int32, w int) (int, int, int, int) {
	minX, minY, maxX, maxY := 1<<30, 1<<30, -1, -1
	for _, px := range pix {
		x, y := int(px)%w, int(px)/w
		minX, maxX = min(minX, x), max(maxX, x)
		minY, maxY = min(minY, y), max(maxY, y)
	}
	return minX, minY, maxX, maxY
}

// dedupeNames numbers repeated names of one owner ("X", "X 2", …) in id order.
func dedupeNames(regions []*Region) {
	seen := map[string]int{}
	for _, r := range regions {
		key := fmt.Sprintf("%d|%s", r.Owner, r.Name)
		seen[key]++
		if c := seen[key]; c > 1 {
			r.Name = fmt.Sprintf("%s %d", r.Name, c)
			r.NameKo = fmt.Sprintf("%s %d", r.NameKo, c)
		}
	}
}

// nearestGroup searches outwards from pixels (4-steps over the pixels pass
// allows, at most reach steps) for the first pixel whose groupOf is not 0.
func nearestGroup(pixels []int32, w, n, reach int, pass func(j int) bool, groupOf func(j int) int32) int32 {
	dist := make(map[int32]int, len(pixels)*4)
	queue := make([]int32, 0, len(pixels))
	for _, px := range pixels {
		dist[px] = 0
		queue = append(queue, px)
	}
	for head := 0; head < len(queue); head++ {
		i := queue[head]
		if dist[i] >= reach {
			continue
		}
		var found int32
		forNeighbours4(int(i), w, n, func(j int) {
			if found != 0 {
				return
			}
			if _, seen := dist[int32(j)]; seen {
				return
			}
			if g := groupOf(j); g != 0 {
				found = g
				return
			}
			if !pass(j) {
				return
			}
			dist[int32(j)] = dist[i] + 1
			queue = append(queue, int32(j))
		})
		if found != 0 {
			return found
		}
	}
	return 0
}
