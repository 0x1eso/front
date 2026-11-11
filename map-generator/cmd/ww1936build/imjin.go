package main

// The Imjin War map (ww175 design §3, §4): scenarios/imjin1592. It runs on
// the same projection, terrain image, owners, land graph and scenario.src.json
// as world1936, but draws its regions from towns instead of admin-1 units:
//
//	go run ./cmd/ww1936build -src scenarios/imjin1592/src \
//	  -out-dir scenarios/imjin1592 -out-image assets/maps/imjin1592/image.png \
//	  -width 2400 -lon-min 118 -lon-max 136 -lat-min 30.8 -lat-max 43.3
//
// then `go run -tags nodynamic . --maps=imjin1592`.
//
// - Every region is a town of towns1590.json: a seed that grows over its
//   owner's land (multi-source, 4-neighbour, in file order on ties) with every
//   river line as a wall, so borders follow the rivers. A pass is a small
//   disk of its own; an island is its land body.
// - The narrow channels of seaTiles.json are carved to 3 tiles of water with a
//   bank of land on each side; the small islands there are stamped.
// - Each region gets an Imjin terrain class (hand table, pass, fortress,
//   walled, else by height and land cover), the rivers' edges their class
//   (rivers1590.json names the big ones), fords.json marks fords, and every
//   water tile a sea flag byte (coastal, lee, channel, shoal, current id) as
//   run-length pairs in scenario.src.json's imjin block.

import (
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const imjinTownsFile = "towns1590.json"

// Sea flag bits (engine-lib imjin/Terrain.ts reads them).
const (
	seaFlagCoastal = 1
	seaFlagLee     = 2
	seaFlagChannel = 4
	seaFlagShoal   = 8
	// The current id sits in the high nibble.
	seaFlagCurrentShift = 4
)

const (
	imjinPassRadius   = 12    // a pass region is the owner's land within this many tiles
	imjinIslandMax    = 40000 // an island town's land body is at most this big
	imjinSeedReach    = 15    // a seed off its owner's land takes the nearest such tile within this
	imjinCoastalReach = 3     // coastal water: within this many tiles (Chebyshev) of land
	imjinShoalReach   = 8     // a shoal polygon marks water within this many tiles of land
	imjinLeeReach     = 2     // water this near a small island is lee
	imjinLeeIsland    = 2000  // an island under this many tiles makes lee water
	imjinFordReach    = 20
)

// ImjinArgs are the command's flags for the Imjin map.
type ImjinArgs struct {
	Cache, Src, OutImage, OutDir string
	P                            Projection
}

type imjinTown struct {
	Key       string  `json:"key"`
	Name      string  `json:"name,omitempty"`
	NameKo    string  `json:"nameKo"`
	Owner     string  `json:"owner"`
	Prov      string  `json:"prov"`
	Kind      string  `json:"kind,omitempty"`
	Lon       float64 `json:"lon"`
	Lat       float64 `json:"lat"`
	VP        int     `json:"vp"`
	Pop       int     `json:"pop"`
	Walled    bool    `json:"walled,omitempty"`
	Fortress  bool    `json:"fortress,omitempty"`
	NavalBase int     `json:"navalBase,omitempty"`
}

func (t imjinTown) name() string {
	if t.Name != "" {
		return t.Name
	}
	return t.Key
}

type imjinNamed struct {
	Key    string `json:"key"`
	Name   string `json:"name,omitempty"`
	NameKo string `json:"nameKo"`
}

type imjinSeaSeed struct {
	Name   string  `json:"name"`
	NameKo string  `json:"nameKo"`
	Lon    float64 `json:"lon"`
	Lat    float64 `json:"lat"`
}

// imjinChannel is a narrow channel: the builder finds the narrowest water
// between the island town's land body and other land near the point and
// cuts it to 3 tiles of water across, with banks of land beside it.
type imjinChannel struct {
	Key     string  `json:"key"`
	NameKo  string  `json:"nameKo"`
	Current int     `json:"current"`
	Island  string  `json:"island"`
	Lon     float64 `json:"lon"`
	Lat     float64 `json:"lat"`
}

type imjinPoly struct {
	Note    string       `json:"note"`
	Polygon [][2]float64 `json:"polygon"`
}

type imjinIsle struct {
	Key    string  `json:"key"`
	NameKo string  `json:"nameKo"`
	Owner  string  `json:"owner"`
	Lon    float64 `json:"lon"`
	Lat    float64 `json:"lat"`
	Stamp  int     `json:"stamp"`
}

type imjinTables struct {
	Countries []CountryRow
	Owners    struct {
		Note string `json:"note"`
		OwnerTables
	}
	Towns struct {
		Note string      `json:"note"`
		Rows []imjinTown `json:"rows"`
	}
	Provinces struct {
		Note string       `json:"note"`
		Rows []imjinNamed `json:"rows"`
	}
	Seas struct {
		Note string         `json:"note"`
		Rows []imjinSeaSeed `json:"rows"`
	}
	SeaTiles struct {
		Note     string         `json:"note"`
		Channels []imjinChannel `json:"channels"`
		Shoals   []imjinPoly    `json:"shoals"`
		Lee      []imjinPoly    `json:"lee"`
		Islands  []imjinIsle    `json:"islands"`
	}
	Rivers struct {
		Note  string   `json:"note"`
		Big   []string `json:"big"`
		Lines []struct {
			Name string       `json:"name"`
			Line [][2]float64 `json:"line"`
		} `json:"lines"`
	}
	Fords struct {
		Note string `json:"note"`
		Rows []struct {
			Key    string  `json:"key"`
			NameKo string  `json:"nameKo"`
			Lon    float64 `json:"lon"`
			Lat    float64 `json:"lat"`
		} `json:"rows"`
	}
	Terrain struct {
		Note string `json:"note"`
		Rows []struct {
			Note    string   `json:"note"`
			Class   string   `json:"class"`
			Regions []string `json:"regions"`
		} `json:"rows"`
	}
}

// imjinClasses are engine-lib imjin/Terrain.ts IMJIN_TERRAINS.
var imjinClasses = map[string]bool{
	"plain": true, "paddy": true, "hills": true, "forest": true, "mountain": true,
	"pass": true, "marsh": true, "walled": true, "fortress": true,
}

// imjinLand is the 1936 land terrain the kept 1936 battle loop reads for an
// Imjin class.
var imjinLand = map[string]string{
	"plain": terPlains, "paddy": terPlains, "hills": terHills, "forest": terForest,
	"mountain": terMountain, "pass": terMountain, "marsh": terMarsh, "walled": terUrban,
	"fortress": terMountain,
}

func loadImjinTables(dir string) (*imjinTables, error) {
	t := &imjinTables{}
	for _, f := range []struct {
		name string
		v    any
	}{
		{"countries.json", &t.Countries},
		{"owners1590.json", &t.Owners},
		{imjinTownsFile, &t.Towns},
		{"provinces1590.json", &t.Provinces},
		{"seaZones1590.json", &t.Seas},
		{"seaTiles.json", &t.SeaTiles},
		{"rivers1590.json", &t.Rivers},
		{"fords.json", &t.Fords},
		{"terrain1590.json", &t.Terrain},
	} {
		if err := decodeStrict(filepath.Join(dir, f.name), f.v); err != nil {
			return nil, err
		}
	}
	var bad []string
	tags := map[string]bool{}
	for _, c := range t.Countries {
		tags[c.Tag] = true
	}
	provs := map[string]bool{}
	for _, p := range t.Provinces.Rows {
		provs[p.Key] = true
	}
	keys := map[string]bool{}
	for _, r := range t.Towns.Rows {
		if keys[r.Key] || r.Key == "" || r.NameKo == "" {
			bad = append(bad, fmt.Sprintf("town %q: empty or twice", r.Key))
		}
		keys[r.Key] = true
		if !tags[r.Owner] {
			bad = append(bad, fmt.Sprintf("town %s: owner %q", r.Key, r.Owner))
		}
		if !provs[r.Prov] {
			bad = append(bad, fmt.Sprintf("town %s: province %q", r.Key, r.Prov))
		}
		if r.Kind != "" && r.Kind != "pass" && r.Kind != "island" {
			bad = append(bad, fmt.Sprintf("town %s: kind %q", r.Key, r.Kind))
		}
	}
	for _, r := range t.Terrain.Rows {
		if !imjinClasses[r.Class] {
			bad = append(bad, fmt.Sprintf("terrain %s: class %q", r.Note, r.Class))
		}
		for _, k := range r.Regions {
			if !keys[k] {
				bad = append(bad, fmt.Sprintf("terrain %s: no town %q", r.Note, k))
			}
		}
	}
	for _, s := range t.SeaTiles.Islands {
		if !tags[s.Owner] {
			bad = append(bad, fmt.Sprintf("island %s: owner %q", s.Key, s.Owner))
		}
	}
	if len(bad) > 0 {
		return nil, fmt.Errorf("imjin tables:\n  %s", strings.Join(bad, "\n  "))
	}
	return t, nil
}

// imjinChannelReach: the narrowest gap is looked for within this many tiles
// of a channel's point; imjinChannelHalf: half the carved channel's length.
const (
	imjinChannelReach = 30
	imjinChannelHalf  = 8
)

// carveChannels cuts each channel at the narrowest gap between its island
// (the land body of the island town nearest the point) and other land
// within imjinChannelReach of the point: water within 1.5 tiles of the
// channel's axis (through the gap's middle, square to it) along
// imjinChannelHalf tiles each way, and banks of land beside that water to
// the two shores, so the channel is 3 tiles across whatever the source
// coast does. Returns each carved water tile's current id (0 elsewhere),
// the bank tiles and each current's heading (0..63, 0 north, 16 east,
// along the axis).
func carveChannels(p Projection, land []bool, chans []imjinChannel, towns []imjinTown) ([]uint8, []bool, map[int]int, error) {
	w, h := p.Width, p.Height
	n := w * h
	cur := make([]uint8, n)
	bank := make([]bool, n)
	dirs := map[int]int{}
	townAt := map[string]imjinTown{}
	for _, t := range towns {
		townAt[t.Key] = t
	}
	for _, c := range chans {
		isle, ok := townAt[c.Island]
		if c.Current < 1 || c.Current > 15 || !ok || isle.Kind != "island" {
			return nil, nil, nil, fmt.Errorf("channel %s: current %d or island %q", c.Key, c.Current, c.Island)
		}
		ip, ok1 := p.Pixel(isle.Lon, isle.Lat)
		pt, ok2 := p.Pixel(c.Lon, c.Lat)
		if ok1 {
			ip, ok1 = nearestOf(w, h, ip, imjinSeedReach, func(i int) bool { return land[i] })
		}
		if !ok1 || !ok2 {
			return nil, nil, nil, fmt.Errorf("channel %s: off the map or its island has no land", c.Key)
		}
		inIsle := map[int32]bool{int32(ip): true}
		body := []int32{int32(ip)}
		for head := 0; head < len(body) && len(body) <= imjinIslandMax; head++ {
			forNeighbours4(int(body[head]), w, n, func(j int) {
				if land[j] && !inIsle[int32(j)] {
					inIsle[int32(j)] = true
					body = append(body, int32(j))
				}
			})
		}
		if len(body) > imjinIslandMax {
			return nil, nil, nil, fmt.Errorf("channel %s: island %s is joined to the mainland in the source", c.Key, c.Island)
		}
		x0, y0 := pt%w, pt/w
		bestD, bi, mi := math.MaxInt, -1, -1
		for y := max(0, y0-imjinChannelReach); y <= min(h-1, y0+imjinChannelReach); y++ {
			for x := max(0, x0-imjinChannelReach); x <= min(w-1, x0+imjinChannelReach); x++ {
				b := y*w + x
				if !inIsle[int32(b)] {
					continue
				}
				for yy := max(0, y-12); yy <= min(h-1, y+12); yy++ {
					for xx := max(0, x-12); xx <= min(w-1, x+12); xx++ {
						m := yy*w + xx
						if !land[m] || inIsle[int32(m)] {
							continue
						}
						d := (xx-x)*(xx-x) + (yy-y)*(yy-y)
						if d < bestD || (d == bestD && (b < bi || (b == bi && m < mi))) {
							bestD, bi, mi = d, b, m
						}
					}
				}
			}
		}
		if bi < 0 {
			return nil, nil, nil, fmt.Errorf("channel %s: no other land within 12 tiles of %s near the point", c.Key, c.Island)
		}
		bx, by := float64(bi%w)+0.5, float64(bi/w)+0.5
		mx, my := float64(mi%w)+0.5, float64(mi/w)+0.5
		gap := math.Hypot(mx-bx, my-by)
		ux, uy := (mx-bx)/gap, (my-by)/gap // across, island to mainland
		vx, vy := -uy, ux                  // along the channel
		cx, cy := (bx+mx)/2, (by+my)/2
		reachAcross := math.Max(3.5, gap/2+1.5)
		box := imjinChannelHalf + int(reachAcross) + 2
		for y := int(cy) - box; y <= int(cy)+box; y++ {
			for x := int(cx) - box; x <= int(cx)+box; x++ {
				if x < 0 || y < 0 || x >= w || y >= h {
					continue
				}
				i := y*w + x
				dx, dy := float64(x)+0.5-cx, float64(y)+0.5-cy
				along, across := math.Abs(dx*vx+dy*vy), math.Abs(dx*ux+dy*uy)
				switch {
				case across <= 1.5 && along <= imjinChannelHalf:
					land[i] = false
					cur[i] = uint8(c.Current)
				case across <= reachAcross && along <= imjinChannelHalf-2 && !land[i]:
					bank[i] = true
				}
			}
		}
		for i, b := range bank {
			if b && cur[i] == 0 {
				land[i] = true
			}
		}
		// Heading of the axis: 0 north (up), 16 east, 64 steps a turn.
		dir := int(math.Round(math.Atan2(vx, -vy)/(2*math.Pi)*64)) % 64
		if dir < 0 {
			dir += 64
		}
		dirs[c.Current] = dir
		log.Printf("channel %s: gap %.1f tiles at (%d, %d), heading %d", c.Key, gap, int(cx), int(cy), dir)
	}
	return cur, bank, dirs, nil
}

// nearestOf is the tile nearest px (Euclidean, then the smaller index)
// within reach that ok accepts.
func nearestOf(w, h, px, reach int, ok func(i int) bool) (int, bool) {
	x0, y0 := px%w, px/w
	best, bestD := -1, math.MaxInt
	for y := max(0, y0-reach); y <= min(h-1, y0+reach); y++ {
		for x := max(0, x0-reach); x <= min(w-1, x0+reach); x++ {
			i := y*w + x
			if !ok(i) {
				continue
			}
			d := (x-x0)*(x-x0) + (y-y0)*(y-y0)
			if d < bestD || (d == bestD && i < best) {
				best, bestD = i, d
			}
		}
	}
	return best, best >= 0
}

// chebyshevWithin marks the tiles within reach (8-neighbour steps) of a
// source tile.
func chebyshevWithin(src []bool, w, h, reach int) []bool {
	n := w * h
	dist := make([]int8, n)
	for i := range dist {
		dist[i] = -1
	}
	queue := make([]int32, 0, 1<<16)
	for i, s := range src {
		if s {
			dist[i] = 0
			queue = append(queue, int32(i))
		}
	}
	for head := 0; head < len(queue); head++ {
		i := int(queue[head])
		if int(dist[i]) >= reach {
			continue
		}
		x, y := i%w, i/w
		for dy := -1; dy <= 1; dy++ {
			for dx := -1; dx <= 1; dx++ {
				nx, ny := x+dx, y+dy
				if nx < 0 || ny < 0 || nx >= w || ny >= h {
					continue
				}
				j := ny*w + nx
				if dist[j] < 0 {
					dist[j] = dist[i] + 1
					queue = append(queue, int32(j))
				}
			}
		}
	}
	out := make([]bool, n)
	for i, d := range dist {
		out[i] = d >= 0
	}
	return out
}

// ImjinSrc is scenario.src.json's imjin block (map-generator/regions.go
// copies it to scenario.json as it is; engine-api ScenarioTypes ImjinMapSchema).
type ImjinSrc struct {
	// Fords are land edges [a, b] (a < b) on a river crossed at a ford.
	Fords [][2]int `json:"fords"`
	// SeaFlags is the sea flag byte of every tile in tile order as
	// run-length pairs [count, byte, count, byte, …].
	SeaFlags []int `json:"seaFlags"`
	// Currents name the current ids of the sea flags (id = index + 1).
	Currents []ImjinLabel `json:"currents"`
	// Labels name the passes, fords and channels on the map.
	Labels []ImjinLabel `json:"labels"`
}

// ImjinLabel is a named place on the map.
type ImjinLabel struct {
	Kind string `json:"kind"`
	// Dir: a channel's current heading (0..63, 0 north, 16 east), the axis
	// its current runs along; the current flips on the battle's clock.
	Dir    int    `json:"dir,omitempty"`
	Name   string `json:"name"`
	NameKo string `json:"nameKo"`
	X      int    `json:"x"`
	Y      int    `json:"y"`
}

// encodeRuns is the run-length pairs of a byte per tile.
func encodeRuns(b []uint8) []int {
	var out []int
	for i := 0; i < len(b); {
		j := i
		for j < len(b) && b[j] == b[i] {
			j++
		}
		out = append(out, j-i, int(b[i]))
		i = j
	}
	return out
}

// imjinRegionClass is a region's class by rule: walled and fortress towns,
// passes, then by its tiles' mean magnitude (the generator's height,
// writeTerrain) and majority MODIS land cover.
func imjinRegionClass(town imjinTown, meanMag float64, modis [256]int, tiles, latC int) string {
	switch {
	case town.Kind == "pass":
		return "pass"
	case town.Fortress:
		return "fortress"
	case town.Walled:
		return "walled"
	case meanMag >= 12:
		return "mountain"
	case meanMag >= 6:
		return "hills"
	}
	forest := 0
	for c := 1; c <= 5; c++ {
		forest += modis[c]
	}
	switch {
	case modis[11]*4 >= tiles:
		return "marsh"
	case forest*2 >= tiles:
		return "forest"
	case (modis[12]+modis[14])*3 >= tiles && latC < 3800:
		return "paddy"
	}
	return "plain"
}

func runImjin(a ImjinArgs) error {
	p := a.P
	w, h := p.Width, p.Height
	n := w * h
	log.Printf("imjin map %dx%d", w, h)
	t, err := loadImjinTables(a.Src)
	if err != nil {
		return err
	}
	ne := func(name string) ([]Feature, error) { return readFeatures(filepath.Join(a.Cache, name+".geojson")) }
	lakes, err := ne("ne_10m_lakes")
	if err != nil {
		return err
	}
	landFeats, err := ne("ne_10m_land")
	if err != nil {
		return err
	}
	land := buildLand(p, landFeats, lakes)
	current, bank, currentDir, err := carveChannels(p, land, t.SeaTiles.Channels, t.Towns.Rows)
	if err != nil {
		return err
	}
	stamped := append([]bool(nil), bank...)
	var keep []int
	var places []IslandPlace
	keepAt := func(pt int) {
		keep = append(keep, pt)
		places = append(places, IslandPlace{Point: pt})
	}
	stampAt := func(key string, lon, lat float64, count int) error {
		pt, ok := p.Pixel(lon, lat)
		if !ok {
			return fmt.Errorf("island %s is off the map", key)
		}
		if lp, ok := nearestOf(w, h, pt, 4, func(i int) bool { return land[i] }); ok {
			keepAt(lp)
			return nil
		}
		for _, px := range stampIsland(land, w, n, pt, max(count, minIsland)) {
			stamped[px] = true
		}
		keepAt(pt)
		return nil
	}
	for _, s := range t.SeaTiles.Islands {
		if err := stampAt(s.Key, s.Lon, s.Lat, s.Stamp); err != nil {
			return err
		}
	}
	for _, r := range t.Towns.Rows {
		if r.Kind == "island" {
			if err := stampAt(r.Key, r.Lon, r.Lat, 40); err != nil {
				return err
			}
		}
	}
	elev, err := loadGray(filepath.Join(a.Cache, "gebco_08_rev_elev_21600x10800.png"))
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(a.OutImage), 0755); err != nil {
		return err
	}
	mag, err := writeTerrain(a.OutImage, p, land, elev, stamped)
	if err != nil {
		return err
	}
	_, water := generatorLand(land, w, n, keep...)
	finalLand := make([]bool, n)
	for i := range finalLand {
		finalLand[i] = !water[i]
	}

	// Owners on the final land: admin-1 units near the window only.
	adminAll, err := ne("ne_10m_admin_1_states_provinces")
	if err != nil {
		return err
	}
	lonMax, latMax := p.LonMin+p.LonSpan, p.LatMax
	var admin []Feature
	for _, f := range adminAll {
		in := false
		for _, poly := range f.Polygons {
			a, b, c, d := polyBox(poly)
			if c >= p.LonMin-1 && a <= lonMax+1 && d >= p.LatMin-1 && b <= latMax+1 {
				in = true
			}
		}
		if in {
			admin = append(admin, f)
		}
	}
	tbl := &Tables{Countries: t.Countries, Owners: t.Owners.OwnerTables, tagIndex: map[string]int{}, lowDetail: map[string]bool{}}
	for i, c := range t.Countries {
		tbl.tagIndex[c.Tag] = i + 1
	}
	owner, _, _, err := assignOwners(p, finalLand, admin, tbl)
	if err != nil {
		return err
	}
	ownerIdx := func(tag string) uint8 { return uint8(tbl.tagIndex[tag]) }

	// River lines: Natural Earth's on the window and the hand ones; the big
	// ones rank 1, every other 6 (riverOf: big 2, small 1).
	neRivers, err := readRivers(filepath.Join(a.Cache, "ne_10m_rivers_lake_centerlines.geojson"))
	if err != nil {
		return err
	}
	big := map[string]bool{}
	for _, b := range t.Rivers.Big {
		big[b] = true
	}
	var rivers []riverLine
	rank := func(name string) int {
		if big[name] {
			return 1
		}
		return 6
	}
	for _, l := range neRivers {
		in := false
		for _, part := range l.Parts {
			for _, pt := range part {
				if pt[0] >= p.LonMin && pt[0] <= lonMax && pt[1] >= p.LatMin && pt[1] <= latMax {
					in = true
				}
			}
		}
		if in {
			rivers = append(rivers, riverLine{Name: l.Name, Rank: rank(l.Name), Parts: l.Parts})
		}
	}
	for _, l := range t.Rivers.Lines {
		rivers = append(rivers, riverLine{Name: l.Name, Rank: rank(l.Name), Parts: [][][2]float64{l.Line}})
	}
	riverRank, _ := rasterRivers(p, rivers)

	// Regions: passes, islands, then the towns' cells.
	towns := t.Towns.Rows
	region := make([]uint16, n)
	var bad []string
	seeds := make([]int, len(towns))
	for k, r := range towns {
		id := uint16(k + 1)
		o := ownerIdx(r.Owner)
		pt, ok := p.Pixel(r.Lon, r.Lat)
		if ok {
			pt, ok = nearestOf(w, h, pt, imjinSeedReach, func(i int) bool { return finalLand[i] && owner[i] == o && region[i] == 0 })
		}
		if !ok {
			bad = append(bad, fmt.Sprintf("town %s: no land of %s within %d tiles", r.Key, r.Owner, imjinSeedReach))
			continue
		}
		seeds[k] = pt
		switch r.Kind {
		case "pass":
			x0, y0 := pt%w, pt/w
			for y := y0 - imjinPassRadius; y <= y0+imjinPassRadius; y++ {
				for x := x0 - imjinPassRadius; x <= x0+imjinPassRadius; x++ {
					if x < 0 || y < 0 || x >= w || y >= h || (x-x0)*(x-x0)+(y-y0)*(y-y0) > imjinPassRadius*imjinPassRadius {
						continue
					}
					if i := y*w + x; finalLand[i] && owner[i] == o && region[i] == 0 {
						region[i] = id
					}
				}
			}
		case "island":
			body := []int32{int32(pt)}
			seen := map[int32]bool{int32(pt): true}
			for head := 0; head < len(body) && len(body) <= imjinIslandMax; head++ {
				forNeighbours4(int(body[head]), w, n, func(j int) {
					if finalLand[j] && !seen[int32(j)] {
						seen[int32(j)] = true
						body = append(body, int32(j))
					}
				})
			}
			if len(body) > imjinIslandMax {
				bad = append(bad, fmt.Sprintf("island %s: its land body is over %d tiles (joined to the mainland?)", r.Key, imjinIslandMax))
				continue
			}
			for _, px := range body {
				if owner[px] == o && region[px] == 0 {
					region[px] = id
				}
			}
		}
	}
	if len(bad) > 0 {
		return fmt.Errorf("towns:\n  %s", strings.Join(bad, "\n  "))
	}
	// The towns' cells: river tiles are walls.
	queue := make([]int32, 0, 1<<20)
	for k, r := range towns {
		if r.Kind == "" || r.Kind == "town" {
			if region[seeds[k]] == 0 {
				region[seeds[k]] = uint16(k + 1)
				queue = append(queue, int32(seeds[k]))
			}
		}
	}
	grow := func(pass func(i, j int) bool) {
		for head := 0; head < len(queue); head++ {
			i := int(queue[head])
			forNeighbours4(i, w, n, func(j int) {
				if region[j] == 0 && pass(i, j) {
					region[j] = region[i]
					queue = append(queue, int32(j))
				}
			})
		}
	}
	grow(func(i, j int) bool { return finalLand[j] && owner[j] == owner[i] && riverRank[j] == noRiver })
	// The river tiles and land the walls cut off: the nearest cell over the
	// owner's land.
	queue = queue[:0]
	for i := 0; i < n; i++ {
		if region[i] != 0 {
			queue = append(queue, int32(i))
		}
	}
	grow(func(i, j int) bool { return finalLand[j] && owner[j] == owner[i] })
	// Land of an owner no cell reaches over land (small islands): the
	// nearest of the owner's regions across anything.
	for o := 1; o <= len(t.Countries); o++ {
		reached := make([]uint16, n)
		queue = queue[:0]
		for i := 0; i < n; i++ {
			if region[i] != 0 && int(owner[i]) == o && finalLand[i] {
				reached[i] = region[i]
				queue = append(queue, int32(i))
			}
		}
		for head := 0; head < len(queue); head++ {
			i := int(queue[head])
			forNeighbours4(i, w, n, func(j int) {
				if reached[j] == 0 {
					reached[j] = reached[i]
					queue = append(queue, int32(j))
					if finalLand[j] && region[j] == 0 && int(owner[j]) == o {
						region[j] = reached[i]
					}
				}
			})
		}
	}
	for i := 0; i < n; i++ {
		if finalLand[i] && region[i] == 0 {
			return fmt.Errorf("land tile %d (%d, %d) has no region", i, i%w, i/w)
		}
	}

	// Sea zones: a cell per seed over the water; water no seed reaches is
	// one lake zone.
	seaSeeds := t.Seas.Rows
	zone := make([]uint16, n)
	queue = queue[:0]
	for k, s := range seaSeeds {
		pt, ok := p.Pixel(s.Lon, s.Lat)
		if ok {
			pt, ok = nearestOf(w, h, pt, 30, func(i int) bool { return !finalLand[i] && zone[i] == 0 })
		}
		if !ok {
			return fmt.Errorf("sea zone %s: no water within 30 tiles", s.Name)
		}
		zone[pt] = uint16(seaZoneBase + k + 1)
		queue = append(queue, int32(pt))
	}
	for head := 0; head < len(queue); head++ {
		i := int(queue[head])
		forNeighbours4(i, w, n, func(j int) {
			if zone[j] == 0 && !finalLand[j] {
				zone[j] = zone[i]
				queue = append(queue, int32(j))
			}
		})
	}
	lakeID := uint16(seaZoneBase + len(seaSeeds) + 1)
	hasLake := false
	for i := 0; i < n; i++ {
		if !finalLand[i] && zone[i] == 0 {
			zone[i] = lakeID
			hasLake = true
		}
	}

	raw := make([]uint16, n)
	ownerOf := map[uint16]string{}
	islandSet := map[uint16]bool{}
	for k, r := range towns {
		ownerOf[uint16(k+1)] = r.Owner
		if r.Kind == "island" {
			islandSet[uint16(k+1)] = true
		}
	}
	for i := 0; i < n; i++ {
		if finalLand[i] {
			raw[i] = region[i]
		} else {
			raw[i] = zone[i]
		}
	}
	final, err := finalMap(raw, finalLand, w, h, ownerOf, islandSet)
	if err != nil {
		return err
	}
	lists := buildTileLists(final)

	// The regions and the sea zones as the shared code reads them.
	regions := make([]*Region, len(towns))
	ecoByID := map[int]*EcoRegion{}
	byName := map[string]int{}
	tags := make([]string, len(t.Countries))
	for i, c := range t.Countries {
		tags[i] = c.Tag
	}
	isSea := func(j int) bool { return final[j] > seaZoneBase }
	for k, r := range towns {
		id := k + 1
		tiles := lists.of(id)
		if len(tiles) == 0 {
			return fmt.Errorf("town %s: its region has no tile on the final map", r.Key)
		}
		rg := &Region{ID: id, Owner: tbl.tagIndex[r.Owner], Pixels: tiles, Name: r.name(), NameKo: r.NameKo, VP: r.VP, VPTile: -1}
		if final[seeds[k]] == uint16(id) {
			rg.VPTile = seeds[k]
		}
		if r.Kind == "island" {
			rg.Island = r.Key
		}
		regions[k] = rg
		coastal := false
		for _, px := range tiles {
			forNeighbours4(int(px), w, n, func(j int) {
				if isSea(j) {
					coastal = true
				}
			})
			if coastal {
				break
			}
		}
		cat := 1
		switch {
		case r.Pop >= 100:
			cat = 5
		case r.Pop >= 50:
			cat = 4
		case r.Pop >= 25:
			cat = 3
		case r.Pop >= 5:
			cat = 2
		}
		infra := 1
		if r.Walled || r.VP >= 5 {
			infra = 2
		}
		if r.VP >= 8 {
			infra = 3
		}
		ecoByID[id] = &EcoRegion{R: rg, Core: true, Coastal: coastal, Pop: r.Pop, Cat: cat, Infra: infra}
		byName[r.Owner+":"+rg.Name] = id
	}
	seas := make([]*Region, 0, len(seaSeeds)+1)
	for k, s := range seaSeeds {
		id := seaZoneBase + k + 1
		if len(lists.of(id)) == 0 {
			return fmt.Errorf("sea zone %s has no tile on the final map", s.Name)
		}
		seas = append(seas, &Region{ID: id, Name: s.Name, NameKo: s.NameKo, VPTile: -1})
	}
	lake := map[int]bool{}
	if hasLake && len(lists.of(int(lakeID))) > 0 {
		seas = append(seas, &Region{ID: int(lakeID), Name: "Lakes", NameKo: "호수", VPTile: -1, Lake: true})
		lake[int(lakeID)] = true
	}

	modis, mw, mh, err := loadModis(filepath.Join(a.Cache, "modis_igbp_2024_3600x1800.png"), filepath.Join(a.Cache, "modis_igbp_colormap.xml"))
	if err != nil {
		return err
	}
	lg, err := buildLandGraph(p, final, lists, LandInput{
		Regions: regions, Eco: ecoByID, Tags: tags, Mag: mag, Modis: modis, ModisW: mw, ModisH: mh, Rivers: rivers, ByName: byName,
	})
	if err != nil {
		return err
	}
	sg, err := buildSeaGraph(p, final, lists, seas, StraitTables{}, byName)
	if err != nil {
		return err
	}

	// The Imjin terrain class of every region.
	hand := map[string]string{}
	for _, row := range t.Terrain.Rows {
		for _, k := range row.Regions {
			if hand[k] != "" {
				return fmt.Errorf("terrain1590.json: %s twice", k)
			}
			hand[k] = row.Class
		}
	}
	lons, lats := geoAxes(p)
	classOf := map[int]string{}
	classCount := map[string]int{}
	for k, r := range towns {
		id := k + 1
		tiles := lists.of(id)
		var counts [256]int
		sum := 0
		for _, px := range tiles {
			sum += int(mag[px])
			counts[modis[modisCell(lons[int(px)%w], lats[int(px)/w], mw, mh)]]++
		}
		c := imjinRegionClass(r, float64(sum)/float64(len(tiles)), counts, len(tiles), lg.V3[id].LatC)
		if hc := hand[r.Key]; hc != "" {
			c = hc
		}
		classOf[id] = c
		classCount[c]++
		v := lg.V3[id]
		v.Land = imjinLand[c]
		lg.V3[id] = v
	}

	// Fords: the river edge whose border lies nearest the point.
	edgeRiver := map[int64]int{}
	for _, e := range lg.Edges {
		if e.Strait == 0 {
			edgeRiver[pairKey(e.A, e.B)] = e.River
		}
	}
	isRegion := func(id uint16) bool { return id != 0 && id < seaZoneBase }
	var labels []ImjinLabel
	var fords [][2]int
	fordSeen := map[int64]bool{}
	for _, f := range t.Fords.Rows {
		pt, ok := p.Pixel(f.Lon, f.Lat)
		if !ok {
			return fmt.Errorf("ford %s is off the map", f.Key)
		}
		x0, y0 := pt%w, pt/w
		best, bestD, bestTile := int64(-1), math.MaxInt, 0
		for y := max(0, y0-imjinFordReach); y <= min(h-1, y0+imjinFordReach); y++ {
			for x := max(0, x0-imjinFordReach); x <= min(w-1, x0+imjinFordReach); x++ {
				i := y*w + x
				a := final[i]
				if !isRegion(a) {
					continue
				}
				forNeighbours4(i, w, n, func(j int) {
					b := final[j]
					if !isRegion(b) || b == a {
						return
					}
					k := pairKey(int(a), int(b))
					if edgeRiver[k] == 0 {
						return
					}
					d := (x-x0)*(x-x0) + (y-y0)*(y-y0)
					if d < bestD || (d == bestD && k < best) {
						best, bestD, bestTile = k, d, i
					}
				})
			}
		}
		if best < 0 {
			log.Printf("ford %s: no river edge within %d tiles, left out", f.Key, imjinFordReach)
			continue
		}
		if !fordSeen[best] {
			fordSeen[best] = true
			fords = append(fords, [2]int{int(best >> 16), int(best & 0xffff)})
		}
		labels = append(labels, ImjinLabel{Kind: "ford", Name: f.Key, NameKo: f.NameKo, X: bestTile % w, Y: bestTile / w})
	}
	sort.Slice(fords, func(i, j int) bool {
		if fords[i][0] != fords[j][0] {
			return fords[i][0] < fords[j][0]
		}
		return fords[i][1] < fords[j][1]
	})
	for k, r := range towns {
		if r.Kind == "pass" {
			c := lg.V3[k+1].Center
			labels = append(labels, ImjinLabel{Kind: "pass", Name: r.name(), NameKo: r.NameKo, X: c % w, Y: c / w})
		}
	}

	// The sea flag byte of every tile.
	landSrc := make([]bool, n)
	for i := range landSrc {
		landSrc[i] = isRegion(final[i])
	}
	near3 := chebyshevWithin(landSrc, w, h, imjinCoastalReach)
	near8 := chebyshevWithin(landSrc, w, h, imjinShoalReach)
	body, sizes := landBodies(landSrc, w, n)
	smallIsle := make([]bool, n)
	for i := 0; i < n; i++ {
		smallIsle[i] = landSrc[i] && sizes[body[i]] < imjinLeeIsland
	}
	nearIsle := chebyshevWithin(smallIsle, w, h, imjinLeeReach)
	inPoly := func(polys []imjinPoly) []bool {
		out := make([]bool, n)
		for _, pl := range polys {
			ring := make(Ring, len(pl.Polygon))
			copy(ring, pl.Polygon)
			fillPolygon(p, Polygon{ring}, func(i int) { out[i] = true })
		}
		return out
	}
	shoal, leePoly := inPoly(t.SeaTiles.Shoals), inPoly(t.SeaTiles.Lee)
	flags := make([]uint8, n)
	flagCount := map[string]int{}
	channelTiles := map[int][]int{}
	for i := 0; i < n; i++ {
		if final[i] <= seaZoneBase {
			continue
		}
		var f uint8
		if near3[i] {
			f |= seaFlagCoastal
			flagCount["coastal"]++
		}
		if nearIsle[i] || leePoly[i] {
			f |= seaFlagLee
			flagCount["lee"]++
		}
		if c := current[i]; c != 0 {
			f |= seaFlagChannel | c<<seaFlagCurrentShift
			flagCount["channel"]++
			channelTiles[int(c)] = append(channelTiles[int(c)], i)
		}
		if shoal[i] && near8[i] {
			f |= seaFlagShoal
			flagCount["shoal"]++
		}
		flags[i] = f
	}
	var currents []ImjinLabel
	for _, c := range t.SeaTiles.Channels {
		tiles := channelTiles[c.Current]
		if len(tiles) == 0 {
			return fmt.Errorf("channel %s: no water tile left on the final map", c.Key)
		}
		mid := tiles[len(tiles)/2]
		lbl := ImjinLabel{Kind: "channel", Name: c.Key, NameKo: c.NameKo, X: mid % w, Y: mid / w, Dir: currentDir[c.Current]}
		labels = append(labels, lbl)
		for len(currents) < c.Current {
			currents = append(currents, ImjinLabel{})
		}
		currents[c.Current-1] = lbl
		// The channel must join two zones' water or one zone end to end.
		fmt.Printf("channel %s: %d water tiles, zones", c.Key, len(tiles))
		zs := map[uint16]bool{}
		for _, px := range tiles {
			zs[final[px]] = true
		}
		for z := range zs {
			fmt.Printf(" %d", z)
		}
		fmt.Println()
	}

	// Strategic regions: one per province, one per sea zone.
	sr := StrategicResult{RegionSR: map[int]int{}, Zones: map[int]ZoneV4{}}
	sr.Harbor = harbors(final, w, h, lake)
	provIdx := map[string]int{}
	for k, pv := range t.Provinces.Rows {
		provIdx[pv.Key] = k + 1
	}
	members := map[int][]int{}
	for k, r := range towns {
		members[provIdx[r.Prov]] = append(members[provIdx[r.Prov]], k+1)
	}
	for k, pv := range t.Provinces.Rows {
		id := k + 1
		m := members[id]
		if len(m) == 0 {
			continue
		}
		sort.Ints(m)
		biggest := m[0]
		for _, rid := range m {
			if len(lists.of(rid)) > len(lists.of(biggest)) {
				biggest = rid
			}
			sr.RegionSR[rid] = id
		}
		c := lg.V3[biggest].Center
		name := pv.Name
		if name == "" {
			name = pv.Key
		}
		sr.List = append(sr.List, Strategic{ID: id, Kind: "land", Name: name, NameKo: pv.NameKo, Center: [2]int{c % w, c / w}, LatC: hundredths(lats[c/w]), Members: m})
		sr.LandN++
	}
	var zoneIDs []int
	for _, z := range seas {
		zoneIDs = append(zoneIDs, z.ID)
	}
	centers := seaCenters(lists, zoneIDs, w)
	for k, z := range seas {
		c := centers[z.ID]
		latC, lonC := hundredths(lats[c/w]), hundredths(lons[c%w])
		v := ZoneV4{Center: c, LatC: latC, WCell: weatherCell(lonC, latC)}
		if !z.Lake {
			v.SR = srSeaBase + k + 1
			sr.List = append(sr.List, Strategic{ID: v.SR, Kind: "sea", Name: z.Name, NameKo: z.NameKo, Center: [2]int{c % w, c / w}, LatC: latC, Members: []int{z.ID}})
		}
		sr.Zones[z.ID] = v
	}

	// Hand start levels: the towns' naval bases, no air base anywhere.
	bases := HandBases{Naval: map[int]int{}, Air: map[int]int{}, Forts: map[int]int{}}
	for k, r := range towns {
		id := k + 1
		bases.Air[id] = 0
		if r.NavalBase > 0 {
			if sr.Harbor[id] == 0 {
				return fmt.Errorf("town %s has a naval base but no harbour", r.Key)
			}
			bases.Naval[id] = r.NavalBase
		}
	}

	capitals := make([]int, len(t.Countries))
	for i, c := range t.Countries {
		pt, ok := p.Pixel(c.Capital[0], c.Capital[1])
		if ok {
			pt, ok = nearestOf(w, h, pt, imjinSeedReach, func(j int) bool { return isRegion(final[j]) && ownerOf[final[j]] == c.Tag })
		}
		if !ok {
			return fmt.Errorf("capital of %s is not on its own land", c.Tag)
		}
		capitals[i] = pt
	}
	rows := make([]EconomyRow, len(t.Countries))
	for i := range rows {
		rows[i].Dev = 2
	}

	landIDs := make([]uint16, n)
	seaIDs := make([]uint16, n)
	for i, id := range final {
		if isRegion(id) {
			landIDs[i] = id
		} else {
			seaIDs[i] = id
		}
	}
	if err := os.MkdirAll(a.OutDir, 0755); err != nil {
		return err
	}
	if err := writeRegionsPNG(filepath.Join(a.OutDir, "regions.png"), p, landIDs, seaIDs); err != nil {
		return err
	}
	kmPerTile := math.Round(equatorKm*p.LonSpan/360/float64(w)*10000) / 10000
	err = writeScenarioSrc(filepath.Join(a.OutDir, "scenario.src.json"), ScenarioSrcInput{
		P: p, T: tbl, Rows: rows, Capitals: capitals, Regions: regions, Eco: ecoByID, Seas: seas,
		Land: lg, Sea: sg, Places: places, SR: sr, Bases: bases, RowTable: buildRows(p),
		V5: V5Result{ByID: map[int]*RegionV5{}},
		Imjin: &ImjinOut{
			Block:     ImjinSrc{Fords: fords, SeaFlags: encodeRuns(flags), Currents: currents, Labels: labels},
			Class:     classOf,
			KmPerTile: kmPerTile,
		},
	})
	if err != nil {
		return err
	}

	// The report.
	landTiles := 0
	for _, id := range final {
		if isRegion(id) {
			landTiles++
		}
	}
	fmt.Printf("final map %dx%d: %d land tiles, %d regions, %d sea zones (lake %v), km a tile %.4f\n", w, h, landTiles, len(regions), len(seas), hasLake, kmPerTile)
	per := map[string][]int{}
	for _, r := range regions {
		per[tags[r.Owner-1]] = append(per[tags[r.Owner-1]], len(lists.of(r.ID)))
	}
	for _, tag := range tags {
		s := per[tag]
		sort.Ints(s)
		sum := 0
		for _, v := range s {
			sum += v
		}
		fmt.Printf("  %s: %d regions, %d tiles, smallest %d, largest %d\n", tag, len(s), sum, s[0], s[len(s)-1])
	}
	var cls []string
	for c := range imjinClasses {
		cls = append(cls, fmt.Sprintf("%s %d", c, classCount[c]))
	}
	sort.Strings(cls)
	fmt.Println("classes: " + strings.Join(cls, ", "))
	for k, r := range towns {
		fmt.Printf("  %3d %s %s %s %d tiles\n", k+1, r.Owner, r.Key, classOf[k+1], len(lists.of(k+1)))
	}
	big2, small1 := 0, 0
	for _, e := range lg.Edges {
		switch e.River {
		case 2:
			big2++
		case 1:
			small1++
		}
	}
	fmt.Printf("land edges %d: big river %d, small river %d, straits %d; fords %d\n", len(lg.Edges), big2, small1, len(lg.Straits), len(fords))
	for _, e := range lg.Edges {
		if e.River > 0 {
			fmt.Printf("  river %d: %s – %s\n", e.River, regions[e.A-1].Name, regions[e.B-1].Name)
		}
	}
	for _, f := range fords {
		fmt.Printf("  ford %s – %s\n", regions[f[0]-1].Name, regions[f[1]-1].Name)
	}
	fmt.Printf("sea edges %d; flags %v; runs %d\n", len(sg.Edges), flagCount, len(encodeRuns(flags))/2)
	for _, z := range seas {
		fmt.Printf("  zone %d %s %d tiles\n", z.ID, z.Name, len(lists.of(z.ID)))
	}
	return nil
}

// ImjinOut is what writeScenarioSrc adds for the Imjin map: the imjin
// block, each region's class and the map's km a tile (the window is not the
// globe, so 40075 / width is wrong).
type ImjinOut struct {
	Block     ImjinSrc
	Class     map[int]string
	KmPerTile float64
}
