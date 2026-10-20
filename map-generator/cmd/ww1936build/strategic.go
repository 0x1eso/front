package main

import (
	"container/heap"
	"fmt"
	"math"
	"math/big"
	"sort"
	"strings"
)

// The strategic regions of scenario.json version 4 (P4 spec §3.4–3.6): the
// 65 sea strategic regions of src/seaRegions1936.json, the land strategic
// regions grown from the seeds of src/landRegions1936.json, each sea zone's
// centre, latitude, weather cell and strategic region, and each coastal
// region's harbour zone. All of it is computed on the final map; the map
// generator checks the harbours against its own tiles (map-generator/
// regions.go).

const (
	// srSeaBase: sea strategic regions are 1001.. (P4 spec §3.4).
	srSeaBase = 1000
	// srMaxRegions, srMaxTiles: a land strategic region's share grows no
	// larger than this many regions or land tiles (in more than one region)
	// while seeds are added (P4 spec §3.4-3). The spec's 12 regions and
	// 40,000 tiles made 479 land strategic regions with the spec's seeds.
	// With the hand seeds outside Europe (controller ruling 2026-10-21:
	// HOI4-like zones for India, Persia, Siberia, China, Africa and the
	// Americas) the 149 hand-seeded regions and the 31 islands no region of
	// their owner lies near fill the 150..180 target, and 33 / 200,000 is the
	// finest split that keeps to it (180, no auto seed; 32 regions makes 192,
	// 185,000 tiles 181).
	srMaxRegions = 33
	srMaxTiles   = 200000
	// srIslandRegions, srIslandKm: an island strategic region of at most
	// this many regions joins a strategic region of its owner within this
	// many km (P4 spec §3.4-5).
	srIslandRegions = 3
	srIslandKm      = 600
	// srMinCount, srMaxCount: the target number of land strategic regions:
	// spec §3.4-7's 110..140, raised by the controller ruling of 2026-10-21
	// (HOI4-like granularity outside Europe matters more than the count).
	srMinCount = 150
	srMaxCount = 180
	// seedReach: a seed in the water takes the nearest land tile within
	// this many tiles.
	seedReach = 25
)

// SeaRegionRow is a line of src/seaRegions1936.json (P4 spec §3.4 table):
// the sea zones are given less seaZoneBase.
type SeaRegionRow struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	NameKo string `json:"nameKo"`
	Zones  []int  `json:"zones"`
}

// LandSeedRow is a line of src/landRegions1936.json (P4 spec §3.4-2): a
// hand seed. KeepAlone keeps its strategic region from taking a small
// island (and from joining one).
type LandSeedRow struct {
	Name      string  `json:"name"`
	NameKo    string  `json:"nameKo"`
	Lon       float64 `json:"lon"`
	Lat       float64 `json:"lat"`
	KeepAlone bool    `json:"keepAlone,omitempty"`
}

// Strategic is a strategic region of scenario.json (engine-api
// StrategicSchema): members are region ids (land) or sea zone ids (sea),
// ascending.
type Strategic struct {
	ID      int    `json:"id"`
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	NameKo  string `json:"nameKo"`
	Center  [2]int `json:"center"`
	LatC    int    `json:"latC"`
	Members []int  `json:"members"`
}

// ZoneV4 is what version 4 adds to a sea zone (P4 spec §3.6).
type ZoneV4 struct {
	Center int // tile
	LatC   int
	WCell  int
	SR     int // 0 for a lake
}

// StrategicInput is what buildStrategic reads beside the final map.
type StrategicInput struct {
	Regions []*Region // stable ids
	Tags    []string  // countries.json order
	Seas    []*Region // sea zones, ascending, Lake marked
	Land    LandGraph
	Sea     SeaGraph
	SeaRows []SeaRegionRow
	Seeds   []LandSeedRow
	// MaxRegions, MaxTiles: the share thresholds (srMaxRegions, srMaxTiles).
	MaxRegions, MaxTiles int
}

// StrategicResult: the strategic regions (land ascending, then sea), each
// surviving region's strategic region and harbour, each zone's v4 fields,
// and what the tool prints.
type StrategicResult struct {
	List     []Strategic
	RegionSR map[int]int
	Harbor   map[int]int
	Zones    map[int]ZoneV4
	Report   []string
	LandN    int
	Merged   []string // the small islands that joined a strategic region
}

// loadSeaRegions reads src/seaRegions1936.json: ids 1001.. in order, a
// name in both languages and at least one zone each.
func loadSeaRegions(path string) ([]SeaRegionRow, error) {
	var rows []SeaRegionRow
	if err := decodeStrict(path, &rows); err != nil {
		return nil, err
	}
	var bad []string
	for k, r := range rows {
		if r.ID != srSeaBase+1+k {
			bad = append(bad, fmt.Sprintf("row %d: id %d, want %d", k, r.ID, srSeaBase+1+k))
		}
		if r.Name == "" || r.NameKo == "" || len(r.Zones) == 0 {
			bad = append(bad, fmt.Sprintf("%d: a name or the zones missing", r.ID))
		}
	}
	if len(bad) > 0 {
		return nil, fmt.Errorf("%s:\n  %s", path, strings.Join(bad, "\n  "))
	}
	return rows, nil
}

// loadLandSeeds reads src/landRegions1936.json.
func loadLandSeeds(path string) ([]LandSeedRow, error) {
	var rows []LandSeedRow
	if err := decodeStrict(path, &rows); err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var bad []string
	for _, r := range rows {
		if r.Name == "" || r.NameKo == "" || seen[r.Name] {
			bad = append(bad, fmt.Sprintf("seed %q: a name missing or twice", r.Name))
		}
		seen[r.Name] = true
	}
	if len(bad) > 0 {
		return nil, fmt.Errorf("%s:\n  %s", path, strings.Join(bad, "\n  "))
	}
	return rows, nil
}

// harbors gives every land region of the final map its harbour zone (P4
// spec §3.5): of the sea zones (lakes left out) its tiles touch, the one with
// the most 4-neighbour tile pairs, ties to the smaller id. A region touching
// none is missing from the map (harbour 0). map-generator/regions.go
// harborZones computes the same on the generator's tiles: keep the two in
// step.
func harbors(ids []uint16, w, h int, lake map[int]bool) map[int]int {
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

// centroidNearest returns, of the candidate tiles, the one nearest the
// centroid of tiles (exact: big integers; ties to the smaller tile).
func centroidNearest(tiles []int32, candidates []int, w int) int {
	var sx, sy int64
	for _, t := range tiles {
		sx += int64(int(t) % w)
		sy += int64(int(t) / w)
	}
	k := big.NewInt(int64(len(tiles)))
	best := -1
	var bestD *big.Int
	for _, c := range candidates {
		dx := new(big.Int).Sub(new(big.Int).Mul(k, big.NewInt(int64(c%w))), big.NewInt(sx))
		dy := new(big.Int).Sub(new(big.Int).Mul(k, big.NewInt(int64(c/w))), big.NewInt(sy))
		d := new(big.Int).Add(new(big.Int).Mul(dx, dx), new(big.Int).Mul(dy, dy))
		if best < 0 || d.Cmp(bestD) < 0 || (d.Cmp(bestD) == 0 && c < best) {
			best, bestD = c, d
		}
	}
	return best
}

// nearestLandTile is the land-region tile nearest tile px (Euclidean in
// tiles, ties to the smaller tile) within reach tiles for which ok holds; px
// itself when it qualifies.
func nearestLandTile(ids []uint16, w, h, px, reach int, ok func(id int) bool) (int, bool) {
	isOK := func(t int) bool {
		id := int(ids[t])
		return id != 0 && id < seaZoneBase && ok(id)
	}
	if isOK(px) {
		return px, true
	}
	x0, y0 := px%w, px/w
	best, bestD := -1, math.MaxInt
	for y := max(0, y0-reach); y <= min(h-1, y0+reach); y++ {
		for x := max(0, x0-reach); x <= min(w-1, x0+reach); x++ {
			t := y*w + x
			if !isOK(t) {
				continue
			}
			d := (x-x0)*(x-x0) + (y-y0)*(y-y0)
			if d < bestD || (d == bestD && t < best) {
				best, bestD = t, d
			}
		}
	}
	return best, best >= 0
}

// ---- the multi-source Dijkstra over the land graph ----

// srLabel is a region's distance to its nearest seed and that seed's rank.
type srLabel struct {
	dist int
	rank int
}

func (a srLabel) less(b srLabel) bool {
	return a.dist < b.dist || (a.dist == b.dist && a.rank < b.rank)
}

type srItem struct {
	lab srLabel
	id  int
}

type srHeap []srItem

func (h srHeap) Len() int { return len(h) }
func (h srHeap) Less(a, b int) bool {
	if h[a].lab != h[b].lab {
		return h[a].lab.less(h[b].lab)
	}
	return h[a].id < h[b].id
}
func (h srHeap) Swap(a, b int) { h[a], h[b] = h[b], h[a] }
func (h *srHeap) Push(x any)   { *h = append(*h, x.(srItem)) }
func (h *srHeap) Pop() any {
	old := *h
	it := old[len(old)-1]
	*h = old[:len(old)-1]
	return it
}

const srInf = math.MaxInt / 2

// nearestSeeds labels every region of one landmass with its nearest seed
// (km along land edges; ties to the seed of the lower rank). seeds maps a
// region to its seed rank. adj lists each region's (neighbour, km).
func nearestSeeds(members []int, adj map[int][][2]int, seeds map[int]int) map[int]srLabel {
	lab := make(map[int]srLabel, len(members))
	for _, id := range members {
		lab[id] = srLabel{srInf, srInf}
	}
	h := &srHeap{}
	for id, rank := range seeds {
		lab[id] = srLabel{0, rank}
		heap.Push(h, srItem{lab[id], id})
	}
	for h.Len() > 0 {
		it := heap.Pop(h).(srItem)
		if it.lab != lab[it.id] {
			continue
		}
		for _, e := range adj[it.id] {
			next := srLabel{it.lab.dist + e[1], it.lab.rank}
			if next.less(lab[e[0]]) {
				lab[e[0]] = next
				heap.Push(h, srItem{next, e[0]})
			}
		}
	}
	return lab
}

// landSR is a land strategic region while it is built.
type landSR struct {
	members   []int // ascending
	name      string
	nameKo    string
	keepAlone bool
	hand      bool // grown from a hand seed
	seedless  bool // a whole landmass without a seed (an island)
}

// growLandmass splits one landmass among its seeds (P4 spec §3.4-3,4):
// while a seed's share holds more than maxRegions regions, or more than
// maxTiles land tiles in more than one region, the region farthest from
// every seed (ties: the smaller id; with no seed yet, the smallest id)
// becomes a seed. hand are the landmass's hand seeds (region → rank, the
// file order); auto seeds rank after every hand seed, in the order they are
// made (nextRank on). Returns the seed of each region and the seeds in rank
// order.
func growLandmass(members []int, adj map[int][][2]int, tiles map[int]int, hand map[int]int, nextRank int, maxRegions, maxTiles int) (map[int]int, []int) {
	seeds := map[int]int{}
	for id, rank := range hand {
		seeds[id] = rank
	}
	var auto []int
	for {
		lab := nearestSeeds(members, adj, seeds)
		count := map[int]int{}
		sum := map[int]int{}
		for _, id := range members {
			if lab[id].rank < srInf {
				count[lab[id].rank]++
				sum[lab[id].rank] += tiles[id]
			}
		}
		over := len(seeds) == 0
		for rank, c := range count {
			if c > maxRegions || (sum[rank] > maxTiles && c > 1) {
				over = true
			}
		}
		if over {
			far, farD := -1, -1
			for _, id := range members {
				if _, ok := seeds[id]; ok {
					continue
				}
				if d := lab[id].dist; d > farD {
					far, farD = id, d
				}
			}
			if far >= 0 {
				seeds[far] = nextRank + len(auto)
				auto = append(auto, far)
				continue
			}
		}
		of := map[int]int{}
		byRank := map[int]int{}
		for id, rank := range seeds {
			byRank[rank] = id
		}
		for _, id := range members {
			of[id] = byRank[lab[id].rank]
		}
		ranks := make([]int, 0, len(byRank))
		for rank := range byRank {
			ranks = append(ranks, rank)
		}
		sort.Ints(ranks)
		order := make([]int, len(ranks))
		for k, rank := range ranks {
			order[k] = byRank[rank]
		}
		return of, order
	}
}

// buildStrategic computes the strategic regions and the version 4 fields of
// the sea zones and regions on the final map (P4 spec §3.4–3.6).
func buildStrategic(p Projection, ids []uint16, lists tileLists, in StrategicInput) (StrategicResult, error) {
	w, h := p.Width, p.Height
	res := StrategicResult{RegionSR: map[int]int{}, Zones: map[int]ZoneV4{}}
	lons, lats := geoAxes(p)
	xy := func(t int) [2]int { return [2]int{t % w, t / w} }
	latOf := func(t int) int { return hundredths(lats[t/w]) }

	// Sea: every zone that is not a lake in exactly one region of the table.
	lake := map[int]bool{}
	zoneSR := map[int]int{}
	var bad []string
	for _, z := range in.Seas {
		lake[z.ID] = z.Lake
	}
	known := map[int]bool{}
	for _, z := range in.Seas {
		known[z.ID] = true
	}
	for _, r := range in.SeaRows {
		for _, k := range r.Zones {
			z := seaZoneBase + k
			switch {
			case !known[z]:
				bad = append(bad, fmt.Sprintf("sea region %d: no zone %d", r.ID, z))
			case lake[z]:
				bad = append(bad, fmt.Sprintf("sea region %d: zone %d is a lake", r.ID, z))
			case zoneSR[z] != 0:
				bad = append(bad, fmt.Sprintf("zone %d in sea regions %d and %d", z, zoneSR[z], r.ID))
			default:
				zoneSR[z] = r.ID
			}
		}
	}
	for _, z := range in.Seas {
		if !z.Lake && zoneSR[z.ID] == 0 {
			bad = append(bad, fmt.Sprintf("zone %d %s is in no sea region", z.ID, z.Name))
		}
	}
	if len(bad) > 0 {
		return res, fmt.Errorf("seaRegions1936.json:\n  %s", strings.Join(bad, "\n  "))
	}
	for _, z := range in.Seas {
		c := in.Sea.Centers[z.ID]
		if c < 0 {
			return res, fmt.Errorf("zone %d %s has no tile on the final map", z.ID, z.Name)
		}
		latC := latOf(c)
		res.Zones[z.ID] = ZoneV4{Center: c, LatC: latC, WCell: weatherCell(hundredths(lons[c%w]), latC), SR: zoneSR[z.ID]}
	}
	var seaList []Strategic
	for _, r := range in.SeaRows {
		var members []int
		var tiles []int32
		var centers []int
		for _, k := range r.Zones {
			z := seaZoneBase + k
			members = append(members, z)
			tiles = append(tiles, lists.of(z)...)
			centers = append(centers, res.Zones[z].Center)
		}
		sort.Ints(members)
		c := centroidNearest(tiles, centers, w)
		seaList = append(seaList, Strategic{ID: r.ID, Kind: "sea", Name: r.Name, NameKo: r.NameKo, Center: xy(c), LatC: latOf(c), Members: members})
	}

	// Land: the surviving regions, their landmasses without strait edges.
	byID := map[int]*Region{}
	var landIDs []int
	tiles := map[int]int{}
	for _, r := range in.Regions {
		byID[r.ID] = r
		if n := len(lists.of(r.ID)); n > 0 {
			landIDs = append(landIDs, r.ID)
			tiles[r.ID] = n
		}
	}
	sort.Ints(landIDs)
	res.Harbor = harbors(ids, w, h, lake)
	adj := map[int][][2]int{}
	borders := map[int64]int{}
	for _, e := range in.Land.Edges {
		if e.Strait == 1 {
			continue
		}
		adj[e.A] = append(adj[e.A], [2]int{e.B, e.Km})
		adj[e.B] = append(adj[e.B], [2]int{e.A, e.Km})
		borders[pairKey(e.A, e.B)] = 1
	}
	for _, id := range landIDs {
		sort.Slice(adj[id], func(a, b int) bool { return adj[id][a][0] < adj[id][b][0] })
	}
	mass := landmasses(landIDs, borders)
	massMembers := map[int][]int{}
	var massOrder []int
	for _, id := range landIDs {
		m := mass[id]
		if len(massMembers[m]) == 0 {
			massOrder = append(massOrder, m)
		}
		massMembers[m] = append(massMembers[m], id)
	}

	// Hand seeds: the region at the point (the nearest land tile's when the
	// point is water).
	seedOf := map[int]int{} // region → seed row
	handIn := map[int]map[int]int{}
	for k, s := range in.Seeds {
		px, ok := p.Pixel(s.Lon, s.Lat)
		if ok {
			px, ok = nearestLandTile(ids, w, h, px, seedReach, func(int) bool { return true })
		}
		if !ok {
			bad = append(bad, fmt.Sprintf("seed %q (%.2f, %.2f): no land within %d tiles", s.Name, s.Lon, s.Lat, seedReach))
			continue
		}
		id := int(ids[px])
		if other, twice := seedOf[id]; twice {
			bad = append(bad, fmt.Sprintf("seeds %q and %q are both in region %d", in.Seeds[other].Name, s.Name, id))
			continue
		}
		seedOf[id] = k
		m := mass[id]
		if handIn[m] == nil {
			handIn[m] = map[int]int{}
		}
		handIn[m][id] = k
		res.Report = append(res.Report, fmt.Sprintf("seed %q → %d %s:%s", s.Name, id, in.Tags[byID[id].Owner-1], byID[id].Name))
	}
	if len(bad) > 0 {
		return res, fmt.Errorf("landRegions1936.json:\n  %s", strings.Join(bad, "\n  "))
	}

	var srs []*landSR
	nextRank := len(in.Seeds)
	for _, m := range massOrder {
		members := massMembers[m]
		sum := 0
		for _, id := range members {
			sum += tiles[id]
		}
		if len(handIn[m]) == 0 && len(members) <= in.MaxRegions && sum <= in.MaxTiles {
			r := byID[members[0]]
			srs = append(srs, &landSR{members: members, name: r.Name, nameKo: r.NameKo, seedless: true})
			continue
		}
		of, order := growLandmass(members, adj, tiles, handIn[m], nextRank, in.MaxRegions, in.MaxTiles)
		nextRank += len(order)
		share := map[int]*landSR{}
		for _, seed := range order {
			sr := &landSR{}
			if k, ok := seedOf[seed]; ok {
				s := in.Seeds[k]
				sr.name, sr.nameKo, sr.keepAlone, sr.hand = s.Name, s.NameKo, s.KeepAlone, true
			} else {
				sr.name, sr.nameKo = byID[seed].Name, byID[seed].NameKo
			}
			share[seed] = sr
			srs = append(srs, sr)
		}
		for _, id := range members {
			share[of[id]].members = append(share[of[id]].members, id)
		}
	}

	// The centre of a land strategic region: of its regions' centres, the
	// one nearest the centroid of its tiles.
	centerOf := func(members []int) int {
		var all []int32
		var cs []int
		for _, id := range members {
			all = append(all, lists.of(id)...)
			cs = append(cs, in.Land.V3[id].Center)
		}
		return centroidNearest(all, cs, w)
	}
	ownerOf := func(sr *landSR) int {
		o := byID[sr.members[0]].Owner
		for _, id := range sr.members {
			if byID[id].Owner != o {
				return 0
			}
		}
		return o
	}

	// Small islands join a strategic region of their owner (P4 spec §3.4-5).
	sort.SliceStable(srs, func(a, b int) bool { return srs[a].members[0] < srs[b].members[0] })
	alive := make([]bool, len(srs))
	for k := range alive {
		alive[k] = true
	}
	for k, sr := range srs {
		if !sr.seedless || len(sr.members) > srIslandRegions {
			continue
		}
		owner := ownerOf(sr)
		if owner == 0 {
			continue
		}
		c := centerOf(sr.members)
		best, bestKm, bestMin := -1, 0, 0
		for j, other := range srs {
			if j == k || !alive[j] || other.keepAlone {
				continue
			}
			km := -1
			for _, id := range other.members {
				if byID[id].Owner != owner {
					continue
				}
				if d := tileKm(p, c, in.Land.V3[id].Center); km < 0 || d < km {
					km = d
				}
			}
			if km < 0 || km > srIslandKm {
				continue
			}
			if best < 0 || km < bestKm || (km == bestKm && other.members[0] < bestMin) {
				best, bestKm, bestMin = j, km, other.members[0]
			}
		}
		if best < 0 {
			continue
		}
		target := srs[best]
		res.Merged = append(res.Merged, fmt.Sprintf("%s:%s (%d regions) → %s, %d km", in.Tags[owner-1], sr.name, len(sr.members), target.name, bestKm))
		target.members = append(target.members, sr.members...)
		sort.Ints(target.members)
		alive[k] = false
	}

	// Number by the smallest region id (P4 spec §3.4-7).
	var final []*landSR
	for k, sr := range srs {
		if alive[k] {
			final = append(final, sr)
		}
	}
	sort.SliceStable(final, func(a, b int) bool { return final[a].members[0] < final[b].members[0] })
	for k, sr := range final {
		id := k + 1
		c := centerOf(sr.members)
		res.List = append(res.List, Strategic{ID: id, Kind: "land", Name: sr.name, NameKo: sr.nameKo, Center: xy(c), LatC: latOf(c), Members: sr.members})
		for _, r := range sr.members {
			res.RegionSR[r] = id
		}
	}
	res.LandN = len(final)
	for _, id := range landIDs {
		if res.RegionSR[id] == 0 {
			return res, fmt.Errorf("region %d is in no strategic region", id)
		}
	}
	res.List = append(res.List, seaList...)
	return res, nil
}
