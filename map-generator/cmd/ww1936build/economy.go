package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
)

// The World War 1936 P1 economy of every region (P1 spec §3): population,
// category (building slots), infrastructure, homeland, coast, starting
// factories and resource output, from src/economy1936.json and
// src/resources1936.json. Deterministic: integer arithmetic only, ties go to
// the smaller region id.

// RESOURCE_IDS order (packages/engine-api/src/ww1936/EconomyTypes.ts).
var resourceIDs = [...]string{"oil", "aluminium", "rubber", "tungsten", "steel", "chromium"}

// REGION_CATEGORIES order and CATEGORY_SLOTS (EconomyTypes.ts).
var categories = [...]string{"wasteland", "pastoral", "rural", "town", "large_town", "city", "large_city", "metropolis", "megalopolis"}
var categorySlots = [...]int{0, 1, 2, 4, 5, 6, 8, 10, 12}

const (
	catWasteland = 0
	catCity      = 5
	catTop       = len(categories) - 1
)

// The map generator's islet and pond limits (map-generator/map_generator.go
// minIslandSize, minLakeSize): land bodies under minIsland tiles become
// water, then water bodies under minLake tiles (but the ocean) become land.
const (
	minIsland = 30
	minLake   = 200
)

// siteReach is how far (pixels) a resource site may lie off the coast.
const siteReach = 8

// Population weights (spec §3.3-4, controller ruling 2026-10-20): a region's
// share of its country's people is the Natural Earth pop_max of the
// populated places in it (today's numbers, a proxy for where people lived in
// 1936) plus popAreaFloor per isqrt(tiles), so a region without a town still
// gets a few. A place counts at most placePopCap: pop_max is today's whole
// conurbation (Tokyo 35.7M, also listing Yokohama and Kawasaki apart), far
// beyond any 1936 city, and uncapped it gave Tokyo's region 47% of Japan,
// Paris's 36% of France. placeReach is how far a coastal place may lie off
// the land, as for the VP cities.
const (
	popAreaFloor = 2000
	placePopCap  = 3_000_000
	placeReach   = 3
)

// devCiv is DEV_CIV (P1 spec §11.3) in millionths per thousand people:
// civ = round(popCore / 1000 × DEV_CIV[dev]) = (popCore × devCiv + 500,000) / 1,000,000.
var devCiv = [5]int64{20, 100, 220, 400, 700}

// EconomyRow is one line of src/economy1936.json (P1 spec §3.2).
type EconomyRow struct {
	Tag         string   `json:"tag"`
	PopCore     int      `json:"popCore"`     // thousands
	PopColonial int      `json:"popColonial"` // thousands
	Dev         int      `json:"dev"`         // 1..5
	Civ         *int     `json:"civ,omitempty"`
	Mil         *int     `json:"mil,omitempty"`
	Dock        *int     `json:"dock,omitempty"`
	Infra       *int     `json:"infra,omitempty"`
	NonCore     []string `json:"nonCore,omitempty"` // adm0_a3 codes that are not homeland
	// AdmPop spreads popCore by these admin-1 populations (Natural Earth
	// unit name → thousands, the USA's 1930 census) instead of by the
	// populated places; every homeland unit must be listed.
	AdmPop map[string]int `json:"admPop,omitempty"`
}

// IndustryPoint (src/industry1936.json "industry") multiplies the factory
// weight of the region at its point: the 1936 industrial regions.
type IndustryPoint struct {
	Tag  string  `json:"tag"`
	Mult int     `json:"mult"`
	Lon  float64 `json:"lon"`
	Lat  float64 `json:"lat"`
	Note string  `json:"note"`
}

// Yard (src/industry1936.json "yards") is a 1936 naval yard: a country's
// dockyards go to its yards' regions first, D'Hondt by weight.
type Yard struct {
	Tag    string  `json:"tag"`
	Weight int     `json:"weight"`
	Lon    float64 `json:"lon"`
	Lat    float64 `json:"lat"`
	Note   string  `json:"note"`
}

// Industry is src/industry1936.json.
type Industry struct {
	Industry []IndustryPoint `json:"industry"`
	Yards    []Yard          `json:"yards"`
}

// EconomyInput is what buildEconomy works from besides the map.
type EconomyInput struct {
	Rows     []EconomyRow // countries.json order
	Sites    []Site
	Places   []Place
	Industry Industry
	Adm      []int32 // admin-1 unit per pixel (feature index + 1), for AdmPop
	Keep     []int   // the kept islands' points (islands.go keepPoints)
}

// Site is one line of src/resources1936.json (P1 spec §3.5).
type Site struct {
	Tag    string  `json:"tag"`
	Res    string  `json:"res"`
	Amount int     `json:"amount"`
	Lon    float64 `json:"lon"`
	Lat    float64 `json:"lat"`
	Note   string  `json:"note"`
}

// Place is a Natural Earth populated place: where it is and its pop_max.
type Place struct {
	Name     string
	Lon, Lat float64
	Pop      int64
}

// placesOf reads the populated places (ne_10m_populated_places_simple),
// each capped at placePopCap.
func placesOf(features []Feature) []Place {
	var out []Place
	for _, f := range features {
		if f.Point == nil || f.Num("pop_max") <= 0 {
			continue
		}
		pop := min(int64(f.Num("pop_max")), placePopCap)
		out = append(out, Place{Name: f.Str("name"), Lon: f.Point[0], Lat: f.Point[1], Pop: pop})
	}
	return out
}

// placeHit is a place on the map: its region and admin-1 unit.
type placeHit struct {
	region int
	unit   int32
	pop    int64
}

// pointRegion is the region of the nearest staying land pixel within reach
// of a point, and that pixel; ok is false off the land.
func pointRegion(p Projection, kept []bool, ids []uint16, lon, lat float64, reach int) (int, int, bool) {
	px, ok := p.Pixel(lon, lat)
	if ok {
		px, ok = nearestLand(p, kept, px, reach)
	}
	if !ok || ids[px] == 0 {
		return 0, 0, false
	}
	return int(ids[px]), px, true
}

// placeHits puts each place in the region (and admin-1 unit) of the nearest
// staying land pixel within placeReach; places in the sea or off the map
// count for none. adm may be nil (no units).
func placeHits(places []Place, p Projection, kept []bool, ids []uint16, adm []int32) []placeHit {
	var out []placeHit
	for _, pl := range places {
		id, px, ok := pointRegion(p, kept, ids, pl.Lon, pl.Lat, placeReach)
		if !ok {
			continue
		}
		var u int32
		if adm != nil {
			u = adm[px]
		}
		out = append(out, placeHit{id, u, pl.Pop})
	}
	return out
}

// regionPeople sums the pop_max of the places in each region, by region id.
func regionPeople(hits []placeHit, regions int) []int64 {
	out := make([]int64, regions+1)
	for _, h := range hits {
		if h.region <= regions {
			out[h.region] += h.pop
		}
	}
	return out
}

// popWeight is a region's population weight (spec §3.3-4 as amended).
func popWeight(people int64, tiles int) int64 {
	return people + int64(isqrt(tiles))*popAreaFloor
}

// EcoRegion is a region's economy as the tool computes it.
type EcoRegion struct {
	R       *Region
	Core    bool
	Coastal bool
	Capital bool
	// Dropped: every pixel lies on an islet the map generator removes, so
	// the region will not be on the map. It gets no population, factories
	// or sites (the generator moves anything it still has to the capital).
	Dropped bool
	Pop     int
	Mult    int // industry multiplier of the factory weight (1 when none)
	Yard    int // naval yard weight (0 when none)
	Cat     int // index into categories
	Infra   int
	Civ     int
	Mil     int
	Dock    int
	Res     [6]int
}

// EconomySummary is what the tool reports after placing everything.
type EconomySummary struct {
	Civ, Mil, Dock []int // per country, countries.json order
	Bumps          int   // category steps added because slots ran out
	Sites          int
	Dropped        int
	ForeignCore    []string // core regions on another modern country's land
	Points         []string // where each industry point and yard landed
}

func decodeStrict(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	return nil
}

// loadEconomy reads economy1936.json and returns its rows in countries.json
// order. Every country must be there once, with dev 1..5.
func loadEconomy(path string, t *Tables) ([]EconomyRow, error) {
	var rows []EconomyRow
	if err := decodeStrict(path, &rows); err != nil {
		return nil, err
	}
	out := make([]EconomyRow, len(t.Countries))
	seen := make([]bool, len(t.Countries))
	var bad []string
	for _, r := range rows {
		i, ok := t.tagIndex[r.Tag]
		if !ok {
			bad = append(bad, r.Tag+": not in countries.json")
			continue
		}
		if seen[i-1] {
			bad = append(bad, r.Tag+": twice")
			continue
		}
		seen[i-1] = true
		if r.Dev < 1 || r.Dev > 5 {
			bad = append(bad, fmt.Sprintf("%s: dev %d is not 1..5", r.Tag, r.Dev))
		}
		if r.PopCore < 0 || r.PopColonial < 0 {
			bad = append(bad, r.Tag+": negative population")
		}
		for _, v := range []*int{r.Civ, r.Mil, r.Dock} {
			if v != nil && *v < 0 {
				bad = append(bad, r.Tag+": negative factories")
			}
		}
		if r.Infra != nil && (*r.Infra < 1 || *r.Infra > 5) {
			bad = append(bad, fmt.Sprintf("%s: infra %d is not 1..5", r.Tag, *r.Infra))
		}
		for _, a := range r.NonCore {
			if _, ok := t.Owners.Adm0[a]; !ok {
				bad = append(bad, r.Tag+": nonCore "+a+" is not in owners1936.json")
			}
		}
		out[i-1] = r
	}
	for i, ok := range seen {
		if !ok {
			bad = append(bad, t.Countries[i].Tag+": missing")
		}
	}
	if len(bad) > 0 {
		return nil, fmt.Errorf("%s:\n  %s", path, strings.Join(bad, "\n  "))
	}
	return out, nil
}

// loadSites reads resources1936.json: known tags and resource names, amounts
// of at least 1.
func loadSites(path string, t *Tables) ([]Site, error) {
	var sites []Site
	if err := decodeStrict(path, &sites); err != nil {
		return nil, err
	}
	var bad []string
	for _, s := range sites {
		if _, ok := t.tagIndex[s.Tag]; !ok {
			bad = append(bad, s.Note+": unknown tag "+s.Tag)
		}
		if resourceIndex(s.Res) < 0 {
			bad = append(bad, s.Note+": unknown resource "+s.Res)
		}
		if s.Amount < 1 {
			bad = append(bad, fmt.Sprintf("%s: amount %d", s.Note, s.Amount))
		}
	}
	if len(bad) > 0 {
		return nil, fmt.Errorf("%s:\n  %s", path, strings.Join(bad, "\n  "))
	}
	return sites, nil
}

func resourceIndex(name string) int {
	for i, r := range resourceIDs {
		if r == name {
			return i
		}
	}
	return -1
}

// isMajor: the seven majors take their factories from the table (spec §11.1).
func isMajor(tag string) bool {
	switch tag {
	case "DEU", "ITA", "JPN", "GBR", "FRA", "USA", "SUN":
		return true
	}
	return false
}

// regionAdm0 is the modern country (adm0_a3) of the region's main admin-1
// unit, "" without one.
func regionAdm0(r *Region, admin []Feature) string {
	if r.MainAdm <= 0 || int(r.MainAdm) > len(admin) {
		return ""
	}
	return admin[r.MainAdm-1].Str("adm0_a3")
}

// regionCore (spec §3.3-1): the region's main admin-1 unit lies in a modern
// country that is neither drawn as a colony (lowDetail) nor listed in the
// owner's nonCore.
func regionCore(r *Region, admin []Feature, t *Tables, eco EconomyRow) bool {
	a := regionAdm0(r, admin)
	if t.lowDetail[a] {
		return false
	}
	for _, nc := range eco.NonCore {
		if nc == a {
			return false
		}
	}
	return true
}

// generatorLand repeats the map generator's cleanup on the tool's land mask
// (map_generator.go removeSmallIslands, then processWater): kept[px] is land
// that stays land, water[px] water that stays water (4-neighbour bodies; the
// largest water body, the ocean, always stays). Ponds that become land are
// neither. A land body within keepRadius of a keep point stays whatever its
// size (P4 spec §3.2, islands.go).
func generatorLand(land []bool, w, n int, keep ...int) (kept, water []bool) {
	kept = make([]bool, n)
	water = make([]bool, n)
	keepZone := make([]bool, n)
	for _, px := range keep {
		inBox(px, w, n/w, func(j int) { keepZone[j] = true })
	}
	comp := make([]int32, n)
	queue := make([]int32, 0, 1<<16)
	body := func(start int, same func(int) bool, id int32) []int32 {
		comp[start] = id
		queue = append(queue[:0], int32(start))
		for head := 0; head < len(queue); head++ {
			forNeighbours4(int(queue[head]), w, n, func(j int) {
				if comp[j] == 0 && same(j) {
					comp[j] = id
					queue = append(queue, int32(j))
				}
			})
		}
		return queue
	}
	var id int32
	for i := 0; i < n; i++ {
		if land[i] && comp[i] == 0 {
			id++
			pix := body(i, func(j int) bool { return land[j] }, id)
			stay := len(pix) >= minIsland
			for _, px := range pix {
				stay = stay || keepZone[px]
			}
			for _, px := range pix {
				kept[px] = stay
			}
		}
	}
	for i := range comp {
		comp[i] = 0
	}
	type wb struct {
		pixels []int32
	}
	var bodies []wb
	id = 0
	for i := 0; i < n; i++ {
		if !kept[i] && comp[i] == 0 {
			id++
			pix := body(i, func(j int) bool { return !kept[j] }, id)
			bodies = append(bodies, wb{append([]int32(nil), pix...)})
		}
	}
	largest := -1
	for k, b := range bodies {
		if largest < 0 || len(b.pixels) > len(bodies[largest].pixels) {
			largest = k
		}
	}
	for k, b := range bodies {
		if k == largest || len(b.pixels) >= minLake {
			for _, px := range b.pixels {
				water[px] = true
			}
		}
	}
	return kept, water
}

// regionDropped: none of the region's pixels stays land.
func regionDropped(r *Region, kept []bool) bool {
	for _, px := range r.Pixels {
		if kept[px] {
			return false
		}
	}
	return true
}

// regionCoastal (spec §3.3-2): a pixel of the region that stays land touches
// water that stays water (a sea zone on the final map) 4-neighbour.
func regionCoastal(r *Region, kept, water []bool, w int) bool {
	n := len(kept)
	for _, px := range r.Pixels {
		if !kept[px] {
			continue
		}
		coast := false
		forNeighbours4(int(px), w, n, func(j int) {
			if water[j] {
				coast = true
			}
		})
		if coast {
			return true
		}
	}
	return false
}

// isqrt is floor(sqrt(v)) for v >= 0.
func isqrt(v int) int {
	if v <= 0 {
		return 0
	}
	x := v
	y := (x + 1) / 2
	for y < x {
		x = y
		y = (x + v/x) / 2
	}
	return x
}

// apportion splits total by weights with the largest-remainder method
// (remainder ties: the smaller index). All weights 0: everything to index 0.
func apportion(total int, weights []int64) []int {
	out := make([]int, len(weights))
	if len(weights) == 0 {
		return out
	}
	var sum int64
	for _, w := range weights {
		sum += w
	}
	if sum == 0 {
		out[0] = total
		return out
	}
	rem := make([]int64, len(weights))
	given := 0
	for i, w := range weights {
		q := int64(total) * w
		out[i] = int(q / sum)
		rem[i] = q % sum
		given += out[i]
	}
	order := make([]int, len(weights))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(a, b int) bool { return rem[order[a]] > rem[order[b]] })
	for k := 0; k < total-given; k++ {
		out[order[k]]++
	}
	return out
}

// category (spec §3.3-5): the first matching row, from the region's
// population (thousands), its highest city tier and whether it holds the
// capital. Returns the REGION_CATEGORIES name.
func category(pop, maxTier int, capital bool) string {
	return categories[categoryIndex(pop, maxTier, capital)]
}

func categoryIndex(pop, maxTier int, capital bool) int {
	switch {
	case maxTier >= 20 && pop >= 8000:
		return 8 // megalopolis
	case maxTier >= 20 || pop >= 6000:
		return 7 // metropolis
	case maxTier >= 10 || pop >= 4000:
		return 6 // large_city
	case maxTier >= 5 || capital || pop >= 2500:
		return 5 // city
	case pop >= 1500:
		return 4 // large_town
	case pop >= 700:
		return 3 // town
	case pop >= 200:
		return 2 // rural
	case pop >= 30:
		return 1 // pastoral
	}
	return 0 // wasteland
}

// infraOf (spec §3.3-6): base is the table's infra, else its dev; tiers the
// region's city tier sum, tiles its pixels.
func infraOf(base, tiers, tiles int, core, wasteland bool) int {
	if wasteland {
		return 1
	}
	v := base - 2
	if core {
		v = base
		if tiers >= 10 {
			v++
		}
		if tiles > 6000 {
			v--
		}
	}
	return min(5, max(1, v))
}

// factoryCounts (spec §11.3): the table's civ/mil/dock where given, else the
// formula. Dockyards only for a country with a coastal region.
func factoryCounts(eco EconomyRow, hasCoast bool) (civ, mil, dock int) {
	civ = int((int64(eco.PopCore)*devCiv[eco.Dev-1] + 500_000) / 1_000_000)
	if eco.PopCore >= 1000 {
		civ = max(civ, 1)
	}
	if eco.Civ != nil {
		civ = *eco.Civ
	}
	mil = (civ + 2) / 4
	if eco.Mil != nil {
		mil = *eco.Mil
	}
	if hasCoast {
		dock = (civ + 5) / 10
	}
	if eco.Dock != nil {
		dock = *eco.Dock
	}
	return civ, mil, dock
}

// factoryWeight is w2 (spec §3.3-7 as amended): the region's population
// times its industry multiplier, so the factories follow the people and the
// 1936 industry (the Ruhr, the Midlands, the Donbas…), halved in a colony.
func factoryWeight(e *EcoRegion) int64 {
	w := int64(e.Pop) * int64(max(e.Mult, 1))
	if !e.Core {
		w /= 2
	}
	return w
}

// placeFactories (spec §3.3-7) places one country's dockyards, then civ,
// then mil, one at a time, D'Hondt. A dockyard goes first to a region with a
// naval yard (Yard weight × 1000 / (its dockyards + 1), ties to the earlier
// region) while one has room. Otherwise each goes to the region with free slots
// (dock: a coastal one) with the largest w2 × 1000 / (factories already there
// + 1), ties to the earlier region, a homeland (core) region first: a colony
// takes one only when no core region has room for it. When no region has
// room, the region of the largest w2 that can (coastal for a dock; not yet a
// megalopolis) goes up one category and the placement starts over. Returns
// how many steps it added. regions must be in id order.
//
// Two changes to the spec's wording, so the yards and mills sit where the
// 1936 industry was (§11.1): dockyards go first, not last (last, they only
// got the slots the civ and mil left, in empty regions: all twelve British
// yards in Kuwait, the Bahamas…, the Soviet ones in Yakutia); and colonies
// come after the homeland (with w2 only halved, Egypt and Nigeria outweigh
// most of England, and under the spec's first w2 31 of Britain's 52
// factories went to the colonies).
func placeFactories(regions []*EcoRegion, civ, mil, dock int) (int, error) {
	w2 := make([]int64, len(regions))
	for i, e := range regions {
		w2[i] = factoryWeight(e)
	}
	// pick is the region for the next factory of kind among core or
	// colonial regions, -1 when none has room.
	pick := func(kind int, core bool) int {
		best := -1
		var bestScore int64
		for i, e := range regions {
			placed := e.Civ + e.Mil + e.Dock
			if e.Core != core || placed >= categorySlots[e.Cat] || (kind == 0 && !e.Coastal) {
				continue
			}
			score := w2[i] * 1000 / int64(placed+1)
			if best < 0 || score > bestScore {
				best, bestScore = i, score
			}
		}
		return best
	}
	// pickYard is the naval-yard region for the next dockyard, -1 when none
	// has room.
	pickYard := func() int {
		best := -1
		var bestScore int64
		for i, e := range regions {
			if e.Yard == 0 || !e.Coastal || e.Civ+e.Mil+e.Dock >= categorySlots[e.Cat] {
				continue
			}
			score := int64(e.Yard) * 1000 / int64(e.Dock+1)
			if best < 0 || score > bestScore {
				best, bestScore = i, score
			}
		}
		return best
	}
	bumps := 0
	for {
		for _, e := range regions {
			e.Civ, e.Mil, e.Dock = 0, 0, 0
		}
		done := true
	place:
		for kind, count := range []int{dock, civ, mil} {
			for k := 0; k < count; k++ {
				best := -1
				if kind == 0 {
					best = pickYard()
				}
				if best < 0 {
					best = pick(kind, true)
				}
				if best < 0 {
					best = pick(kind, false)
				}
				if best < 0 {
					up := -1
					for i, e := range regions {
						if e.Cat >= catTop || (kind == 0 && !e.Coastal) {
							continue
						}
						if up < 0 || w2[i] > w2[up] {
							up = i
						}
					}
					if up < 0 {
						return bumps, fmt.Errorf("no region can take %s %d", [...]string{"dockyard", "civ", "mil"}[kind], k+1)
					}
					regions[up].Cat++
					bumps++
					done = false
					break place
				}
				switch kind {
				case 0:
					regions[best].Dock++
				case 1:
					regions[best].Civ++
				default:
					regions[best].Mil++
				}
			}
		}
		if done {
			return bumps, nil
		}
	}
}

// placeSites (spec §3.3-8) adds each site to the region of the nearest
// staying land pixel within siteReach. A site that finds no land, or whose
// region is not its tag's, is an error (nothing is dropped quietly).
func placeSites(sites []Site, p Projection, kept []bool, ids []uint16, eco map[int]*EcoRegion, t *Tables) error {
	var bad []string
	for _, s := range sites {
		id, px, ok := pointRegion(p, kept, ids, s.Lon, s.Lat, siteReach)
		if !ok {
			bad = append(bad, fmt.Sprintf("%s (%s %s at %.2f, %.2f): no land within %d pixels", s.Note, s.Tag, s.Res, s.Lon, s.Lat, siteReach))
			continue
		}
		e := eco[id]
		if e == nil {
			bad = append(bad, fmt.Sprintf("%s (%s %s): pixel %d has no region", s.Note, s.Tag, s.Res, px))
			continue
		}
		if owner := t.Countries[e.R.Owner-1].Tag; owner != s.Tag {
			bad = append(bad, fmt.Sprintf("%s (%s %s at %.2f, %.2f): falls in %s's region %d %q", s.Note, s.Tag, s.Res, s.Lon, s.Lat, owner, e.R.ID, e.R.Name))
			continue
		}
		e.Res[resourceIndex(s.Res)] += s.Amount
	}
	if len(bad) > 0 {
		return fmt.Errorf("resource sites:\n  %s", strings.Join(bad, "\n  "))
	}
	return nil
}

// industryReach is how far (pixels) an industry point or yard may lie off
// the land.
const industryReach = 8

// placeIndustry sets each region's industry multiplier (the largest of the
// points in it) and naval yard weight (the sum of its yards). A point that
// finds no land or lands in another country's region, and a yard whose
// region has no coast or the generator drops, is an error.
func placeIndustry(ind Industry, p Projection, kept []bool, ids []uint16, eco map[int]*EcoRegion, t *Tables, sum *EconomySummary) error {
	var bad []string
	find := func(tag, note string, lon, lat float64) *EcoRegion {
		id, _, ok := pointRegion(p, kept, ids, lon, lat, industryReach)
		e := eco[id]
		if !ok || e == nil {
			bad = append(bad, fmt.Sprintf("%s (%s at %.2f, %.2f): no land within %d pixels", note, tag, lon, lat, industryReach))
			return nil
		}
		if owner := t.Countries[e.R.Owner-1].Tag; owner != tag {
			bad = append(bad, fmt.Sprintf("%s (%s at %.2f, %.2f): falls in %s's region %d %q", note, tag, lon, lat, owner, e.R.ID, e.R.Name))
			return nil
		}
		return e
	}
	for _, pt := range ind.Industry {
		if e := find(pt.Tag, pt.Note, pt.Lon, pt.Lat); e != nil {
			e.Mult = max(e.Mult, pt.Mult)
			sum.Points = append(sum.Points, fmt.Sprintf("%s ×%d %s → %d %q", pt.Tag, pt.Mult, pt.Note, e.R.ID, e.R.Name))
		}
	}
	for _, y := range ind.Yards {
		e := find(y.Tag, y.Note, y.Lon, y.Lat)
		if e == nil {
			continue
		}
		if !e.Coastal {
			bad = append(bad, fmt.Sprintf("yard %s (%s): region %d %q has no coast", y.Note, y.Tag, e.R.ID, e.R.Name))
			continue
		}
		e.Yard += y.Weight
		sum.Points = append(sum.Points, fmt.Sprintf("%s yard %d %s → %d %q", y.Tag, y.Weight, y.Note, e.R.ID, e.R.Name))
	}
	if len(bad) > 0 {
		return fmt.Errorf("industry1936.json:\n  %s", strings.Join(bad, "\n  "))
	}
	return nil
}

// loadIndustry reads industry1936.json: known tags, multipliers and yard
// weights of at least 1.
func loadIndustry(path string, t *Tables) (Industry, error) {
	var ind Industry
	if err := decodeStrict(path, &ind); err != nil {
		return ind, err
	}
	var bad []string
	for _, pt := range ind.Industry {
		if _, ok := t.tagIndex[pt.Tag]; !ok || pt.Mult < 1 {
			bad = append(bad, fmt.Sprintf("industry %s: tag %s, mult %d", pt.Note, pt.Tag, pt.Mult))
		}
	}
	for _, y := range ind.Yards {
		if _, ok := t.tagIndex[y.Tag]; !ok || y.Weight < 1 {
			bad = append(bad, fmt.Sprintf("yard %s: tag %s, weight %d", y.Note, y.Tag, y.Weight))
		}
	}
	if len(bad) > 0 {
		return ind, fmt.Errorf("%s:\n  %s", path, strings.Join(bad, "\n  "))
	}
	return ind, nil
}

// featureOwner is the 1936 owner of an admin-1 unit by the owner tables
// (the adm1 override, else its modern country's), "" when none.
func featureOwner(f Feature, t *Tables) string {
	if tag, ok := t.Owners.Adm1[adm1Key(f)]; ok {
		return tag
	}
	if o := t.Owners.Adm0[f.Str("adm0_a3")]; o != nil {
		return *o
	}
	return ""
}

// admUnits resolves a row's AdmPop names to admin-1 units (feature index +
// 1) the row's country owns; each name must match exactly one.
func admUnits(row EconomyRow, admin []Feature, t *Tables) (map[int32]int64, []string) {
	byName := map[string][]int32{}
	for i, f := range admin {
		if featureOwner(f, t) == row.Tag {
			byName[f.Str("name")] = append(byName[f.Str("name")], int32(i+1))
		}
	}
	names := make([]string, 0, len(row.AdmPop))
	for name := range row.AdmPop {
		names = append(names, name)
	}
	sort.Strings(names)
	units := map[int32]int64{}
	var bad []string
	for _, name := range names {
		switch u := byName[name]; len(u) {
		case 1:
			if row.AdmPop[name] < 0 {
				bad = append(bad, fmt.Sprintf("%s admPop %q: negative", row.Tag, name))
			}
			units[u[0]] = int64(row.AdmPop[name])
		case 0:
			bad = append(bad, fmt.Sprintf("%s admPop %q: no such admin-1 unit of %s", row.Tag, name, row.Tag))
		default:
			bad = append(bad, fmt.Sprintf("%s admPop %q: %d units of that name", row.Tag, name, len(u)))
		}
	}
	return units, bad
}

// censusWeights are the homeland population weights of a country with
// AdmPop: each unit's population spreads over the regions holding its land
// by the places and area there (the usual weights, inside the unit), so a
// region's weight is Σ unit pop × 10^6 × its share of the unit.
func censusWeights(core []*EcoRegion, units map[int32]int64, adm []int32, kept []bool, hits []placeHit, admin []Feature) ([]int64, []string) {
	type ru struct {
		region int
		unit   int32
	}
	index := map[int]int{}
	for i, e := range core {
		index[e.R.ID] = i
	}
	count := map[ru]int{}
	for i, e := range core {
		for _, px := range e.R.Pixels {
			if kept[px] {
				count[ru{i, adm[px]}]++
			}
		}
	}
	people := map[ru]int64{}
	for _, h := range hits {
		if i, ok := index[h.region]; ok {
			people[ru{i, h.unit}] += h.pop
		}
	}
	keys := make([]ru, 0, len(count))
	for k := range count {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(a, b int) bool {
		if keys[a].unit != keys[b].unit {
			return keys[a].unit < keys[b].unit
		}
		return keys[a].region < keys[b].region
	})
	local := map[ru]int64{}
	unitTotal := map[int32]int64{}
	var bad []string
	for _, k := range keys {
		if _, ok := units[k.unit]; !ok {
			name := "no unit"
			if k.unit > 0 {
				name = admin[k.unit-1].Str("name")
			}
			bad = append(bad, fmt.Sprintf("region %d %q: admin-1 unit %q has no admPop", core[k.region].R.ID, core[k.region].R.Name, name))
			continue
		}
		l := popWeight(people[k], count[k])
		local[k] = l
		unitTotal[k.unit] += l
	}
	weights := make([]int64, len(core))
	for _, k := range keys {
		if l, ok := local[k]; ok && unitTotal[k.unit] > 0 {
			weights[k.region] += units[k.unit] * 1_000_000 * l / unitTotal[k.unit]
		}
	}
	return weights, bad
}

// buildEconomy runs spec §3.3 for every region. regions are in id order
// (region k has id k + 1), capitals the capital pixel per country
// (assignVP), ids the land region per pixel, places the populated places
// that spread each country's people.
func buildEconomy(p Projection, land []bool, ids []uint16, regions []*Region, capitals []int, admin []Feature, t *Tables, in EconomyInput) ([]*EcoRegion, EconomySummary, error) {
	w := p.Width
	n := w * p.Height
	rows := in.Rows
	kept, water := generatorLand(land, w, n, in.Keep...)
	hits := placeHits(in.Places, p, kept, ids, in.Adm)
	people := regionPeople(hits, len(regions))
	sum := EconomySummary{Civ: make([]int, len(t.Countries)), Mil: make([]int, len(t.Countries)), Dock: make([]int, len(t.Countries))}
	eco := make([]*EcoRegion, len(regions))
	byID := make(map[int]*EcoRegion, len(regions))
	perCountry := make([][]*EcoRegion, len(t.Countries))
	for k, r := range regions {
		e := &EcoRegion{R: r, Mult: 1}
		e.Dropped = regionDropped(r, kept)
		e.Core = regionCore(r, admin, t, rows[r.Owner-1])
		e.Coastal = !e.Dropped && regionCoastal(r, kept, water, w)
		e.Capital = int(ids[capitals[r.Owner-1]]) == r.ID
		eco[k] = e
		byID[r.ID] = e
		if e.Dropped {
			sum.Dropped++
			continue
		}
		perCountry[r.Owner-1] = append(perCountry[r.Owner-1], e)
		if e.Core {
			if a := regionAdm0(r, admin); a != "" {
				if o := t.Owners.Adm0[a]; o == nil || *o != t.Countries[r.Owner-1].Tag {
					sum.ForeignCore = append(sum.ForeignCore, fmt.Sprintf("%s %d %q on %s", t.Countries[r.Owner-1].Tag, r.ID, r.Name, a))
				}
			}
		}
	}
	var errs []string
	if err := placeIndustry(in.Industry, p, kept, ids, byID, t, &sum); err != nil {
		errs = append(errs, err.Error())
	}
	for c, list := range perCountry {
		row := rows[c]
		tag := t.Countries[c].Tag
		if len(list) == 0 {
			errs = append(errs, tag+": no region stays on the map")
			continue
		}
		var core, colonial []*EcoRegion
		for _, e := range list {
			if e.Core {
				core = append(core, e)
			} else {
				colonial = append(colonial, e)
			}
		}
		popCore, popColonial := row.PopCore, row.PopColonial
		if len(colonial) == 0 {
			popCore, popColonial = popCore+popColonial, 0
		}
		if len(core) == 0 {
			popColonial, popCore = popCore+popColonial, 0
		}
		for k, part := range []struct {
			list []*EcoRegion
			pop  int
		}{{core, popCore}, {colonial, popColonial}} {
			weights := make([]int64, len(part.list))
			for i, e := range part.list {
				weights[i] = popWeight(people[e.R.ID], len(e.R.Pixels))
			}
			if k == 0 && len(row.AdmPop) > 0 {
				if in.Adm == nil {
					errs = append(errs, tag+": admPop needs the admin-1 raster")
					continue
				}
				units, bad := admUnits(row, admin, t)
				if len(bad) == 0 {
					weights, bad = censusWeights(part.list, units, in.Adm, kept, hits, admin)
				}
				if len(bad) > 0 {
					errs = append(errs, bad...)
					continue
				}
			}
			for i, v := range apportion(part.pop, weights) {
				part.list[i].Pop = v
			}
		}
		base := row.Dev
		if row.Infra != nil {
			base = *row.Infra
		}
		hasCoast := false
		for _, e := range list {
			// An industrial region has the slots its industry needs: its
			// category reads its population times its multiplier.
			e.Cat = categoryIndex(e.Pop*e.Mult, e.R.MaxTier, e.Capital)
			e.Infra = infraOf(base, e.R.Tiers, len(e.R.Pixels), e.Core, e.Cat == catWasteland)
			hasCoast = hasCoast || e.Coastal
		}
		civ, mil, dock := factoryCounts(row, hasCoast)
		if dock > 0 && !hasCoast {
			errs = append(errs, fmt.Sprintf("%s: %d dockyards but no coastal region", tag, dock))
			continue
		}
		bumps, err := placeFactories(list, civ, mil, dock)
		if err != nil {
			errs = append(errs, tag+": "+err.Error())
			continue
		}
		sum.Bumps += bumps
		sum.Civ[c], sum.Mil[c], sum.Dock[c] = civ, mil, dock
	}
	if len(errs) > 0 {
		return nil, sum, fmt.Errorf("economy:\n  %s", strings.Join(errs, "\n  "))
	}
	if err := placeSites(in.Sites, p, kept, ids, byID, t); err != nil {
		return nil, sum, err
	}
	sum.Sites = len(in.Sites)
	for _, e := range eco {
		if e.Dropped {
			e.Infra = 1
		}
	}
	return eco, sum, nil
}

// printEconomy prints the factory totals per country, the category steps
// added, the sites placed and the core regions on another modern country's
// land (to check the nonCore lists by eye).
func printEconomy(t *Tables, sum EconomySummary) {
	fmt.Printf("economy: %d sites placed, %d category steps added, %d regions the generator drops\n", sum.Sites, sum.Bumps, sum.Dropped)
	fmt.Println("factories per country (civ/mil/dock):")
	var line []string
	for c, ct := range t.Countries {
		line = append(line, fmt.Sprintf("%s %d/%d/%d", ct.Tag, sum.Civ[c], sum.Mil[c], sum.Dock[c]))
		if len(line) == 8 {
			fmt.Println("  " + strings.Join(line, "  "))
			line = nil
		}
	}
	if len(line) > 0 {
		fmt.Println("  " + strings.Join(line, "  "))
	}
	fmt.Printf("industry points and naval yards: %d\n", len(sum.Points))
	for _, s := range sum.Points {
		fmt.Println("  " + s)
	}
	fmt.Printf("core regions on another modern country's land: %d\n", len(sum.ForeignCore))
	for _, s := range sum.ForeignCore {
		fmt.Println("  " + s)
	}
}
