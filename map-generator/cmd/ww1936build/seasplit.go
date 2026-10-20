package main

import (
	"fmt"
	"sort"
)

// Sea-zone split (P4 spec §3.1, folded into the P2 rebuild): narrow seas
// that matter in the war (the Channel, the Aegean, the Adriatic…) are cut
// out of the large Natural Earth zones they lie in, by lon/lat boxes.

// SeaSplitRow is a new zone: the water tiles of its source zones whose
// centre lies in the box [lon0, lon1] × [lat0, lat1].
type SeaSplitRow struct {
	ID     int        `json:"id"`
	Name   string     `json:"name"`
	NameKo string     `json:"nameKo"`
	From   []int      `json:"from"`
	Lon    [2]float64 `json:"lon"`
	Lat    [2]float64 `json:"lat"`
}

// SeaRename gives a zone a new name; Was is the name it must have now.
type SeaRename struct {
	ID     int    `json:"id"`
	Was    string `json:"was"`
	Name   string `json:"name"`
	NameKo string `json:"nameKo"`
}

// SeaSplit is src/seasplit1936.json. Expect pins the names of the zones the
// rows read, so a change in the zone numbering fails here instead of cutting
// the wrong sea; Lakes lists the zones that are lakes (no fleets, no sea
// edges).
type SeaSplit struct {
	Expect map[string]string `json:"expect"`
	Split  []SeaSplitRow     `json:"split"`
	Rename []SeaRename       `json:"rename"`
	Lakes  []SeaRename       `json:"lakes"`
}

func loadSeaSplit(path string) (SeaSplit, error) {
	var s SeaSplit
	if err := decodeStrict(path, &s); err != nil {
		return s, err
	}
	var bad []string
	seen := map[int]bool{}
	for _, r := range s.Split {
		if r.ID <= seaZoneBase || r.ID > 0xffff || seen[r.ID] {
			bad = append(bad, fmt.Sprintf("split id %d bad or twice", r.ID))
		}
		seen[r.ID] = true
		if r.Name == "" || r.NameKo == "" || len(r.From) == 0 || r.Lon[0] >= r.Lon[1] || r.Lat[0] >= r.Lat[1] {
			bad = append(bad, fmt.Sprintf("split %d: empty name, no source or an empty box", r.ID))
		}
	}
	if len(bad) > 0 {
		return s, fmt.Errorf("%s:\n  %v", path, bad)
	}
	return s, nil
}

// geoAxes are the longitude of each pixel column's centre and the latitude
// of each row's centre.
func geoAxes(p Projection) ([]float64, []float64) {
	lons := make([]float64, p.Width)
	lats := make([]float64, p.Height)
	for x := range lons {
		lons[x], _ = p.LonLat(x, 0)
	}
	for y := range lats {
		_, lats[y] = p.LonLat(0, y)
	}
	return lons, lats
}

// applySeaSplit cuts the new zones out of ids (sea zone per pixel, 0 on
// land), in row order, then hands every piece of a zone the cut touched but
// its largest (ties: the smaller first pixel) to the zone it shares the most
// water edges with (ties: the smaller id), until each is one piece. It
// renames, marks the lakes, and returns the zones (old and new) sorted by id
// with their pixels, the tiles cut into each new zone (before the pieces
// moved) and the pieces that moved.
func applySeaSplit(p Projection, ids []uint16, zones []*Region, s SeaSplit) ([]*Region, map[int]int, []string, error) {
	w := p.Width
	n := w * p.Height
	byID := map[int]*Region{}
	for _, z := range zones {
		byID[z.ID] = z
	}
	var bad []string
	keys := make([]string, 0, len(s.Expect))
	for k := range s.Expect {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		var id int
		fmt.Sscan(k, &id)
		if z := byID[id]; z == nil || z.Name != s.Expect[k] {
			bad = append(bad, fmt.Sprintf("zone %s should be %q", k, s.Expect[k]))
		}
	}
	for _, r := range s.Split {
		if byID[r.ID] != nil {
			bad = append(bad, fmt.Sprintf("zone %d already exists", r.ID))
		}
		for _, f := range r.From {
			if byID[f] == nil {
				bad = append(bad, fmt.Sprintf("split %d: no zone %d", r.ID, f))
			}
		}
	}
	if len(bad) > 0 {
		return nil, nil, nil, fmt.Errorf("seasplit1936.json:\n  %v", bad)
	}
	lons, lats := geoAxes(p)
	cut := map[int]int{}
	affected := map[uint16]bool{}
	for _, r := range s.Split {
		from := map[uint16]bool{}
		for _, f := range r.From {
			from[uint16(f)] = true
			affected[uint16(f)] = true
		}
		affected[uint16(r.ID)] = true
		for y := 0; y < p.Height; y++ {
			if lats[y] < r.Lat[0] || lats[y] > r.Lat[1] {
				continue
			}
			for x := 0; x < w; x++ {
				i := y*w + x
				if from[ids[i]] && lons[x] >= r.Lon[0] && lons[x] <= r.Lon[1] {
					ids[i] = uint16(r.ID)
					cut[r.ID]++
				}
			}
		}
		if cut[r.ID] == 0 {
			return nil, nil, nil, fmt.Errorf("split %d %q: its box holds no water of %v", r.ID, r.Name, r.From)
		}
		byID[r.ID] = &Region{ID: r.ID, Name: r.Name, NameKo: r.NameKo, VPTile: -1}
	}
	moves := joinSeaPieces(ids, w, n, affected)
	for _, rn := range s.Rename {
		z := byID[rn.ID]
		if z == nil || z.Name != rn.Was {
			return nil, nil, nil, fmt.Errorf("rename %d: the zone is not %q", rn.ID, rn.Was)
		}
		z.Name, z.NameKo = rn.Name, rn.NameKo
	}
	for _, l := range s.Lakes {
		z := byID[l.ID]
		if z == nil || z.Name != l.Was {
			return nil, nil, nil, fmt.Errorf("lake %d: the zone is not %q", l.ID, l.Was)
		}
		z.Lake = true
	}
	out := make([]*Region, 0, len(byID))
	for _, z := range byID {
		z.Pixels = z.Pixels[:0]
		out = append(out, z)
	}
	sort.Slice(out, func(a, b int) bool { return out[a].ID < out[b].ID })
	for i := 0; i < n; i++ {
		if id := int(ids[i]); id > seaZoneBase {
			if z := byID[id]; z != nil {
				z.Pixels = append(z.Pixels, int32(i))
			}
		}
	}
	for _, z := range out {
		if len(z.Pixels) == 0 {
			return nil, nil, nil, fmt.Errorf("zone %d %q has no water left", z.ID, z.Name)
		}
	}
	return out, cut, moves, nil
}

// joinSeaPieces makes each zone in affected one piece (see applySeaSplit)
// and says which pieces moved.
func joinSeaPieces(ids []uint16, w, n int, affected map[uint16]bool) []string {
	var moves []string
	for pass := 0; pass < 16; pass++ {
		comp := make([]int32, n)
		type piece struct {
			id     uint16
			pixels []int32
		}
		var pieces []piece
		for i := 0; i < n; i++ {
			id := ids[i]
			if id <= seaZoneBase || !affected[id] || comp[i] != 0 {
				continue
			}
			c := int32(len(pieces) + 1)
			comp[i] = c
			pix := []int32{int32(i)}
			for head := 0; head < len(pix); head++ {
				forNeighbours4(int(pix[head]), w, n, func(j int) {
					if comp[j] == 0 && ids[j] == id {
						comp[j] = c
						pix = append(pix, int32(j))
					}
				})
			}
			pieces = append(pieces, piece{id, pix})
		}
		largest := map[uint16]int{}
		for k, pc := range pieces {
			if b, ok := largest[pc.id]; !ok || len(pc.pixels) > len(pieces[b].pixels) {
				largest[pc.id] = k
			}
		}
		var small []int
		for k, pc := range pieces {
			if largest[pc.id] != k {
				small = append(small, k)
			}
		}
		if len(small) == 0 {
			return moves
		}
		sort.Slice(small, func(a, b int) bool {
			pa, pb := pieces[small[a]], pieces[small[b]]
			if len(pa.pixels) != len(pb.pixels) {
				return len(pa.pixels) < len(pb.pixels)
			}
			return pa.pixels[0] < pb.pixels[0]
		})
		moved := false
		for _, k := range small {
			pc := pieces[k]
			edges := map[uint16]int{}
			for _, px := range pc.pixels {
				forNeighbours4(int(px), w, n, func(j int) {
					if o := ids[j]; o > seaZoneBase && o != pc.id {
						edges[o]++
					}
				})
			}
			best, bestN := uint16(0), 0
			for o, c := range edges {
				if c > bestN || (c == bestN && o < best) {
					best, bestN = o, c
				}
			}
			if best == 0 {
				continue
			}
			for _, px := range pc.pixels {
				ids[px] = best
			}
			moves = append(moves, fmt.Sprintf("%d tiles of %d at (%d,%d) → %d", len(pc.pixels), pc.id, int(pc.pixels[0])%w, int(pc.pixels[0])/w, best))
			moved = true
		}
		if !moved {
			return moves
		}
	}
	return moves
}
