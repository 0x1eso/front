package main

import (
	"strings"
	"testing"
)

// seaWorld: a 360-pixel-wide map of water, zone 40001 at x < 100 and zone
// 40002 at x >= 100 (one degree a column: column x is centred on
// lon x + 0.5 − 180).
func seaWorld() (Projection, []uint16, []*Region) {
	p := NewProjection(360, -60, 84)
	w := p.Width
	ids := make([]uint16, w*p.Height)
	for i := range ids {
		ids[i] = 40001
		if i%w >= 100 {
			ids[i] = 40002
		}
	}
	zones := []*Region{{ID: 40001, Name: "West Sea", NameKo: "서해"}, {ID: 40002, Name: "East Sea", NameKo: "동해"}}
	return p, ids, zones
}

// A box across the whole of zone 40001 (x 40..59) leaves two pieces of it of
// equal size: the one with the first pixel (x < 40) stays, the other (x
// 60..99) joins the neighbour it shares the longest edge with, a tie
// between the new zone and 40002 that the smaller id wins.
func TestSeaSplitCutsTheBoxAndJoinsThePieces(t *testing.T) {
	p, ids, zones := seaWorld()
	w := p.Width
	s := SeaSplit{
		Expect: map[string]string{"40001": "West Sea"},
		Split:  []SeaSplitRow{{ID: 40003, Name: "Strait", NameKo: "해협", From: []int{40001}, Lon: [2]float64{-140, -120}, Lat: [2]float64{-90, 90}}},
		Rename: []SeaRename{{ID: 40001, Was: "West Sea", Name: "Far West Sea", NameKo: "먼 서해"}},
		Lakes:  []SeaRename{{ID: 40002, Was: "East Sea"}},
	}
	out, cut, moves, err := applySeaSplit(p, ids, zones, s)
	if err != nil {
		t.Fatal(err)
	}
	h := p.Height
	if cut[40003] != 20*h {
		t.Fatalf("cut %d tiles, want %d", cut[40003], 20*h)
	}
	if len(moves) != 1 {
		t.Fatalf("moves %v", moves)
	}
	for x := 0; x < w; x++ {
		want := uint16(40001)
		switch {
		case x >= 40 && x < 60:
			want = 40003
		case x >= 60:
			want = 40002
		}
		if got := ids[5*w+x]; got != want {
			t.Fatalf("column %d is zone %d, want %d", x, got, want)
		}
	}
	if len(out) != 3 || out[0].ID != 40001 || out[2].ID != 40003 {
		t.Fatalf("zones %v", out)
	}
	if out[0].Name != "Far West Sea" || !out[1].Lake || out[2].Name != "Strait" || len(out[2].Pixels) != 20*h {
		t.Fatalf("zones %+v %+v %+v", *out[0], *out[1], *out[2])
	}
}

// The tool fails rather than cut the wrong sea: a zone named otherwise than
// the table expects, a box over no water of its sources, a rename of the
// wrong zone.
func TestSeaSplitChecksItsZones(t *testing.T) {
	p, ids, zones := seaWorld()
	row := SeaSplitRow{ID: 40003, Name: "Strait", NameKo: "해협", From: []int{40001}, Lon: [2]float64{-140, -120}, Lat: [2]float64{-90, 90}}
	if _, _, _, err := applySeaSplit(p, ids, zones, SeaSplit{Expect: map[string]string{"40001": "North Sea"}}); err == nil || !strings.Contains(err.Error(), `should be "North Sea"`) {
		t.Fatalf("err = %v", err)
	}
	far := row
	far.Lon = [2]float64{100, 110} // over 40002 only
	if _, _, _, err := applySeaSplit(p, ids, zones, SeaSplit{Split: []SeaSplitRow{far}}); err == nil || !strings.Contains(err.Error(), "holds no water") {
		t.Fatalf("err = %v", err)
	}
	p, ids, zones = seaWorld()
	if _, _, _, err := applySeaSplit(p, ids, zones, SeaSplit{Split: []SeaSplitRow{row}, Rename: []SeaRename{{ID: 40002, Was: "West Sea"}}}); err == nil || !strings.Contains(err.Error(), "rename 40002") {
		t.Fatalf("err = %v", err)
	}
}
