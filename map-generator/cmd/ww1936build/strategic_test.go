package main

import (
	"reflect"
	"strings"
	"testing"
)

// srWorld is a 360-pixel map, water of zone 40001 west of x = 100 and
// 40002 east of it, with a lake (40003) and, at y 80..84, a strip of four
// regions of owner 1 (regions 1..4, five tiles wide each), a small island of
// owner 1 (5) east of it, one of owner 2 far away (6), and a keepAlone
// island of owner 1 (7) beyond region 5.
func srWorld() (Projection, []uint16, StrategicInput) {
	p := NewProjection(360, -60, 84)
	w := p.Width
	ids := make([]uint16, w*p.Height)
	for i := range ids {
		ids[i] = 40001
		if i%w >= 100 {
			ids[i] = 40002
		}
	}
	for k := 0; k < 4; k++ {
		paint(p, ids, uint16(k+1), 10+5*k, 80, 14+5*k, 84)
	}
	paint(p, ids, 5, 32, 80, 33, 81)
	paint(p, ids, 6, 60, 80, 61, 81)
	paint(p, ids, 7, 37, 80, 38, 81)
	paint(p, ids, 40003, 10, 100, 14, 102)
	lists := buildTileLists(ids)
	in := StrategicInput{
		Tags:       []string{"AAA", "BBB"},
		Seas:       []*Region{{ID: 40001, Name: "West"}, {ID: 40002, Name: "East"}, {ID: 40003, Name: "Lake", Lake: true}},
		Land:       LandGraph{V3: map[int]RegionV3{}},
		SeaRows:    []SeaRegionRow{{ID: 1001, Name: "West Sea", NameKo: "서해", Zones: []int{1}}, {ID: 1002, Name: "East Sea", NameKo: "동해", Zones: []int{2}}},
		MaxRegions: 2,
		MaxTiles:   1 << 30,
	}
	for id := 1; id <= 7; id++ {
		owner := 1
		if id == 6 {
			owner = 2
		}
		in.Regions = append(in.Regions, &Region{ID: id, Owner: owner, Name: "R" + string(rune('0'+id)), NameKo: "주"})
		in.Land.V3[id] = RegionV3{Center: nearestCentroid(lists.of(id), w)}
	}
	for k := 1; k < 4; k++ {
		in.Land.Edges = append(in.Land.Edges, Edge{A: k, B: k + 1, Border: 5, Km: tileKm(p, in.Land.V3[k].Center, in.Land.V3[k+1].Center)})
	}
	// A strait edge does not join landmasses.
	in.Land.Edges = append(in.Land.Edges, Edge{A: 4, B: 5, Km: 400, Strait: 1})
	in.Sea = SeaGraph{Centers: seaCenters(lists, []int{40001, 40002, 40003}, w)}
	at := func(id int) (float64, float64) {
		c := in.Land.V3[id].Center
		return p.LonLat(c%w, c/w)
	}
	lon1, lat1 := at(1)
	lon7, lat7 := at(7)
	in.Seeds = []LandSeedRow{{Name: "West", NameKo: "서부", Lon: lon1, Lat: lat1}, {Name: "Rock", NameKo: "바위", Lon: lon7, Lat: lat7, KeepAlone: true}}
	return p, ids, in
}

func TestStrategicRegions(t *testing.T) {
	p, ids, in := srWorld()
	res, err := buildStrategic(p, ids, buildTileLists(ids), in)
	if err != nil {
		t.Fatal(err)
	}
	type sr struct {
		ID      int
		Name    string
		Members []int
	}
	var got []sr
	for _, s := range res.List {
		got = append(got, sr{s.ID, s.Name, s.Members})
	}
	// The strip splits in two (two regions a share at most): the hand seed
	// West, then the farthest region (4) as an auto seed named after it. The
	// island 5 joins the nearest strategic region of its owner (not the
	// keepAlone Rock), the island 6 of the other owner stays alone; the
	// regions are numbered by their smallest region; the sea regions follow.
	want := []sr{
		{1, "West", []int{1, 2}},
		{2, "R4", []int{3, 4, 5}},
		{3, "R6", []int{6}},
		{4, "Rock", []int{7}},
		{1001, "West Sea", []int{40001}},
		{1002, "East Sea", []int{40002}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("strategic regions\n got %v\nwant %v", got, want)
	}
	if res.LandN != 4 || len(res.Merged) != 1 || !strings.Contains(res.Merged[0], "AAA:R5 (1 regions) → R4") {
		t.Fatalf("land %d, merged %v", res.LandN, res.Merged)
	}
	if res.RegionSR[5] != 2 || res.RegionSR[7] != 4 {
		t.Fatalf("region SRs %v", res.RegionSR)
	}
	// Zones: their strategic region (0 for the lake), centre, latitude.
	if z := res.Zones[40002]; z.SR != 1002 || z.Center != in.Sea.Centers[40002] || z.LatC == 0 {
		t.Fatalf("zone 40002 %+v", z)
	}
	if res.Zones[40003].SR != 0 {
		t.Fatalf("the lake is in %d", res.Zones[40003].SR)
	}
	// A land strategic region's centre is one of its regions' centres.
	if c := res.List[0].Center; c != [2]int{in.Land.V3[1].Center % p.Width, in.Land.V3[1].Center / p.Width} && c != [2]int{in.Land.V3[2].Center % p.Width, in.Land.V3[2].Center / p.Width} {
		t.Fatalf("centre %v", c)
	}
	// Harbours: the strip's regions touch only zone 40001.
	if res.Harbor[1] != 40001 || res.Harbor[6] != 40001 {
		t.Fatalf("harbours %v", res.Harbor)
	}
}

func TestStrategicRegionsFail(t *testing.T) {
	cases := []struct {
		want string
		edit func(in *StrategicInput)
	}{
		{"zone 40002 East is in no sea region", func(in *StrategicInput) { in.SeaRows = in.SeaRows[:1] }},
		{"zone 40001 in sea regions 1001 and 1002", func(in *StrategicInput) { in.SeaRows[1].Zones = []int{1, 2} }},
		{"zone 40003 is a lake", func(in *StrategicInput) { in.SeaRows[1].Zones = []int{2, 3} }},
		{"no zone 40009", func(in *StrategicInput) { in.SeaRows[1].Zones = []int{2, 9} }},
		{`seeds "West" and "Again" are both in region 1`, func(in *StrategicInput) {
			in.Seeds = append(in.Seeds, LandSeedRow{Name: "Again", NameKo: "다시", Lon: in.Seeds[0].Lon, Lat: in.Seeds[0].Lat})
		}},
	}
	for _, c := range cases {
		p, ids, in := srWorld()
		c.edit(&in)
		if _, err := buildStrategic(p, ids, buildTileLists(ids), in); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("%s: err = %v", c.want, err)
		}
	}
}

// A seed in the water takes the region of the nearest land tile.
func TestSeedInTheWater(t *testing.T) {
	p, ids, in := srWorld()
	lon, lat := p.LonLat(40, 82) // water, two tiles east of the keepAlone island
	in.Seeds[1].Lon, in.Seeds[1].Lat = lon, lat
	res, err := buildStrategic(p, ids, buildTileLists(ids), in)
	if err != nil {
		t.Fatal(err)
	}
	if res.List[3].Name != "Rock" || !reflect.DeepEqual(res.List[3].Members, []int{7}) {
		t.Fatalf("%+v", res.List[3])
	}
}

// Without a hand seed, a landmass over the thresholds starts from its
// smallest region and adds the farthest one; a share of one region may be
// larger than the tile threshold.
func TestGrowLandmass(t *testing.T) {
	members := []int{1, 2, 3, 4, 5}
	adj := map[int][][2]int{}
	link := func(a, b, km int) {
		adj[a] = append(adj[a], [2]int{b, km})
		adj[b] = append(adj[b], [2]int{a, km})
	}
	link(1, 2, 100)
	link(2, 3, 100)
	link(3, 4, 100)
	link(4, 5, 100)
	tiles := map[int]int{1: 10, 2: 10, 3: 10, 4: 10, 5: 1000}
	of, order := growLandmass(members, adj, tiles, nil, 7, 3, 1<<30)
	if !reflect.DeepEqual(order, []int{1, 5}) || of[3] != 1 || of[4] != 5 {
		t.Fatalf("by regions: seeds %v, shares %v", order, of)
	}
	// 35 tiles a share: 1 starts, the farthest region 3 follows; region 2,
	// as far from both, goes to the earlier seed, and region 3 alone stays
	// over the threshold (one region cannot be split).
	chain := map[int][][2]int{1: {{2, 100}}, 2: {{1, 100}, {3, 100}}, 3: {{2, 100}}}
	of, order = growLandmass([]int{1, 2, 3}, chain, map[int]int{1: 10, 2: 10, 3: 1000}, nil, 7, 10, 35)
	if !reflect.DeepEqual(order, []int{1, 3}) || of[2] != 1 || of[3] != 3 {
		t.Fatalf("by tiles: seeds %v, shares %v", order, of)
	}
	// A hand seed keeps its rank: equally far from two seeds, region 3 goes
	// to the seed of the lower rank (the hand seed 5, rank 0).
	of, order = growLandmass(members, adj, tiles, map[int]int{5: 0, 1: 1}, 7, 10, 1<<30)
	if !reflect.DeepEqual(order, []int{5, 1}) || of[3] != 5 {
		t.Fatalf("ties: seeds %v, shares %v", order, of)
	}
}

func TestHarborsCountPairsAndSkipLakes(t *testing.T) {
	// Region 1 touches 40001 along two pairs, 40002 along two (a tie: the
	// smaller id), and the lake 40003 along six.
	w, h := 7, 5
	ids := []uint16{
		40001, 40001, 40001, 40002, 40002, 40002, 40002,
		40003, 1, 1, 1, 40002, 40002, 40002,
		40003, 1, 1, 1, 40003, 40003, 40003,
		40003, 40003, 40003, 40003, 40003, 40003, 40003,
		40003, 40003, 40003, 40003, 40003, 40003, 40003,
	}
	lakes := map[int]bool{40003: true}
	if got := harbors(ids, w, h, lakes); got[1] != 40001 {
		t.Fatalf("tie: harbour %d", got[1])
	}
	ids[1] = 40002 // 40001 one pair, 40002 three
	if got := harbors(ids, w, h, lakes); got[1] != 40002 {
		t.Fatalf("harbour %d", got[1])
	}
	if got := harbors(ids, w, h, map[int]bool{}); got[1] != 40003 {
		t.Fatalf("without lakes: harbour %d", got[1])
	}
}
