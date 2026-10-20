package main

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
)

// buildLand marks land pixels: Natural Earth land polygons minus lakes.
func buildLand(p Projection, landFeats, lakeFeats []Feature) []bool {
	land := make([]bool, p.Width*p.Height)
	for _, f := range landFeats {
		for _, poly := range f.Polygons {
			fillPolygon(p, poly, func(i int) { land[i] = true })
		}
	}
	for _, f := range lakeFeats {
		for _, poly := range f.Polygons {
			fillPolygon(p, poly, func(i int) { land[i] = false })
		}
	}
	return land
}

func loadGray(path string) (*image.Gray, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	g, ok := img.(*image.Gray)
	if !ok {
		return nil, fmt.Errorf("%s is not 8-bit grayscale", path)
	}
	return g, nil
}

// elevationAt averages the 3x3 block of the equirectangular elevation
// raster (0..255, about 25 m per step) around lon, lat.
func elevationAt(g *image.Gray, lon, lat float64) int {
	w := g.Rect.Dx()
	h := g.Rect.Dy()
	cx := int((lon + 180) / 360 * float64(w))
	cy := int((90 - lat) / 180 * float64(h))
	sum, k := 0, 0
	for dy := -1; dy <= 1; dy++ {
		y := cy + dy
		if y < 0 || y >= h {
			continue
		}
		for dx := -1; dx <= 1; dx++ {
			x := ((cx+dx)%w + w) % w
			sum += int(g.Pix[y*g.Stride+x])
			k++
		}
	}
	return sum / k
}

// terrainBlue maps elevation to the generator's blue channel (map_generator.go
// GenerateMap): plains under ~500 m, highland to ~1500 m, mountains above.
func terrainBlue(e int) uint8 {
	var mag int
	switch {
	case e < 20:
		mag = e / 2
	case e < 60:
		mag = 10 + (e-20)/4
	default:
		mag = 20 + min(10, (e-60)/15)
	}
	return uint8(140 + 2*mag)
}

// writeTerrain writes the generator's image.png: water (0, 0, 106), land a
// grey whose blue channel is its terrain; a stamped island pixel (islands.go)
// is plains at the lowest elevation. Returns each land pixel's magnitude
// (the generator's (blue − 140) / 2, 0..30).
func writeTerrain(path string, p Projection, land []bool, elev *image.Gray, stamped []bool) ([]uint8, error) {
	img := image.NewNRGBA(image.Rect(0, 0, p.Width, p.Height))
	mag := make([]uint8, p.Width*p.Height)
	for y := 0; y < p.Height; y++ {
		for x := 0; x < p.Width; x++ {
			i := y*p.Width + x
			if !land[i] {
				img.SetNRGBA(x, y, color.NRGBA{0, 0, 106, 255})
				continue
			}
			b := uint8(140)
			if stamped == nil || !stamped[i] {
				lon, lat := p.LonLat(x, y)
				b = terrainBlue(elevationAt(elev, lon, lat))
			}
			mag[i] = (b - 140) / 2
			img.SetNRGBA(x, y, color.NRGBA{b, b, b, 255})
		}
	}
	f, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return mag, png.Encode(f, img)
}
