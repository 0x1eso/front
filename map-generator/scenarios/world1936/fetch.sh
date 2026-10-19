#!/usr/bin/env bash
# Fetches the World War 1936 map sources into map-generator/.cache/ww1936
# (git-ignored) and checks them. Public domain: Natural Earth (pinned
# commit), NASA Earth Observatory / GEBCO topography. Run from map-generator/.
set -euo pipefail
dir=.cache/ww1936
mkdir -p "$dir"
ne=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson
for f in ne_10m_land ne_10m_lakes ne_10m_admin_1_states_provinces ne_10m_geography_marine_polys ne_10m_populated_places_simple; do
  [ -f "$dir/$f.geojson" ] || curl -fsSL -o "$dir/$f.geojson" "$ne/$f.geojson"
done
nasa=https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png
[ -f "$dir/gebco_08_rev_elev_21600x10800.png" ] || curl -fsSL -o "$dir/gebco_08_rev_elev_21600x10800.png" "$nasa"
(cd "$dir" && sha256sum -c - <<'SUMS'
1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416  ne_10m_land.geojson
2d036f53dedec578001c5c30c2959ee7d4eebc1306900fa4367c49929ec8f2d9  ne_10m_lakes.geojson
22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5  ne_10m_admin_1_states_provinces.geojson
53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66c  ne_10m_geography_marine_polys.geojson
fd3fa867a320cbd5c5b6bb5bc550afeec2939fb2cef688e508007282a55ac42f  ne_10m_populated_places_simple.geojson
4a70590d40dd7b9c69b9ab359d1dc4475ce97c1d2d13625223b248364112c699  gebco_08_rev_elev_21600x10800.png
SUMS
)
