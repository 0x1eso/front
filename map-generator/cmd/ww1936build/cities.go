package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
)

// 1936 city weights (spec §7.5), keyed by Natural Earth nameascii|adm0_a3.
// Listed cities are taken whatever their Natural Earth scale rank; other
// capitals and rank 0..2 cities get 5 (rank 0..1) or 3.
var cityTiers = map[string]int{
	"London|GBR": 20, "Paris|FRA": 20, "Berlin|DEU": 20, "Moscow|RUS": 20, "Tokyo|JPN": 20, "New York|USA": 20,

	"Rome|ITA": 10, "Vienna|AUT": 10, "St. Petersburg|RUS": 10, "Chicago|USA": 10, "Osaka|JPN": 10,
	"Shanghai|CHN": 10, "Buenos Aires|ARG": 10, "Kolkata|IND": 10, "Mumbai|IND": 10, "Warsaw|POL": 10,
	"Budapest|HUN": 10, "Madrid|ESP": 10, "Barcelona|ESP": 10, "Hamburg|DEU": 10, "Detroit|USA": 10,
	"Philadelphia|USA": 10, "Beijing|CHN": 10, "Tianjin|CHN": 10, "Istanbul|TUR": 10, "Cairo|EGY": 10,
	"Sydney|AUS": 10, "Rio de Janeiro|BRA": 10, "Sao Paulo|BRA": 10, "Mexico City|MEX": 10, "Los Angeles|USA": 10,

	"Milan|ITA": 5, "Munich|DEU": 5, "Leipzig|DEU": 5, "Prague|CZE": 5, "Bucharest|ROU": 5, "Kiev|UKR": 5,
	"Kharkiv|UKR": 5, "Baku|AZE": 5, "Tashkent|UZB": 5, "Montreal|CAN": 5, "Toronto|CAN": 5, "Melbourne|AUS": 5,
	"Johannesburg|ZAF": 5, "Alexandria|EGY": 5, "Tehran|IRN": 5, "Delhi|IND": 5, "Chennai|IND": 5,
	"Lahore|PAK": 5, "Nanjing|CHN": 5, "Wuhan|CHN": 5, "Guangzhou|CHN": 5, "Seoul|KOR": 5, "Lisbon|PRT": 5,
	"Brussels|BEL": 5, "Amsterdam|NLD": 5, "Kobenhavn|DNK": 5, "Stockholm|SWE": 5, "Athens|GRC": 5,
	"Belgrade|SRB": 5, "Havana|CUB": 5, "Lima|PER": 5, "Montevideo|URY": 5, "San Francisco|USA": 5,
	"Boston|USA": 5, "Glasgow|GBR": 5, "Birmingham|GBR": 5, "Manchester|GBR": 5, "Marseille|FRA": 5,
	"Lyon|FRA": 5, "Naples|ITA": 5, "Turin|ITA": 5, "Manila|PHL": 5, "Singapore|SGP": 5, "Jakarta|IDN": 5,
	"Hong Kong|HKG": 5, "Cape Town|ZAF": 5, "Santiago|CHL": 5, "Bogota|COL": 5,
}

// Places that were no city of note in 1936 (later capitals, new cities).
var cityDrop = map[string]bool{
	"Brasilia|BRA": true, "Islamabad|PAK": true, "Abuja|NGA": true, "Dodoma|TZA": true, "Gaborone|BWA": true,
	"Nouakchott|MRT": true, "Belmopan|BLZ": true, "Putrajaya|MYS": true, "Yamoussoukro|CIV": true,
	"Lilongwe|MWI": true, "Dubai|ARE": true, "Abu Dhabi|ARE": true, "Doha|QAT": true, "Shenzhen|CHN": true,
	"Dongguan|CHN": true, "Chandigarh|IND": true,
}

func cityKey(f Feature) string {
	return strings.Join(strings.Fields(f.Str("nameascii")), " ") + "|" + f.Str("adm0_a3")
}

// bootstrapCities writes vp_cities.json from Natural Earth populated places
// and the lists above; it fails when a listed city is not found.
func bootstrapCities(places []Feature, path string) error {
	var rows []City
	found := map[string]bool{}
	for _, f := range places {
		if f.Point == nil {
			continue
		}
		key := cityKey(f)
		if cityDrop[key] {
			found[key] = true
			continue
		}
		rank := int(f.Num("scalerank"))
		tier, listed := cityTiers[key]
		if !listed {
			if rank > 2 && f.Num("adm0cap") != 1 {
				continue
			}
			tier = 3
			if rank <= 1 {
				tier = 5
			}
		}
		if listed && found[key] {
			continue // a second place of the same name and country
		}
		found[key] = true
		rows = append(rows, City{Name: f.Str("name"), Lon: f.Point[0], Lat: f.Point[1], Tier: tier})
	}
	var missing []string
	for key := range cityTiers {
		if !found[key] {
			missing = append(missing, key)
		}
	}
	for key := range cityDrop {
		if !found[key] {
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return fmt.Errorf("cities not in Natural Earth (fix the key): %v", missing)
	}
	sort.Slice(rows, func(a, b int) bool {
		if rows[a].Tier != rows[b].Tier {
			return rows[a].Tier > rows[b].Tier
		}
		if rows[a].Name != rows[b].Name {
			return rows[a].Name < rows[b].Name
		}
		return rows[a].Lon < rows[b].Lon
	})
	js, err := json.MarshalIndent(rows, "", "  ")
	if err != nil {
		return err
	}
	fmt.Printf("%d cities written to %s\n", len(rows), path)
	return os.WriteFile(path, append(js, '\n'), 0644)
}
