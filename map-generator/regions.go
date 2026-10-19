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
// docs/superpowers/specs/2026-10-19-world-war-1936-design.md §4.

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
// longest edge with.
func finalizeRegions(packed []byte, raw []uint16, w, h int) ([]uint16, error) {
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
	for pass := 0; pass < 4; pass++ {
		changed := mergeFragments(ids, w, n, isLand)
		changed = mergeFragments(ids, w, n, isWater) || changed
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
// shares the longest edge with (ties: the smaller id). A piece with no such
// neighbour (a small island) keeps its id. Reports whether anything changed.
func mergeFragments(ids []uint16, w, n int, kind func(int) bool) bool {
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
		edges := map[uint16]int{}
		for _, t := range tiles {
			forNeighbours4(int(t), w, n, func(j int) {
				if ids[j] != own && ids[j] != 0 && kind(j) {
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

// scenario.src.json as cmd/ww1936build writes it.
type srcCountry struct {
	Tag     string `json:"tag"`
	Capital [2]int `json:"capital"`
}

type srcRegion struct {
	ID     int     `json:"id"`
	Name   string  `json:"name"`
	NameKo string  `json:"nameKo"`
	Owner  string  `json:"owner"`
	VP     int     `json:"vp"`
	VPTile *[2]int `json:"vpTile,omitempty"`
}

type srcSea struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	NameKo string `json:"nameKo"`
}

type scenarioSrc struct {
	Version   int          `json:"version"`
	Countries []srcCountry `json:"countries"`
	Regions   []srcRegion  `json:"regions"`
	SeaZones  []srcSea     `json:"seaZones"`
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
}

type outSea struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	NameKo string `json:"nameKo"`
	Tiles  int    `json:"tiles"`
}

type scenarioOut struct {
	Version   int          `json:"version"`
	Width     int          `json:"width"`
	Height    int          `json:"height"`
	Countries []srcCountry `json:"countries"`
	Regions   []outRegion  `json:"regions"`
	SeaZones  []outSea     `json:"seaZones"`
}

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

// buildScenario fills in tile counts, terrain classes and victory-point
// tiles, drops regions that lost every tile, and checks that every country
// keeps a region and that its capital is on its own land.
func buildScenario(src scenarioSrc, ids []uint16, packed []byte, w, h int) (scenarioOut, []string, error) {
	n := w * h
	tiles := map[int]int{}
	terrain := map[int]*[3]int{}
	for i := 0; i < n; i++ {
		id := int(ids[i])
		if id == 0 {
			continue
		}
		tiles[id]++
		if id < seaZoneBase {
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
	out := scenarioOut{Version: 1, Width: w, Height: h, Countries: src.Countries}
	var notes []string
	known := map[int]bool{}
	regionCount := map[string]int{}
	byID := map[int]outRegion{}
	for _, r := range src.Regions {
		known[r.ID] = true
		if tiles[r.ID] == 0 {
			notes = append(notes, fmt.Sprintf("region %d %q (%s) lost every tile", r.ID, r.Name, r.Owner))
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
		o := outRegion{ID: r.ID, Name: r.Name, NameKo: r.NameKo, Owner: r.Owner, VP: r.VP, VPTile: vpTile, Tiles: tiles[r.ID], Terrain: terrainClasses[class]}
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
	seaKnown := map[int]bool{}
	for _, s := range src.SeaZones {
		seaKnown[s.ID] = true
		if tiles[s.ID] == 0 {
			continue
		}
		out.SeaZones = append(out.SeaZones, outSea{ID: s.ID, Name: s.Name, NameKo: s.NameKo, Tiles: tiles[s.ID]})
	}
	for id, k := range tiles {
		if id > seaZoneBase && !seaKnown[id] {
			out.SeaZones = append(out.SeaZones, outSea{ID: id, Name: "Lake", NameKo: "호수", Tiles: k})
		}
	}
	sort.Slice(out.Regions, func(a, b int) bool { return out.Regions[a].ID < out.Regions[b].ID })
	sort.Slice(out.SeaZones, func(a, b int) bool { return out.SeaZones[a].ID < out.SeaZones[b].ID })
	return out, notes, nil
}

// writeScenarioFiles reads scenarios/<name>/regions.png and scenario.src.json
// and writes regions.bin and scenario.json into mapDir. Returns the files to
// format with Prettier.
func writeScenarioFiles(name, mapDir string, packed []byte, w, h int) ([]string, []string, error) {
	srcDir := filepath.Join("scenarios", name)
	raw, err := decodeRegionIDs(filepath.Join(srcDir, "regions.png"), w, h)
	if err != nil {
		return nil, nil, err
	}
	ids, err := finalizeRegions(packed, raw, w, h)
	if err != nil {
		return nil, nil, err
	}
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
