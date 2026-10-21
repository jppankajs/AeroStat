/**
 * AeroStat — API Layer
 * Geocoding, data fetching, processing pipeline
 */

// Rolling average helper for pollutant-specific averaging windows.
function getRollingAvg(arr, ci, windowSize, minimumSamples) {
  if (!Array.isArray(arr) || ci < 0) return null;
  const values = arr.slice(Math.max(0, ci - windowSize + 1), ci + 1)
    .filter(value => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number);
  const required = minimumSamples == null ? windowSize : minimumSamples;
  return values.length < required ? null : avg(values);
}

// ═══ AQI COMPUTATION ═══

function computeAQI(pm, bp) {
  if (pm === null || pm === undefined || !Number.isFinite(Number(pm))) return { value: 0, category: 'N/A', color: '#666' };
  for (const [bpl, bph, al, ah, cat, col] of bp) {
    if (pm <= bph) {
      return {
        value: Math.round(((ah - al) / (bph - bpl)) * (pm - bpl) + al),
        category: cat,
        color: col
      };
    }
  }
  return { value: 500, category: bp[bp.length - 1][4], color: bp[bp.length - 1][5] };
}

function computeCPCB(pm) {
  return computeAQI(pm, CPCB_BP);
}

// EPA AQI method: truncate PM2.5 concentration to 0.1 μg/m³ and truncate
// the resulting index to an integer. Above 325.4 μg/m³ the AQI exceeds 500;
// this dashboard caps the numeric gauge at 500 and labels it accordingly.
function computeEPA(pm) {
  if (pm === null || pm === undefined || !Number.isFinite(Number(pm))) {
    return { value: 0, category: 'N/A', color: '#666' };
  }
  const c = Math.floor(Math.max(0, Number(pm)) * 10) / 10;
  if (c > 325.4) {
    return { value: 500, category: 'Hazardous (500+)', color: '#7e0023' };
  }
  for (const [bpl, bph, al, ah, cat, col] of EPA_BP) {
    if (c >= bpl && c <= bph) {
      const value = Math.floor(((ah - al) / (bph - bpl)) * (c - bpl) + al);
      return { value, category: cat, color: col };
    }
  }
  // Handles floating-point boundary gaps after EPA's 0.1 μg/m³ truncation.
  const band = EPA_BP.find(([, high]) => c <= high) || EPA_BP[EPA_BP.length - 1];
  return { value: band[2], category: band[4], color: band[5] };
}

// ═══ POLLUTANT FINGERPRINTING ═══

function classifySource({ no2, co, pm25, pm10, so2, o3 }) {
  // Educational pattern scoring only; not validated source apportionment.
  // Inputs are the selected city's current modelled pollutant values. Thresholds
  // intentionally require more than one signal and never use city-name shortcuts.
  const vals = { no2, co, pm25, pm10, so2, o3 };
  const n = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k,
    v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v))]));
  const validCount = Object.values(n).filter(v => v !== null).length;
  const r = n.pm25 !== null && n.pm10 !== null && n.pm10 > 0 ? n.pm25 / n.pm10 : null;
  const g = (key, threshold) => n[key] !== null && n[key] >= threshold;
  const low = (key, threshold) => n[key] !== null && n[key] < threshold;

  const sc = {
    traffic:      (g('no2', 35) ? 2 : 0) + (g('no2', 50) ? 2 : 0) + (g('co', 700) ? 1 : 0) + (g('co', 1500) ? 2 : 0) + (r !== null && r >= .65 && g('pm25', 15) ? 1 : 0),
    industrial:   (g('so2', 40) ? 3 : 0) + (g('so2', 75) ? 2 : 0) + (g('pm10', 80) ? 1 : 0) + (g('pm10', 130) ? 2 : 0) + (r !== null && r < .45 && g('pm25', 25) ? 1 : 0),
    construction: (g('pm10', 90) ? 2 : 0) + (g('pm10', 150) ? 2 : 0) + (r !== null && r < .35 ? 2 : 0) + (g('pm25', 20) && low('so2', 20) ? 1 : 0),
    photochem:    (g('o3', 45) ? 2 : 0) + (g('o3', 65) ? 2 : 0) + (g('o3', 85) ? 1 : 0) + (g('o3', 45) && low('no2', 20) ? 1 : 0),
    biomass:      (g('pm25', 35) ? 2 : 0) + (g('pm25', 60) ? 2 : 0) + (g('co', 800) ? 1 : 0) + (g('co', 2000) ? 2 : 0) + (r !== null && r >= .65 && g('pm25', 35) ? 1 : 0)
  };
  const ranked = Object.entries(sc).sort((a, b) => b[1] - a[1]);
  const [bestKey, topScore] = ranked[0];
  const runnerUpScore = ranked[1]?.[1] ?? 0;
  const labels = {
    traffic:      { icon: '🚗', label: 'Traffic / Combustion Pattern', detail: 'Elevated NO₂ and/or CO with a fine-particle signal fits this demo rule; it does not identify a confirmed source.' },
    industrial:   { icon: '🏭', label: 'Industrial-like Pattern', detail: 'Elevated SO₂ and/or coarse particles fit this demo rule; industrial emissions are not confirmed.' },
    construction: { icon: '🏗️', label: 'Dust-like Pattern', detail: 'Elevated PM₁₀ with a coarse-particle profile fits this demo rule; construction is not confirmed.' },
    photochem:    { icon: '☀️', label: 'Photochemical Smog (possible pattern)', detail: 'The selected city’s ozone pattern fits this demo rule. This does not confirm smog or identify its cause.' },
    biomass:      { icon: '🔥', label: 'Biomass-like Pattern', detail: 'Elevated PM₂.₅ with additional combustion-related signals fits this demo rule; biomass burning is not confirmed.' }
  };
  // Require multiple pollutant signals and a clear margin; sparse data is inconclusive.
  const enoughEvidence = validCount >= 4 && topScore >= 3 && topScore - runnerUpScore >= 2;
  const selected = enoughEvidence
    ? labels[bestKey]
    : { icon: 'ⓘ', label: 'Insufficient Source Evidence', detail: 'This city’s available modelled pollutant values do not distinguish a reliable source pattern.' };
  const confidence = !enoughEvidence ? 'Inconclusive' : (topScore >= 5 && topScore - runnerUpScore >= 3 ? 'Stronger heuristic signal' : 'Moderate heuristic signal');
  const fmt = v => v === null ? 'n/a' : Number(v).toFixed(1);
  const inputSummary = `Selected-city model inputs (µg/m³): PM₂.₅ ${fmt(n.pm25)}, PM₁₀ ${fmt(n.pm10)}, NO₂ ${fmt(n.no2)}, CO ${fmt(n.co)}, O₃ ${fmt(n.o3)}, SO₂ ${fmt(n.so2)}.`;

  return {
    ...selected,
    detail: `${selected.detail} ${inputSummary}`,
    heuristic: true,
    confidence,
    scores: sc,
    inputValues: n,
    citation: 'Educational heuristic based on the selected city’s modelled pollutant values; not validated source apportionment. A pattern label is not proof of an emission source.'
  };
}

// ═══ GEOCODING ═══
// Open-Meteo provides forward-search suggestions. Nominatim is used only for
// explicit user-submitted searches and the user-triggered GPS reverse lookup;
// the public Nominatim service must not be used for client-side autocomplete.
const nominatimCache = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimRequestAt = 0;

function nominatimRequest(url) {
  const execute = async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastNominatimRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastNominatimRequestAt = Date.now();
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('GEO_FAIL');
    return response.json();
  };
  const request = nominatimQueue.then(execute, execute);
  // Keep the queue usable after an individual request fails.
  nominatimQueue = request.catch(() => undefined);
  return request;
}

// Lightweight India city index makes short-prefix suggestions useful even if the
// remote geocoder has a minimum query length or is temporarily unavailable.
const INDIA_CITY_SEEDS = [
  ['Hyderabad',17.3850,78.4867,'Telangana'],['Hubballi',15.3647,75.1240,'Karnataka'],['Hosur',12.7409,77.8253,'Tamil Nadu'],
  ['Haldwani',29.2183,79.5130,'Uttarakhand'],['Haridwar',29.9457,78.1642,'Uttarakhand'],['Hassan',13.0068,76.0996,'Karnataka'],
  ['Bengaluru',12.9716,77.5946,'Karnataka'],['Mysuru',12.2958,76.6394,'Karnataka'],['Mangaluru',12.9141,74.8560,'Karnataka'],
  ['Chennai',13.0827,80.2707,'Tamil Nadu'],['Coimbatore',11.0168,76.9558,'Tamil Nadu'],['Pune',18.5204,73.8567,'Maharashtra'],
  ['Mumbai',19.0760,72.8777,'Maharashtra'],['Delhi',28.6139,77.2090,'Delhi'],['Kolkata',22.5726,88.3639,'West Bengal'],
  ['Ahmedabad',23.0225,72.5714,'Gujarat'],['Jaipur',26.9124,75.7873,'Rajasthan'],['Kochi',9.9312,76.2673,'Kerala'],
  ['Vijayawada',16.5062,80.6480,'Andhra Pradesh'],['Visakhapatnam',17.6868,83.2185,'Andhra Pradesh'],['Tirupati',13.6288,79.4192,'Andhra Pradesh'],
  ['Kurnool',15.8281,78.0373,'Andhra Pradesh'],['Adoni',15.6322,77.2728,'Andhra Pradesh'],['Lucknow',26.8467,80.9462,'Uttar Pradesh'],
  ['Indore',22.7196,75.8577,'Madhya Pradesh'],['Bhopal',23.2599,77.4126,'Madhya Pradesh'],['Nagpur',21.1458,79.0882,'Maharashtra'],
  ['Gurugram',28.4595,77.0266,'Haryana'],['Noida',28.5355,77.3910,'Uttar Pradesh'],['Surat',21.1702,72.8311,'Gujarat']
].map(([name, latitude, longitude, admin1]) => ({name, latitude, longitude, lat:String(latitude), lon:String(longitude), admin1, admin2:'', country:'India', display_name:`${name}, ${admin1}, India`, source:'AeroStat India city index'}));

async function geocodeSuggestions(query) {
  const q = String(query || '').trim().replace(/[\s-]+$/g, '');
  if (q.length < 2) return [];
  const norm = q.toLocaleLowerCase('en-IN');
  const localMatches = INDIA_CITY_SEEDS.filter(place => place.name.toLocaleLowerCase('en-IN').startsWith(norm));
  let remoteMatches = [];
  try {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({
      name: q, count: '10', language: 'en', format: 'json'
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(6500) });
    if (response.ok) {
      const payload = await response.json();
      remoteMatches = (Array.isArray(payload.results) ? payload.results : []).map(place => {
        const context = [place.admin2, place.admin1, place.country]
          .filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index && value !== place.name);
        return { name: place.name, lat: String(place.latitude), lon: String(place.longitude), latitude: place.latitude,
          longitude: place.longitude, admin1: place.admin1 || '', admin2: place.admin2 || '', country: place.country || '',
          display_name: [place.name, ...context].join(', '), source: 'Open-Meteo Geocoding' };
      });
    }
  } catch (_) {
    // The local city index still provides useful suggestions during a transient outage.
  }
  const all = [...localMatches, ...remoteMatches.filter(place => !localMatches.some(local =>
    local.name.toLocaleLowerCase('en-IN') === String(place.name).toLocaleLowerCase('en-IN') &&
    Math.abs(Number(local.latitude)-Number(place.latitude)) < .15 && Math.abs(Number(local.longitude)-Number(place.longitude)) < .15))];
  all.sort((a,b) => (a.country === 'India' ? 0 : 1) - (b.country === 'India' ? 0 : 1));
  return all.slice(0, 8);
}

// Explicit submit-only search supports administrative areas (including districts
// and states) where Nominatim has a suitable result. It is serialized and cached.
async function geocode(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const key = q.toLocaleLowerCase('en-IN');
  if (nominatimCache.has(key)) return nominatimCache.get(key);

  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
    countrycodes: 'in',
    'accept-language': 'en'
  });
  const results = await nominatimRequest(url);
  const safeResults = Array.isArray(results) ? results : [];
  nominatimCache.set(key, safeResults);
  return safeResults;
}

async function reverseGeocode(lat, lon) {
  const url = 'https://nominatim.openstreetmap.org/reverse?' + new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'en'
  });
  return nominatimRequest(url);
}

// ═══ DATA FETCHING (Open-Meteo air quality + weather) ═══
async function fetchCityData(lat, lon, cityName) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('INVALID_COORDINATES');
  }

  const name = String(cityName || 'Selected location');
  // Keep enough precision to avoid collisions between nearby towns.
  const ck = `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  const storageKey = `aerostat_${ck}`;

  try {
    const cached = sessionStorage.getItem(storageKey);
    if (cached) {
      const entry = JSON.parse(cached);
      if (entry && entry.data && Date.now() - entry.timestamp < 30 * 60 * 1000) {
        // Reuse measurements, but never reuse the old location label.
        return { ...entry.data, cityName: name, lat: latitude, lon: longitude };
      }
    }
  } catch (error) {
    // Ignore malformed/unavailable browser storage and fetch fresh data.
  }

  const params = {
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: 'pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,ozone,sulphur_dioxide,us_aqi,european_aqi,dust,uv_index',
    past_days: '7',
    forecast_days: '7',
    timezone: 'auto',
    domains: 'cams_global'
  };
  const airUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?' + new URLSearchParams(params);
  const weatherUrl = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,apparent_temperature,precipitation,weather_code',
    hourly: 'temperature_2m',
    past_days: '7',
    forecast_days: '7',
    timezone: 'auto'
  });

  const [airResponse, weatherResponse] = await Promise.all([fetch(airUrl), fetch(weatherUrl)]);
  if (!airResponse.ok || !weatherResponse.ok) throw new Error('API_FAIL');
  const [airData, weatherData] = await Promise.all([airResponse.json(), weatherResponse.json()]);
  if (!airData.hourly || !Array.isArray(airData.hourly.time) ||
      !Array.isArray(airData.hourly.pm2_5) ||
      !Array.isArray(airData.hourly.pm10) ||
      !Array.isArray(airData.hourly.nitrogen_dioxide) ||
      !Array.isArray(airData.hourly.carbon_monoxide) ||
      !Array.isArray(airData.hourly.ozone) ||
      !Array.isArray(airData.hourly.sulphur_dioxide) ||
      !weatherData.current || !weatherData.hourly ||
      !Array.isArray(weatherData.hourly.temperature_2m)) {
    throw new Error('API_FAIL');
  }

  const result = processData(airData, weatherData, name, latitude, longitude);
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ timestamp: Date.now(), data: result }));
  } catch (error) {
    // Storage can be disabled or full; the live result is still usable.
  }
  return result;
}

// ═══ DATA PROCESSING PIPELINE ═══

function processData(aq, wx, cityName, lat, lon) {
  const h = aq.hourly;
  const now = new Date();

  // Align the air-quality series to the API's current local timestamp. The
  // API uses timezone=auto, so comparing against the browser clock can shift
  // the index for locations outside the browser's own timezone.
  const currentTime = wx.current && wx.current.time;
  let ci = currentTime ? h.time.indexOf(currentTime) : -1;
  if (ci < 0 && currentTime && h.time.length) {
    const target = Date.parse(currentTime);
    if (Number.isFinite(target)) {
      let bestDelta = Infinity;
      h.time.forEach((time, index) => {
        const stamp = Date.parse(time);
        if (!Number.isFinite(stamp)) return;
        const delta = Math.abs(stamp - target);
        if (delta < bestDelta) { bestDelta = delta; ci = index; }
      });
    }
  }
  if (ci < 0) {
    // Last-resort fallback: nearest timestamp to current wall clock.
    const target = now.getTime();
    let bestDelta = Infinity;
    h.time.forEach((time, index) => {
      const stamp = Date.parse(time);
      if (!Number.isFinite(stamp)) return;
      const delta = Math.abs(stamp - target);
      if (delta < bestDelta) { bestDelta = delta; ci = index; }
    });
  }
  if (ci < 0) ci = Math.min(167, h.time.length - 1);

  // 24-hour rolling averages for each pollutant
  const pm25a = get24hrAvg(h.pm2_5, ci);
  const pm10a = get24hrAvg(h.pm10, ci);
  const no2a  = get24hrAvg(h.nitrogen_dioxide, ci);
  const coa   = get24hrAvg(h.carbon_monoxide, ci);
  const o3a   = getRollingAvg(h.ozone, ci, 8, 6);
  const so2a  = get24hrAvg(h.sulphur_dioxide, ci);

  // AQI computation (both standards)
  const indiaAQI = computeCPCB(pm25a);
  const usAQI    = computeEPA(pm25a);

  // WHO exceedance ratios (null-safe)
  const ratioOrNull = (value, reference) =>
    value === null || value === undefined || !Number.isFinite(Number(value))
      ? null : safeDiv(Number(value), reference);
  const whoEx = {
    pm2_5: ratioOrNull(pm25a, WHO.pm2_5),
    pm10:  ratioOrNull(pm10a, WHO.pm10),
    no2:   ratioOrNull(no2a, WHO.nitrogen_dioxide),
    co:    ratioOrNull(coa, WHO.carbon_monoxide),
    o3:    ratioOrNull(o3a, WHO.ozone),
    so2:   ratioOrNull(so2a, WHO.sulphur_dioxide)
  };

  // Historical model values only, ending at the current API timestep.
  const historicalEnd = Math.min(ci + 1, h.pm2_5.length);
  const pmHistory = h.pm2_5.slice(0, historicalEnd)
    .map((value, index) => ({ value, index }))
    .filter(point => Number.isFinite(point.value));
  const pp = pmHistory.map(point => point.value);

  // Calculate rolling 24-hour PM2.5 means, then report the share of evaluated
  // rolling windows above guideline reference concentrations. This is not a
  // formal WHO exceedance-day statistic.
  const rolling24 = [];
  for (let i = 23; i < historicalEnd; i++) {
    const value = get24hrAvg(h.pm2_5, i);
    if (value !== null && Number.isFinite(value)) rolling24.push(value);
  }

  const stats = {
    mean:    avg(pp),
    median:  median(pp),
    stddev:  stdDev(pp),
    min:     pp.length ? Math.min(...pp) : 0,
    max:     pp.length ? Math.max(...pp) : 0,
    pctWHO:  rolling24.length ? rolling24.filter(v => v > WHO.pm2_5).length / rolling24.length * 100 : 0,
    pctCPCB: rolling24.length ? rolling24.filter(v => v > 30).length / rolling24.length * 100 : 0,
    evaluated24hWindows: rolling24.length,
    catDist: catDist(pp)
  };

  // Linear regression preserves each sample's original time index when values are missing.
  const reg = pmHistory.length > 10
    ? linearRegression(pmHistory.map(point => point.index), pp)
    : { slope: 0, intercept: 0, r2: 0 };

  // Hourly pattern (average PM2.5 at each hour-of-day across 7 days)
  const hp = Array(24).fill(0).map((_, hr) => {
    const v = h.pm2_5.slice(0, 168).filter((_, i) => i % 24 === hr && h.pm2_5[i] !== null);
    return v.length ? avg(v) : 0;
  });

  // Correlation: PM2.5 vs Temperature (using raw unfiltered arrays for proper alignment)
  const t7 = wx.hourly.temperature_2m.slice(0, 168);
  const pm7raw = h.pm2_5.slice(0, 168);
  const pairs = pm7raw.map((pm, i) => ({ pm, t: t7[i] }))
    .filter(p => p.pm !== null && p.t !== null);
  const corr = pairs.length > 10
    ? pearsonR(pairs.map(p => p.pm), pairs.map(p => p.t))
    : 0;

  // Heatmap grid: 7 days × 24 hours
  const hg = Array(7).fill(null).map((_, d) =>
    Array(24).fill(null).map((_, hr) => h.pm2_5[d * 24 + hr])
  );

  // Source fingerprint
  const fp = classifySource({
    // Preserve missing data as null; do not turn unavailable pollutant values into zero.
    no2: no2a ?? null, co: coa ?? null, pm25: pm25a ?? null,
    pm10: pm10a ?? null, so2: so2a ?? null, o3: o3a ?? null
  });

  // Wind dispersion assessment
  const ws = wx.current.wind_speed_10m;
  const wd = ws > 20 ? 'higher wind' : ws > 12 ? 'moderate wind' : ws > 6 ? 'lower wind' : 'very low wind';

  // Null percentage (data quality)
  const np = (h.pm2_5.slice(0, 168).filter(v => v === null).length / 168) * 100;

  return {
    cityName, lat, lon,
    fetchTimestamp: new Date().toISOString(),
    dataSource: 'CAMS model output via Open-Meteo (global domain; hourly API values may be interpolated from coarser model timesteps)',
    sparseWarning: np > 30, nullPct: np,
    indiaAQI, usAQI, whoExceedances: whoEx,
    pollutants: { pm25: pm25a, pm10: pm10a, no2: no2a, co: coa, o3: o3a, so2: so2a },
    stats, regression: reg, hourlyPattern: hp,
    correlation: corr, heatmapGrid: hg, fingerprint: fp,
    windSpeed: ws, windDispersion: wd,
    windDirection: wx.current.wind_direction_10m,
    temperature: wx.current.temperature_2m,
    humidity: wx.current.relative_humidity_2m,
    feelsLike: wx.current.apparent_temperature,
    weatherCode: wx.current.weather_code,
    rawHourly: {
      pm2_5: h.pm2_5, pm10: h.pm10,
      no2: h.nitrogen_dioxide, co: h.carbon_monoxide,
      o3: h.ozone, so2: h.sulphur_dioxide,
      time: h.time, temp: wx.hourly.temperature_2m
    },
    currentIdx: ci
  };
}
