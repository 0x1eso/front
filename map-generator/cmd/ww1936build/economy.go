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

// regionPeople sums the pop_max of the places in each region, by region id:
// a place counts for the region of the nearest staying land pixel within
// placeReach; places in the sea or off the map count for none.
func regionPeople(places []Place, p Projection, kept []bool, ids []uint16, regions int) []int64 {
	out := make([]int64, regions+1)
	for _, pl := range places {
		px, ok := p.Pixel(pl.Lon, pl.Lat)
		if ok {
			px, ok = nearestLand(p, kept, px, placeReach)
		}
		if !ok {
			continue
		}
		if id := int(ids[px]); id > 0 && id <= regions {
			out[id] += pl.Pop
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
// neither.
func generatorLand(land []bool, w, n int) (kept, water []bool) {
	kept = make([]bool, n)
	water = make([]bool, n)
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
			keep := len(pix) >= minIsland
			for _, px := range pix {
				kept[px] = keep
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

// factoryWeight is w2 (spec §3.3-7 as amended): the region's population, so
// the factories follow the people (the Ruhr, the Midlands, the Donbas…),
// halved in a colony.
func factoryWeight(e *EcoRegion) int64 {
	w := int64(e.Pop)
	if !e.Core {
		w /= 2
	}
	return w
}

// placeFactories (spec §3.3-7) places one country's dockyards, then civ,
// then mil, one at a time, D'Hondt: each goes to the region with free slots
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
	bumps := 0
	for {
		for _, e := range regions {
			e.Civ, e.Mil, e.Dock = 0, 0, 0
		}
		done := true
	place:
		for kind, count := range []int{dock, civ, mil} {
			for k := 0; k < count; k++ {
				best := pick(kind, true)
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
		px, ok := p.Pixel(s.Lon, s.Lat)
		if ok {
			px, ok = nearestLand(p, kept, px, siteReach)
		}
		if !ok {
			bad = append(bad, fmt.Sprintf("%s (%s %s at %.2f, %.2f): no land within %d pixels", s.Note, s.Tag, s.Res, s.Lon, s.Lat, siteReach))
			continue
		}
		e := eco[int(ids[px])]
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

// buildEconomy runs spec §3.3 for every region. regions are in id order
// (region k has id k + 1), capitals the capital pixel per country
// (assignVP), ids the land region per pixel, places the populated places
// that spread each country's people.
func buildEconomy(p Projection, land []bool, ids []uint16, regions []*Region, capitals []int, admin []Feature, t *Tables, rows []EconomyRow, sites []Site, places []Place) ([]*EcoRegion, EconomySummary, error) {
	w := p.Width
	n := w * p.Height
	kept, water := generatorLand(land, w, n)
	people := regionPeople(places, p, kept, ids, len(regions))
	sum := EconomySummary{Civ: make([]int, len(t.Countries)), Mil: make([]int, len(t.Countries)), Dock: make([]int, len(t.Countries))}
	eco := make([]*EcoRegion, len(regions))
	byID := make(map[int]*EcoRegion, len(regions))
	perCountry := make([][]*EcoRegion, len(t.Countries))
	for k, r := range regions {
		e := &EcoRegion{R: r}
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
		for _, part := range []struct {
			list []*EcoRegion
			pop  int
		}{{core, popCore}, {colonial, popColonial}} {
			weights := make([]int64, len(part.list))
			for i, e := range part.list {
				weights[i] = popWeight(people[e.R.ID], len(e.R.Pixels))
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
			e.Cat = categoryIndex(e.Pop, e.R.MaxTier, e.Capital)
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
	if err := placeSites(sites, p, kept, ids, byID, t); err != nil {
		return nil, sum, err
	}
	sum.Sites = len(sites)
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
	fmt.Printf("core regions on another modern country's land: %d\n", len(sum.ForeignCore))
	for _, s := range sum.ForeignCore {
		fmt.Println("  " + s)
	}
}
