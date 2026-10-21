package main

import (
	"strings"
	"testing"
)

// carveWorld: a 10×3 strip of AAA land. Region 1 (x 0..4) holds the unit
// AAA:Cut at x 3..4, region 2 (x 5..7) is AAA:West, region 3 (x 8..9) is
// AAA's land on modern KKK holding one pixel of the unit (as Tsushima in a
// Korean region), region 4 an island on the unit's land (x 9 of row 0).
func carveWorld() ([]*Region, []uint16, []int32, []uint8, []Feature, *Tables) {
	const w, h = 10, 3
	ids := make([]uint16, w*h)
	adm := make([]int32, w*h)
	owner := make([]uint8, w*h)
	regions := []*Region{
		{ID: 1, Owner: 1, VPTile: -1, MainAdm: 1, Name: "West"},
		{ID: 2, Owner: 1, VPTile: -1, MainAdm: 1, Name: "West 2"},
		{ID: 3, Owner: 1, VPTile: -1, MainAdm: 3, Name: "Over"},
		{ID: 4, Owner: 1, VPTile: -1, MainAdm: 2, Name: "Isle", Island: "isle"},
	}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			i := y*w + x
			owner[i] = 1
			id, unit := 1, int32(1)
			switch {
			case x == 9 && y == 0:
				id, unit = 4, 2
			case x >= 8:
				id, unit = 3, 3
			case x >= 5:
				id = 2
			case x >= 3:
				unit = 2
			}
			if x == 8 && y == 2 {
				unit = 2
			}
			ids[i], adm[i] = uint16(id), unit
			regions[id-1].Pixels = append(regions[id-1].Pixels, int32(i))
		}
	}
	admin := []Feature{
		{Props: map[string]any{"adm0_a3": "AAA", "name": "West"}},
		{Props: map[string]any{"adm0_a3": "AAA", "name": "Cut"}},
		{Props: map[string]any{"adm0_a3": "KKK", "name": "Over"}},
	}
	tables := &Tables{
		Countries: []CountryRow{{Tag: "AAA"}},
		Owners:    OwnerTables{Carve: []CarveRow{{Adm1: []string{"AAA:Cut"}, Owner: "AAA", Name: [2]string{"Cut", "잘라냄"}, Note: "test"}}},
		tagIndex:  map[string]int{"AAA": 1},
		lowDetail: map[string]bool{},
	}
	return regions, ids, adm, owner, admin, tables
}

// A carved unit becomes a region of its own; the donor keeps the rest, a
// region of another modern country and an island keep the unit's pixels.
func TestCarveUnitsCutsTheUnitOut(t *testing.T) {
	regions, ids, adm, owner, admin, tables := carveWorld()
	out, donors, err := carveUnits(regions, ids, adm, owner, admin, tables)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 5 || len(donors) != 1 || len(donors[0]) != 1 || donors[0][0].Name != "West" {
		t.Fatalf("%d regions, donors %v", len(out), donors)
	}
	var cut *Region
	for k, r := range out {
		if r.ID != k+1 || (k > 0 && r.Pixels[0] <= out[k-1].Pixels[0]) {
			t.Fatalf("not numbered by first pixel: %d %s", r.ID, r.Name)
		}
		for _, px := range r.Pixels {
			if ids[px] != uint16(r.ID) {
				t.Fatalf("pixel %d: id %d, region %d", px, ids[px], r.ID)
			}
		}
		if r.carved {
			cut = r
		}
	}
	if cut == nil || cut.Name != "Cut" || cut.NameKo != "잘라냄" || cut.MainAdm != 2 {
		t.Fatalf("carved region %+v", cut)
	}
	want := []int32{3, 4, 13, 14, 23, 24}
	if len(cut.Pixels) != len(want) {
		t.Fatalf("carved pixels %v", cut.Pixels)
	}
	for k, px := range want {
		if cut.Pixels[k] != px {
			t.Fatalf("carved pixels %v", cut.Pixels)
		}
	}
	for _, r := range out {
		switch r.Name {
		case "West":
			if len(r.Pixels) != 9 {
				t.Fatalf("West keeps %d pixels", len(r.Pixels))
			}
		case "Over":
			if len(r.Pixels) != 5 {
				t.Fatalf("the region of another modern country keeps %d pixels", len(r.Pixels))
			}
		case "Isle":
			if len(r.Pixels) != 1 {
				t.Fatal("the island lost its pixel")
			}
		}
	}
	// finishNames keeps the row's name.
	if err := finishNames(out, adm, make([]uint16, len(ids)), admin, tables); err != nil || cut.Name != "Cut" {
		t.Fatalf("%v, named %q", err, cut.Name)
	}
}

func TestCarveUnitsFails(t *testing.T) {
	cases := []struct {
		want string
		row  CarveRow
	}{
		{"no Natural Earth unit", CarveRow{Adm1: []string{"AAA:Nowhere"}, Owner: "AAA"}},
		{"units of AAA and KKK", CarveRow{Adm1: []string{"AAA:Cut", "KKK:Over"}, Owner: "AAA"}},
		{"no pixel of BBB", CarveRow{Adm1: []string{"AAA:Cut"}, Owner: "BBB"}},
	}
	for _, c := range cases {
		regions, ids, adm, owner, admin, tables := carveWorld()
		tables.Countries = append(tables.Countries, CountryRow{Tag: "BBB"})
		tables.tagIndex["BBB"] = 2
		tables.Owners.Carve = []CarveRow{c.row}
		if _, _, err := carveUnits(regions, ids, adm, owner, admin, tables); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("%s: err = %v", c.want, err)
		}
	}
}

// v5World: on a 360-wide map, AAA region 1 (x 0..9), AAA region 2
// (x 10..19), BBB region 3 (x 20..29) and AAA region 4 (x 30..39, on modern
// KKK, which holds no data); edges 1–2, 2–3 and 3–4, rows 40..49. Three
// landmarks and two dams stand in for the lists.
func v5World(t *testing.T) (Projection, []uint16, V5Input) {
	keepL, keepD := landmarkIDs, damIDs
	landmarkIDs, damIDs = []string{"lm_a", "lm_b", "lm_c"}, []string{"dam_a", "dam_b"}
	t.Cleanup(func() { landmarkIDs, damIDs = keepL, keepD })
	p := NewProjection(360, -60, 84)
	final := make([]uint16, p.Width*p.Height)
	for y := 40; y < 50; y++ {
		for x := 0; x < 40; x++ {
			final[y*p.Width+x] = uint16(x/10 + 1)
		}
	}
	regions := []*Region{
		{ID: 1, Owner: 1, Name: "One", MainAdm: 1},
		{ID: 2, Owner: 1, Name: "Two", MainAdm: 1},
		{ID: 3, Owner: 2, Name: "Three", MainAdm: 2},
		{ID: 4, Owner: 1, Name: "Four", MainAdm: 3},
	}
	admin := []Feature{
		{Props: map[string]any{"adm0_a3": "AAA"}},
		{Props: map[string]any{"adm0_a3": "BBB"}},
		{Props: map[string]any{"adm0_a3": "KKK"}},
	}
	at := func(x int) (float64, float64) { return p.LonLat(x, 45) }
	site := func(tag string, amount, x int) EnergySite {
		lon, lat := at(x)
		return EnergySite{Tag: tag, Amount: amount, Lon: lon, Lat: lat, Note: "test"}
	}
	in := V5Input{
		Energy: EnergyTable{
			NoData:  []string{"KKK"},
			Coal:    []EnergySite{site("AAA", 3, 2), site("AAA", 4, 5), site("BBB", 8, 25)},
			Uranium: []EnergySite{site("AAA", 6, 12)},
			Hydro:   []EnergySite{site("AAA", 2, 12), site("BBB", 1, 21)},
		},
		Landmarks: LandmarkTable{
			Landmarks: []LandmarkRow{{ID: "lm_a", Region: "AAA:One"}, {ID: "lm_b", Region: "AAA:One"}, {ID: "lm_c", Region: "BBB:Three"}},
			Dams: []DamRow{
				{ID: "dam_a", Region: "AAA:One", Downstream: []string{"AAA:Two", "BBB:Three"}},
				{ID: "dam_b", Region: "AAA:Two", Downstream: []string{}},
			},
		},
		Regions: regions,
		Tags:    []string{"AAA", "BBB"},
		Admin:   admin,
		ByName:  map[string]int{"AAA:One": 1, "AAA:Two": 2, "BBB:Three": 3, "AAA:Four": 4},
		Edges:   []Edge{{A: 1, B: 2}, {A: 2, B: 3}, {A: 3, B: 4}},
	}
	return p, final, in
}

// The sites add up in their regions; the landmarks and dams land where the
// table names them, a dam's downstream regions in order.
func TestBuildV5(t *testing.T) {
	p, final, in := v5World(t)
	res, err := buildV5(p, final, in)
	if err != nil {
		t.Fatal(err)
	}
	one, two, three := res.ByID[1], res.ByID[2], res.ByID[3]
	if one.Coal != 7 || two.Uranium != 6 || two.Hydro != 2 || three.Coal != 8 || three.Hydro != 1 || res.ByID[4] != nil {
		t.Fatalf("one %+v two %+v three %+v", *one, *two, *three)
	}
	if strings.Join(one.Landmarks, ",") != "lm_a,lm_b" || strings.Join(three.Landmarks, ",") != "lm_c" {
		t.Fatalf("landmarks %v %v", one.Landmarks, three.Landmarks)
	}
	if d := one.Dam; d == nil || d.ID != "dam_a" || len(d.Downstream) != 2 || d.Downstream[0] != 2 || d.Downstream[1] != 3 {
		t.Fatalf("dam %+v", one.Dam)
	}
	if d := two.Dam; d == nil || d.ID != "dam_b" || d.Downstream == nil || len(d.Downstream) != 0 {
		t.Fatalf("dam without a downstream region %+v", two.Dam)
	}
}

func TestBuildV5Fails(t *testing.T) {
	cases := []struct {
		want string
		edit func(in *V5Input)
	}{
		{"holds 9, at most 8", func(in *V5Input) { in.Energy.Coal[0].Amount = 5 }},
		{"falls in 3 BBB:Three", func(in *V5Input) { in.Energy.Coal[2].Tag = "AAA" }},
		{"lies in KKK", func(in *V5Input) {
			in.Energy.Hydro[1] = EnergySite{Tag: "AAA", Amount: 1, Lon: in.Energy.Hydro[1].Lon + 15, Lat: in.Energy.Hydro[1].Lat}
		}},
		{"amount below 1", func(in *V5Input) { in.Energy.Uranium[0].Amount = 0 }},
		{"more than 2 landmarks", func(in *V5Input) { in.Landmarks.Landmarks[2].Region = "AAA:One" }},
		{"landmark lm_c is missing", func(in *V5Input) { in.Landmarks.Landmarks = in.Landmarks.Landmarks[:2] }},
		{"lm_x: unknown or twice", func(in *V5Input) { in.Landmarks.Landmarks[2].ID = "lm_x" }},
		{"lm_a: unknown or twice", func(in *V5Input) { in.Landmarks.Landmarks[2].ID = "lm_a" }},
		{"dam dam_b is missing", func(in *V5Input) { in.Landmarks.Dams = in.Landmarks.Dams[:1] }},
		{"no region \"AAA:Nowhere\"", func(in *V5Input) { in.Landmarks.Dams[1].Region = "AAA:Nowhere" }},
		{"touches neither", func(in *V5Input) { in.Landmarks.Dams[0].Downstream = []string{"BBB:Three"} }},
		{"twice or the dam's own", func(in *V5Input) { in.Landmarks.Dams[0].Downstream = []string{"AAA:Two", "AAA:One"} }},
		{"already has dam_a", func(in *V5Input) { in.Landmarks.Dams[1].Region = "AAA:One" }},
		{"4 downstream regions", func(in *V5Input) {
			in.Landmarks.Dams[0].Downstream = []string{"AAA:Two", "BBB:Three", "AAA:Two", "BBB:Three"}
		}},
		{"lies in KKK", func(in *V5Input) { in.Landmarks.Dams[1].Downstream = []string{"BBB:Three", "AAA:Four"} }},
	}
	for _, c := range cases {
		p, final, in := v5World(t)
		c.edit(&in)
		if _, err := buildV5(p, final, in); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("%s: err = %v", c.want, err)
		}
	}
}
