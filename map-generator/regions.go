package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"image/png"
	"os"
	"path/filepath"
	"sort"
)

// World War 1936 scenario maps (info.json "ww1936": true). The map's region
// raster and region list come from scenarios/<map>/ (drawn by
// cmd/ww1936build); this file fixes them to the terrain the generator kept
// and writes regions.bin and scenario.json next to map.bin. See
// docs/superpowers/specs/2026-10-19-world-war-1936-design.md §4 and, for
// version 4 (the strategic regions, harbours and start bases), P4 spec
// §3.4–3.6, §6.4 and §12.1; for version 5 (coal, uranium, hydro, landmarks
// and dams), P6 spec §16.1–§16.4.

const (
	// Land regions are 1..seaZoneBase-1, sea zones seaZoneBase+1..65535.
	seaZoneBase = 40000
	// Pieces of a region smaller than this many tiles join a neighbour.
	minRegionFragment = 20
	// packTerrain's byte for impassable terrain.
	impassableByte = 0b10011111
)

func packedIsLand(b byte) bool  { return b&0x80 != 0 && b != impassableByte }
func packedIsWater(b byte) bool { return b&0x80 == 0 }

// forNeighbours4 calls fn for the orthogonal neighbours of tile i of a
// row-major grid of width w and n tiles: up, left, right, down.
func forNeighbours4(i, w, n int, fn func(j int)) {
	x := i % w
	if i >= w {
		fn(i - w)
	}
	if x > 0 {
		fn(i - 1)
	}
	if x < w-1 {
		fn(i + 1)
	}
	if i+w < n {
		fn(i + w)
	}
}

// decodeRegionIDs reads a region raster (id = R<<8 | G; 0 = none) cropped to
// width x height like the terrain.
func decodeRegionIDs(path string, width, height int) ([]uint16, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	b := img.Bounds()
	if b.Dx() < width || b.Dy() < height {
		return nil, fmt.Errorf("%s is %dx%d, the map %dx%d", path, b.Dx(), b.Dy(), width, height)
	}
	ids := make([]uint16, width*height)
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, _, _ := img.At(b.Min.X+x, b.Min.Y+y).RGBA()
			ids[y*width+x] = uint16((r>>8)<<8 | (g >> 8))
		}
	}
	return ids, nil
}

// finalizeRegions gives every land tile a land region and every water tile a
// sea zone on the terrain as packed (after small islands and lakes went):
// tiles without one take their nearest neighbour's (4-neighbour BFS, seeds in
// tile order), water bodies no zone reaches get new zones in tile order, and
// pieces under minRegionFragment tiles join the neighbour they share the
// longest edge with. owner gives each land region's 1936 owner: a land piece
// joins only a region of its own owner and stays when it has none beside it
// (Gibraltar, Hong Kong), so merging never moves land between countries. A
// nil owner treats all land regions as one owner. The regions in island (the
// kept and stamped islands, P4 spec §3.2) neither join a neighbour nor take
// a piece, whatever their size. cmd/ww1936build/land.go finalMap repeats
// this on the tool's raster: keep the two in step.
func finalizeRegions(packed []byte, raw []uint16, w, h int, owner map[uint16]string, island map[uint16]bool) ([]uint16, error) {
	n := w * h
	if len(packed) != n || len(raw) != n {
		return nil, fmt.Errorf("regions: %d terrain bytes, %d ids, %dx%d map", len(packed), len(raw), w, h)
	}
	isLand := func(i int) bool { return packedIsLand(packed[i]) }
	isWater := func(i int) bool { return packedIsWater(packed[i]) }
	ids := make([]uint16, n)
	for i := 0; i < n; i++ {
		id := raw[i]
		switch {
		case packed[i] == impassableByte:
		case isLand(i):
			if id >= 1 && id < seaZoneBase {
				ids[i] = id
			}
		default:
			if id > seaZoneBase {
				ids[i] = id
			}
		}
	}
	floodFill(ids, w, n, isLand)
	floodFill(ids, w, n, isWater)

	next := seaZoneBase + 1
	for i := 0; i < n; i++ {
		if isWater(i) && int(ids[i]) >= next {
			next = int(ids[i]) + 1
		}
	}
	for i := 0; i < n; i++ {
		if !isWater(i) || ids[i] != 0 {
			continue
		}
		if next > 0xffff {
			return nil, fmt.Errorf("regions: more than %d sea zones", 0xffff-seaZoneBase)
		}
		fillComponent(ids, w, n, i, uint16(next), isWater)
		next++
	}
	for i := 0; i < n; i++ {
		if isLand(i) && ids[i] == 0 {
			return nil, fmt.Errorf("regions: land tile (%d,%d) has no region and touches none", i%w, i/w)
		}
	}
	sameOwner := func(a, b uint16) bool { return owner[a] == owner[b] }
	anyZone := func(a, b uint16) bool { return true }
	for pass := 0; pass < 4; pass++ {
		changed := mergeFragments(ids, w, n, isLand, sameOwner, island)
		changed = mergeFragments(ids, w, n, isWater, anyZone, island) || changed
		if !changed {
			break
		}
	}
	return ids, nil
}

// floodFill spreads ids into tiles of the same kind that have none.
func floodFill(ids []uint16, w, n int, kind func(int) bool) {
	queue := make([]int32, 0, 1024)
	for i := 0; i < n; i++ {
		if kind(i) && ids[i] != 0 {
			queue = append(queue, int32(i))
		}
	}
	for head := 0; head < len(queue); head++ {
		i := int(queue[head])
		forNeighbours4(i, w, n, func(j int) {
			if ids[j] == 0 && kind(j) {
				ids[j] = ids[i]
				queue = append(queue, int32(j))
			}
		})
	}
}

// fillComponent gives id to the id-less tiles of one kind connected to start.
func fillComponent(ids []uint16, w, n, start int, id uint16, kind func(int) bool) {
	ids[start] = id
	queue := []int32{int32(start)}
	for head := 0; head < len(queue); head++ {
		forNeighbours4(int(queue[head]), w, n, func(j int) {
			if ids[j] == 0 && kind(j) {
				ids[j] = id
				queue = append(queue, int32(j))
			}
		})
	}
}

// mergeFragments hands every connected piece of a region smaller than
// minRegionFragment tiles to the neighbouring region of the same kind it
// shares the longest edge with among those join allows (ties: the smaller
// id). A piece with no such neighbour (a small island, an exclave) keeps its
// id, and so does a piece of an island region, which takes none either.
// Reports whether anything changed.
func mergeFragments(ids []uint16, w, n int, kind func(int) bool, join func(own, other uint16) bool, island map[uint16]bool) bool {
	comp := make([]int32, n)
	var pieces [][]int32
	for i := 0; i < n; i++ {
		if comp[i] != 0 || ids[i] == 0 || !kind(i) {
			continue
		}
		c := int32(len(pieces) + 1)
		comp[i] = c
		tiles := []int32{int32(i)}
		for head := 0; head < len(tiles); head++ {
			t := int(tiles[head])
			forNeighbours4(t, w, n, func(j int) {
				if comp[j] == 0 && ids[j] == ids[t] && kind(j) {
					comp[j] = c
					tiles = append(tiles, int32(j))
				}
			})
		}
		pieces = append(pieces, tiles)
	}
	changed := false
	for _, tiles := range pieces {
		if len(tiles) >= minRegionFragment {
			continue
		}
		own := ids[tiles[0]]
		if island[own] {
			continue
		}
		edges := map[uint16]int{}
		for _, t := range tiles {
			forNeighbours4(int(t), w, n, func(j int) {
				if ids[j] != own && ids[j] != 0 && kind(j) && !island[ids[j]] && join(own, ids[j]) {
					edges[ids[j]]++
				}
			})
		}
		best, bestN := uint16(0), 0
		for id, k := range edges {
			if k > bestN || (k == bestN && id < best) {
				best, bestN = id, k
			}
		}
		if best == 0 {
			continue
		}
		for _, t := range tiles {
			ids[t] = best
		}
		changed = true
	}
	return changed
}

// encodeRegionsRLE writes regions.bin (spec §4.7): "RGN1", u32 width, u32
// height, u32 run count, then (uvarint length, uvarint id) runs.
func encodeRegionsRLE(ids []uint16, w, h int) []byte {
	var body []byte
	runs := 0
	for i := 0; i < len(ids); {
		j := i + 1
		for j < len(ids) && ids[j] == ids[i] {
			j++
		}
		body = binary.AppendUvarint(body, uint64(j-i))
		body = binary.AppendUvarint(body, uint64(ids[i]))
		runs++
		i = j
	}
	out := make([]byte, 16, 16+len(body))
	copy(out, "RGN1")
	binary.LittleEndian.PutUint32(out[4:], uint32(w))
	binary.LittleEndian.PutUint32(out[8:], uint32(h))
	binary.LittleEndian.PutUint32(out[12:], uint32(runs))
	return append(out, body...)
}

// scenario.src.json as cmd/ww1936build writes it. Dev (version 3) is the
// country's industrialisation from economy1936.json (P2 spec §6.4).
type srcCountry struct {
	Tag     string `json:"tag"`
	Capital [2]int `json:"capital"`
	Dev     int    `json:"dev,omitempty"`
}

type srcRegion struct {
	ID     int     `json:"id"`
	Name   string  `json:"name"`
	NameKo string  `json:"nameKo"`
	Owner  string  `json:"owner"`
	VP     int     `json:"vp"`
	VPTile *[2]int `json:"vpTile,omitempty"`
	Economy
	LandGraph
	// Port is a hand harbour (a kept island's, islands1936.json); the
	// formula of buildScenario adds the rest.
	Port   bool   `json:"port,omitempty"`
	Island string `json:"island,omitempty"`
	// Version 4: the land strategic region, the harbour zone the tool
	// computed (buildScenario checks it against the final tiles) and the
	// hand start levels (navalBases1936.json, coastalForts1936.json, the
	// islands); without a hand level buildScenario applies the formula.
	SR          int  `json:"sr,omitempty"`
	Harbor      int  `json:"harbor,omitempty"`
	NavalBase   *int `json:"navalBase,omitempty"`
	AirBase     *int `json:"airBase,omitempty"`
	CoastalFort *int `json:"coastalFort,omitempty"`
	// Version 5 (P6 spec §16.1): coal, uranium, hydro, landmarks and the
	// dam (cmd/ww1936build energy.go), only where there are some.
	Coal      int      `json:"coal,omitempty"`
	Uranium   int      `json:"uranium,omitempty"`
	Hydro     int      `json:"hydro,omitempty"`
	Landmarks []string `json:"landmarks,omitempty"`
	Dam       *outDam  `json:"dam,omitempty"`
}

// outDam is a region's dam (P6 spec §16.4): its id (engine-api DAMS) and the
// regions downstream of it.
type outDam struct {
	ID         string `json:"id"`
	Downstream []int  `json:"downstream"`
}

// LandGraph is a region's version 3 data (P2 spec §3.1), copied from
// scenario.src.json to scenario.json as it is. A region the tool knows the
// generator drops has none (Center nil).
type LandGraph struct {
	Land   string  `json:"land,omitempty"`
	Center *[2]int `json:"center,omitempty"`
	LatC   int     `json:"latC"`
	WCell  int     `json:"wcell"`
	Rail   int     `json:"rail"`
	Fort   int     `json:"fort"`
}

// landEdge is [a, b, border, km, river, strait] (P2 spec §3.1), seaEdge
// [a, b, km, kind] (P4 spec §3.3).
type landEdge [6]int
type seaEdge [4]int

// strait is a hand strait or canal between two sea zones and its shore
// regions (P4 spec §3.3).
type strait struct {
	ID    string `json:"id"`
	Kind  string `json:"kind"`
	A     int    `json:"a"`
	B     int    `json:"b"`
	Shore []int  `json:"shore"`
}

// Economy is a region's P1 economy (version 2; P1 spec §3.1), copied from
// scenario.src.json to scenario.json as it is, but coastal, which
// buildScenario recomputes on the final tiles.
type Economy struct {
	Cat     string `json:"cat"`
	Pop     int    `json:"pop"`
	Infra   int    `json:"infra"`
	Core    bool   `json:"core"`
	Coastal bool   `json:"coastal"`
	Civ     int    `json:"civ"`
	Mil     int    `json:"mil"`
	Dock    int    `json:"dock"`
	Res     [6]int `json:"res"`
}

// srcSea is a sea zone of scenario.src.json; version 4 adds its centre,
// latitude, weather cell and sea strategic region (0 for a lake).
type srcSea struct {
	ID     int     `json:"id"`
	Name   string  `json:"name"`
	NameKo string  `json:"nameKo"`
	Lake   bool    `json:"lake,omitempty"`
	Center *[2]int `json:"center,omitempty"`
	LatC   int     `json:"latC,omitempty"`
	WCell  int     `json:"wcell,omitempty"`
	SR     int     `json:"sr,omitempty"`
}

// strategicRegion is a strategic region (P4 spec §3.4): members are land
// region ids or sea zone ids, ascending.
type strategicRegion struct {
	ID      int    `json:"id"`
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	NameKo  string `json:"nameKo"`
	Center  [2]int `json:"center"`
	LatC    int    `json:"latC"`
	Members []int  `json:"members"`
}

// rowTable is P4 plan decision 9: per map row, the centre latitude in
// hundredths of a degree and one tile's east-west km × 1000.
type rowTable struct {
	LatC     []int `json:"latC"`
	KmxMilli []int `json:"kmxMilli"`
}

// scenarioSrc: KeepIslands are the kept islands' points, the land bodies
// near which removeSmallIslands keeps (map_generator.go). Version 4 adds
// the strategic regions, the row table and the major powers (for the air
// base and anti-air formulas); a file without strategic regions writes no
// version 4 fields.
type scenarioSrc struct {
	Version       int               `json:"version"`
	Countries     []srcCountry      `json:"countries"`
	Regions       []srcRegion       `json:"regions"`
	SeaZones      []srcSea          `json:"seaZones"`
	Edges         []landEdge        `json:"edges,omitempty"`
	SeaEdges      []seaEdge         `json:"seaEdges,omitempty"`
	Straits       []strait          `json:"straits,omitempty"`
	HistoricalOob bool              `json:"historicalOob,omitempty"`
	KeepIslands   [][2]int          `json:"keepIslands,omitempty"`
	Strategic     []strategicRegion `json:"strategic,omitempty"`
	Rows          *rowTable         `json:"rows,omitempty"`
	Majors        []string          `json:"majors,omitempty"`
}

// scenario.json (engine-api ScenarioDataSchema).
type outRegion struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	NameKo  string `json:"nameKo"`
	Owner   string `json:"owner"`
	VP      int    `json:"vp"`
	VPTile  [2]int `json:"vpTile"`
	Tiles   int    `json:"tiles"`
	Terrain string `json:"terrain"`
	Economy
	outLand
	*outV4
	*outV5
}

// outV5 is a region's version 5 data in scenario.json (P6 spec §16.1): coal,
// uranium and hydro on every region, the landmarks and the dam where there
// are some.
type outV5 struct {
	Coal      int      `json:"coal"`
	Uranium   int      `json:"uranium"`
	Hydro     int      `json:"hydro"`
	Landmarks []string `json:"landmarks,omitempty"`
	Dam       *outDam  `json:"dam,omitempty"`
}

// outV4 is a region's version 4 data in scenario.json (P4 spec §3.6): its
// land strategic region, harbour zone (0: not on a sea) and start levels.
type outV4 struct {
	SR          int `json:"sr"`
	Harbor      int `json:"harbor"`
	NavalBase   int `json:"navalBase"`
	AirBase     int `json:"airBase"`
	AA          int `json:"aa"`
	CoastalFort int `json:"coastalFort"`
}

// outLand is a region's version 3 data in scenario.json: the tool's land
// graph fields, and the port on the final tiles.
type outLand struct {
	Land   string `json:"land"`
	Center [2]int `json:"center"`
	LatC   int    `json:"latC"`
	WCell  int    `json:"wcell"`
	Rail   int    `json:"rail"`
	Fort   int    `json:"fort"`
	Port   bool   `json:"port"`
	Island string `json:"island,omitempty"`
}

// scenarioVersion is the scenario.src.json / scenario.json version this
// generator reads and writes (2: P1 economy fields; 3: P2 land graph and
// the P4 map fixes; 4: the P4 strategic regions, harbours, start bases and
// row table; 5: the P6 coal, uranium, hydro, landmarks and dams).
const scenarioVersion = 5

type outSea struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	NameKo string `json:"nameKo"`
	Tiles  int    `json:"tiles"`
	Lake   bool   `json:"lake,omitempty"`
	*outSeaV4
}

// outSeaV4 is a sea zone's version 4 data (P4 spec §3.6).
type outSeaV4 struct {
	Center [2]int `json:"center"`
	LatC   int    `json:"latC"`
	WCell  int    `json:"wcell"`
	SR     int    `json:"sr"`
}

type scenarioOut struct {
	Version       int               `json:"version"`
	Width         int               `json:"width"`
	Height        int               `json:"height"`
	Countries     []srcCountry      `json:"countries"`
	Regions       []outRegion       `json:"regions"`
	SeaZones      []outSea          `json:"seaZones"`
	Edges         []landEdge        `json:"edges,omitempty"`
	SeaEdges      []seaEdge         `json:"seaEdges,omitempty"`
	Straits       []strait          `json:"straits,omitempty"`
	HistoricalOob bool              `json:"historicalOob,omitempty"`
	Strategic     []strategicRegion `json:"strategic,omitempty"`
	Rows          *rowTable         `json:"rows,omitempty"`
}

// portMinVP: a coastal region with this many points or more has a port
// (P2 spec §3.1, as engine-lib ScenarioIndex.isPort reads a v2 file).
const portMinVP = 5

var terrainClasses = [3]string{"plains", "highland", "mountain"}

// regionCenters returns, per land region id, the tile farthest (in 4-steps)
// from the region's edge; ties go to the smaller tile index.
func regionCenters(ids []uint16, w, h int) map[int]int {
	n := w * h
	dist := make([]int32, n)
	queue := make([]int32, 0, 1024)
	for i := 0; i < n; i++ {
		dist[i] = -1
		id := ids[i]
		if id == 0 || id >= seaZoneBase {
			continue
		}
		x := i % w
		edge := x == 0 || x == w-1 || i < w || i >= n-w
		if !edge {
			forNeighbours4(i, w, n, func(j int) {
				if ids[j] != id {
					edge = true
				}
			})
		}
		if edge {
			dist[i] = 0
			queue = append(queue, int32(i))
		}
	}
	for head := 0; head < len(queue); head++ {
		i := int(queue[head])
		forNeighbours4(i, w, n, func(j int) {
			if dist[j] == -1 && ids[j] == ids[i] {
				dist[j] = dist[i] + 1
				queue = append(queue, int32(j))
			}
		})
	}
	best := map[int]int{}
	bestD := map[int]int32{}
	for i := 0; i < n; i++ {
		id := int(ids[i])
		if id == 0 || id >= seaZoneBase {
			continue
		}
		if d, ok := bestD[id]; !ok || dist[i] > d {
			bestD[id] = dist[i]
			best[id] = i
		}
	}
	return best
}

// buildScenario fills in tile counts, terrain classes, victory-point tiles
// and coasts (a land tile touching a sea-zone tile, on the final tiles), drops
// regions that lost every tile, and checks that every country keeps a region
// and that its capital is on its own land. A dropped region's population and
// resources go to its country's capital region (so the country totals stay
// exact); one with factories, or a dockyard off the coast, is an error.
func buildScenario(src scenarioSrc, ids []uint16, packed []byte, w, h int) (scenarioOut, []string, error) {
	n := w * h
	tiles := map[int]int{}
	terrain := map[int]*[3]int{}
	coastal := map[int]bool{}
	// ocean: the region touches a sea zone that is no lake (the colony
	// ports below go on the open sea).
	ocean := map[int]bool{}
	openSea := map[int]bool{}
	for _, s := range src.SeaZones {
		if !s.Lake {
			openSea[s.ID] = true
		}
	}
	for i := 0; i < n; i++ {
		id := int(ids[i])
		if id == 0 {
			continue
		}
		tiles[id]++
		if id < seaZoneBase {
			if !ocean[id] {
				forNeighbours4(i, w, n, func(j int) {
					if ids[j] > seaZoneBase {
						coastal[id] = true
						if openSea[int(ids[j])] {
							ocean[id] = true
						}
					}
				})
			}
			mag := int(packed[i] & 0x1f)
			class := 0
			if mag >= 20 {
				class = 2
			} else if mag >= 10 {
				class = 1
			}
			if terrain[id] == nil {
				terrain[id] = &[3]int{}
			}
			terrain[id][class]++
		}
	}
	centers := regionCenters(ids, w, h)
	out := scenarioOut{Version: scenarioVersion, Width: w, Height: h, Countries: src.Countries}
	var notes []string
	known := map[int]bool{}
	regionCount := map[string]int{}
	byID := map[int]outRegion{}
	// What dropped regions leave to their country's capital region.
	type leftover struct {
		pop int
		res [6]int
	}
	left := map[string]*leftover{}
	var lefts []string // owners in the order they first left something
	for _, r := range src.Regions {
		known[r.ID] = true
		if tiles[r.ID] == 0 {
			if f := r.Civ + r.Mil + r.Dock; f > 0 {
				return out, notes, fmt.Errorf("region %d %q (%s) lost every tile but has %d factories: give it none in cmd/ww1936build", r.ID, r.Name, r.Owner, f)
			}
			if r.Coal+r.Uranium+r.Hydro > 0 || len(r.Landmarks) > 0 || r.Dam != nil {
				return out, notes, fmt.Errorf("region %d %q (%s) lost every tile but has version 5 data: give it none in cmd/ww1936build", r.ID, r.Name, r.Owner)
			}
			note := fmt.Sprintf("region %d %q (%s) lost every tile", r.ID, r.Name, r.Owner)
			if r.Pop > 0 || r.Res != [6]int{} {
				l := left[r.Owner]
				if l == nil {
					l = &leftover{}
					left[r.Owner] = l
					lefts = append(lefts, r.Owner)
				}
				l.pop += r.Pop
				for k, v := range r.Res {
					l.res[k] += v
				}
				note += fmt.Sprintf("; its population %d and resources %v go to the capital region", r.Pop, r.Res)
			}
			notes = append(notes, note)
			continue
		}
		var vpTile [2]int
		if v := r.VPTile; v != nil && v[0] >= 0 && v[0] < w && v[1] >= 0 && v[1] < h && int(ids[v[1]*w+v[0]]) == r.ID {
			vpTile = *v
		} else {
			c := centers[r.ID]
			vpTile = [2]int{c % w, c / w}
		}
		t := terrain[r.ID]
		class := 0
		for k := 1; k < 3; k++ {
			if t[k] > t[class] {
				class = k
			}
		}
		o := outRegion{ID: r.ID, Name: r.Name, NameKo: r.NameKo, Owner: r.Owner, VP: r.VP, VPTile: vpTile, Tiles: tiles[r.ID], Terrain: terrainClasses[class], Economy: r.Economy}
		o.Coastal = coastal[r.ID]
		o.outLand = outLand{Land: r.Land, Center: vpTile, LatC: r.LatC, WCell: r.WCell, Rail: r.Rail, Fort: r.Fort, Island: r.Island}
		if o.Land == "" {
			o.Land = landOfClass[class]
		}
		if c := r.Center; c != nil {
			if c[0] < 0 || c[0] >= w || c[1] < 0 || c[1] >= h || int(ids[c[1]*w+c[0]]) != r.ID {
				return out, notes, fmt.Errorf("region %d %q (%s): its center %v is not one of its tiles on the final map", r.ID, r.Name, r.Owner, *c)
			}
			o.Center = *c
		}
		if o.Dock > 0 && !o.Coastal {
			return out, notes, fmt.Errorf("region %d %q (%s) has %d dockyards but no coast on the final map", r.ID, r.Name, r.Owner, o.Dock)
		}
		out.Regions = append(out.Regions, o)
		byID[r.ID] = o
		regionCount[r.Owner]++
	}
	for id := range tiles {
		if id < seaZoneBase && !known[id] {
			return out, notes, fmt.Errorf("region id %d is on the map but not in scenario.src.json", id)
		}
	}
	for _, c := range src.Countries {
		if regionCount[c.Tag] == 0 {
			return out, notes, fmt.Errorf("country %s has no region left", c.Tag)
		}
		x, y := c.Capital[0], c.Capital[1]
		if x < 0 || x >= w || y < 0 || y >= h {
			return out, notes, fmt.Errorf("capital of %s is off the map", c.Tag)
		}
		r, ok := byID[int(ids[y*w+x])]
		if !ok || r.Owner != c.Tag {
			return out, notes, fmt.Errorf("capital of %s at (%d,%d) is not on its own land", c.Tag, x, y)
		}
	}
	capitalOf := map[string]int{}
	for _, c := range src.Countries {
		capitalOf[c.Tag] = int(ids[c.Capital[1]*w+c.Capital[0]])
	}
	for _, tag := range lefts {
		l := left[tag]
		for i := range out.Regions {
			if r := &out.Regions[i]; r.ID == capitalOf[tag] {
				r.Pop += l.pop
				for k, v := range l.res {
					r.Res[k] += v
				}
			}
		}
	}
	capCapitalVP(out.Regions, src.Countries, ids, w)
	handPort := map[int]bool{}
	for _, r := range src.Regions {
		handPort[r.ID] = r.Port
	}
	for i := range out.Regions {
		r := &out.Regions[i]
		r.Port = r.Coastal && (r.Dock >= 1 || r.VP >= portMinVP || handPort[r.ID])
	}
	seaKnown := map[int]bool{}
	for _, s := range src.SeaZones {
		seaKnown[s.ID] = true
		if tiles[s.ID] == 0 {
			continue
		}
		out.SeaZones = append(out.SeaZones, outSea{ID: s.ID, Name: s.Name, NameKo: s.NameKo, Tiles: tiles[s.ID], Lake: s.Lake})
	}
	for id, k := range tiles {
		if id > seaZoneBase && !seaKnown[id] {
			out.SeaZones = append(out.SeaZones, outSea{ID: id, Name: "Lake", NameKo: "호수", Tiles: k})
		}
	}
	sort.Slice(out.Regions, func(a, b int) bool { return out.Regions[a].ID < out.Regions[b].ID })
	sort.Slice(out.SeaZones, func(a, b int) bool { return out.SeaZones[a].ID < out.SeaZones[b].ID })
	graphNotes, err := copyGraphs(src, &out, ids, w, h, byID, tiles)
	notes = append(notes, graphNotes...)
	if err != nil {
		return out, notes, err
	}
	// The colony ports first (P2 Task 11): buildV4's naval-base formula
	// reads the ports (P4 pre-flight, map chain).
	if src.Edges != nil {
		notes = append(notes, colonyPorts(&out, ocean)...)
	}
	if src.Strategic != nil {
		if err := buildV4(src, &out, ids, w, h); err != nil {
			return out, notes, err
		}
		if err := buildV5(src, &out); err != nil {
			return out, notes, err
		}
	}
	return out, notes, nil
}

// colonyPorts gives a port to every set of a country's regions joined by
// land (edges, no straits) that touches the open sea but has none: the one
// of its regions on the open sea with the most points, then the most
// people, then the smaller id. P2 Task 11 (controller ruling 2): a colony
// or an island without a port got no sea hub and no sea move at all
// (Eritrea, Italian Somaliland and Libya held Italy's East African and
// Libyan armies "encircled" from the first day). Each port it adds is a
// note.
func colonyPorts(out *scenarioOut, ocean map[int]bool) []string {
	index := map[int]int{}
	for i, r := range out.Regions {
		index[r.ID] = i
	}
	adj := map[int][]int{}
	for _, e := range out.Edges {
		if e[5] != 0 {
			continue
		}
		a, b := e[0], e[1]
		if out.Regions[index[a]].Owner != out.Regions[index[b]].Owner {
			continue
		}
		adj[a] = append(adj[a], b)
		adj[b] = append(adj[b], a)
	}
	var notes []string
	seen := map[int]bool{}
	for _, r := range out.Regions {
		if seen[r.ID] {
			continue
		}
		seen[r.ID] = true
		set := []int{r.ID}
		for k := 0; k < len(set); k++ {
			for _, v := range adj[set[k]] {
				if !seen[v] {
					seen[v] = true
					set = append(set, v)
				}
			}
		}
		best := -1
		hasPort := false
		for _, id := range set {
			c := out.Regions[index[id]]
			if c.Port {
				hasPort = true
				break
			}
			if !c.Coastal || !ocean[id] {
				continue
			}
			if best < 0 {
				best = id
				continue
			}
			b := out.Regions[index[best]]
			if c.VP > b.VP || (c.VP == b.VP && (c.Pop > b.Pop || (c.Pop == b.Pop && id < best))) {
				best = id
			}
		}
		if hasPort || best < 0 {
			continue
		}
		p := &out.Regions[index[best]]
		p.Port = true
		notes = append(notes, fmt.Sprintf("port added: region %d %q (%s), the only port of its %d region(s)", p.ID, p.Name, p.Owner, len(set)))
	}
	return notes
}

// buildV5 writes the version 5 fields (P6 spec §16.1, cmd/ww1936build
// energy.go): every region's coal, uranium and hydro (0 when none), the
// landmarks and dams where the tool put them. It checks what the engine
// reads: the bounds (coal 0..8, uranium and hydro 0..6, two landmarks, three
// downstream regions), each landmark and dam once, and every downstream
// region on the map, not the dam's own, and joined by a land edge to the
// dam's region or an earlier downstream region.
func buildV5(src scenarioSrc, out *scenarioOut) error {
	srcRegionOf := map[int]srcRegion{}
	for _, r := range src.Regions {
		srcRegionOf[r.ID] = r
	}
	onMap := map[int]bool{}
	for _, r := range out.Regions {
		onMap[r.ID] = true
	}
	touch := map[[2]int]bool{}
	for _, e := range out.Edges {
		touch[[2]int{e[0], e[1]}], touch[[2]int{e[1], e[0]}] = true, true
	}
	seen := map[string]bool{}
	for i := range out.Regions {
		r := &out.Regions[i]
		s := srcRegionOf[r.ID]
		if s.Coal < 0 || s.Coal > 8 || s.Uranium < 0 || s.Uranium > 6 || s.Hydro < 0 || s.Hydro > 6 || len(s.Landmarks) > 2 {
			return fmt.Errorf("region %d %q: coal %d, uranium %d, hydro %d, %d landmarks out of bounds", r.ID, r.Name, s.Coal, s.Uranium, s.Hydro, len(s.Landmarks))
		}
		v := &outV5{Coal: s.Coal, Uranium: s.Uranium, Hydro: s.Hydro, Landmarks: s.Landmarks, Dam: s.Dam}
		for _, l := range s.Landmarks {
			if seen[l] {
				return fmt.Errorf("landmark %s twice", l)
			}
			seen[l] = true
		}
		if d := s.Dam; d != nil {
			if seen[d.ID] || len(d.Downstream) > 3 {
				return fmt.Errorf("dam %s twice or with %d downstream regions", d.ID, len(d.Downstream))
			}
			seen[d.ID] = true
			chain := []int{r.ID}
			for _, down := range d.Downstream {
				joined := false
				for _, c := range chain {
					if c == down {
						return fmt.Errorf("dam %s: downstream region %d twice or its own", d.ID, down)
					}
					joined = joined || touch[[2]int{c, down}]
				}
				if !onMap[down] || !joined {
					return fmt.Errorf("dam %s: downstream region %d is off the map or touches neither the dam's region nor an earlier downstream region", d.ID, down)
				}
				chain = append(chain, down)
			}
		}
		r.outV5 = v
	}
	return nil
}

// harborZones gives each land region its harbour zone (P4 spec §3.5): of
// the sea zones that are not lakes its tiles touch (4-neighbour), the one
// with the most tile pairs, ties to the smaller id. A region on no sea is
// missing. cmd/ww1936build strategic.go harbors computes the same on the
// tool's tiles: keep the two in step.
func harborZones(ids []uint16, w, h int, lake map[int]bool) map[int]int {
	n := w * h
	count := map[int64]int{}
	for i := 0; i < n; i++ {
		a := int(ids[i])
		if a == 0 || a >= seaZoneBase {
			continue
		}
		forNeighbours4(i, w, n, func(j int) {
			z := int(ids[j])
			if z > seaZoneBase && !lake[z] {
				count[int64(a)<<16|int64(z)]++
			}
		})
	}
	keys := make([]int64, 0, len(count))
	for k := range count {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(a, b int) bool { return keys[a] < keys[b] })
	out := map[int]int{}
	best := map[int]int{}
	for _, k := range keys {
		r, z, c := int(k>>16), int(k&0xffff), count[k]
		if c > best[r] {
			out[r], best[r] = z, c
		}
	}
	return out
}

// startAirBase is P4 spec §12.1's air base start level (plan decision 6,
// engine-lib ScenarioIndex.startAirBase without a version 4 field): a major's
// capital 5, a major's region of 10 points or more 3, of 5 or more 1;
// another country's capital 3 at dev 3 or more, else 1, its regions of 10
// points or more 1. The islands' hand levels come before it.
func startAirBase(major, capital bool, dev, vp int) int {
	switch {
	case major && capital:
		return 5
	case major && vp >= 10:
		return 3
	case major && vp >= 5:
		return 1
	case major:
		return 0
	case capital && dev >= 3:
		return 3
	case capital:
		return 1
	case vp >= 10:
		return 1
	}
	return 0
}

// startAA is P4 spec §12.1's anti-air start level: a major's capital 3, a
// major's region of 10 points or more 1, another country's capital 1 at dev
// 3 or more.
func startAA(major, capital bool, dev, vp int) int {
	switch {
	case major && capital:
		return 3
	case major && vp >= 10:
		return 1
	case !major && capital && dev >= 3:
		return 1
	}
	return 0
}

// buildV4 writes the version 4 fields (P4 spec §3.4–3.6, §6.4, §12.1): the
// harbours (the tool's, checked against the final tiles), the start levels
// (the hand ones, else the formulas: a naval base min(3, 1 + dockyards) in a
// port on a sea, the air base and anti-air of startAirBase and startAA, no
// coastal fort; a region with a naval base is a port), each sea zone's centre, latitude, weather cell and
// strategic region, the strategic regions (every region and every zone that
// is not a lake in exactly one) and the row table.
func buildV4(src scenarioSrc, out *scenarioOut, ids []uint16, w, h int) error {
	lake := map[int]bool{}
	srcZone := map[int]srcSea{}
	for _, z := range src.SeaZones {
		lake[z.ID] = z.Lake
		srcZone[z.ID] = z
	}
	for _, z := range out.SeaZones {
		if _, ok := srcZone[z.ID]; !ok {
			return fmt.Errorf("sea zone %d is on the map but not in scenario.src.json: run cmd/ww1936build", z.ID)
		}
	}
	srcRegionOf := map[int]srcRegion{}
	for _, r := range src.Regions {
		srcRegionOf[r.ID] = r
	}
	major := map[string]bool{}
	for _, tag := range src.Majors {
		major[tag] = true
	}
	dev := map[string]int{}
	capital := map[int]bool{}
	for _, c := range src.Countries {
		dev[c.Tag] = c.Dev
		capital[int(ids[c.Capital[1]*w+c.Capital[0]])] = true
	}
	harbor := harborZones(ids, w, h, lake)
	for i := range out.Regions {
		r := &out.Regions[i]
		s := srcRegionOf[r.ID]
		if s.Harbor != harbor[r.ID] {
			return fmt.Errorf("region %d %q: harbour %d in scenario.src.json, %d on the final map", r.ID, r.Name, s.Harbor, harbor[r.ID])
		}
		if s.SR == 0 {
			return fmt.Errorf("region %d %q has no strategic region", r.ID, r.Name)
		}
		v := &outV4{SR: s.SR, Harbor: harbor[r.ID]}
		switch {
		case s.NavalBase != nil:
			v.NavalBase = *s.NavalBase
		case r.Port && v.Harbor != 0:
			v.NavalBase = min(3, 1+r.Dock)
		}
		if s.AirBase != nil {
			v.AirBase = *s.AirBase
		} else {
			v.AirBase = startAirBase(major[r.Owner], capital[r.ID], dev[r.Owner], r.VP)
		}
		v.AA = startAA(major[r.Owner], capital[r.ID], dev[r.Owner], r.VP)
		if s.CoastalFort != nil {
			v.CoastalFort = *s.CoastalFort
		}
		if (v.NavalBase > 0 || v.CoastalFort > 0) && v.Harbor == 0 {
			return fmt.Errorf("region %d %q: a naval base or coastal fort but no harbour", r.ID, r.Name)
		}
		// A naval base makes a port (P4 pre-flight T2): the static port and
		// the engine's naval-base port agree at the start.
		if v.NavalBase >= 1 {
			r.Port = true
		}
		r.outV4 = v
	}
	for i := range out.SeaZones {
		z := &out.SeaZones[i]
		s := srcZone[z.ID]
		c := s.Center
		if c == nil || c[0] < 0 || c[0] >= w || c[1] < 0 || c[1] >= h || int(ids[c[1]*w+c[0]]) != z.ID {
			return fmt.Errorf("sea zone %d %q: its center is not one of its tiles on the final map", z.ID, z.Name)
		}
		if (s.SR == 0) != z.Lake {
			return fmt.Errorf("sea zone %d %q: strategic region %d, lake %v", z.ID, z.Name, s.SR, z.Lake)
		}
		z.outSeaV4 = &outSeaV4{Center: *c, LatC: s.LatC, WCell: s.WCell, SR: s.SR}
	}
	regionSR := map[int]int{}
	for _, r := range out.Regions {
		regionSR[r.ID] = r.SR
	}
	zoneSR := map[int]int{}
	for _, z := range out.SeaZones {
		zoneSR[z.ID] = z.SR
	}
	seen := map[int]bool{}
	count := map[int]int{}
	for _, s := range src.Strategic {
		if seen[s.ID] || len(s.Members) == 0 || (s.Kind != "land" && s.Kind != "sea") {
			return fmt.Errorf("strategic region %d: twice, empty, or of kind %q", s.ID, s.Kind)
		}
		seen[s.ID] = true
		of := regionSR
		if s.Kind == "sea" {
			of = zoneSR
		}
		for k, m := range s.Members {
			if k > 0 && m <= s.Members[k-1] {
				return fmt.Errorf("strategic region %d: members out of order", s.ID)
			}
			if of[m] != s.ID {
				return fmt.Errorf("strategic region %d: member %d is not on the map or is in %d", s.ID, m, of[m])
			}
			count[m]++
		}
		c := s.Center
		if c[0] < 0 || c[0] >= w || c[1] < 0 || c[1] >= h || of[int(ids[c[1]*w+c[0]])] != s.ID {
			return fmt.Errorf("strategic region %d: its center is not on one of its members", s.ID)
		}
		out.Strategic = append(out.Strategic, s)
	}
	for id, sr := range regionSR {
		if count[id] != 1 || !seen[sr] {
			return fmt.Errorf("region %d is in %d strategic regions", id, count[id])
		}
	}
	for id, sr := range zoneSR {
		if sr != 0 && (count[id] != 1 || !seen[sr]) {
			return fmt.Errorf("sea zone %d is in %d strategic regions", id, count[id])
		}
	}
	if r := src.Rows; r == nil || len(r.LatC) != h || len(r.KmxMilli) != h {
		return fmt.Errorf("the row table does not have the map's %d rows", h)
	}
	out.Rows = src.Rows
	return nil
}

var landOfClass = [3]string{"plains", "hills", "mountain"}

// copyGraphs copies the land and sea graphs of scenario.src.json (version
// 3) to scenario.json. An edge or a strait shore of a region the cleanup
// dropped goes (with a note), and so does a sea edge of a zone without
// tiles. The tool computed the land borders on its copy of the cleanup
// (cmd/ww1936build land.go finalMap): every border must match the final
// tiles, every pair of touching regions must have its edge, and no strait
// may join two regions that touch, or the build fails.
func copyGraphs(src scenarioSrc, out *scenarioOut, ids []uint16, w, h int, regions map[int]outRegion, tiles map[int]int) ([]string, error) {
	out.HistoricalOob = src.HistoricalOob
	var notes []string
	if src.Edges != nil {
		count := map[[2]int]int{}
		isLand := func(id uint16) bool { return id != 0 && id < seaZoneBase }
		pair := func(a, b uint16) {
			if isLand(a) && isLand(b) && a != b {
				count[[2]int{int(min(a, b)), int(max(a, b))}]++
			}
		}
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				i := y*w + x
				if x+1 < w {
					pair(ids[i], ids[i+1])
				}
				if y+1 < h {
					pair(ids[i], ids[i+w])
				}
			}
		}
		seen := map[[2]int]bool{}
		out.Edges = []landEdge{}
		for _, e := range src.Edges {
			key := [2]int{e[0], e[1]}
			_, okA := regions[e[0]]
			_, okB := regions[e[1]]
			if !okA || !okB {
				notes = append(notes, fmt.Sprintf("edge %d-%d dropped: a region lost every tile", e[0], e[1]))
				continue
			}
			if e[0] >= e[1] || seen[key] {
				return notes, fmt.Errorf("edge %d-%d out of order or twice", e[0], e[1])
			}
			seen[key] = true
			if count[key] != e[2] {
				return notes, fmt.Errorf("edge %d-%d: border %d in scenario.src.json, %d on the final map", e[0], e[1], e[2], count[key])
			}
			out.Edges = append(out.Edges, e)
		}
		missing := 0
		for key := range count {
			if !seen[key] {
				missing++
			}
		}
		if missing > 0 {
			return notes, fmt.Errorf("%d pairs of regions touch on the final map but have no edge in scenario.src.json", missing)
		}
	}
	if src.SeaEdges != nil {
		out.SeaEdges = []seaEdge{}
		for _, e := range src.SeaEdges {
			if tiles[e[0]] == 0 || tiles[e[1]] == 0 {
				notes = append(notes, fmt.Sprintf("sea edge %d-%d dropped: a zone has no tiles", e[0], e[1]))
				continue
			}
			out.SeaEdges = append(out.SeaEdges, e)
		}
	}
	for _, st := range src.Straits {
		if tiles[st.A] == 0 || tiles[st.B] == 0 {
			return notes, fmt.Errorf("strait %s: a zone has no tiles", st.ID)
		}
		kept := st
		kept.Shore = nil
		for _, id := range st.Shore {
			if _, ok := regions[id]; ok {
				kept.Shore = append(kept.Shore, id)
			} else {
				notes = append(notes, fmt.Sprintf("strait %s: shore region %d dropped", st.ID, id))
			}
		}
		if len(kept.Shore) == 0 {
			return notes, fmt.Errorf("strait %s has no shore region left", st.ID)
		}
		out.Straits = append(out.Straits, kept)
	}
	return notes, nil
}

// readKeepIslands reads the kept islands' points from a World War 1936
// map's scenario.src.json (scenarios/<name>/), for removeSmallIslands.
func readKeepIslands(name string) ([]Coord, error) {
	data, err := os.ReadFile(filepath.Join("scenarios", name, "scenario.src.json"))
	if err != nil {
		return nil, err
	}
	var src struct {
		KeepIslands [][2]int `json:"keepIslands"`
	}
	if err := json.Unmarshal(data, &src); err != nil {
		return nil, fmt.Errorf("scenario.src.json: %w", err)
	}
	out := make([]Coord, len(src.KeepIslands))
	for k, p := range src.KeepIslands {
		out[k] = Coord{X: p[0], Y: p[1]}
	}
	return out, nil
}

// capCapitalVP keeps each country's capital region at no more than a third
// of the country's points (spec §7.5, owner decision 2026-10-20): the capital
// keeps min(its VP, max(1, floor(rest / 2))), where rest is what the
// country's other regions hold, so no single thrust to a capital ends a
// country. A country whose only points are its capital keeps 1. Runs on the
// regions left after the drop, so the final file holds to it.
func capCapitalVP(regions []outRegion, countries []srcCountry, ids []uint16, w int) {
	index := map[int]int{}
	total := map[string]int{}
	for i, r := range regions {
		index[r.ID] = i
		total[r.Owner] += r.VP
	}
	for _, c := range countries {
		i, ok := index[int(ids[c.Capital[1]*w+c.Capital[0]])]
		if !ok {
			continue
		}
		r := &regions[i]
		rest := total[c.Tag] - r.VP
		r.VP = min(r.VP, max(1, rest/2))
	}
}

// writeScenarioFiles reads scenarios/<name>/regions.png and scenario.src.json
// and writes regions.bin and scenario.json into mapDir. Returns the files to
// format with Prettier.
func writeScenarioFiles(name, mapDir string, packed []byte, w, h int) ([]string, []string, error) {
	srcDir := filepath.Join("scenarios", name)
	srcBytes, err := os.ReadFile(filepath.Join(srcDir, "scenario.src.json"))
	if err != nil {
		return nil, nil, err
	}
	var src scenarioSrc
	dec := json.NewDecoder(bytes.NewReader(srcBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&src); err != nil {
		return nil, nil, fmt.Errorf("scenario.src.json: %w", err)
	}
	if src.Version != scenarioVersion {
		return nil, nil, fmt.Errorf("scenario.src.json is version %d, not %d: run cmd/ww1936build", src.Version, scenarioVersion)
	}
	owner := make(map[uint16]string, len(src.Regions))
	island := map[uint16]bool{}
	for _, r := range src.Regions {
		owner[uint16(r.ID)] = r.Owner
		if r.Island != "" {
			island[uint16(r.ID)] = true
		}
	}
	raw, err := decodeRegionIDs(filepath.Join(srcDir, "regions.png"), w, h)
	if err != nil {
		return nil, nil, err
	}
	ids, err := finalizeRegions(packed, raw, w, h, owner, island)
	if err != nil {
		return nil, nil, err
	}
	out, notes, err := buildScenario(src, ids, packed, w, h)
	if err != nil {
		return nil, nil, err
	}
	if err := os.WriteFile(filepath.Join(mapDir, "regions.bin"), encodeRegionsRLE(ids, w, h), 0644); err != nil {
		return nil, nil, err
	}
	js, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return nil, nil, err
	}
	scenarioPath := filepath.Join(mapDir, "scenario.json")
	if err := os.WriteFile(scenarioPath, append(js, '\n'), 0644); err != nil {
		return nil, nil, err
	}
	return []string{scenarioPath}, notes, nil
}
