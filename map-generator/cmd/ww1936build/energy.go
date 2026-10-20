package main

import (
	"fmt"
	"sort"
	"strings"
)

// Version 5 (P6 spec §16.1, P6 plan Task 15): each region's coal, uranium
// and hydro power, the thirteen landmarks and the nine dams.
//
// src/energy1936.json lists the coal fields, uranium mines and hydro power
// as sites (owner tag, amount, lon/lat), placed like the P1 resource sites
// (placeSites) but on the final map: the region of the nearest land tile
// within siteReach, which must be the tag's. A region's value is the sum of
// its sites, at most coalMax, uraniumMax or hydroMax. src/landmarks1936.json
// names the landmarks' and dams' regions ("TAG:name") and each dam's
// downstream regions (at most damDownstreamMax, each touching the dam's
// region or an earlier one of its list). Nothing lands on a region of a
// modern country in noData (the Korean Peninsula and Taiwan: P6 spec §24-3,
// plan decision 33).

const (
	coalMax          = 8
	uraniumMax       = 6
	hydroMax         = 6
	landmarksMax     = 2 // New York holds two (spec §16.3)
	damDownstreamMax = 3
)

// landmarkIDs and damIDs are engine-api DepthTypes.ts LANDMARKS and DAMS
// (P6 plan Task 1 Step 1): keep them in step.
var landmarkIDs = []string{
	"lm_eiffel", "lm_westminster", "lm_kremlin", "lm_brandenburg", "lm_colosseum", "lm_liberty", "lm_empire_state",
	"lm_golden_gate", "lm_hagia_sophia", "lm_forbidden_city", "lm_himeji", "lm_christ_redeemer", "lm_taj_mahal",
}

var damIDs = []string{
	"dam_hoover", "dam_grand_coulee", "dam_norris", "dam_dnipro", "dam_mohne", "dam_eder", "dam_kembs", "dam_galloway", "dam_vemork",
}

// EnergyTable is src/energy1936.json.
type EnergyTable struct {
	Sources []string     `json:"sources"`
	NoData  []string     `json:"noData"`
	Coal    []EnergySite `json:"coal"`
	Uranium []EnergySite `json:"uranium"`
	Hydro   []EnergySite `json:"hydro"`
}

// EnergySite is one coal field, uranium mine or hydro power area.
type EnergySite struct {
	Tag    string  `json:"tag"`
	Amount int     `json:"amount"`
	Lon    float64 `json:"lon"`
	Lat    float64 `json:"lat"`
	Note   string  `json:"note"`
}

// LandmarkTable is src/landmarks1936.json.
type LandmarkTable struct {
	Landmarks []LandmarkRow `json:"landmarks"`
	Dams      []DamRow      `json:"dams"`
}

// LandmarkRow is a landmark and its region.
type LandmarkRow struct {
	ID     string `json:"id"`
	Region string `json:"region"`
	Note   string `json:"note"`
}

// DamRow is a dam, its region and the regions downstream of it.
type DamRow struct {
	ID         string   `json:"id"`
	Region     string   `json:"region"`
	Downstream []string `json:"downstream"`
	Note       string   `json:"note"`
}

// DamOut is a region's dam in scenario.src.json and scenario.json.
type DamOut struct {
	ID         string `json:"id"`
	Downstream []int  `json:"downstream"`
}

// RegionV5 is what version 5 adds to a region.
type RegionV5 struct {
	Coal, Uranium, Hydro int
	Landmarks            []string
	Dam                  *DamOut
}

// V5Input is what buildV5 reads beside the final map.
type V5Input struct {
	Energy    EnergyTable
	Landmarks LandmarkTable
	Regions   []*Region      // stable ids
	Tags      []string       // countries.json order
	Admin     []Feature      // for each region's modern country
	ByName    map[string]int // "TAG:name" → id, surviving regions
	Edges     []Edge
}

// V5Result is each region's version 5 data (regions with none left out) and
// what the tool prints.
type V5Result struct {
	ByID   map[int]*RegionV5
	Report []string
}

// buildV5 places the version 5 data on the final map; every mistake fails.
func buildV5(p Projection, final []uint16, in V5Input) (V5Result, error) {
	res := V5Result{ByID: map[int]*RegionV5{}}
	byID := map[int]*Region{}
	for _, r := range in.Regions {
		byID[r.ID] = r
	}
	name := func(id int) string { return fmt.Sprintf("%d %s:%s", id, in.Tags[byID[id].Owner-1], byID[id].Name) }
	noData := map[string]bool{}
	for _, a := range in.Energy.NoData {
		noData[a] = true
	}
	var bad []string
	allowed := func(what string, id int) bool {
		if a := regionAdm0(byID[id], in.Admin); noData[a] {
			bad = append(bad, fmt.Sprintf("%s: region %s lies in %s, which holds no version 5 data (spec §24-3)", what, name(id), a))
			return false
		}
		return true
	}
	get := func(id int) *RegionV5 {
		v := res.ByID[id]
		if v == nil {
			v = &RegionV5{}
			res.ByID[id] = v
		}
		return v
	}
	w, h := p.Width, p.Height
	place := func(kind string, sites []EnergySite, field func(*RegionV5) *int, most int) {
		per := map[string]int{}
		for _, s := range sites {
			what := fmt.Sprintf("%s %s (%s, %d)", kind, s.Note, s.Tag, s.Amount)
			if s.Amount < 1 {
				bad = append(bad, what+": amount below 1")
				continue
			}
			px, ok := p.Pixel(s.Lon, s.Lat)
			if ok {
				px, ok = nearestLandTile(final, w, h, px, siteReach, func(int) bool { return true })
			}
			if !ok {
				bad = append(bad, fmt.Sprintf("%s at %.2f, %.2f: no land within %d tiles", what, s.Lon, s.Lat, siteReach))
				continue
			}
			id := int(final[px])
			if owner := in.Tags[byID[id].Owner-1]; owner != s.Tag {
				bad = append(bad, fmt.Sprintf("%s at %.2f, %.2f: falls in %s", what, s.Lon, s.Lat, name(id)))
				continue
			}
			if !allowed(what, id) {
				continue
			}
			*field(get(id)) += s.Amount
			per[s.Tag] += s.Amount
			res.Report = append(res.Report, fmt.Sprintf("%s %s %d %s → %s", kind, s.Tag, s.Amount, s.Note, name(id)))
		}
		ids := make([]int, 0, len(res.ByID))
		for id := range res.ByID {
			ids = append(ids, id)
		}
		sort.Ints(ids)
		regions := 0
		for _, id := range ids {
			v := *field(res.ByID[id])
			if v > most {
				bad = append(bad, fmt.Sprintf("%s: region %s holds %d, at most %d", kind, name(id), v, most))
			}
			if v > 0 {
				regions++
			}
		}
		var line []string
		for _, tag := range in.Tags {
			if per[tag] > 0 {
				line = append(line, fmt.Sprintf("%s %d", tag, per[tag]))
			}
		}
		res.Report = append(res.Report, fmt.Sprintf("%s per country (%d regions): %s", kind, regions, strings.Join(line, ", ")))
	}
	place("coal", in.Energy.Coal, func(v *RegionV5) *int { return &v.Coal }, coalMax)
	place("uranium", in.Energy.Uranium, func(v *RegionV5) *int { return &v.Uranium }, uraniumMax)
	place("hydro", in.Energy.Hydro, func(v *RegionV5) *int { return &v.Hydro }, hydroMax)

	region := func(what, key string) (int, bool) {
		id, ok := in.ByName[key]
		if !ok {
			bad = append(bad, fmt.Sprintf("%s: no region %q", what, key))
			return 0, false
		}
		return id, allowed(what, id)
	}
	known := func(list []string, id string) bool {
		for _, k := range list {
			if k == id {
				return true
			}
		}
		return false
	}
	seen := map[string]bool{}
	for _, l := range in.Landmarks.Landmarks {
		what := "landmark " + l.ID
		if !known(landmarkIDs, l.ID) || seen[l.ID] {
			bad = append(bad, what+": unknown or twice")
			continue
		}
		seen[l.ID] = true
		if id, ok := region(what, l.Region); ok {
			v := get(id)
			v.Landmarks = append(v.Landmarks, l.ID)
			if len(v.Landmarks) > landmarksMax {
				bad = append(bad, fmt.Sprintf("%s: region %s holds more than %d landmarks", what, name(id), landmarksMax))
			}
			res.Report = append(res.Report, fmt.Sprintf("%s → %s", what, name(id)))
		}
	}
	for _, id := range landmarkIDs {
		if !seen[id] {
			bad = append(bad, "landmark "+id+" is missing")
		}
	}
	touch := map[int64]bool{}
	for _, e := range in.Edges {
		touch[pairKey(e.A, e.B)] = true
	}
	for _, d := range in.Landmarks.Dams {
		what := "dam " + d.ID
		if !known(damIDs, d.ID) || seen[d.ID] {
			bad = append(bad, what+": unknown or twice")
			continue
		}
		seen[d.ID] = true
		id, ok := region(what, d.Region)
		if !ok {
			continue
		}
		if len(d.Downstream) > damDownstreamMax {
			bad = append(bad, fmt.Sprintf("%s: %d downstream regions, at most %d", what, len(d.Downstream), damDownstreamMax))
		}
		out := &DamOut{Downstream: []int{}, ID: d.ID}
		chain := []int{id}
		var names []string
		for _, key := range d.Downstream {
			down, ok := region(what+" downstream", key)
			if !ok {
				continue
			}
			joined := false
			for _, c := range chain {
				if c == down {
					bad = append(bad, fmt.Sprintf("%s: downstream %s twice or the dam's own", what, name(down)))
				}
				joined = joined || touch[pairKey(c, down)]
			}
			if !joined {
				bad = append(bad, fmt.Sprintf("%s: downstream %s touches neither the dam's region nor an earlier downstream region", what, name(down)))
			}
			chain = append(chain, down)
			out.Downstream = append(out.Downstream, down)
			names = append(names, name(down))
		}
		v := get(id)
		if v.Dam != nil {
			bad = append(bad, fmt.Sprintf("%s: region %s already has %s", what, name(id), v.Dam.ID))
			continue
		}
		v.Dam = out
		res.Report = append(res.Report, fmt.Sprintf("%s → %s, downstream [%s]", what, name(id), strings.Join(names, ", ")))
	}
	for _, id := range damIDs {
		if !seen[id] {
			bad = append(bad, "dam "+id+" is missing")
		}
	}
	if len(bad) > 0 {
		return res, fmt.Errorf("version 5 data:\n  %s", strings.Join(bad, "\n  "))
	}
	return res, nil
}
