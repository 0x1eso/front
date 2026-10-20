package main

import (
	"fmt"
	"strings"
)

// The start tables of the P4 buildings (P4 spec §6.4, §12.1):
// src/navalBases1936.json and src/coastalForts1936.json name places by
// lon/lat; each goes to the coastal region at the point (one with a harbour
// zone), or the nearest coastal region's tile when the point is water or an
// inland region. The islands of src/islands1936.json add their own
// navalBase, airBase and coastalFort. A region named twice keeps the larger
// level. The generator (map-generator/regions.go) applies the formulas to
// every region without a hand value: a naval base min(3, 1 + dockyards) in
// a P2 port with a harbour, the air base and anti-air of spec §12.1.

// baseReach is how far (tiles) a base's point may lie from its coastal
// region.
const baseReach = 30

// BaseRow is a line of navalBases1936.json or coastalForts1936.json. Tag is
// the 1936 owner the region must have (a check on the point).
type BaseRow struct {
	Name  string  `json:"name"`
	Tag   string  `json:"tag"`
	Lon   float64 `json:"lon"`
	Lat   float64 `json:"lat"`
	Level int     `json:"level"`
}

// BaseTables are the two hand tables.
type BaseTables struct {
	Naval []BaseRow
	Forts []BaseRow
}

func loadBases(navalPath, fortPath string) (BaseTables, error) {
	var b BaseTables
	if err := decodeStrict(navalPath, &b.Naval); err != nil {
		return b, err
	}
	if err := decodeStrict(fortPath, &b.Forts); err != nil {
		return b, err
	}
	var bad []string
	check := func(rows []BaseRow, maxLevel int, what string) {
		seen := map[string]bool{}
		for _, r := range rows {
			if r.Name == "" || seen[r.Name] || r.Tag == "" || r.Level < 1 || r.Level > maxLevel {
				bad = append(bad, fmt.Sprintf("%s %q: empty, twice, or level %d outside 1..%d", what, r.Name, r.Level, maxLevel))
			}
			seen[r.Name] = true
		}
	}
	check(b.Naval, 10, "naval base")
	check(b.Forts, 5, "coastal fort")
	if len(bad) > 0 {
		return b, fmt.Errorf("base tables:\n  %s", strings.Join(bad, "\n  "))
	}
	return b, nil
}

// HandBases are the hand start levels by region id: a region missing from
// a map takes the generator's formula.
type HandBases struct {
	Naval   map[int]int
	Air     map[int]int
	Forts   map[int]int
	Report  []string
	ByLevel map[int]int // hand naval bases per level, after the max
}

// coastalRegionAt is the coastal region (with a harbour zone) at a point, or
// the one of the nearest such tile within baseReach.
func coastalRegionAt(p Projection, ids []uint16, harbor map[int]int, lon, lat float64) (int, bool) {
	px, ok := p.Pixel(lon, lat)
	if !ok {
		return 0, false
	}
	t, ok := nearestLandTile(ids, p.Width, p.Height, px, baseReach, func(id int) bool { return harbor[id] != 0 })
	if !ok {
		return 0, false
	}
	return int(ids[t]), true
}

// resolveBases turns the hand tables and the islands into levels by region.
// owner gives a region's 1936 owner tag (surviving regions only).
func resolveBases(p Projection, ids []uint16, harbor map[int]int, tbl BaseTables, islands []IslandRow, regions []*Region, owner map[int]string) (HandBases, error) {
	hb := HandBases{Naval: map[int]int{}, Air: map[int]int{}, Forts: map[int]int{}, ByLevel: map[int]int{}}
	var bad []string
	names := map[int]string{}
	for _, r := range regions {
		names[r.ID] = r.Name
	}
	place := func(rows []BaseRow, into map[int]int, what string) {
		for _, r := range rows {
			id, ok := coastalRegionAt(p, ids, harbor, r.Lon, r.Lat)
			if !ok {
				bad = append(bad, fmt.Sprintf("%s %s (%.2f, %.2f): no coastal region within %d tiles", what, r.Name, r.Lon, r.Lat, baseReach))
				continue
			}
			if owner[id] != r.Tag {
				bad = append(bad, fmt.Sprintf("%s %s: region %d is %s's, not %s's", what, r.Name, id, owner[id], r.Tag))
				continue
			}
			line := fmt.Sprintf("%s %s %d → %d %s:%s", what, r.Name, r.Level, id, owner[id], names[id])
			if old, twice := into[id]; twice {
				line += fmt.Sprintf(" (shared: level %d)", max(old, r.Level))
			}
			hb.Report = append(hb.Report, line)
			into[id] = max(into[id], r.Level)
		}
	}
	place(tbl.Naval, hb.Naval, "naval base")
	place(tbl.Forts, hb.Forts, "coastal fort")
	islandRegion := map[string]int{}
	for _, r := range regions {
		if r.Island != "" {
			if _, ok := owner[r.ID]; ok {
				islandRegion[r.Island] = r.ID
			}
		}
	}
	for _, row := range islands {
		id, ok := islandRegion[row.Key]
		if !ok {
			bad = append(bad, fmt.Sprintf("island %s: no region on the final map", row.Key))
			continue
		}
		// An island's navalBase is its start level, 0 included (P4 plan Task
		// 2 Step 5); its airBase only when it has one (the ISLAND_AIRBASE
		// table of spec §12.1); its coastalFort only when it has one.
		if row.NavalBase > 0 && harbor[id] == 0 {
			bad = append(bad, fmt.Sprintf("island %s: a naval base without a harbour", row.Key))
		}
		hb.Naval[id] = max(hb.Naval[id], row.NavalBase)
		if row.AirBase > 0 {
			hb.Air[id] = max(hb.Air[id], row.AirBase)
		}
		if row.CoastalFort > 0 {
			hb.Forts[id] = max(hb.Forts[id], row.CoastalFort)
		}
	}
	if len(bad) > 0 {
		return hb, fmt.Errorf("naval bases and coastal forts:\n  %s", strings.Join(bad, "\n  "))
	}
	for _, lv := range hb.Naval {
		if lv > 0 {
			hb.ByLevel[lv]++
		}
	}
	return hb, nil
}
