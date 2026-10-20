package main

import (
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"sort"
)

// capitalVP is what a capital adds to its region (WW_CAPITAL_VP).
const capitalVP = 15

// baseVP is what a region holding a city or a capital gets on top of their
// weights. A region without one is worth nothing (spec §7.5 as amended: the
// empty land of Siberia must not hold a large share of the Soviet points).
const baseVP = 1

// nearestLand finds a land pixel within r pixels of px (cities on the coast
// can fall in the sea), scanning rings outwards, row by row.
func nearestLand(p Projection, land []bool, px, r int) (int, bool) {
	if land[px] {
		return px, true
	}
	x0, y0 := px%p.Width, px/p.Width
	for d := 1; d <= r; d++ {
		for y := y0 - d; y <= y0+d; y++ {
			for x := x0 - d; x <= x0+d; x++ {
				if x < 0 || y < 0 || x >= p.Width || y >= p.Height {
					continue
				}
				if max(abs(x-x0), abs(y-y0)) != d {
					continue
				}
				if land[y*p.Width+x] {
					return y*p.Width + x, true
				}
			}
		}
	}
	return 0, false
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

// assignVP adds each city's tier to the region it is in and +capitalVP to
// each capital's, and baseVP to every region holding either (spec §7.5). A
// region's VP tile is its capital, else its highest-tier city (first listed
// on ties).
// Returns each country's capital pixel.
func assignVP(p Projection, land []bool, ids []uint16, regions []*Region, t *Tables) ([]int, error) {
	byID := map[int]*Region{}
	for _, r := range regions {
		byID[r.ID] = r
	}
	for _, c := range t.Cities {
		px, ok := p.Pixel(c.Lon, c.Lat)
		if !ok {
			continue
		}
		px, ok = nearestLand(p, land, px, 3)
		if !ok {
			continue
		}
		r := byID[int(ids[px])]
		if r == nil {
			continue
		}
		if r.vpWeight == 0 {
			r.VP += baseVP
		}
		r.VP += c.Tier
		r.Tiers += c.Tier
		r.MaxTier = max(r.MaxTier, c.Tier)
		if c.Tier > r.vpWeight {
			r.vpWeight = c.Tier
			r.VPTile = px
		}
	}
	capitals := make([]int, len(t.Countries))
	var errs []string
	for i, c := range t.Countries {
		px, ok := p.Pixel(c.Capital[0], c.Capital[1])
		if ok {
			px, ok = nearestLand(p, land, px, 3)
		}
		if !ok {
			errs = append(errs, c.Tag+": capital is not on land")
			continue
		}
		r := byID[int(ids[px])]
		if r == nil || r.Owner != i+1 {
			errs = append(errs, fmt.Sprintf("%s: capital (%.2f, %.2f) is not on its own land", c.Tag, c.Capital[0], c.Capital[1]))
			continue
		}
		if r.vpWeight == 0 {
			r.VP += baseVP
		}
		r.VP += capitalVP
		r.vpWeight = 1 << 20
		r.VPTile = px
		capitals[i] = px
	}
	if len(errs) > 0 {
		return nil, fmt.Errorf("capitals:\n  %v", errs)
	}
	return capitals, nil
}

// writeRegionsPNG stores ids as R = id >> 8, G = id & 255.
func writeRegionsPNG(path string, p Projection, land, sea []uint16) error {
	img := image.NewNRGBA(image.Rect(0, 0, p.Width, p.Height))
	for i := 0; i < p.Width*p.Height; i++ {
		id := land[i]
		if id == 0 {
			id = sea[i]
		}
		img.SetNRGBA(i%p.Width, i/p.Width, color.NRGBA{uint8(id >> 8), uint8(id), 0, 255})
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}

type srcCountryOut struct {
	Tag     string `json:"tag"`
	Capital [2]int `json:"capital"`
	Dev     int    `json:"dev"`
}

// srcRegionOut is a region of scenario.src.json, version 3 (P1 spec §3.1:
// the economy fields after vpTile; P2 spec §3.1: the land graph fields after
// those). Port is a hand harbour (an island of islands1936.json), the
// generator's formula adds the rest. A region the generator drops has no
// land-graph fields.
type srcRegionOut struct {
	ID      int     `json:"id"`
	Name    string  `json:"name"`
	NameKo  string  `json:"nameKo"`
	Owner   string  `json:"owner"`
	VP      int     `json:"vp"`
	VPTile  *[2]int `json:"vpTile,omitempty"`
	Cat     string  `json:"cat"`
	Pop     int     `json:"pop"`
	Infra   int     `json:"infra"`
	Core    bool    `json:"core"`
	Coastal bool    `json:"coastal"`
	Civ     int     `json:"civ"`
	Mil     int     `json:"mil"`
	Dock    int     `json:"dock"`
	Res     [6]int  `json:"res"`
	Land    string  `json:"land,omitempty"`
	Center  *[2]int `json:"center,omitempty"`
	LatC    int     `json:"latC"`
	WCell   int     `json:"wcell"`
	Rail    int     `json:"rail"`
	Fort    int     `json:"fort"`
	Port    bool    `json:"port,omitempty"`
	Island  string  `json:"island,omitempty"`
}

type srcSeaOut struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	NameKo string `json:"nameKo"`
	Lake   bool   `json:"lake,omitempty"`
}

// ScenarioSrcInput is what writeScenarioSrc writes.
type ScenarioSrcInput struct {
	P        Projection
	T        *Tables
	Rows     []EconomyRow // countries.json order
	Capitals []int
	Regions  []*Region // stable ids, ascending
	Eco      map[int]*EcoRegion
	Seas     []*Region
	Land     LandGraph
	Sea      SeaGraph
	Islands  []IslandRow
	Places   []IslandPlace
}

// writeScenarioSrc writes scenario.src.json (read by the map generator,
// map-generator/regions.go), version 3.
func writeScenarioSrc(path string, in ScenarioSrcInput) error {
	p := in.P
	xy := func(px int) *[2]int { return &[2]int{px % p.Width, px / p.Width} }
	out := struct {
		Version       int             `json:"version"`
		Countries     []srcCountryOut `json:"countries"`
		Regions       []srcRegionOut  `json:"regions"`
		SeaZones      []srcSeaOut     `json:"seaZones"`
		Edges         []Edge          `json:"edges"`
		SeaEdges      []SeaEdge       `json:"seaEdges"`
		Straits       []Strait        `json:"straits"`
		HistoricalOob bool            `json:"historicalOob"`
		KeepIslands   [][2]int        `json:"keepIslands"`
	}{Version: 3, Edges: in.Land.Edges, SeaEdges: in.Sea.Edges, Straits: in.Sea.Straits, HistoricalOob: true}
	for i, c := range in.T.Countries {
		out.Countries = append(out.Countries, srcCountryOut{c.Tag, *xy(in.Capitals[i]), in.Rows[i].Dev})
	}
	hand := map[string]bool{}
	for _, r := range in.Islands {
		hand[r.Key] = r.Port
	}
	for _, r := range in.Regions {
		e := in.Eco[r.ID]
		row := srcRegionOut{
			ID: r.ID, Name: r.Name, NameKo: r.NameKo, Owner: in.T.Countries[r.Owner-1].Tag, VP: r.VP,
			Cat: categories[e.Cat], Pop: e.Pop, Infra: e.Infra, Core: e.Core, Coastal: e.Coastal,
			Civ: e.Civ, Mil: e.Mil, Dock: e.Dock, Res: e.Res, Island: r.Island, Port: hand[r.Island],
		}
		if r.VPTile >= 0 {
			row.VPTile = xy(r.VPTile)
		}
		if v, ok := in.Land.V3[r.ID]; ok {
			row.Land, row.Center, row.LatC, row.WCell, row.Rail, row.Fort = v.Land, xy(v.Center), v.LatC, v.WCell, v.Rail, v.Fort
		}
		out.Regions = append(out.Regions, row)
	}
	for _, z := range in.Seas {
		out.SeaZones = append(out.SeaZones, srcSeaOut{z.ID, z.Name, z.NameKo, z.Lake})
	}
	for _, pl := range in.Places {
		out.KeepIslands = append(out.KeepIslands, *xy(pl.Point))
	}
	js, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(js, '\n'), 0644)
}

// summary prints region counts per country, smallest first.
func summary(t *Tables, regions []*Region) {
	per := map[string]int{}
	for _, r := range regions {
		per[t.Countries[r.Owner-1].Tag]++
	}
	tags := make([]string, 0, len(per))
	for tag := range per {
		tags = append(tags, tag)
	}
	sort.Slice(tags, func(a, b int) bool {
		if per[tags[a]] != per[tags[b]] {
			return per[tags[a]] < per[tags[b]]
		}
		return tags[a] < tags[b]
	})
	for _, tag := range tags {
		fmt.Printf("  %s %d\n", tag, per[tag])
	}
}
