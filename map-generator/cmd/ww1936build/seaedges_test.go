package main

import (
	"reflect"
	"strings"
	"testing"
)

// seaGraphWorld: a 360-pixel-wide map of land (region 1) with water
// rectangles painted on it.
func seaGraphWorld() (Projection, []uint16) {
	p := NewProjection(360, -60, 84)
	ids := make([]uint16, p.Width*p.Height)
	for i := range ids {
		ids[i] = 1
	}
	return p, ids
}

func paint(p Projection, ids []uint16, id uint16, x0, y0, x1, y1 int) {
	for y := y0; y <= y1; y++ {
		for x := x0; x <= x1; x++ {
			ids[y*p.Width+x] = id
		}
	}
}

func zonesOf(ids ...int) []*Region {
	var out []*Region
	for _, id := range ids {
		out = append(out, &Region{ID: id, Name: "Zone", NameKo: "해역"})
	}
	return out
}

// Two zones meeting along two tile pairs are not joined; along three they
// are, with the great-circle distance between their centres.
func TestSeaEdgesNeedThreeWaterPairs(t *testing.T) {
	for _, rows := range []int{2, 3} {
		p, ids := seaGraphWorld()
		paint(p, ids, 40001, 100, 50, 109, 50+rows-1)
		paint(p, ids, 40002, 110, 50, 119, 50+rows-1)
		g, err := buildSeaGraph(p, ids, buildTileLists(ids), zonesOf(40001, 40002), StraitTables{}, nil)
		if err != nil {
			t.Fatal(err)
		}
		if rows == 2 && len(g.Edges) != 0 {
			t.Fatalf("two pairs: %v", g.Edges)
		}
		if rows == 3 {
			if len(g.Edges) != 1 || g.Edges[0].A != 40001 || g.Edges[0].B != 40002 || g.Edges[0].Kind != seaKindWater {
				t.Fatalf("three pairs: %v", g.Edges)
			}
			if want := tileKm(p, g.Centers[40001], g.Centers[40002]); g.Edges[0].Km != want || want < 500 || want > 1500 {
				t.Fatalf("km %d, want %d (about ten degrees)", g.Edges[0].Km, want)
			}
		}
	}
}

// Zones on the two end columns of three rows or more meet across the date
// line (kind 3); on two rows they do not.
func TestDateLineEdges(t *testing.T) {
	for _, rows := range []int{2, 3} {
		p, ids := seaGraphWorld()
		w := p.Width
		paint(p, ids, 40001, 0, 40, 4, 40+rows-1)
		paint(p, ids, 40002, w-5, 40, w-1, 40+rows-1)
		g, err := buildSeaGraph(p, ids, buildTileLists(ids), zonesOf(40001, 40002), StraitTables{}, nil)
		if err != nil {
			t.Fatal(err)
		}
		if rows == 2 && len(g.Edges) != 0 {
			t.Fatalf("two rows: %v", g.Edges)
		}
		if rows == 3 {
			want := []SeaEdge{{A: 40001, B: 40002, Km: g.Edges[0].Km, Kind: seaKindDateLine}}
			if !reflect.DeepEqual(g.Edges, want) || !reflect.DeepEqual(g.DateLine, want) {
				t.Fatalf("three rows: %v", g.Edges)
			}
			// The short way: five degrees, not 355.
			if g.Edges[0].Km > 1500 {
				t.Fatalf("km %d", g.Edges[0].Km)
			}
		}
	}
}

// A hand strait on zones water already joins marks that edge (kind 1); a
// canal between zones water does not join adds one (kind 2); a lake gets no
// edge though it touches the sea; the shore names become region ids.
func TestHandStraitsAndCanals(t *testing.T) {
	p, ids := seaGraphWorld()
	paint(p, ids, 40001, 100, 50, 109, 59)
	paint(p, ids, 40002, 110, 50, 119, 59)
	paint(p, ids, 40003, 200, 50, 209, 59)
	paint(p, ids, 40004, 120, 50, 129, 59) // a lake beside 40002
	zones := zonesOf(40001, 40002, 40003, 40004)
	zones[3].Lake = true
	tbl := StraitTables{Sea: []StraitRow{
		{ID: "narrows", Kind: "strait", A: 40002, B: 40001, Shore: []string{"AAA:Land"}},
		{ID: "cut", Kind: "canal", A: 40001, B: 40003, Shore: []string{"AAA:Land"}},
	}}
	byName := map[string]int{"AAA:Land": 1}
	g, err := buildSeaGraph(p, ids, buildTileLists(ids), zones, tbl, byName)
	if err != nil {
		t.Fatal(err)
	}
	kinds := map[[2]int]int{}
	for _, e := range g.Edges {
		kinds[[2]int{e.A, e.B}] = e.Kind
	}
	if want := map[[2]int]int{{40001, 40002}: seaKindStrait, {40001, 40003}: seaKindCanal}; !reflect.DeepEqual(kinds, want) {
		t.Fatalf("edges %v, want %v", kinds, want)
	}
	if want := []Strait{{ID: "narrows", Kind: "strait", A: 40001, B: 40002, Shore: []int{1}}, {ID: "cut", Kind: "canal", A: 40001, B: 40003, Shore: []int{1}}}; !reflect.DeepEqual(g.Straits, want) {
		t.Fatalf("straits %+v", g.Straits)
	}
	tbl.Sea[0].Shore = []string{"AAA:Nowhere"}
	if _, err := buildSeaGraph(p, ids, buildTileLists(ids), zones, tbl, byName); err == nil || !strings.Contains(err.Error(), `no region "AAA:Nowhere"`) {
		t.Fatalf("err = %v", err)
	}
}
