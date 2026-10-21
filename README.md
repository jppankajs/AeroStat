# AeroStat — Location-Based Environmental Analytics

A browser-based college project for exploring modelled air-quality and weather data for Indian cities and searched administrative areas. It combines location search, PM2.5-based indicative AQI calculations, pollutant comparisons, trends, basic statistics, weather context and historical global/national environmental indicators.

## Important accuracy statement

- Air-quality values are **model output**, not direct measurements from a local monitoring station. Open-Meteo's CAMS global product is approximately 45 km in spatial resolution with underlying 3-hourly model timesteps; the API may provide interpolated hourly values.
- The main gauge is a **PM2.5-based indicative AQI estimate**. It is not an official CPCB or US EPA AQI report.
- WHO comparisons are screening ratios against guideline concentrations and averaging periods. They are not regulatory compliance results or official WHO exceedance-day calculations.
- Pollution-source pattern labels and wind-dispersion wording are heuristic educational demonstrations, not validated scientific source apportionment or atmospheric dispersion models. The source card scores a small set of pollutant patterns, shows an inconclusive state when the scores are weak or tied, and labels any selected pattern as a hypothesis only. The photochemical rule is a demo heuristic, not an official ozone threshold. No label confirms a real emission source.
- City/district/state searches resolve to a representative coordinate. The application does not calculate a district-wide or state-wide average.
- Global climate and national forest/solar cards are **historical static reference values**, not live feeds. Check the displayed year and source in the Methodology panel.

## Features

- Search suggestions for Indian populated places using Open-Meteo Geocoding.
- Explicit submitted search (Enter) using OpenStreetMap Nominatim for administrative-area matching; requests are cached and serialized.
- GPS lookup only after the user clicks **Locate me**.
- PM2.5-based indicative CPCB-style and EPA-style index estimates.
- Pollutant reference comparisons, model-output trends, descriptive statistics, city comparison and local model weather.
- Static global and national environmental indicators with historical labels.

## Run locally (Windows / VS Code)

1. Extract the ZIP.
2. In VS Code, open the inner `AeroStat` folder that contains `index.html`, `css/`, and `js/`.
3. Open the terminal in that exact folder and run:

   ```powershell
   py -m http.server 8000
   ```

4. Open `http://localhost:8000`.

Do not start the server from the parent folder; it will show a directory listing instead of the dashboard. No `npm install` is required. Internet access is needed for the external APIs, Chart.js CDN and Google Fonts.

## APIs and attribution

- **Air quality:** [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api), using CAMS-based model output.
- **Weather:** [Open-Meteo Weather API](https://open-meteo.com/en/docs).
- **Place suggestions:** [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), which uses place data based on GeoNames.
- **Explicit place search and GPS reverse geocoding:** [OpenStreetMap Nominatim](https://nominatim.org/). Nominatim is not used for client-side autocomplete. Its public service is rate-limited and must be used in accordance with the [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/).
- **Map and geocoding data:** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- **Standards references:** [US EPA AQI breakpoints](https://aqs.epa.gov/aqsweb/documents/codetables/aqi_breakpoints.html) and [WHO Global Air Quality Guidelines](https://www.who.int/publications/i/item/9789240034228).
- **Historical environmental context:** NOAA Global Monitoring Laboratory (GML), NASA Goddard Institute for Space Studies (GISS), the National Snow and Ice Data Center (NSIDC), the Forest Survey of India (FSI), the Ministry of Environment, Forest and Climate Change (MoEFCC), and the International Renewable Energy Agency (IRENA). These indicators are historical reference values rather than live feeds. Consult the Methodology panel for the applicable years and sources.
  
## Project structure

```text
AeroStat/
├── index.html
├── README.md
├── css/
│   └── styles.css
└── js/
    ├── constants.js
    ├── math.js
    ├── api.js
    ├── charts.js
    ├── ui.js
    └── app.js
```

## Before using for decisions

This is an educational project, not a medical or regulatory monitoring service. For official local air-quality readings, consult CPCB/State Pollution Control Board monitoring stations and their published data.


## Dashboard behavior

The dashboard includes six sections: Overview, Pollutants, Trends, Health & Weather, Compare, and Climate. Environmental data may take time to load because the application depends on external APIs. If an API request fails, the interface is designed to display an appropriate error message. The project does not include a Population section.

### City-specific source assessment

The source-assessment card uses the selected location's modelled pollutant values (PM₂.₅, PM₁₀, NO₂, CO, O₃, and SO₂) to evaluate a small set of illustrative pollution-pattern rules. It may show an inconclusive result when the evidence is weak or ambiguous. Any suggested pattern is a hypothesis for educational exploration, not a confirmed emission source or scientifically validated source-apportionment result. Different cities may produce the same assessment when their modelled pollutant profiles are similar.
