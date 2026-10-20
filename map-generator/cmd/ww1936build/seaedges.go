package main

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// The sea-zone graph (P4 spec §3.3, folded into the P2 rebuild): zones that
// share water, the hand straits and canals of src/straits1936.json, and the
// date line (the map does not wrap, the graph does).

const (
	seaKindWater    = 0
	seaKindStrait   = 1
	seaKindCanal    = 2
	seaKindDateLine = 3
	// minSeaPairs is the fewest 4-neighbour water tile pairs (or date-line
	// rows) that join two zones.
	minSeaPairs = 3
)

// SeaEdge is [a, b, km, kind] of scenario.json.
type SeaEdge struct {
	A, B, Km, Kind int
}

func (e SeaEdge) MarshalJSON() ([]byte, error) {
	return json.Marshal([4]int{e.A, e.B, e.Km, e.Kind})
}

func (e *SeaEdge) UnmarshalJSON(b []byte) error {
	var v [4]int
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	*e = SeaEdge{v[0], v[1], v[2], v[3]}
	return nil
}

// StraitRow is one line of src/straits1936.json: a strait or canal between
// two zones, and the land regions ("TAG:name") on its shores.
type StraitRow struct {
	ID    string   `json:"id"`
	Kind  string   `json:"kind"`
	A     int      `json:"a"`
	B     int      `json:"b"`
	Shore []string `json:"shore"`
}

// Strait is a strait of scenario.json (shore as region ids).
type Strait struct {
	ID    string `json:"id"`
	Kind  string `json:"kind"`
	A     int    `json:"a"`
	B     int    `json:"b"`
	Shore []int  `json:"shore"`
}

// LandStraits are the hand corrections to the land straits of P2 spec
// §3.2-4: Add joins two regions on one landmass across a narrow strait (the
// computed rule only looks across landmasses), Remove drops a computed one.
type LandStraits struct {
	Add    [][2]string `json:"add"`
	Remove [][2]string `json:"remove"`
}

// StraitTables is src/straits1936.json.
type StraitTables struct {
	Sea  []StraitRow `json:"sea"`
	Land LandStraits `json:"land"`
}

func loadStraits(path string) (StraitTables, error) {
	var s StraitTables
	if err := decodeStrict(path, &s); err != nil {
		return s, err
	}
	var bad []string
	seen := map[string]bool{}
	for _, r := range s.Sea {
		if r.ID == "" || seen[r.ID] {
			bad = append(bad, fmt.Sprintf("strait %q empty or twice", r.ID))
		}
		seen[r.ID] = true
		if r.Kind != "strait" && r.Kind != "canal" {
			bad = append(bad, fmt.Sprintf("%s: kind %q", r.ID, r.Kind))
		}
		if r.A <= seaZoneBase || r.B <= seaZoneBase || r.A == r.B || len(r.Shore) == 0 {
			bad = append(bad, r.ID+": bad zones or no shore")
		}
	}
	if len(bad) > 0 {
		return s, fmt.Errorf("%s:\n  %v", path, bad)
	}
	return s, nil
}

// seaCenters is each zone's water tile nearest its centroid.
func seaCenters(lists tileLists, zones []int, w int) map[int]int {
	out := map[int]int{}
	for _, z := range zones {
		out[z] = nearestCentroid(lists.of(z), w)
	}
	return out
}

// waterPairs counts the 4-neighbour water tile pairs between zones, by pair
// (a < b), lakes included.
func waterPairs(ids []uint16, w, h int) map[int64]int {
	out := map[int64]int{}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			t := y*w + x
			p := ids[t]
			if p <= seaZoneBase {
				continue
			}
			if x+1 < w {
				if q := ids[t+1]; q > seaZoneBase && q != p {
					out[pairKey(int(p), int(q))]++
				}
			}
			if y+1 < h {
				if q := ids[t+w]; q > seaZoneBase && q != p {
					out[pairKey(int(p), int(q))]++
				}
			}
		}
	}
	return out
}

// dateLinePairs counts, by zone pair, the rows whose first and last tiles
// are water of two different zones.
func dateLinePairs(ids []uint16, w, h int) map[int64]int {
	out := map[int64]int{}
	for y := 0; y < h; y++ {
		a, b := ids[y*w], ids[y*w+w-1]
		if a > seaZoneBase && b > seaZoneBase && a != b {
			out[pairKey(int(a), int(b))]++
		}
	}
	return out
}

// SeaGraph is what buildSeaGraph prints.
type SeaGraph struct {
	Edges    []SeaEdge
	Straits  []Strait
	Centers  map[int]int
	DateLine []SeaEdge
	Hand     []string // the hand straits and canals, as found
}

// buildSeaGraph makes the sea edges (P4 spec §3.3): zones with
// minSeaPairs water tile pairs or more, kind water; the hand straits and
// canals mark the water edge of their pair, or add one; zones meeting across
// the date line in minSeaPairs rows or more get a date-line edge (unless
// water already joins them). Lakes get none. km is the great-circle
// distance between the zones' centres. byName resolves shore regions.
func buildSeaGraph(p Projection, ids []uint16, lists tileLists, zones []*Region, tbl StraitTables, byName map[string]int) (SeaGraph, error) {
	w, h := p.Width, p.Height
	lake := map[int]bool{}
	var zoneIDs []int
	for _, z := range zones {
		zoneIDs = append(zoneIDs, z.ID)
		lake[z.ID] = z.Lake
	}
	g := SeaGraph{Centers: seaCenters(lists, zoneIDs, w)}
	km := func(a, b int) int { return tileKm(p, g.Centers[a], g.Centers[b]) }
	kind := map[int64]int{}
	for k, c := range waterPairs(ids, w, h) {
		a, b := int(k>>16), int(k&0xffff)
		if c >= minSeaPairs && !lake[a] && !lake[b] {
			kind[k] = seaKindWater
		}
	}
	var bad []string
	for _, r := range tbl.Sea {
		if g.Centers[r.A] < 0 || g.Centers[r.B] < 0 || lake[r.A] || lake[r.B] {
			bad = append(bad, fmt.Sprintf("%s: zones %d, %d", r.ID, r.A, r.B))
			continue
		}
		k := pairKey(r.A, r.B)
		was := "added"
		if _, ok := kind[k]; ok {
			was = "on water"
		}
		kind[k] = seaKindStrait
		if r.Kind == "canal" {
			kind[k] = seaKindCanal
		}
		st := Strait{ID: r.ID, Kind: r.Kind, A: min(r.A, r.B), B: max(r.A, r.B)}
		for _, name := range r.Shore {
			id, ok := byName[name]
			if !ok {
				bad = append(bad, fmt.Sprintf("%s: no region %q", r.ID, name))
				continue
			}
			st.Shore = append(st.Shore, id)
		}
		sort.Ints(st.Shore)
		g.Straits = append(g.Straits, st)
		g.Hand = append(g.Hand, fmt.Sprintf("%s (%s) %d–%d %s", r.ID, r.Kind, st.A, st.B, was))
	}
	if len(bad) > 0 {
		return g, fmt.Errorf("straits1936.json:\n  %s", strings.Join(bad, "\n  "))
	}
	for k, c := range dateLinePairs(ids, w, h) {
		a, b := int(k>>16), int(k&0xffff)
		if c < minSeaPairs || lake[a] || lake[b] {
			continue
		}
		if _, ok := kind[k]; ok {
			continue
		}
		kind[k] = seaKindDateLine
	}
	keys := make([]int64, 0, len(kind))
	for k := range kind {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(a, b int) bool { return keys[a] < keys[b] })
	for _, k := range keys {
		e := SeaEdge{A: int(k >> 16), B: int(k & 0xffff), Kind: kind[k]}
		e.Km = km(e.A, e.B)
		g.Edges = append(g.Edges, e)
		if e.Kind == seaKindDateLine {
			g.DateLine = append(g.DateLine, e)
		}
	}
	return g, nil
}
