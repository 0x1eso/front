#!/usr/bin/env bash
# Fetches the World War 1936 map sources into map-generator/.cache/ww1936
# (git-ignored) and checks them. Public domain: Natural Earth (pinned
# commit), NASA Earth Observatory / GEBCO topography, and the MODIS land cover
# classification through NASA GIBS (P2 spec §3.2-5: NASA NEO, which the plan
# named, was decommissioned in September 2026; GIBS serves the same MODIS
# IGBP classes). Run from map-generator/.
#
# A file already there is kept only when its SHA-256 matches; otherwise it is
# downloaded again, to <file>.part first, and moved into place only after its
# checksum matches.
set -euo pipefail
dir=.cache/ww1936
mkdir -p "$dir"
ne=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson
nasa=https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934
# MODIS Combined L3 IGBP Land Cover Type, annual 2024 (the newest year), as a
# 0.1° grid (3600 x 1800, lon -180..180, lat 90..-90), one colour per class;
# the colour map gives each colour its IGBP class.
gibs="https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=3600&HEIGHT=1800&FORMAT=image/png&TIME=2024-01-01"
gibsColors=https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_IGBP_Land_Cover_Type.xml

if command -v sha256sum > /dev/null; then
    sha256() { sha256sum "$1" | cut -d ' ' -f 1; }
else
    sha256() { shasum -a 256 "$1" | cut -d ' ' -f 1; }
fi

# fetch <file> <url> <sha256>
fetch() {
    local file="$dir/$1" url=$2 want=$3 got
    if [ -f "$file" ] && [ "$(sha256 "$file")" = "$want" ]; then
        echo "$1: OK"
        return
    fi
    rm -f "$file.part"
    curl -fsSL -o "$file.part" "$url"
    got=$(sha256 "$file.part")
    if [ "$got" != "$want" ]; then
        rm -f "$file.part"
        echo "$1: checksum $got, expected $want" >&2
        exit 1
    fi
    mv "$file.part" "$file"
    echo "$1: OK (downloaded)"
}

fetch ne_10m_land.geojson "$ne/ne_10m_land.geojson" 1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416
fetch ne_10m_lakes.geojson "$ne/ne_10m_lakes.geojson" 2d036f53dedec578001c5c30c2959ee7d4eebc1306900fa4367c49929ec8f2d9
fetch ne_10m_admin_1_states_provinces.geojson "$ne/ne_10m_admin_1_states_provinces.geojson" 22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5
fetch ne_10m_geography_marine_polys.geojson "$ne/ne_10m_geography_marine_polys.geojson" 53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66c
fetch ne_10m_populated_places_simple.geojson "$ne/ne_10m_populated_places_simple.geojson" fd3fa867a320cbd5c5b6bb5bc550afeec2939fb2cef688e508007282a55ac42f
fetch gebco_08_rev_elev_21600x10800.png "$nasa/gebco_08_rev_elev_21600x10800.png" 4a70590d40dd7b9c69b9ab359d1dc4475ce97c1d2d13625223b248364112c699
fetch ne_10m_rivers_lake_centerlines.geojson "$ne/ne_10m_rivers_lake_centerlines.geojson" bb854a900ecbd3b408df46d5e16e3e0f974ba55993f9d8b5c26e855273c0905a
fetch modis_igbp_2024_3600x1800.png "$gibs" 459a94055c97184da5fcfe4fb62185c100afae0c369b48bf62ae001101e9d3ee
fetch modis_igbp_colormap.xml "$gibsColors" 29a9b5fe6d976a0ea5da12c46d9accfe20a1807b3f602d36d940663d6e854ef7
