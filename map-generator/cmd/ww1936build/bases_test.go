package main

import (
	"strings"
	"testing"
)

// basesWorld: srWorld's strip (regions 1..4 of AAA on zone 40001) with an
// inland region 8 (AAA) under region 2, and the islands 5, 6 (BBB), 7.
func basesWorld() (Projection, []uint16, map[int]int, map[int]string) {
	p, ids, _ := srWorld()
	paint(p, ids, 8, 16, 82, 18, 83) // inside region 2: no water around it
	owner := map[int]string{1: "AAA", 2: "AAA", 3: "AAA", 4: "AAA", 5: "AAA", 6: "BBB", 7: "AAA", 8: "AAA"}
	return p, ids, harbors(ids, p.Width, p.Height, map[int]bool{40003: true}), owner
}

func TestCoastalRegionAt(t *testing.T) {
	p, ids, harbor, _ := basesWorld()
	if harbor[8] != 0 || harbor[2] != 40001 {
		t.Fatalf("harbours %v", harbor)
	}
	at := func(x, y int) int {
		lon, lat := p.LonLat(x, y)
		id, ok := coastalRegionAt(p, ids, harbor, lon, lat)
		if !ok {
			return -1
		}
		return id
	}
	// On a coastal region: that region; in the water: the nearest coastal
	// region's tile; inland: the nearest coastal tile around it.
	if got := at(11, 82); got != 1 {
		t.Fatalf("on land: %d", got)
	}
	if got := at(12, 78); got != 1 {
		t.Fatalf("in the water: %d", got)
	}
	if got := at(17, 82); got != 2 {
		t.Fatalf("inland: %d", got)
	}
	if got := at(200, 20); got != -1 {
		t.Fatalf("far out at sea: %d", got)
	}
}

func TestResolveBases(t *testing.T) {
	p, ids, harbor, owner := basesWorld()
	lonlat := func(x, y int) (float64, float64) { return p.LonLat(x, y) }
	lon1, lat1 := lonlat(11, 82)
	lon2, lat2 := lonlat(12, 83)
	tbl := BaseTables{
		Naval: []BaseRow{{Name: "Port A", Tag: "AAA", Lon: lon1, Lat: lat1, Level: 4}, {Name: "Port B", Tag: "AAA", Lon: lon2, Lat: lat2, Level: 10}},
		Forts: []BaseRow{{Name: "Fort A", Tag: "AAA", Lon: lon1, Lat: lat1, Level: 2}},
	}
	regions := []*Region{{ID: 7, Island: "rock"}, {ID: 5, Island: "reef"}}
	islands := []IslandRow{
		{Key: "rock", NavalBase: 6, AirBase: 2, CoastalFort: 3},
		{Key: "reef", NavalBase: 0, AirBase: 0, CoastalFort: 0},
	}
	hb, err := resolveBases(p, ids, harbor, tbl, islands, regions, owner)
	if err != nil {
		t.Fatal(err)
	}
	// Two rows in one region: the larger level. An island's naval base is a
	// hand level even at 0; its air base and fort only when it has one.
	if hb.Naval[1] != 10 || hb.Forts[1] != 2 || hb.Naval[7] != 6 || hb.Air[7] != 2 || hb.Forts[7] != 3 {
		t.Fatalf("%+v", hb)
	}
	if v, ok := hb.Naval[5]; !ok || v != 0 {
		t.Fatalf("reef naval base %d %v", v, ok)
	}
	if _, ok := hb.Air[5]; ok {
		t.Fatal("reef has a hand air base")
	}
	if hb.ByLevel[10] != 1 || hb.ByLevel[6] != 1 || hb.ByLevel[4] != 0 || len(hb.Report) != 3 || !strings.Contains(hb.Report[1], "(shared: level 10)") {
		t.Fatalf("by level %v, report %v", hb.ByLevel, hb.Report)
	}
	// The wrong owner, or nothing near the point, fails.
	tbl.Naval[0].Tag = "BBB"
	if _, err := resolveBases(p, ids, harbor, tbl, islands, regions, owner); err == nil || !strings.Contains(err.Error(), "region 1 is AAA's, not BBB's") {
		t.Fatalf("err = %v", err)
	}
	tbl.Naval[0].Tag = "AAA"
	tbl.Naval[0].Lon, tbl.Naval[0].Lat = lonlat(200, 20)
	if _, err := resolveBases(p, ids, harbor, tbl, islands, regions, owner); err == nil || !strings.Contains(err.Error(), "Port A") {
		t.Fatalf("err = %v", err)
	}
}
