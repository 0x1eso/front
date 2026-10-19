package main

import (
	"fmt"
	"sort"
)

const seaZoneBase = 40000

type seaPart struct {
	label   int32
	pixels  []int32
	mainLen int
}

// buildSeas cuts the water into sea zones (spec §4.6): Natural Earth marine
// areas (larger first, so smaller ones inside them win) and big named lakes;
// the rest of the water takes its nearest area. Zones over MaxSea are split,
// and parts under MinSea join the water zone they share the longest edge
// with (or the nearest zone when they touch none). Ids run from
// seaZoneBase+1 in the order of each zone's first pixel.
func buildSeas(p Projection, land []bool, marine, lakes []Feature, prm Params) ([]uint16, []*Region, error) {
	w := p.Width
	n := w * p.Height
	type named struct{ name, nameKo string }
	var names []named
	label := make([]int32, n)
	type area struct{ idx, pixels int }
	var order []area
	for i, f := range marine {
		count := 0
		for _, poly := range f.Polygons {
			fillPolygon(p, poly, func(px int) {
				if !land[px] {
					count++
				}
			})
		}
		if count > 0 {
			order = append(order, area{i, count})
		}
	}
	sort.Slice(order, func(a, b int) bool {
		if order[a].pixels != order[b].pixels {
			return order[a].pixels > order[b].pixels
		}
		return order[a].idx < order[b].idx
	})
	paint := func(f Feature) {
		names = append(names, named{f.Str("name"), f.Str("name_ko")})
		id := int32(len(names))
		for _, poly := range f.Polygons {
			fillPolygon(p, poly, func(px int) {
				if !land[px] {
					label[px] = id
				}
			})
		}
	}
	for _, a := range order {
		paint(marine[a.idx])
	}
	for _, f := range lakes {
		if f.Num("scalerank") <= 2 && f.Str("name") != "" {
			paint(f)
		}
	}
	// Water the areas miss: first along the water, then (lakes no area
	// reaches) the nearest labelled water across land.
	queue := make([]int32, 0, 1<<16)
	for i := 0; i < n; i++ {
		if !land[i] && label[i] != 0 {
			queue = append(queue, int32(i))
		}
	}
	for head := 0; head < len(queue); head++ {
		i := int(queue[head])
		forNeighbours4(i, w, n, func(j int) {
			if !land[j] && label[j] == 0 {
				label[j] = label[i]
				queue = append(queue, int32(j))
			}
		})
	}
	reach := make([]int32, n)
	queue = queue[:0]
	for i := 0; i < n; i++ {
		if !land[i] && label[i] != 0 {
			reach[i] = label[i]
			queue = append(queue, int32(i))
		}
	}
	for head := 0; head < len(queue); head++ {
		i := int(queue[head])
		forNeighbours4(i, w, n, func(j int) {
			if reach[j] != 0 {
				return
			}
			reach[j] = reach[i]
			if !land[j] && label[j] == 0 {
				label[j] = reach[i]
			}
			queue = append(queue, int32(j))
		})
	}

	// Connected parts of each label, the big ones split.
	seen := make([]bool, n)
	mark := make([]int32, n)
	var parts []*seaPart
	for i := 0; i < n; i++ {
		if land[i] || label[i] == 0 || seen[i] {
			continue
		}
		seen[i] = true
		pix := []int32{int32(i)}
		for head := 0; head < len(pix); head++ {
			k := int(pix[head])
			forNeighbours4(k, w, n, func(j int) {
				if !seen[j] && !land[j] && label[j] == label[k] {
					seen[j] = true
					pix = append(pix, int32(j))
				}
			})
		}
		if len(pix) <= prm.MaxSea {
			parts = append(parts, &seaPart{label: label[i], pixels: pix, mainLen: len(pix)})
			continue
		}
		k := (len(pix) + prm.MaxSea - 1) / prm.MaxSea
		for _, sp := range splitPixels(pix, k, w, n, mark, int32(len(parts)+1)) {
			parts = append(parts, &seaPart{label: label[i], pixels: sp, mainLen: len(sp)})
		}
	}

	// Small parts join a neighbour, smallest first, until none is left.
	partOf := make([]int32, n)
	for k, pt := range parts {
		for _, px := range pt.pixels {
			partOf[px] = int32(k + 1)
		}
	}
	alive := make([]bool, len(parts))
	for k := range alive {
		alive[k] = true
	}
	for {
		idx := make([]int, 0, len(parts))
		for k := range parts {
			if alive[k] && len(parts[k].pixels) < prm.MinSea {
				idx = append(idx, k)
			}
		}
		sort.Slice(idx, func(a, b int) bool {
			la, lb := len(parts[idx[a]].pixels), len(parts[idx[b]].pixels)
			if la != lb {
				return la < lb
			}
			return idx[a] < idx[b]
		})
		merged := false
		for _, k := range idx {
			if !alive[k] || len(parts[k].pixels) >= prm.MinSea {
				continue
			}
			own := int32(k + 1)
			edges := map[int32]int{}
			for _, px := range parts[k].pixels {
				forNeighbours4(int(px), w, n, func(j int) {
					if !land[j] && partOf[j] != own && partOf[j] != 0 {
						edges[partOf[j]]++
					}
				})
			}
			best, bestN := int32(0), 0
			for o, c := range edges {
				if c > bestN || (c == bestN && o < best) {
					best, bestN = o, c
				}
			}
			if best == 0 {
				best = nearestGroup(parts[k].pixels, w, n, w, func(j int) int32 {
					if land[j] || partOf[j] == own || partOf[j] == 0 {
						return 0
					}
					return partOf[j]
				})
			}
			if best == 0 {
				continue
			}
			tg := parts[best-1]
			for _, px := range parts[k].pixels {
				partOf[px] = best
			}
			tg.pixels = append(tg.pixels, parts[k].pixels...)
			if parts[k].mainLen > tg.mainLen {
				tg.label, tg.mainLen = parts[k].label, parts[k].mainLen
			}
			parts[k].pixels = nil
			alive[k] = false
			merged = true
		}
		if !merged {
			break
		}
	}
	var final []*seaPart
	for k, pt := range parts {
		if alive[k] {
			sort.Slice(pt.pixels, func(a, b int) bool { return pt.pixels[a] < pt.pixels[b] })
			final = append(final, pt)
		}
	}
	sort.Slice(final, func(a, b int) bool { return final[a].pixels[0] < final[b].pixels[0] })
	if seaZoneBase+len(final) > 0xffff {
		return nil, nil, fmt.Errorf("%d sea zones do not fit in 16 bits", len(final))
	}
	ids := make([]uint16, n)
	zones := make([]*Region, len(final))
	for k, pt := range final {
		id := seaZoneBase + 1 + k
		for _, px := range pt.pixels {
			ids[px] = uint16(id)
		}
		nm := names[pt.label-1]
		z := &Region{ID: id, Pixels: pt.pixels, Name: nm.name, NameKo: nm.nameKo, VPTile: -1}
		if z.Name == "" {
			z.Name = "Sea"
		}
		if z.NameKo == "" {
			z.NameKo = z.Name
		}
		zones[k] = z
	}
	dedupeNames(zones)
	return ids, zones, nil
}
