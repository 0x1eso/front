package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

// CountryRow is one line of src/countries.json: a tag and its capital.
type CountryRow struct {
	Tag     string     `json:"tag"`
	Capital [2]float64 `json:"capital"` // lon, lat
}

// Patch gives the land inside a polygon to a 1936 owner (spec §4.4), only on
// the listed modern countries / admin-1 units when those lists are set.
type Patch struct {
	Owner   string       `json:"owner"`
	Note    string       `json:"note"`
	Adm0    []string     `json:"adm0,omitempty"`
	Adm1    []string     `json:"adm1,omitempty"`
	Polygon [][2]float64 `json:"polygon"`
}

// OwnerTables is src/owners1936.json.
type OwnerTables struct {
	// Modern country (Natural Earth adm0_a3) → 1936 tag; null: no owner,
	// the land takes its neighbours'.
	Adm0 map[string]*string `json:"adm0"`
	// Modern countries drawn with fewer, larger regions (colonies).
	LowDetail []string `json:"lowDetail"`
	// "ADM0:Natural Earth admin-1 name" → 1936 tag.
	Adm1    map[string]string `json:"adm1"`
	Patches []Patch           `json:"patches"`
}

// City is one line of src/vp_cities.json.
type City struct {
	Name string  `json:"name"`
	Lon  float64 `json:"lon"`
	Lat  float64 `json:"lat"`
	Tier int     `json:"tier"`
}

type Tables struct {
	Countries []CountryRow
	Owners    OwnerTables
	Cities    []City
	// Optional src/region_names.json: "TAG:generated name" → [name, nameKo].
	RegionNames map[string][2]string
	tagIndex    map[string]int // 1-based
	lowDetail   map[string]bool
}

func readJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	return nil
}

func loadTables(dir string) (*Tables, error) {
	t := &Tables{tagIndex: map[string]int{}, lowDetail: map[string]bool{}}
	if err := readJSON(filepath.Join(dir, "countries.json"), &t.Countries); err != nil {
		return nil, err
	}
	if err := readJSON(filepath.Join(dir, "owners1936.json"), &t.Owners); err != nil {
		return nil, err
	}
	if err := readJSON(filepath.Join(dir, "vp_cities.json"), &t.Cities); err != nil {
		return nil, err
	}
	if _, err := os.Stat(filepath.Join(dir, "region_names.json")); err == nil {
		if err := readJSON(filepath.Join(dir, "region_names.json"), &t.RegionNames); err != nil {
			return nil, err
		}
	}
	if len(t.Countries) > 254 {
		return nil, fmt.Errorf("too many countries for a byte: %d", len(t.Countries))
	}
	for i, c := range t.Countries {
		if _, dup := t.tagIndex[c.Tag]; dup {
			return nil, fmt.Errorf("countries.json: %s twice", c.Tag)
		}
		t.tagIndex[c.Tag] = i + 1
	}
	var bad []string
	check := func(where, tag string) {
		if _, ok := t.tagIndex[tag]; !ok {
			bad = append(bad, where+" → "+tag)
		}
	}
	for k, v := range t.Owners.Adm0 {
		if v != nil {
			check("adm0 "+k, *v)
		}
	}
	for k, v := range t.Owners.Adm1 {
		check("adm1 "+k, v)
	}
	for _, p := range t.Owners.Patches {
		check("patch "+p.Note, p.Owner)
		if len(p.Polygon) < 3 {
			bad = append(bad, "patch "+p.Note+" has fewer than 3 points")
		}
	}
	for _, a := range t.Owners.LowDetail {
		t.lowDetail[a] = true
	}
	if len(bad) > 0 {
		sort.Strings(bad)
		return nil, fmt.Errorf("unknown tags in the tables:\n  %v", bad)
	}
	return t, nil
}

func adm1Key(f Feature) string { return f.Str("adm0_a3") + ":" + f.Str("name") }

// assignOwners rasterizes the admin-1 units and gives every land pixel its
// 1936 owner (1-based index into countries.json). adm holds the admin-1
// feature index + 1 per pixel (0 = none).
func assignOwners(p Projection, land []bool, admin []Feature, t *Tables) ([]uint8, []int32, error) {
	n := p.Width * p.Height
	adm := make([]int32, n)
	for i, f := range admin {
		id := int32(i + 1)
		for _, poly := range f.Polygons {
			fillPolygon(p, poly, func(px int) { adm[px] = id })
		}
	}
	featOwner := make([]uint8, len(admin)+1)
	usedAdm1 := map[string]bool{}
	missing := map[string]bool{}
	for i, f := range admin {
		key := adm1Key(f)
		if tag, ok := t.Owners.Adm1[key]; ok {
			featOwner[i+1] = uint8(t.tagIndex[tag])
			usedAdm1[key] = true
			continue
		}
		a0 := f.Str("adm0_a3")
		o, ok := t.Owners.Adm0[a0]
		if !ok {
			missing[a0] = true
			continue
		}
		if o != nil {
			featOwner[i+1] = uint8(t.tagIndex[*o])
		}
	}
	var errs []string
	for a0 := range missing {
		errs = append(errs, "adm0 "+a0+" is not in owners1936.json")
	}
	for key := range t.Owners.Adm1 {
		if !usedAdm1[key] {
			errs = append(errs, "adm1 "+key+" matches no Natural Earth unit")
		}
	}
	if len(errs) > 0 {
		sort.Strings(errs)
		return nil, nil, fmt.Errorf("owner tables:\n  %v", errs)
	}
	owner := make([]uint8, n)
	for i := 0; i < n; i++ {
		if land[i] && adm[i] != 0 {
			owner[i] = featOwner[adm[i]]
		}
	}
	for _, pt := range t.Owners.Patches {
		allow0 := map[string]bool{}
		for _, a := range pt.Adm0 {
			allow0[a] = true
		}
		allow1 := map[string]bool{}
		for _, a := range pt.Adm1 {
			allow1[a] = true
		}
		tag := uint8(t.tagIndex[pt.Owner])
		ring := make(Ring, len(pt.Polygon))
		copy(ring, pt.Polygon)
		fillPolygon(p, Polygon{ring}, func(px int) {
			if !land[px] || adm[px] == 0 {
				return
			}
			f := admin[adm[px]-1]
			if len(allow0) > 0 && !allow0[f.Str("adm0_a3")] {
				return
			}
			if len(allow1) > 0 && !allow1[adm1Key(f)] {
				return
			}
			owner[px] = tag
		})
	}
	// Land Natural Earth's admin-1 layer misses (coast mismatches) or that
	// has no owner: its nearest owned land's owner and unit.
	queue := make([]int32, 0, 1<<16)
	for i := 0; i < n; i++ {
		if land[i] && owner[i] != 0 {
			queue = append(queue, int32(i))
		}
	}
	for head := 0; head < len(queue); head++ {
		i := int(queue[head])
		forNeighbours4(i, p.Width, n, func(j int) {
			if land[j] && owner[j] == 0 {
				owner[j] = owner[i]
				adm[j] = adm[i]
				queue = append(queue, int32(j))
			}
		})
	}
	// Islands no owned land reaches over land: the nearest owned land across
	// the water.
	origin := make([]int32, n)
	for i := range origin {
		origin[i] = -1
	}
	queue = queue[:0]
	for i := 0; i < n; i++ {
		if land[i] && owner[i] != 0 {
			origin[i] = int32(i)
			queue = append(queue, int32(i))
		}
	}
	for head := 0; head < len(queue); head++ {
		i := int(queue[head])
		forNeighbours4(i, p.Width, n, func(j int) {
			if origin[j] != -1 {
				return
			}
			origin[j] = origin[i]
			if land[j] && owner[j] == 0 {
				owner[j] = owner[origin[i]]
				adm[j] = adm[origin[i]]
			}
			queue = append(queue, int32(j))
		})
	}
	return owner, adm, nil
}
