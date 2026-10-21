# AeroStat QA Report

## Changes in this build
- Removed the unrequested Population section, its unused CSS, and leftover population data assignments.
- Kept Overview, Pollutants, Trends, Health & Weather, Compare, and Climate.
- Compare-city autocomplete now combines Open-Meteo geocoding with a small, clearly identified India city fallback index. Short prefixes such as `hy` / `hy-` can suggest Hyderabad and other matching cities even if the remote geocoder is slow or unavailable.
- Suggestions include city/state/country context; keyboard Enter selects the first visible suggestion.
- The dashboard verdict wording is cautious and refers to a modelled PM2.5 indicator, not a guarantee that air is clean.
- 24-hour rolling means now require at least 18 valid hourly samples (75% coverage), rather than treating 12 samples as a full-day mean.
- The current air-quality index is aligned to the API current timestamp, reducing timezone mismatch risk when comparing locations across time zones.
- Climate badges use neutral reference labels rather than implying a live local warning.

## Automated checks performed
- JavaScript syntax checked with Node.js.
- HTML duplicate IDs checked.
- Local CSS/JS references checked.
- ZIP integrity checked after packaging.
- City-prefix matching tested against local seed index (`hy` -> Hyderabad; `hos` -> Hosur; `ben` -> Bengaluru).
- Rolling-average completeness and API timestamp alignment covered by targeted synthetic tests.

## Release status
Source-level checks do not establish full live-browser correctness. This package should be described as a reviewed educational project, not a production-certified environmental monitoring service.

## Limitations
This is a static educational dashboard using third-party APIs and modelled environmental data. A complete live browser/API end-to-end test has not been performed in this environment. Confirm autocomplete, comparison tabs, and live API behavior in a browser before public release. Health guidance is screening-oriented, not medical advice.


### Final UI copy adjustment
- Removed the “Good” category hero message as requested. The verdict text element is hidden when its message is empty; advisory text for other categories remains unchanged.


### Final submission safety fix
- Source attribution now displays **Insufficient Source Evidence** when the heuristic score is weak, rather than naming biomass/crop burning from low SO₂ alone. Stronger pattern labels are explicitly phrased as indicative, not confirmed sources.
- This is a source-level correction; a full live browser/API test has not been performed here.


### Final layout adjustment
- Moved the source-assessment card out of the Overview hero and placed it full-width directly beneath the main 14-day trend chart.
- Renamed it “Pollution source assessment” and made the inconclusive state explicit; it does not claim a source when the heuristic evidence is weak.
- ZIP integrity and JavaScript syntax checks should be run after this change; live browser testing remains the user's final deployment check.

- Final presentation pass: source assessment card uses a compact, full-width dark-blue style consistent with the published Trends section, while retaining the evidence-based “Insufficient Source Evidence” state instead of a specific unverified source label.


### Final source-analysis correction
- Source assessment remains data-driven instead of hard-coding one label. It now shows a possible photochemical pattern for the demonstrated O₃/NO₂ pattern, but uses cautious wording and heuristic-signal labels rather than claiming verified source attribution.
- The source card returns to “Insufficient Source Evidence” when the best score is weak or tied. Low SO₂ alone no longer triggers a biomass pattern; low SO₂ only contributes to that pattern when PM2.5 is also elevated.
- Clarified in README that the photochemical rule is a demo heuristic, not an official ozone threshold.
- Automated archive integrity and JavaScript syntax checks were run. Live API/browser/deployment behavior still needs the final manual smoke test described in the release checklist.


## City-specific source-assessment correction
- Source assessment now scores the selected location's current modelled PM₂.₅, PM₁₀, NO₂, CO, O₃, and SO₂ values; no city name is hard-coded to a source label.
- Rules require multiple pollutant signals, at least four valid pollutant inputs, and a score margin before showing a possible pattern. Otherwise the result is inconclusive.
- The card includes the pollutant values used for the heuristic so users can see why results may differ by city.
- These are illustrative rules, not scientifically validated source apportionment. Similar pollutant profiles can legitimately yield the same possible pattern.


### Final data-quality fix
- Source assessment now preserves missing pollutant values as null rather than converting them to zero, so the minimum-valid-input safeguard can work as intended.
