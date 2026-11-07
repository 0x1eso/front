package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
)

// overlayFirstID is the first id of a 1914 place cut by the overlay: its
// parts in file order, so the table is append only. The 1936 regions that
// stay keep their ids.
const overlayFirstID = 2001

// overlayMinRemnant is the smallest rest of a 1936 region the overlay leaves
// as a region of its own, in pixels; a smaller rest joins a neighbour.
const overlayMinRemnant = 40

// OverlayPart is one 1914 place: all of its row's land, or the row's land
// nearest its point when the row has several.
type OverlayPart struct {
	Key  string      `json:"key"`
	Name [2]string   `json:"name"`
	At   *[2]float64 `json:"at,omitempty"`
}

// OverlayRow is a piece of land drawn again for 1914: its admin-1 units,
// and the units of the countries in Adm0 (all of them, or those inside
// Polygon). A pixel an earlier row took stays there.
type OverlayRow struct {
	Group   string        `json:"group"`
	Owner   string        `json:"owner"`
	Adm1    []string      `json:"adm1,omitempty"`
	Adm0    []string      `json:"adm0,omitempty"`
	Polygon [][2]float64  `json:"polygon,omitempty"`
	Parts   []OverlayPart `json:"parts"`
}

// OverlayKeep names a 1936 region that stays as it is: a place content can
// reach, and its owner in 1914 when owners1914.json has it wrong.
type OverlayKeep struct {
	ID    int       `json:"id"`
	Key   string    `json:"key"`
	Name  [2]string `json:"name"`
	Group string    `json:"group"`
	Owner string    `json:"owner,omitempty"`
}

// Overlay is scenarios/world1914/src/regions1914.json.
type Overlay struct {
	Rows []OverlayRow  `json:"rows"`
	Keep []OverlayKeep `json:"keep"`
	// A "TAG:name" of straits1936.json the overlay drew over -> its place.
	Aliases map[string]string `json:"aliases"`
}

// OverlayPlace is what a region is in 1914, by region.
type OverlayPlace struct {
	Key, Group, Owner string
	Name              [2]string
}

// Owners1914 is resources/maps/world1936/owners1914.json: engine-lib
// ww1914/World1914.ts reads the same rules.
type Owners1914 map[string]struct {
	To     string
	Except map[string][]int
}

func (o *Owners1914) UnmarshalJSON(data []byte) error {
	var file struct {
		ByOwner map[string]json.RawMessage `json:"byOwner"`
	}
	if err := json.Unmarshal(data, &file); err != nil {
		return err
	}
	*o = Owners1914{}
	for k, raw := range file.ByOwner {
		v := (*o)[k]
		if err := json.Unmarshal(raw, &v.To); err != nil {
			var rule struct {
				To     string           `json:"to"`
				Except map[string][]int `json:"except"`
			}
			if err := json.Unmarshal(raw, &rule); err != nil {
				return fmt.Errorf("owners1914 %s: %w", k, err)
			}
			v.To, v.Except = rule.To, rule.Except
		}
		(*o)[k] = v
	}
	return nil
}

// Of is a 1936 region's owner in 1914.
func (o Owners1914) Of(id int, tag string) string {
	rule, ok := o[tag]
	if !ok {
		return tag
	}
	for to, ids := range rule.Except {
		for _, x := range ids {
			if x == id {
				return to
			}
		}
	}
	return rule.To
}

func loadOverlay(path string) (*Overlay, error) {
	var ov Overlay
	if err := decodeStrict(path, &ov); err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var bad []string
	check := func(key string, name [2]string) {
		if key == "" || name[0] == "" || name[1] == "" {
			bad = append(bad, fmt.Sprintf("place %q has no key or name", key))
		}
		if seen[key] {
			bad = append(bad, "place "+key+" twice")
		}
		seen[key] = true
	}
	for k, r := range ov.Rows {
		if r.Group == "" || r.Owner == "" || len(r.Parts) == 0 {
			bad = append(bad, fmt.Sprintf("row %d needs a group, an owner and parts", k))
		}
		for _, p := range r.Parts {
			check(p.Key, p.Name)
			if len(r.Parts) > 1 && p.At == nil {
				bad = append(bad, "part "+p.Key+" needs a point")
			}
		}
	}
	for _, r := range ov.Keep {
		check(r.Key, r.Name)
	}
	if len(bad) > 0 {
		return nil, fmt.Errorf("regions1914:\n  %s", strings.Join(bad, "\n  "))
	}
	return &ov, nil
}

// overlayRowOf gives each land pixel of a region the row that takes it: the
// first that matches, -1 for none.
func overlayRowOf(p Projection, ov *Overlay, adm []int32, admin []Feature) ([]int32, error) {
	n := p.Width * p.Height
	unit := map[string][]int32{}
	country := map[string][]int32{}
	for i, f := range admin {
		unit[adm1Key(f)] = append(unit[adm1Key(f)], int32(i+1))
		a0 := f.Str("adm0_a3")
		country[a0] = append(country[a0], int32(i+1))
	}
	rowOf := make([]int32, n)
	for i := range rowOf {
		rowOf[i] = -1
	}
	for k, r := range ov.Rows {
		take := map[int32]bool{}
		for _, key := range r.Adm1 {
			if len(unit[key]) == 0 {
				return nil, fmt.Errorf("regions1914 row %s: no Natural Earth unit %q", r.Parts[0].Key, key)
			}
			for _, u := range unit[key] {
				take[u] = true
			}
		}
		inCountry := map[int32]bool{}
		for _, a0 := range r.Adm0 {
			if len(country[a0]) == 0 {
				return nil, fmt.Errorf("regions1914 row %s: no country %q", r.Parts[0].Key, a0)
			}
			for _, u := range country[a0] {
				inCountry[u] = true
			}
		}
		if len(r.Polygon) == 0 {
			for u := range inCountry {
				take[u] = true
			}
		} else {
			ring := make(Ring, len(r.Polygon))
			copy(ring, r.Polygon)
			fillPolygon(p, Polygon{ring}, func(px int) {
				if rowOf[px] == -1 && (len(inCountry) == 0 || inCountry[adm[px]]) {
					rowOf[px] = int32(k)
				}
			})
		}
		for px := 0; px < n; px++ {
			if rowOf[px] == -1 && take[adm[px]] {
				rowOf[px] = int32(k)
			}
		}
	}
	return rowOf, nil
}

// applyOverlay draws the 1914 places over the finished regions: every row's
// land leaves its region and joins the row's parts, and a rest that came
// apart joins its neighbours. Returns the regions, numbered again, and the
// ids the new ones must have (stableIDs).
func applyOverlay(p Projection, regions []*Region, ids []uint16, adm []int32, owner []uint8, admin []Feature, ov *Overlay) ([]*Region, map[*Region]int, map[*Region]OverlayPlace, error) {
	rowOf, err := overlayRowOf(p, ov, adm, admin)
	if err != nil {
		return nil, nil, nil, err
	}
	w, n := p.Width, p.Width*p.Height
	type seed struct{ x, y float64 }
	seeds := make([][]seed, len(ov.Rows))
	for k, r := range ov.Rows {
		for _, part := range r.Parts {
			if part.At != nil {
				x, y := p.ToPixel(part.At[0], part.At[1])
				seeds[k] = append(seeds[k], seed{x, y})
			}
		}
	}
	made := make([][]*Region, len(ov.Rows))
	pinned := map[*Region]int{}
	places := map[*Region]OverlayPlace{}
	next := overlayFirstID
	for k, r := range ov.Rows {
		for _, part := range r.Parts {
			reg := &Region{Name: part.Name[0], NameKo: part.Name[1], VPTile: -1, carved: true}
			made[k] = append(made[k], reg)
			pinned[reg] = next
			places[reg] = OverlayPlace{Key: part.Key, Group: r.Group, Owner: r.Owner, Name: part.Name}
			next++
		}
	}
	var out []*Region
	var gave []*Region
	for _, r := range regions {
		if r.Island != "" {
			out = append(out, r)
			continue
		}
		kept := r.Pixels[:0:0]
		for _, px := range r.Pixels {
			k := rowOf[px]
			if k < 0 {
				kept = append(kept, px)
				continue
			}
			part := 0
			if len(made[k]) > 1 {
				x, y := float64(int(px)%w), float64(int(px)/w)
				best := -1.0
				for i, s := range seeds[k] {
					d := (s.x-x)*(s.x-x) + (s.y-y)*(s.y-y)
					if best < 0 || d < best {
						best, part = d, i
					}
				}
			}
			made[k][part].Pixels = append(made[k][part].Pixels, px)
		}
		if len(kept) == len(r.Pixels) {
			out = append(out, r)
			continue
		}
		r.Pixels = kept
		if len(kept) > 0 {
			out = append(out, r)
			gave = append(gave, r)
		}
	}
	for k, row := range made {
		for i, reg := range row {
			if len(reg.Pixels) == 0 {
				return nil, nil, nil, fmt.Errorf("regions1914: %s has no land", ov.Rows[k].Parts[i].Key)
			}
			sort.Slice(reg.Pixels, func(a, b int) bool { return reg.Pixels[a] < reg.Pixels[b] })
			reg.Owner = int(mostOf(reg.Pixels, func(px int32) int32 { return int32(owner[px]) }))
			reg.MainAdm = mostOf(reg.Pixels, func(px int32) int32 { return adm[px] })
			out = append(out, reg)
		}
	}
	sort.Slice(out, func(a, b int) bool { return out[a].Pixels[0] < out[b].Pixels[0] })
	number := func() {
		for i := range ids {
			ids[i] = 0
		}
		for k, r := range out {
			r.ID = k + 1
			for _, px := range r.Pixels {
				ids[px] = uint16(r.ID)
			}
		}
	}
	number()
	// The rest of a region that came apart: the largest piece stays, unless
	// it is too small, and a piece touching other land joins the region it
	// shares the longest border with.
	byID := map[uint16]*Region{}
	for _, r := range out {
		byID[uint16(r.ID)] = r
	}
	seen := make([]bool, n)
	for _, r := range gave {
		var pieces [][]int32
		for _, start := range r.Pixels {
			if seen[start] {
				continue
			}
			seen[start] = true
			piece := []int32{start}
			for head := 0; head < len(piece); head++ {
				forNeighbours4(int(piece[head]), w, n, func(j int) {
					if !seen[j] && ids[j] == uint16(r.ID) {
						seen[j] = true
						piece = append(piece, int32(j))
					}
				})
			}
			pieces = append(pieces, piece)
		}
		sort.SliceStable(pieces, func(a, b int) bool { return len(pieces[a]) > len(pieces[b]) })
		var stay []int32
		for k, piece := range pieces {
			if k == 0 && len(piece) >= overlayMinRemnant {
				stay = append(stay, piece...)
				continue
			}
			border := map[uint16]int{}
			for _, px := range piece {
				forNeighbours4(int(px), w, n, func(j int) {
					if ids[j] != 0 && ids[j] != uint16(r.ID) {
						border[ids[j]]++
					}
				})
			}
			to, most := uint16(0), 0
			for id, c := range border {
				if c > most || (c == most && id < to) {
					to, most = id, c
				}
			}
			if to == 0 {
				stay = append(stay, piece...)
				continue
			}
			into := byID[to]
			into.Pixels = append(into.Pixels, piece...)
			for _, px := range piece {
				ids[px] = to
			}
		}
		sort.Slice(stay, func(a, b int) bool { return stay[a] < stay[b] })
		r.Pixels = stay
	}
	live := out[:0]
	for _, r := range out {
		if len(r.Pixels) > 0 {
			sort.Slice(r.Pixels, func(a, b int) bool { return r.Pixels[a] < r.Pixels[b] })
			live = append(live, r)
		}
	}
	out = live
	sort.Slice(out, func(a, b int) bool { return out[a].Pixels[0] < out[b].Pixels[0] })
	number()
	return out, pinned, places, nil
}

// mostOf is the value most pixels have (ties: the smaller value).
func mostOf(pixels []int32, of func(int32) int32) int32 {
	counts := map[int32]int{}
	for _, px := range pixels {
		counts[of(px)]++
	}
	var best int32
	most := 0
	for v, c := range counts {
		if c > most || (c == most && v < best) {
			best, most = v, c
		}
	}
	return best
}

// overlayFinish names the regions the overlay keeps and gives every region
// its owner in 1914, by the final ids. Returns region id -> place and
// region id -> owner.
func overlayFinish(regions []*Region, tags []string, ov *Overlay, places map[*Region]OverlayPlace, owners Owners1914) (map[int]OverlayPlace, map[int]string, error) {
	byID := map[int]*Region{}
	placeOf := map[int]OverlayPlace{}
	ownerOf := map[int]string{}
	for _, r := range regions {
		byID[r.ID] = r
		if pl, ok := places[r]; ok {
			placeOf[r.ID] = pl
			ownerOf[r.ID] = pl.Owner
		} else {
			ownerOf[r.ID] = owners.Of(r.ID, tags[r.Owner-1])
		}
	}
	for _, k := range ov.Keep {
		r := byID[k.ID]
		if r == nil {
			return nil, nil, fmt.Errorf("regions1914: keep %s: no region %d", k.Key, k.ID)
		}
		if _, dup := placeOf[k.ID]; dup {
			return nil, nil, fmt.Errorf("regions1914: keep %s: region %d is a place already", k.Key, k.ID)
		}
		r.Name, r.NameKo = k.Name[0], k.Name[1]
		if k.Owner != "" {
			ownerOf[k.ID] = k.Owner
		}
		placeOf[k.ID] = OverlayPlace{Key: k.Key, Group: k.Group, Owner: ownerOf[k.ID], Name: k.Name}
	}
	return placeOf, ownerOf, nil
}

// writePlaces writes engine-api ww1914/GwPlaces.gen.ts, the places content
// names: TypeScript, not JSON, because the server loads the engine's schemas
// and the Docker image holds no resources/maps.
func writePlaces(path string, placeOf map[int]OverlayPlace, center func(id int) [2]int) error {
	ids := make([]int, 0, len(placeOf))
	for id := range placeOf {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(a, b int) bool { return placeOf[ids[a]].Key < placeOf[ids[b]].Key })
	var b strings.Builder
	b.WriteString("// Generated by map-generator/cmd/ww1936build -overlay: do not edit.\n")
	b.WriteString("// Source: map-generator/scenarios/world1914/src/regions1914.json.\n\n")
	b.WriteString("export const GW_PLACES = {\n")
	for _, id := range ids {
		pl, c := placeOf[id], center(id)
		fmt.Fprintf(&b, "  %s: { id: %d, name: %q, nameKo: %q, group: %q, owner: %q, center: [%d, %d] },\n",
			pl.Key, id, pl.Name[0], pl.Name[1], pl.Group, pl.Owner, c[0], c[1])
	}
	b.WriteString("} as const;\n")
	return os.WriteFile(path, []byte(b.String()), 0644)
}
