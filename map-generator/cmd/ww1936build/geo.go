package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sort"
)

// Ring is a closed ring of [lon, lat] points; Polygon is an outer ring and
// its holes (filled with the even-odd rule, so holes need no special case).
type Ring [][2]float64
type Polygon []Ring

// Feature is a GeoJSON feature reduced to what the tool reads.
type Feature struct {
	Props    map[string]any
	Polygons []Polygon
	Point    *[2]float64
}

func (f Feature) Str(key string) string {
	v, _ := f.Props[key].(string)
	return v
}

func (f Feature) Num(key string) float64 {
	v, _ := f.Props[key].(float64)
	return v
}

func readFeatures(path string) ([]Feature, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var fc struct {
		Features []struct {
			Properties map[string]any `json:"properties"`
			Geometry   *struct {
				Type        string          `json:"type"`
				Coordinates json.RawMessage `json:"coordinates"`
			} `json:"geometry"`
		} `json:"features"`
	}
	if err := json.Unmarshal(data, &fc); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	out := make([]Feature, 0, len(fc.Features))
	for _, f := range fc.Features {
		feat := Feature{Props: f.Properties}
		if g := f.Geometry; g != nil {
			switch g.Type {
			case "Polygon":
				var c [][][]float64
				if err := json.Unmarshal(g.Coordinates, &c); err != nil {
					return nil, fmt.Errorf("%s: %w", path, err)
				}
				feat.Polygons = []Polygon{toPolygon(c)}
			case "MultiPolygon":
				var c [][][][]float64
				if err := json.Unmarshal(g.Coordinates, &c); err != nil {
					return nil, fmt.Errorf("%s: %w", path, err)
				}
				for _, p := range c {
					feat.Polygons = append(feat.Polygons, toPolygon(p))
				}
			case "Point":
				var c []float64
				if err := json.Unmarshal(g.Coordinates, &c); err != nil {
					return nil, fmt.Errorf("%s: %w", path, err)
				}
				feat.Point = &[2]float64{c[0], c[1]}
			}
		}
		out = append(out, feat)
	}
	return out, nil
}

func toPolygon(c [][][]float64) Polygon {
	p := make(Polygon, 0, len(c))
	for _, ring := range c {
		r := make(Ring, 0, len(ring))
		for _, pt := range ring {
			r = append(r, [2]float64{pt[0], pt[1]})
		}
		p = append(p, r)
	}
	return p
}

// Projection is the Miller cylindrical projection of spec §4.1.
type Projection struct {
	Width, Height  int
	LatMin, LatMax float64
	yTop           float64
	scale          float64 // pixels per radian
}

func millerY(latDeg float64) float64 {
	phi := latDeg * math.Pi / 180
	return 1.25 * math.Log(math.Tan(math.Pi/4+0.4*phi))
}

func millerLat(y float64) float64 {
	return (2.5*math.Atan(math.Exp(0.8*y)) - 0.625*math.Pi) * 180 / math.Pi
}

func NewProjection(width int, latMin, latMax float64) Projection {
	p := Projection{Width: width, LatMin: latMin, LatMax: latMax}
	p.scale = float64(width) / (2 * math.Pi)
	p.yTop = millerY(latMax)
	h := int(math.Floor((p.yTop - millerY(latMin)) * p.scale))
	p.Height = h - h%4
	return p
}

// ToPixel gives fractional pixel coordinates (x right, y down).
func (p Projection) ToPixel(lon, lat float64) (float64, float64) {
	lat = math.Max(-89.5, math.Min(89.5, lat))
	return (lon + 180) / 360 * float64(p.Width), (p.yTop - millerY(lat)) * p.scale
}

// Pixel is the pixel a point falls in, and whether it is on the map.
func (p Projection) Pixel(lon, lat float64) (int, bool) {
	fx, fy := p.ToPixel(lon, lat)
	x, y := int(math.Floor(fx)), int(math.Floor(fy))
	if x < 0 || x >= p.Width || y < 0 || y >= p.Height {
		return 0, false
	}
	return y*p.Width + x, true
}

// LonLat of a pixel's centre.
func (p Projection) LonLat(px, py int) (float64, float64) {
	lon := (float64(px)+0.5)/float64(p.Width)*360 - 180
	lat := millerLat(p.yTop - (float64(py)+0.5)/p.scale)
	return lon, lat
}

type edge struct {
	x0, y0, x1, y1 float64
	ymin, ymax     float64
}

// fillPolygon calls set for every pixel whose centre lies inside the polygon
// (even-odd over all its rings), row by row.
func fillPolygon(p Projection, poly Polygon, set func(i int)) {
	var edges []edge
	for _, ring := range poly {
		for k := range ring {
			a := ring[k]
			b := ring[(k+1)%len(ring)]
			ax, ay := p.ToPixel(a[0], a[1])
			bx, by := p.ToPixel(b[0], b[1])
			if ay == by {
				continue
			}
			edges = append(edges, edge{ax, ay, bx, by, math.Min(ay, by), math.Max(ay, by)})
		}
	}
	if len(edges) == 0 {
		return
	}
	sort.Slice(edges, func(i, j int) bool { return edges[i].ymin < edges[j].ymin })
	ymin, ymax := edges[0].ymin, edges[0].ymax
	for _, e := range edges {
		ymax = math.Max(ymax, e.ymax)
	}
	y0 := int(math.Max(0, math.Floor(ymin-0.5)))
	y1 := int(math.Min(float64(p.Height-1), math.Ceil(ymax)))
	var active []int
	next := 0
	xs := make([]float64, 0, 64)
	for py := y0; py <= y1; py++ {
		cy := float64(py) + 0.5
		for next < len(edges) && edges[next].ymin <= cy {
			active = append(active, next)
			next++
		}
		w := 0
		for _, k := range active {
			if edges[k].ymax > cy {
				active[w] = k
				w++
			}
		}
		active = active[:w]
		xs = xs[:0]
		for _, k := range active {
			e := edges[k]
			if e.ymin <= cy && cy < e.ymax {
				t := (cy - e.y0) / (e.y1 - e.y0)
				xs = append(xs, e.x0+t*(e.x1-e.x0))
			}
		}
		sort.Float64s(xs)
		for k := 0; k+1 < len(xs); k += 2 {
			xa := int(math.Ceil(xs[k] - 0.5))
			xb := int(math.Ceil(xs[k+1]-0.5)) - 1
			if xa < 0 {
				xa = 0
			}
			if xb >= p.Width {
				xb = p.Width - 1
			}
			for px := xa; px <= xb; px++ {
				set(py*p.Width + px)
			}
		}
	}
}

// forNeighbours4 calls fn for the orthogonal neighbours of i: up, left,
// right, down.
func forNeighbours4(i, w, n int, fn func(j int)) {
	x := i % w
	if i >= w {
		fn(i - w)
	}
	if x > 0 {
		fn(i - 1)
	}
	if x < w-1 {
		fn(i + 1)
	}
	if i+w < n {
		fn(i + w)
	}
}
