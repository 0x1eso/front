package main

import (
	"fmt"
	"sort"
)

// crossCheck compares the 1936 owners with a historical-basemaps file
// (aourednik, GPL-3.0; spec §4.2: compared only, nothing derived is
// written). For each country it prints the share of its land that falls in
// the file's best-matching NAME. Prints only; returns read errors.
func crossCheck(p Projection, land []bool, owner []uint8, t *Tables, path string) error {
	feats, err := readFeatures(path)
	if err != nil {
		return err
	}
	n := p.Width * p.Height
	label := make([]int32, n)
	for i, f := range feats {
		id := int32(i + 1)
		for _, poly := range f.Polygons {
			fillPolygon(p, poly, func(px int) { label[px] = id })
		}
	}
	ours := make([]int, len(t.Countries)+1)
	overlap := make([]map[string]int, len(t.Countries)+1)
	for i := range overlap {
		overlap[i] = map[string]int{}
	}
	for i := 0; i < n; i++ {
		if !land[i] || owner[i] == 0 {
			continue
		}
		o := owner[i]
		ours[o]++
		if label[i] != 0 {
			overlap[o][matchName(feats[label[i]-1])]++
		}
	}
	type row struct {
		tag    string
		name   string
		share  float64
		others string
	}
	var rows []row
	for i, c := range t.Countries {
		o := i + 1
		best, bestN := "", 0
		for name, k := range overlap[o] {
			if k > bestN || (k == bestN && name < best) {
				best, bestN = name, k
			}
		}
		share := 0.0
		if ours[o] > 0 {
			share = float64(bestN) / float64(ours[o])
		}
		others := ""
		names := make([]string, 0, len(overlap[o]))
		for name := range overlap[o] {
			if name != best {
				names = append(names, name)
			}
		}
		sort.Slice(names, func(a, b int) bool {
			return overlap[o][names[a]] > overlap[o][names[b]] || (overlap[o][names[a]] == overlap[o][names[b]] && names[a] < names[b])
		})
		for k, name := range names {
			if k == 2 {
				break
			}
			others += fmt.Sprintf("; %s %.1f%%", name, 100*float64(overlap[o][name])/float64(ours[o]))
		}
		rows = append(rows, row{c.Tag, best, share, others})
	}
	sort.Slice(rows, func(a, b int) bool { return rows[a].share < rows[b].share })
	fmt.Println("share of each country's 1936 land inside its best match in", path)
	for _, r := range rows {
		fmt.Printf("  %s %5.1f%%  %s%s\n", r.tag, 100*r.share, r.name, r.others)
	}
	return nil
}

// matchName groups a basemap feature under its colonial power when it has
// one (SUBJECTO), else under its own NAME.
func matchName(f Feature) string {
	if s := f.Str("SUBJECTO"); s != "" {
		return s
	}
	return f.Str("NAME")
}
