package main

import (
	"image"
	"image/color"
	"image/png"
	"os"
)

// writeOwnerPNG draws each pixel's owner (a colour per country, water dark)
// and the region edges, for checking the tables by eye.
func writeOwnerPNG(path string, p Projection, land []bool, owner []uint8, ids []uint16) error {
	img := image.NewNRGBA(image.Rect(0, 0, p.Width, p.Height))
	n := p.Width * p.Height
	for i := 0; i < n; i++ {
		x, y := i%p.Width, i/p.Width
		if !land[i] {
			img.SetNRGBA(x, y, color.NRGBA{20, 30, 60, 255})
			continue
		}
		o := uint32(owner[i])
		h := o*2654435761 + 12345
		c := color.NRGBA{uint8(64 + h%160), uint8(64 + (h>>8)%160), uint8(64 + (h>>16)%160), 255}
		if ids != nil && x+1 < p.Width && y+1 < p.Height && (ids[i] != ids[i+1] || ids[i] != ids[i+p.Width]) {
			c = color.NRGBA{c.R / 2, c.G / 2, c.B / 2, 255}
		}
		if x+1 < p.Width && y+1 < p.Height && (owner[i] != owner[i+1] || owner[i] != owner[i+p.Width]) {
			c = color.NRGBA{0, 0, 0, 255}
		}
		img.SetNRGBA(x, y, c)
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}
