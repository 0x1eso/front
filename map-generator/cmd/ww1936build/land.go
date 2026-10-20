package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"image"
	"image/png"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
)

// The land graph of scenario.json version 3 (P2 spec §3.1–3.2): region
// edges with their border, distance, river and strait, each region's
// centre, latitude, weather cell, detailed terrain, rail and forts. All of it
// is computed on the map the generator will make: finalMap repeats the
// generator's cleanup (map_generator.go removeSmallIslands and processWater,
// regions.go finalizeRegions) on the tool's raster, and the generator checks
// the borders against its own tiles (map-generator/regions.go).

const (
	// minRegionFragment is the generator's fragment size (regions.go).
	minRegionFragment = 20
	// straitWater is the most water tiles a strait crosses (P2 spec §3.2-4).
	straitWater = 6
	// riverReach is how far (Chebyshev tiles) a border pair may lie from a
	// river pixel and still count as on the river (P2 spec §3.2-3).
	riverReach = 2
	// bigRiverRank: a river of this Natural Earth scalerank or lower is big.
	bigRiverRank = 4
	// earthKm is the mean Earth radius for great-circle distances.
	earthKm = 6371.0
	// urbanMaxTiles, urbanMinTier: a region under this many tiles holding a
	// city of this tier or more is urban (P2 spec §3.2-5).
	urbanMaxTiles = 400
	urbanMinTier  = 10
	// jungleLatC: evergreen broadleaf forest within the tropics is jungle.
	jungleLatC = 2350
)

// bigRiverNames are rivers P2 spec §3.2-3 names as big that Natural Earth
// ranks above bigRiverRank (the Vistula is 5, the Don 6): they count as rank
// bigRiverRank.
var bigRiverNames = map[string]bool{"Vistula": true, "Don": true}

// LAND_TERRAINS (engine-api LandTypes.ts) the tool writes.
const (
	terPlains   = "plains"
	terForest   = "forest"
	terHills    = "hills"
	terMountain = "mountain"
	terMarsh    = "marsh"
	terJungle   = "jungle"
	terDesert   = "desert"
	terUrban    = "urban"
)

// v1Terrain maps the generator's terrain class (plains/highland/mountain)
// to the P2 terrain.
var v1Terrain = [3]string{terPlains, terHills, terMountain}

// ---- the final map ----

// finalMap repeats map-generator/regions.go finalizeRegions on the tool's
// raw ids (land region on land, sea zone on water) and the final land mask:
// tiles without an id of their kind take their nearest neighbour's, pieces
// under minRegionFragment tiles join the same-kind neighbour (land: of the
// same owner) they share the longest edge with, island regions excepted
// (they neither join nor take pieces). Keep it in step with the generator.
func finalMap(raw []uint16, land []bool, w, h int, owner map[uint16]string, island map[uint16]bool) ([]uint16, error) {
	n := w * h
	isLand := func(i int) bool { return land[i] }
	isWater := func(i int) bool { return !land[i] }
	ids := make([]uint16, n)
	for i := 0; i < n; i++ {
		id := raw[i]
		if land[i] {
			if id >= 1 && id < seaZoneBase {
				ids[i] = id
			}
		} else if id > seaZoneBase {
			ids[i] = id
		}
	}
	floodFillIDs(ids, w, n, isLand)
	floodFillIDs(ids, w, n, isWater)
	for i := 0; i < n; i++ {
		if ids[i] == 0 {
			return nil, fmt.Errorf("final map: tile (%d,%d) has no id and touches none", i%w, i/w)
		}
	}
	sameOwner := func(a, b uint16) bool { return owner[a] == owner[b] }
	anyZone := func(a, b uint16) bool { return true }
	for pass := 0; pass < 4; pass++ {
		changed := mergeFragmentIDs(ids, w, n, isLand, sameOwner, island)
		changed = mergeFragmentIDs(ids, w, n, isWater, anyZone, island) || changed
		if !changed {
			break
		}
	}
	return ids, nil
}

func floodFillIDs(ids []uint16, w, n int, kind func(int) bool) {
	queue := make([]int32, 0, 1<<16)
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

func mergeFragmentIDs(ids []uint16, w, n int, kind func(int) bool, join func(own, other uint16) bool, island map[uint16]bool) bool {
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

// ---- stable region ids ----

// idKey is a region's key in the id table: owner tag and name.
func idKey(tag, name string) string { return tag + "\x00" + name }

// loadIDTable reads the committed scenario.json: (owner, name) → id.
func loadIDTable(path string) (map[string]int, error) {
	var sc struct {
		Regions []struct {
			ID    int    `json:"id"`
			Name  string `json:"name"`
			Owner string `json:"owner"`
		} `json:"regions"`
	}
	if err := readJSON(path, &sc); err != nil {
		return nil, err
	}
	table := map[string]int{}
	for _, r := range sc.Regions {
		k := idKey(r.Owner, r.Name)
		if _, dup := table[k]; dup {
			return nil, fmt.Errorf("%s: %s %q twice", path, r.Owner, r.Name)
		}
		table[k] = r.ID
	}
	return table, nil
}

// stableIDs gives every region its id (P2 plan Task 2 Step 2): the id the
// table (the committed scenario.json) gives its owner and name; an island
// not in it the next free id after the table's largest, in islands1936.json
// order; another new region that survives the generator the next ones, in
// tool order; a region the generator drops (it never reaches scenario.json)
// the ids after all of those. Every id of the table must go to a surviving
// region: an existing region's id never changes. tags[i] is region i's
// owner tag, dropped[i] whether the generator drops it, islandOrder the
// islands' list positions. Returns the new id of each region, by index, and
// the new survivors that are not islands.
func stableIDs(regions []*Region, tags []string, dropped []bool, table map[string]int, islandOrder map[string]int) ([]int, []int, error) {
	out := make([]int, len(regions))
	used := map[int]int{} // id → region index
	next := 1
	for _, id := range table {
		next = max(next, id+1)
	}
	var bad []string
	var islands, fresh, gone []int
	for i, r := range regions {
		id, ok := table[idKey(tags[i], r.Name)]
		switch {
		case ok && !dropped[i]:
			if j, dup := used[id]; dup {
				bad = append(bad, fmt.Sprintf("id %d twice: %q and %q", id, regions[j].Name, r.Name))
			}
			used[id] = i
			out[i] = id
		case ok:
			bad = append(bad, fmt.Sprintf("region %d %s %q is in scenario.json but the generator would drop it", id, tags[i], r.Name))
		case r.Island != "":
			islands = append(islands, i)
		case !dropped[i]:
			fresh = append(fresh, i)
		default:
			gone = append(gone, i)
		}
	}
	for k, id := range table {
		if _, ok := used[id]; !ok {
			parts := strings.SplitN(k, "\x00", 2)
			bad = append(bad, fmt.Sprintf("region %d %s %q of scenario.json has no region now", id, parts[0], parts[1]))
		}
	}
	if len(bad) > 0 {
		sort.Strings(bad)
		return nil, nil, fmt.Errorf("stable ids:\n  %s", strings.Join(bad, "\n  "))
	}
	sort.SliceStable(islands, func(a, b int) bool {
		return islandOrder[regions[islands[a]].Island] < islandOrder[regions[islands[b]].Island]
	})
	for _, list := range [][]int{islands, fresh, gone} {
		for _, i := range list {
			out[i] = next
			next++
		}
	}
	newOnes := make([]int, 0, len(fresh))
	for _, i := range fresh {
		newOnes = append(newOnes, out[i])
	}
	if next >= seaZoneBase {
		return nil, nil, fmt.Errorf("stable ids: %d land ids do not fit below the sea zones", next)
	}
	return out, newOnes, nil
}

// ---- per-region tiles and centres ----

// tileLists is each id's tiles of the final map, ascending (CSR by id).
type tileLists struct {
	offsets []int32
	tiles   []int32
}

func buildTileLists(ids []uint16) tileLists {
	counts := make([]int32, 1<<16+1)
	for _, id := range ids {
		counts[int(id)+1]++
	}
	for i := 1; i < len(counts); i++ {
		counts[i] += counts[i-1]
	}
	fill := append([]int32(nil), counts[:1<<16]...)
	tiles := make([]int32, len(ids))
	for i, id := range ids {
		tiles[fill[id]] = int32(i)
		fill[id]++
	}
	return tileLists{counts, tiles}
}

func (t tileLists) of(id int) []int32 { return t.tiles[t.offsets[id]:t.offsets[id+1]] }

// nearestCentroid is the tile nearest the tiles' centroid (in tile
// coordinates; ties: the smaller tile), exact in integers. -1 for none.
func nearestCentroid(tiles []int32, w int) int {
	if len(tiles) == 0 {
		return -1
	}
	var sx, sy int64
	for _, t := range tiles {
		sx += int64(int(t) % w)
		sy += int64(int(t) / w)
	}
	k := int64(len(tiles))
	best, bestD := -1, int64(math.MaxInt64)
	for _, t := range tiles {
		dx := k*int64(int(t)%w) - sx
		dy := k*int64(int(t)/w) - sy
		if d := dx*dx + dy*dy; d < bestD {
			best, bestD = int(t), d
		}
	}
	return best
}

// greatCircleKm between two points (degrees), haversine on a sphere.
func greatCircleKm(lon1, lat1, lon2, lat2 float64) float64 {
	p1, p2 := lat1*math.Pi/180, lat2*math.Pi/180
	dp := p2 - p1
	dl := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dp/2)*math.Sin(dp/2) + math.Cos(p1)*math.Cos(p2)*math.Sin(dl/2)*math.Sin(dl/2)
	return 2 * earthKm * math.Asin(math.Min(1, math.Sqrt(a)))
}

// tileKm is the great-circle distance between two tiles' centres, rounded,
// at least 1.
func tileKm(p Projection, a, b int) int {
	lon1, lat1 := p.LonLat(a%p.Width, a/p.Width)
	lon2, lat2 := p.LonLat(b%p.Width, b/p.Width)
	return max(1, int(math.Round(greatCircleKm(lon1, lat1, lon2, lat2))))
}

// hundredths rounds degrees to hundredths.
func hundredths(deg float64) int { return int(math.Round(deg * 100)) }

func floorDiv(a, b int) int {
	q := a / b
	if (a%b != 0) && ((a < 0) != (b < 0)) {
		q--
	}
	return q
}

// weatherCell is engine-lib Weather.weatherCell: a 10°×10° cell from
// longitude and latitude in hundredths (longitude 0..359 after +180°,
// latitude cut to −60°..89°).
func weatherCell(lonC, latC int) int {
	lon := max(0, min(359, floorDiv(lonC+18000, 100)))
	lat := max(0, min(149, floorDiv(latC+6000, 100)))
	return lon/10 + 36*(lat/10)
}

// ---- edges ----

// Edge is a land edge of scenario.json: [a, b, border, km, river, strait].
type Edge struct {
	A, B, Border, Km, River, Strait int
}

func (e Edge) MarshalJSON() ([]byte, error) {
	return json.Marshal([6]int{e.A, e.B, e.Border, e.Km, e.River, e.Strait})
}

func (e *Edge) UnmarshalJSON(b []byte) error {
	var v [6]int
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	*e = Edge{v[0], v[1], v[2], v[3], v[4], v[5]}
	return nil
}

func pairKey(a, b int) int64 { return int64(min(a, b))<<16 | int64(max(a, b)) }

// borderPairs counts, per pair of land regions a < b, the 4-neighbour tile
// pairs between them, and calls each with the two tiles (right and down
// neighbours, in tile order).
func borderPairs(ids []uint16, w, h int, each func(a, b int, t1, t2 int)) map[int64]int {
	out := map[int64]int{}
	isLand := func(id uint16) bool { return id != 0 && id < seaZoneBase }
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			t := y*w + x
			p := ids[t]
			if !isLand(p) {
				continue
			}
			for _, u := range [2]int{t + 1, t + w} {
				if (u == t+1 && x+1 >= w) || u >= w*h {
					continue
				}
				q := ids[u]
				if !isLand(q) || q == p {
					continue
				}
				out[pairKey(int(p), int(q))]++
				if each != nil {
					each(int(p), int(q), t, u)
				}
			}
		}
	}
	return out
}

// landmasses labels the regions joined by land edges (union-find, the
// smallest id is a mass's label).
func landmasses(regionIDs []int, borders map[int64]int) map[int]int {
	parent := map[int]int{}
	for _, id := range regionIDs {
		parent[id] = id
	}
	var find func(int) int
	find = func(a int) int {
		for parent[a] != a {
			parent[a] = parent[parent[a]]
			a = parent[a]
		}
		return a
	}
	keys := make([]int64, 0, len(borders))
	for k := range borders {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(a, b int) bool { return keys[a] < keys[b] })
	for _, k := range keys {
		a, b := find(int(k>>16)), find(int(k&0xffff))
		if a != b {
			parent[max(a, b)] = min(a, b)
		}
	}
	out := map[int]int{}
	for _, id := range regionIDs {
		out[id] = find(id)
	}
	return out
}

// straitPairs finds the pairs of land regions that touch by no land edge
// but lie within straitWater water tiles of each other (a 4-neighbour path
// from a tile of the one to a tile of the other crossing at most that many
// water tiles), with the fewest water tiles crossed.
func straitPairs(ids []uint16, w, h int, lists tileLists, regionIDs []int, borders map[int64]int) map[int64]int {
	n := w * h
	isWater := func(i int) bool { return ids[i] > seaZoneBase }
	stamp := make([]int32, n)
	depth := make([]uint8, n)
	out := map[int64]int{}
	queue := make([]int32, 0, 1<<12)
	for k, a := range regionIDs {
		mark := int32(k + 1)
		queue = queue[:0]
		for _, t := range lists.of(a) {
			forNeighbours4(int(t), w, n, func(j int) {
				if isWater(j) && stamp[j] != mark {
					stamp[j] = mark
					depth[j] = 1
					queue = append(queue, int32(j))
				}
			})
		}
		for head := 0; head < len(queue); head++ {
			i := int(queue[head])
			d := depth[i]
			forNeighbours4(i, w, n, func(j int) {
				if isWater(j) {
					if d < straitWater && stamp[j] != mark {
						stamp[j] = mark
						depth[j] = d + 1
						queue = append(queue, int32(j))
					}
					return
				}
				b := int(ids[j])
				if b == 0 || b == a {
					return
				}
				key := pairKey(a, b)
				if borders[key] > 0 {
					return
				}
				if old, ok := out[key]; !ok || int(d) < old {
					out[key] = int(d)
				}
			})
		}
	}
	return out
}

// ---- rivers ----

// riverLine is a Natural Earth river (or lake centre) line: its rank for
// the big-river test and its parts as [lon, lat] points.
type riverLine struct {
	Name  string
	Rank  int
	Parts [][][2]float64
}

// readRivers reads ne_10m_rivers_lake_centerlines (LineString and
// MultiLineString features).
func readRivers(path string) ([]riverLine, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var fc struct {
		Features []struct {
			Properties struct {
				Name      string  `json:"name"`
				Scalerank float64 `json:"scalerank"`
			} `json:"properties"`
			Geometry *struct {
				Type        string          `json:"type"`
				Coordinates json.RawMessage `json:"coordinates"`
			} `json:"geometry"`
		} `json:"features"`
	}
	if err := json.Unmarshal(data, &fc); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	var out []riverLine
	for _, f := range fc.Features {
		if f.Geometry == nil {
			continue
		}
		line := riverLine{Name: f.Properties.Name, Rank: int(f.Properties.Scalerank)}
		if bigRiverNames[line.Name] {
			line.Rank = min(line.Rank, bigRiverRank)
		}
		switch f.Geometry.Type {
		case "LineString":
			var c [][2]float64
			if err := json.Unmarshal(f.Geometry.Coordinates, &c); err != nil {
				return nil, fmt.Errorf("%s: %w", path, err)
			}
			line.Parts = [][][2]float64{c}
		case "MultiLineString":
			if err := json.Unmarshal(f.Geometry.Coordinates, &line.Parts); err != nil {
				return nil, fmt.Errorf("%s: %w", path, err)
			}
		default:
			continue
		}
		out = append(out, line)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("%s: no river lines", path)
	}
	return out, nil
}

// noRiver is the rank of a pixel without a river.
const noRiver = 255

// rasterRivers marks each pixel a river line crosses with the smallest rank
// of the lines there, and the index of the first line of that rank: each
// segment, in order, sampled every quarter pixel.
func rasterRivers(p Projection, lines []riverLine) ([]uint8, []int32) {
	w, h := p.Width, p.Height
	rank := make([]uint8, w*h)
	who := make([]int32, w*h)
	for i := range rank {
		rank[i], who[i] = noRiver, -1
	}
	for k, l := range lines {
		r := uint8(min(l.Rank, noRiver-1))
		for _, part := range l.Parts {
			for s := 0; s+1 < len(part); s++ {
				a, b := part[s], part[s+1]
				if math.Abs(a[0]-b[0]) > 180 {
					continue // across the date line
				}
				ax, ay := p.ToPixel(a[0], a[1])
				bx, by := p.ToPixel(b[0], b[1])
				steps := int(math.Ceil(math.Max(math.Abs(bx-ax), math.Abs(by-ay))*4)) + 1
				for q := 0; q <= steps; q++ {
					t := float64(q) / float64(steps)
					x, y := int(math.Floor(ax+t*(bx-ax))), int(math.Floor(ay+t*(by-ay)))
					if x < 0 || y < 0 || x >= w || y >= h {
						continue
					}
					if i := y*w + x; r < rank[i] {
						rank[i], who[i] = r, int32(k)
					}
				}
			}
		}
	}
	return rank, who
}

// spreadMin is, for each pixel, the smallest value within reach
// (Chebyshev) and the id carried with it (ties: the smaller id).
func spreadMin(v []uint8, id []int32, w, h, reach int) ([]uint8, []int32) {
	pass := func(src []uint8, sid []int32, horizontal bool) ([]uint8, []int32) {
		out := make([]uint8, len(src))
		oid := make([]int32, len(src))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				m, mi := uint8(noRiver), int32(-1)
				lo, hi := max(0, x-reach), min(w-1, x+reach)
				if !horizontal {
					lo, hi = max(0, y-reach), min(h-1, y+reach)
				}
				for k := lo; k <= hi; k++ {
					j := y*w + k
					if !horizontal {
						j = k*w + x
					}
					if src[j] < m || (src[j] == m && src[j] != noRiver && sid[j] < mi) {
						m, mi = src[j], sid[j]
					}
				}
				out[y*w+x], oid[y*w+x] = m, mi
			}
		}
		return out, oid
	}
	a, ai := pass(v, id, true)
	return pass(a, ai, false)
}

// riverOf is an edge's river (P2 spec §3.2-3): near of total border pairs
// lie within riverReach of a river; 40% or more makes a river, big (2) when
// the best rank among those pairs is bigRiverRank or less, else small (1).
func riverOf(near, total int, rank uint8) int {
	if total == 0 || near*5 < total*2 {
		return 0
	}
	if int(rank) <= bigRiverRank {
		return 2
	}
	return 1
}

// ---- detailed terrain ----

// modisWater and modisNone are the classes of water and of cells without
// data (unclassified, or transparent).
const (
	modisWater = 0
	modisNone  = 255
)

// loadModis reads the MODIS IGBP land cover grid (0.1°, lon −180..180, lat
// 90..−90) through its colour map: class 1..16 per cell, modisWater for
// water, modisNone for unclassified or no data. A colour not in the map is
// an error.
func loadModis(pngPath, xmlPath string) ([]uint8, int, int, error) {
	raw, err := os.ReadFile(xmlPath)
	if err != nil {
		return nil, 0, 0, err
	}
	var cm struct {
		Entries []struct {
			RGB         string `xml:"rgb,attr"`
			Transparent bool   `xml:"transparent,attr"`
			SourceValue string `xml:"sourceValue,attr"`
		} `xml:"ColorMap>Entries>ColorMapEntry"`
	}
	if err := xml.Unmarshal(raw, &cm); err != nil {
		return nil, 0, 0, fmt.Errorf("%s: %w", xmlPath, err)
	}
	classOf := map[[3]uint8]uint8{}
	for _, e := range cm.Entries {
		if e.Transparent {
			continue
		}
		var c [3]uint8
		parts := strings.Split(e.RGB, ",")
		if len(parts) != 3 {
			return nil, 0, 0, fmt.Errorf("%s: colour %q", xmlPath, e.RGB)
		}
		for k, s := range parts {
			v, err := strconv.Atoi(strings.TrimSpace(s))
			if err != nil {
				return nil, 0, 0, fmt.Errorf("%s: colour %q", xmlPath, e.RGB)
			}
			c[k] = uint8(v)
		}
		first, err := strconv.Atoi(strings.Split(e.SourceValue, ",")[0])
		if err != nil {
			return nil, 0, 0, fmt.Errorf("%s: value %q", xmlPath, e.SourceValue)
		}
		class := uint8(modisNone)
		switch {
		case first >= 1 && first <= 16:
			class = uint8(first)
		case first == 0 || first == 17:
			class = modisWater
		}
		classOf[c] = class
	}
	if len(classOf) < 18 {
		return nil, 0, 0, fmt.Errorf("%s: %d colours, want 18", xmlPath, len(classOf))
	}
	f, err := os.Open(pngPath)
	if err != nil {
		return nil, 0, 0, err
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("%s: %w", pngPath, err)
	}
	b := img.Bounds()
	gw, gh := b.Dx(), b.Dy()
	if gw != 3600 || gh != 1800 {
		return nil, 0, 0, fmt.Errorf("%s is %dx%d, want the 0.1° grid 3600x1800", pngPath, gw, gh)
	}
	grid := make([]uint8, gw*gh)
	var nrgba *image.NRGBA
	var rgba *image.RGBA
	switch im := img.(type) {
	case *image.NRGBA:
		nrgba = im
	case *image.RGBA:
		rgba = im
	}
	for y := 0; y < gh; y++ {
		for x := 0; x < gw; x++ {
			var r, g, bl, a uint8
			switch {
			case nrgba != nil:
				o := nrgba.PixOffset(b.Min.X+x, b.Min.Y+y)
				r, g, bl, a = nrgba.Pix[o], nrgba.Pix[o+1], nrgba.Pix[o+2], nrgba.Pix[o+3]
			case rgba != nil:
				o := rgba.PixOffset(b.Min.X+x, b.Min.Y+y)
				r, g, bl, a = rgba.Pix[o], rgba.Pix[o+1], rgba.Pix[o+2], rgba.Pix[o+3]
			default:
				cr, cg, cb, ca := img.At(b.Min.X+x, b.Min.Y+y).RGBA()
				r, g, bl, a = uint8(cr>>8), uint8(cg>>8), uint8(cb>>8), uint8(ca>>8)
			}
			if a == 0 {
				grid[y*gw+x] = modisNone
				continue
			}
			c, ok := classOf[[3]uint8{r, g, bl}]
			if !ok {
				return nil, 0, 0, fmt.Errorf("%s: pixel (%d,%d) has colour %d,%d,%d, not in the colour map", pngPath, x, y, r, g, bl)
			}
			grid[y*gw+x] = c
		}
	}
	return grid, gw, gh, nil
}

// modisCell is the grid cell holding a point.
func modisCell(lon, lat float64, gw, gh int) int {
	col := max(0, min(gw-1, int(math.Floor((lon+180)/360*float64(gw)))))
	row := max(0, min(gh-1, int(math.Floor((90-lat)/180*float64(gh)))))
	return row*gw + col
}

// majorityClass is the most frequent class (ties: the smaller class).
func majorityClass(counts *[256]int) int {
	best := 0
	for c := 1; c < 256; c++ {
		if counts[c] > counts[best] {
			best = c
		}
	}
	return best
}

// landTerrain is a region's P2 terrain (P2 spec §3.2-5): from its MODIS
// majority class (forest 1–5, jungle for evergreen broadleaf 2 in the
// tropics, marsh 11, desert 16), else its v1 terrain class; urban when it
// holds a city of tier urbanMinTier or more on fewer than urbanMaxTiles
// tiles.
func landTerrain(major, v1Class, latC, maxTier, tiles int) string {
	if maxTier >= urbanMinTier && tiles < urbanMaxTiles {
		return terUrban
	}
	switch {
	case major == 2 && abs(latC) < jungleLatC:
		return terJungle
	case major >= 1 && major <= 5:
		return terForest
	case major == 11:
		return terMarsh
	case major == 16:
		return terDesert
	}
	return v1Terrain[v1Class]
}

// v1Class is map-generator/regions.go's terrain class from the tiles'
// magnitudes: the majority of plains (< 10), highland (< 20), mountain
// (ties: the lower class).
func v1Class(counts [3]int) int {
	class := 0
	for k := 1; k < 3; k++ {
		if counts[k] > counts[class] {
			class = k
		}
	}
	return class
}

func magClass(mag uint8) int {
	switch {
	case mag >= 20:
		return 2
	case mag >= 10:
		return 1
	}
	return 0
}

// ---- rail and forts ----

// RegionLevels is src/rail1936.json or src/forts1936.json: lists of
// regions ("TAG:name") with the level they get (forts) or at least get
// (rail).
type RegionLevels struct {
	Rows []LevelRow `json:"rows"`
}

// LevelRow is one row of a RegionLevels table.
type LevelRow struct {
	Note    string   `json:"note"`
	Level   int      `json:"level"`
	Regions []string `json:"regions"`
}

// resolveLevels turns a table into region id → level (the highest row
// naming the region). An unknown name, or a level outside 0..5, fails.
func resolveLevels(path string, tbl RegionLevels, byName map[string]int) (map[int]int, error) {
	out := map[int]int{}
	var bad []string
	for _, row := range tbl.Rows {
		if row.Level < 0 || row.Level > 5 {
			bad = append(bad, fmt.Sprintf("%s: level %d", row.Note, row.Level))
		}
		for _, name := range row.Regions {
			id, ok := byName[name]
			if !ok {
				bad = append(bad, fmt.Sprintf("%s: no region %q", row.Note, name))
				continue
			}
			out[id] = max(out[id], row.Level)
		}
	}
	if len(bad) > 0 {
		return nil, fmt.Errorf("%s:\n  %s", path, strings.Join(bad, "\n  "))
	}
	return out, nil
}

// startRail is P2 spec §3.2-6: a major's core region max(1, infra − 1),
// another core region max(0, infra − 2), a colony 1 from infrastructure 4.
func startRail(core, major bool, infra int) int {
	switch {
	case !core:
		if infra >= 4 {
			return 1
		}
		return 0
	case major:
		return max(1, infra-1)
	}
	return max(0, infra-2)
}

// ---- the land graph ----

// RegionV3 is what version 3 adds to a region (P2 spec §3.1).
type RegionV3 struct {
	Land   string
	Center int // tile
	LatC   int
	WCell  int
	Rail   int
	Fort   int
}

// LandInput is what buildLandGraph reads beside the final map.
type LandInput struct {
	Regions  []*Region          // stable ids
	Eco      map[int]*EcoRegion // by stable id
	Tags     []string           // countries.json order
	Mag      []uint8            // land magnitude per pixel (writeTerrain)
	Modis    []uint8            // MODIS class per 0.1° cell
	ModisW   int
	ModisH   int
	Rivers   []riverLine
	Straits  LandStraits
	Rail     RegionLevels
	Forts    RegionLevels
	ByName   map[string]int // "TAG:name" → id, surviving regions
	RailPath string
	FortPath string
}

// LandGraph is the result: v3 fields by region id, the sorted edges, and
// what the tool prints.
type LandGraph struct {
	V3        map[int]RegionV3
	Edges     []Edge
	Straits   []Edge
	Terrain   map[string]int
	BigRivers int
	Rivers    map[string]int // edges per named river
	Fragments map[int]int    // surviving region → final tiles
}

// riverGroups names the rivers P2 spec §3.2-3 lists, by Natural Earth name.
var riverGroups = map[string]string{
	"Rhine": "Rhine", "Rhein": "Rhine", "Rhin": "Rhine",
	"Vistula": "Vistula",
	"Danube":  "Danube", "Donau": "Danube",
	"Volga":  "Volga",
	"Dnipro": "Dnieper", "Dnepre": "Dnieper",
	"Don":     "Don",
	"Yangtze": "Yangtze", "Chang Jiang": "Yangtze",
	"Huang": "Huang He",
}

// RiverEdge is an edge's river and the line most of its river pairs lie
// near (ties: the smaller line index).
type RiverEdge struct {
	River int
	Line  int32
}

// riverEdges counts each pair of land regions' border tile pairs (a < b,
// pairKey) and gives the pair its river (riverOf): near and nearLine are
// the smallest river rank within riverReach of each tile and its line
// (spreadMin); a border pair is on a river when either tile is.
func riverEdges(ids []uint16, w, h int, near []uint8, nearLine []int32) (map[int64]int, map[int64]RiverEdge) {
	type acc struct {
		total, near int
		rank        uint8
		lines       map[int32]int
	}
	sums := map[int64]*acc{}
	borders := borderPairs(ids, w, h, func(a, b, t1, t2 int) {
		k := pairKey(a, b)
		s := sums[k]
		if s == nil {
			s = &acc{rank: noRiver, lines: map[int32]int{}}
			sums[k] = s
		}
		s.total++
		r, line := near[t1], nearLine[t1]
		if near[t2] < r {
			r, line = near[t2], nearLine[t2]
		}
		if r != noRiver {
			s.near++
			s.rank = min(s.rank, r)
			s.lines[line]++
		}
	})
	out := make(map[int64]RiverEdge, len(sums))
	for k, s := range sums {
		e := RiverEdge{River: riverOf(s.near, s.total, s.rank), Line: -1}
		if e.River > 0 {
			bestN := 0
			for line, c := range s.lines {
				if c > bestN || (c == bestN && line < e.Line) {
					e.Line, bestN = line, c
				}
			}
		}
		out[k] = e
	}
	return borders, out
}

// buildLandGraph computes the v3 fields of every region left on the final
// map and the land edges (P2 spec §3.2-1..-7).
func buildLandGraph(p Projection, ids []uint16, lists tileLists, in LandInput) (LandGraph, error) {
	w, h := p.Width, p.Height
	g := LandGraph{V3: map[int]RegionV3{}, Terrain: map[string]int{}, Rivers: map[string]int{}}
	byID := map[int]*Region{}
	var regionIDs []int
	for _, r := range in.Regions {
		byID[r.ID] = r
		if len(lists.of(r.ID)) > 0 {
			regionIDs = append(regionIDs, r.ID)
		}
	}
	sort.Ints(regionIDs)
	lons, lats := geoAxes(p)

	rail, err := resolveLevels(in.RailPath, in.Rail, in.ByName)
	if err != nil {
		return g, err
	}
	forts, err := resolveLevels(in.FortPath, in.Forts, in.ByName)
	if err != nil {
		return g, err
	}
	for _, id := range regionIDs {
		tiles := lists.of(id)
		c := nearestCentroid(tiles, w)
		latC, lonC := hundredths(lats[c/w]), hundredths(lons[c%w])
		var mc [3]int
		var counts [256]int
		for _, t := range tiles {
			mc[magClass(in.Mag[t])]++
			counts[in.Modis[modisCell(lons[int(t)%w], lats[int(t)/w], in.ModisW, in.ModisH)]]++
		}
		r := byID[id]
		e := in.Eco[id]
		tag := in.Tags[r.Owner-1]
		v := RegionV3{
			Land:   landTerrain(majorityClass(&counts), v1Class(mc), latC, r.MaxTier, len(tiles)),
			Center: c,
			LatC:   latC,
			WCell:  weatherCell(lonC, latC),
			Rail:   max(startRail(e.Core, isMajor(tag), e.Infra), rail[id]),
			Fort:   forts[id],
		}
		g.V3[id] = v
		g.Terrain[v.Land]++
	}

	rank, who := rasterRivers(p, in.Rivers)
	near, nearWho := spreadMin(rank, who, w, h, riverReach)
	borders, rivers := riverEdges(ids, w, h, near, nearWho)
	km := func(a, b int) int { return tileKm(p, g.V3[a].Center, g.V3[b].Center) }
	for k, border := range borders {
		a, b := int(k>>16), int(k&0xffff)
		rv := rivers[k]
		e := Edge{A: a, B: b, Border: border, Km: km(a, b), River: rv.River}
		if rv.River > 0 {
			if name, ok := riverGroups[in.Rivers[rv.Line].Name]; ok {
				g.Rivers[name]++
			}
			if rv.River == 2 {
				g.BigRivers++
			}
		}
		g.Edges = append(g.Edges, e)
	}

	mass := landmasses(regionIDs, borders)
	near6 := straitPairs(ids, w, h, lists, regionIDs, borders)
	resolve := func(pairs [][2]string, what string) (map[int64]bool, []string) {
		out := map[int64]bool{}
		var bad []string
		for _, pr := range pairs {
			a, okA := in.ByName[pr[0]]
			b, okB := in.ByName[pr[1]]
			if !okA || !okB {
				bad = append(bad, fmt.Sprintf("%s %q–%q: no such region", what, pr[0], pr[1]))
				continue
			}
			k := pairKey(a, b)
			if _, ok := near6[k]; !ok {
				bad = append(bad, fmt.Sprintf("%s %q–%q: not within %d water tiles, or joined by land", what, pr[0], pr[1], straitWater))
				continue
			}
			out[k] = true
		}
		return out, bad
	}
	add, bad := resolve(in.Straits.Add, "add")
	remove, bad2 := resolve(in.Straits.Remove, "remove")
	bad = append(bad, bad2...)
	for k := range remove {
		if mass[int(k>>16)] == mass[int(k&0xffff)] {
			bad = append(bad, fmt.Sprintf("remove %d–%d: not a computed strait (one landmass)", k>>16, k&0xffff))
		}
	}
	for k := range add {
		if mass[int(k>>16)] != mass[int(k&0xffff)] {
			bad = append(bad, fmt.Sprintf("add %d–%d: already a computed strait", k>>16, k&0xffff))
		}
	}
	if len(bad) > 0 {
		sort.Strings(bad)
		return g, fmt.Errorf("straits1936.json land straits:\n  %s", strings.Join(bad, "\n  "))
	}
	for k := range near6 {
		a, b := int(k>>16), int(k&0xffff)
		if (mass[a] != mass[b] && !remove[k]) || add[k] {
			e := Edge{A: a, B: b, Km: km(a, b), Strait: 1}
			g.Edges = append(g.Edges, e)
			g.Straits = append(g.Straits, e)
		}
	}
	sortEdges(g.Edges)
	sortEdges(g.Straits)
	return g, nil
}

func sortEdges(edges []Edge) {
	sort.Slice(edges, func(i, j int) bool {
		if edges[i].A != edges[j].A {
			return edges[i].A < edges[j].A
		}
		return edges[i].B < edges[j].B
	})
}
