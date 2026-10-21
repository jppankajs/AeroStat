/**
 * AeroStat — UI Interactions
 * Search, compare, ticker, modal, global indicators
 */

// ═══ LOCATION SEARCH & GEOCODING ═══
const searchInput = document.getElementById('searchInput');
const sugBox = document.getElementById('suggestions');
let latestSearchToken = 0;

function placeLabel(place) {
  if (!place) return 'Selected location';
  const a = place.address || {};
  if (place.name && !place.address) {
    return [place.name, place.admin1]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(', ');
  }
  const locality = a.city || a.town || a.village || a.municipality ||
    a.county || a.state_district || a.state || place.name ||
    String(place.display_name || '').split(',')[0].trim() || 'Selected location';
  return a.state && a.state !== locality ? `${locality}, ${a.state}` : locality;
}

function escapeHTML(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function hideSearchSuggestions() {
  sugBox.style.display = 'none';
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  hideSearchSuggestions();
  const query = searchInput.value.trim();
  if (query.length < 2) return;

  debounceTimer = setTimeout(async () => {
    const token = ++latestSearchToken;
    try {
      const results = await geocodeSuggestions(query);
      if (token !== latestSearchToken || searchInput.value.trim() !== query) return;
      if (!results.length) {
        // Administrative areas may not appear in a populated-place geocoder.
        // Keep Enter available for the explicit administrative-area search.
        sugBox.innerHTML = '<div class="sug-item" role="status">No city suggestions. Press Enter to search this city, district or state name.</div>';
        sugBox.style.display = 'block';
        return;
      }
      window._sugResults = results;
      window._sugQuery = query;
      sugBox.innerHTML = results.map((place, i) => {
        const label = placeLabel(place);
        return `<button type="button" class="sug-item" role="option" onclick="selectCity(${i})">` +
          `<strong>${escapeHTML(label)}</strong><br><small>${escapeHTML(place.display_name || label)}</small></button>`;
      }).join('');
      sugBox.style.display = 'block';
    } catch (error) {
      if (token === latestSearchToken) showError('GEO_FAIL');
    }
  }, 450);
});

// Enter selects the top result or geocodes the typed query if suggestions are not ready.
searchInput.addEventListener('keydown', async event => {
  if (event.key === 'Escape') {
    hideSearchSuggestions();
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  clearTimeout(debounceTimer);
  const query = searchInput.value.trim();
  if (query.length < 2) return;

  const token = ++latestSearchToken;
  showLoading();
  setLoadStep(1);
  try {
    const results = await geocode(query);
    if (token !== latestSearchToken) return;
    if (!results.length) {
      hideLoading();
      showError('CITY_NOT_FOUND', query);
      return;
    }
    window._sugResults = results;
    window._sugQuery = query;
    await loadSelectedPlace(results[0]);
  } catch (error) {
    hideLoading();
    showError(error.message === 'GEO_FAIL' ? 'GEO_FAIL' : 'API_FAIL');
    console.error('Location search failed:', error);
  }
});

async function loadSelectedPlace(place) {
  const lat = Number(place.lat ?? place.latitude);
  const lon = Number(place.lon ?? place.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    hideLoading();
    showError('GEO_FAIL');
    return;
  }
  const name = placeLabel(place);
  hideSearchSuggestions();
  showLoading();
  setLoadStep(1);
  try {
    setLoadStep(2);
    const data = await fetchCityData(lat, lon, name);
    setLoadStep(3);
    renderDashboard(data);
    setLoadStep(4);
    searchInput.value = name;
    hideError();
    setTimeout(hideLoading, 500);
  } catch (error) {
    hideLoading();
    showError('API_FAIL');
    console.error('Environmental data request failed:', error);
  }
}

async function selectCity(index) {
  const place = window._sugResults && window._sugResults[index];
  if (!place) return;
  await loadSelectedPlace(place);
}

// GPS is used only when the user explicitly clicks "Locate me".
function useGeo() {
  if (!navigator.geolocation) {
    showError('GEO_DENIED');
    return;
  }
  navigator.geolocation.getCurrentPosition(async position => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    showLoading();
    setLoadStep(1);
    try {
      const place = await reverseGeocode(lat, lon);
      const name = placeLabel(place);
      setLoadStep(2);
      const data = await fetchCityData(lat, lon, name === 'Selected location' ? 'My Location' : name);
        setLoadStep(3);
      renderDashboard(data);
      setLoadStep(4);
      searchInput.value = name;
      hideSearchSuggestions();
      hideError();
      setTimeout(hideLoading, 500);
    } catch (error) {
      hideLoading();
      showError(error.message === 'GEO_FAIL' ? 'GEO_FAIL' : 'API_FAIL');
      console.error('GPS location load failed:', error);
    }
  }, error => {
    showError('GEO_DENIED');
    console.warn('Location permission or GPS error:', error.message);
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
}

// ═══ LOADING / ERROR UI ═══

function showLoading() {
  document.getElementById('loadBar').style.display = 'block';
  document.querySelectorAll('.load-step').forEach(s => { s.className = 'load-step'; });
}

function hideLoading() {
  document.getElementById('loadBar').style.display = 'none';
}

function setLoadStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('ls' + i);
    el.className = i < n ? 'load-step done' : i === n ? 'load-step active' : 'load-step';
  }
}

function showError(code, q = '') {
  const el = document.getElementById('errorMsg');
  if (!el) return;
  const msgs = {
    CITY_NOT_FOUND: `No results found for "${String(q).replace(/[<>]/g, '')}" in India. Try a city, district or state name.`,
    API_FAIL: 'Environmental data could not be loaded. Check your internet connection and try again.',
    GEO_DENIED: 'Location access is unavailable. Search for a location manually.',
    GEO_FAIL: 'The location search service is temporarily unavailable. Please try again.'
  };
  el.textContent = msgs[code] || 'An unexpected error occurred.';
  el.style.display = 'block';
  clearTimeout(window._aerostatErrorTimer);
  window._aerostatErrorTimer = setTimeout(() => { el.style.display = 'none'; }, 8000);
}

function hideError() {
  const el = document.getElementById('errorMsg');
  if (el) { el.style.display = 'none'; el.textContent = ''; }
}

// ═══ TICKER ═══

function updateTicker(d) {
  const items = [
    `🌍 ATMOSPHERIC CO₂ AT MAUNA LOA: <span>421.08 ppm</span> · NOAA annual mean, 2023`,
    `🌡️ GLOBAL TEMP ANOMALY: <span>+1.28°C</span> · NASA GISS 2024`,
    `🌊 GLOBAL SEA LEVEL TREND: <span>+4.5 mm/yr</span> · NOAA reference, 2014–2024`,
    `❄️ ARCTIC SEA ICE: <span>4.28M km²</span> · NSIDC Sep 2024 minimum`,
    `🌳 INDIA FOREST COVER: <span>21.76%</span> · FSI 2023`,
    `☀️ GLOBAL SOLAR CAPACITY: <span>1.42 TW</span> · IRENA 2023`,
  ];
  if (d) {
    items.unshift(
      `📍 ${escapeHTML(d.cityName)} PM2.5: <span>${d.pollutants.pm25 != null ? d.pollutants.pm25.toFixed(1) : 'N/A'} μg/m³</span> · AQI ${d.indiaAQI.value}`,
      `📍 ${escapeHTML(d.cityName)} PM2.5: <span>×${d.whoExceedances.pm2_5 != null ? d.whoExceedances.pm2_5.toFixed(1) : 'N/A'} of WHO 24-h reference</span>`,
      `🌡️ ${escapeHTML(d.cityName)}: <span>${d.temperature}°C</span> · ${d.windSpeed} km/h wind`
    );
  }
  document.getElementById('tickerTrack').innerHTML =
    items.concat(items).map(t => `<span class="ticker-item">${t}</span>`).join('');
}

// ═══ COMPARE CITY AUTOCOMPLETE ═══
const compareSelections = new Map();
const compareSuggestionTokens = [0, 0, 0];

[1, 2, 3].forEach((slot) => {
  const input = document.getElementById(`cmp${slot}`);
  const box = document.getElementById(`cmpSug${slot}`);
  let timer;
  input.addEventListener('input', () => {
    compareSelections.delete(slot);
    clearTimeout(timer);
    const query = input.value.trim();
    box.classList.remove('open');
    box.innerHTML = '';
    if (query.length < 2) return;
    timer = setTimeout(async () => {
      const token = ++compareSuggestionTokens[slot - 1];
      try {
        const places = await geocodeSuggestions(query);
        if (token !== compareSuggestionTokens[slot - 1] || input.value.trim() !== query) return;
        if (!places.length) {
          box.innerHTML = '<div class="cmp-message">No suggestions. You can still enter the city and click Compare.</div>';
          box.classList.add('open');
          return;
        }
        box.innerHTML = places.map((place, index) =>
          `<button type="button" class="cmp-suggestion" data-index="${index}"><strong>${escapeHTML(place.name)}</strong><small>${escapeHTML(place.display_name || place.name)}</small></button>`
        ).join('');
        box.querySelectorAll('button[data-index]').forEach(button => {
          button.addEventListener('click', () => {
            const place = places[Number(button.dataset.index)];
            input.value = place.display_name || place.name;
            compareSelections.set(slot, { query: input.value, place });
            box.classList.remove('open');
            box.innerHTML = '';
          });
        });
        box.classList.add('open');
      } catch (err) {
        if (token === compareSuggestionTokens[slot - 1]) {
          box.innerHTML = '<div class="cmp-message">Suggestions unavailable. You can still click Compare to search this name.</div>';
          box.classList.add('open');
        }
      }
    }, 350);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') box.classList.remove('open');
    if (event.key === 'Enter' && box.classList.contains('open')) {
      const first = box.querySelector('button[data-index]');
      if (first) { event.preventDefault(); first.click(); }
      else box.classList.remove('open');
    }
  });
  document.addEventListener('click', event => {
    if (!box.contains(event.target) && event.target !== input) box.classList.remove('open');
  });
});

// ═══ COMPARE ENGINE ═══

function toggleCompare() {
  const s = document.getElementById('compareSection');
  s.style.display = s.style.display === 'none' ? 'block' : 'none';
}

function showCmpTab(n) {
  document.querySelectorAll('.tab-content').forEach((t, i) => {
    t.className = i === n ? 'tab-content active' : 'tab-content';
  });
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.className = i === n ? 'tab-btn active' : 'tab-btn';
  });
  // Chart.js can measure a canvas while its tab is hidden and render it too small.
  // Resize the newly visible comparison chart after the tab becomes active.
  requestAnimationFrame(() => {
    const chartByTab = [charts.cmpGauge, charts.cmpBar, charts.cmpTrend];
    const chart = chartByTab[n];
    if (chart) { chart.resize(); chart.update('none'); }
  });
}

async function runCompare() {
  const entries = [1, 2, 3].map(slot => ({
    slot,
    name: document.getElementById(`cmp${slot}`).value.trim()
  })).filter(entry => entry.name);
  if (entries.length < 2) { alert('Enter at least 2 Indian cities, districts or states.'); return; }
  try {
    const cities = [];
    for (const entry of entries) {
      const selected = compareSelections.get(entry.slot);
      let place;
      if (selected && selected.query === entry.name) {
        place = selected.place;
      } else {
        const results = await geocode(entry.name);
        if (!results || !results.length) {
          alert(`Could not find "${entry.name}". Try a more specific Indian city, district or state name.`);
          return;
        }
        place = results[0];
      }
      const lat = Number(place.latitude ?? place.lat);
      const lon = Number(place.longitude ?? place.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        alert(`The location result for "${entry.name}" did not include valid coordinates. Please choose another suggestion.`);
        return;
      }
      cities.push({ lat, lon, name: placeLabel(place) });
    }
    const unique = new Set(cities.map(c => `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`));
    if (unique.size !== cities.length) {
      alert('Two or more inputs resolve to the same location. Choose different cities to compare.');
      return;
    }
    const button = document.querySelector('.compare-slots .geo-btn');
    if (button) { button.disabled = true; button.textContent = 'Loading…'; }
    try {
      compData = await Promise.all(cities.map(c => fetchCityData(c.lat, c.lon, c.name)));
      renderCompare();
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Compare'; }
    }
  } catch (e) { console.error(e); alert('Comparison failed. Check your internet connection and try again.'); }
}

function renderCompare() {
  if (!compData.length) return;

  // Tab 0: Gauges
  if (charts.cmpGauge) charts.cmpGauge.destroy();
  const ctx0 = document.getElementById('cmpGaugeChart').getContext('2d');
  charts.cmpGauge = new Chart(ctx0, {
    type: 'bar',
    data: { labels: compData.map(d => d.cityName), datasets: [{ label: 'India AQI', data: compData.map(d => d.indiaAQI.value), backgroundColor: CITY_COLORS.slice(0, compData.length), borderRadius: 6 }] },
    options: { responsive: true, indexAxis: 'y', scales: { x: { max: 500, ticks: { color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.05)' } }, y: { ticks: { color: '#8ba8b8' } } }, plugins: { legend: { display: false } } }
  });
  const best = compData.reduce((a, b) => a.indiaAQI.value < b.indiaAQI.value ? a : b);
  const worst = compData.reduce((a, b) => a.indiaAQI.value > b.indiaAQI.value ? a : b);
  const oldBW = document.getElementById('cmpTab0').querySelector('.cmp-bw');
  if (oldBW) oldBW.remove();
  document.getElementById('cmpTab0').insertAdjacentHTML('afterbegin',
    `<div class="cmp-bw" style="font-size:.85rem;margin-bottom:.5rem">🏆 Best: <span style="color:var(--accent)">${escapeHTML(best.cityName)}</span> · ⚠ Worst: <span style="color:var(--danger)">${escapeHTML(worst.cityName)}</span></div>`);

  // Tab 1: Grouped bars
  if (charts.cmpBar) charts.cmpBar.destroy();
  const ctx1 = document.getElementById('cmpBarChart').getContext('2d');
  charts.cmpBar = new Chart(ctx1, {
    type: 'bar',
    data: { labels: ['PM2.5', 'PM10', 'NO₂', 'CO÷100', 'O₃', 'SO₂'], datasets: compData.map((d, i) => ({ label: d.cityName, data: [d.pollutants.pm25, d.pollutants.pm10, d.pollutants.no2, (d.pollutants.co || 0) / 100, d.pollutants.o3, d.pollutants.so2], backgroundColor: CITY_COLORS[i], borderRadius: 3 })) },
    options: { responsive: true, scales: { x: { ticks: { color: '#8ba8b8' }, grid: { display: false } }, y: { ticks: { color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.05)' } } }, plugins: { legend: { labels: { color: '#8ba8b8' } } } }
  });

  // Tab 2: Trend overlay
  if (charts.cmpTrend) charts.cmpTrend.destroy();
  const ctx2 = document.getElementById('cmpTrendChart').getContext('2d');
  const dashes = [[], [6, 4], [3, 3]];
  charts.cmpTrend = new Chart(ctx2, {
    type: 'line',
    data: { labels: compData[0].rawHourly.time.slice(0, 168).map(t => new Date(t).toLocaleDateString('en', { month: 'short', day: 'numeric' })), datasets: compData.map((d, i) => ({ label: d.cityName, data: d.rawHourly.pm2_5.slice(0, 168), borderColor: CITY_COLORS[i], borderDash: dashes[i], borderWidth: 2, pointRadius: 0, tension: .3, spanGaps: true })) },
    options: { responsive: true, scales: { x: { ticks: { maxTicksLimit: 7, color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.05)' } }, y: { ticks: { color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.05)' } } }, plugins: { legend: { labels: { color: '#8ba8b8' } } } }
  });

  // Tab 3: Ranking table
  const demoScore = d => {
    const e = d.whoExceedances;
    const ratios = [e.pm2_5, e.o3, e.no2, e.pm10];
    if (ratios.some(value => value == null || !Number.isFinite(Number(value)))) return null;
    return Math.max(0, Math.min(100, Math.round(
      100 - (e.pm2_5 * 40 + e.o3 * 20 + e.no2 * 20 + e.pm10 * 20)
    )));
  };
  document.getElementById('cmpTable').innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-size:.8rem"><thead><tr>` +
    ['Location', 'Indicative AQI', 'PM2.5', 'WHO reference ×', 'CPCB-style band', 'EPA-style band', 'Demo score'].map(h => `<th style="padding:.5rem;border:1px solid var(--border1);background:var(--bg-surface);color:var(--text2)">${h}</th>`).join('') +
    `</tr></thead><tbody>` +
    compData.map(d =>
      `<tr><td style="padding:.5rem;border:1px solid var(--border1)">${escapeHTML(d.cityName)}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1);color:${d.indiaAQI.color}">${d.indiaAQI.category === 'N/A' ? 'N/A' : d.indiaAQI.value}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1)">${d.pollutants.pm25 == null ? 'N/A' : d.pollutants.pm25.toFixed(1)}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1)">${d.whoExceedances.pm2_5 != null ? '×' + d.whoExceedances.pm2_5.toFixed(1) : 'N/A'}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1);color:${d.indiaAQI.color}">${d.indiaAQI.category}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1);color:${d.usAQI.color}">${d.usAQI.category}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1)">${demoScore(d) == null ? 'N/A' : demoScore(d) + '/100'}</td></tr>`
    ).join('') +
    `</tbody></table><div style="font-size:.65rem;color:var(--text3);margin-top:.5rem">Demo score uses arbitrary weighted WHO-reference ratios; it is not a validated or recognized environmental-health index.</div>`;
}

// ═══ GLOBAL CLIMATE INDICATORS ═══

function renderGlobalIndicators() {
  const cards = [
    { val: '421.08 ppm', title: 'Atmospheric CO₂ at Mauna Loa', label: 'NOAA GML · Mauna Loa · 2023 confirmed annual mean', badge: 'GLOBAL REFERENCE', bcls: 'badge-ref', sub: 'Historical annual mean measured at Mauna Loa, Hawaii; not a Bengaluru-specific CO₂ reading.', spark: [387.64, 390.10, 391.85, 394.06, 396.74, 398.87, 401.01, 404.41, 406.76, 408.72, 411.66, 414.24, 416.45, 418.56, 421.08] },
    { val: '+1.28°C', title: 'Temp Anomaly', label: 'NASA GISS GISTEMP v4 · 2024 · vs 1951-1980 baseline', badge: 'GLOBAL TREND', bcls: 'badge-ref', sub: 'Global annual anomaly relative to the 1951–1980 NASA GISTEMP baseline; not local weather.' },
    { val: '4.5 mm/yr', title: 'Sea Level Rise', label: 'NOAA Satellite Altimetry · 2014-2024 decadal avg', badge: 'GLOBAL TREND', bcls: 'badge-ref', sub: 'Historical global trend reference only; not a Bengaluru lake, reservoir or groundwater level.' },
    { val: '4.28 M km²', title: 'Arctic Sea Ice', label: 'NSIDC · September 2024 minimum extent', badge: 'ARCTIC REFERENCE', bcls: 'badge-ref', sub: 'Arctic September minimum extent; a polar indicator, not a local Indian condition.' },
    { val: '21.76%', title: 'India Forest Cover', label: 'FSI State of Forest Report 2023 · 715,343 km²', badge: 'NATIONAL STATISTIC', bcls: 'badge-ref', sub: 'Forest cover: 715,343 km² (21.76%); total forest + tree cover increased by 1,445 km² since 2021.' },
    { val: '1.42 TW', title: 'Global Solar', label: 'IRENA · 2023 confirmed installed capacity', badge: 'CAPACITY REFERENCE', bcls: 'badge-ref', sub: 'Historical global installed-capacity reference; not Bengaluru generation.' }
  ];

  document.getElementById('giGrid').innerHTML = cards.map((c, i) =>
    `<div class="card gi-card"><div class="card-title">${c.title}</div>` +
    `<div class="gi-val" style="color:var(--accent)">${c.val}</div>` +
    `<div class="gi-label">${c.label}</div>` +
    `<div class="gi-badge ${c.bcls}">${c.badge}</div>` +
    `<div style="font-size:.7rem;color:var(--text3);margin-top:.25rem">${c.sub}</div>` +
    (c.spark ? `<div class="gi-spark"><canvas id="giSpark${i}" width="350" height="30"></canvas></div>` : '') +
    `<div style="font-size:.6rem;color:var(--text3);margin-top:.25rem;font-style:italic">Historical reference · Not real-time</div></div>`
  ).join('');

  // CO₂ sparkline
  setTimeout(() => {
    const ctx = document.getElementById('giSpark0');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'line',
      data: { labels: cards[0].spark.map((_, i) => 2009 + i), datasets: [{ data: cards[0].spark, borderColor: '#5eead4', borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: 'rgba(94,234,212,.08)', tension: .3 }] },
      options: { responsive: false, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
  }, 100);
}

// ═══ METHODOLOGY MODAL ═══

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('methodModal').innerHTML = `<button class="modal-close" onclick="closeModal()">✕</button>
<h2>📋 Data Transparency & Methodology</h2>
<h3>A. Location and live model data</h3>
<p>Location suggestions use Open-Meteo Geocoding. Pressing Enter submits a place search to OpenStreetMap Nominatim to improve administrative-area matching; this request is rate-limited and cached. GPS reverse lookup runs only after you click “Locate me”. OpenStreetMap data attribution is required.</p>
<p>Air-quality data come from Open-Meteo's CAMS-based model output. For India, the global CAMS product has an approximately 45 km grid and underlying 3-hourly timesteps; the API may return hourly-interpolated values. These are model estimates, not direct measurements from a Bengaluru or other local monitoring station. Weather data are also model/API output.</p>
<h3>B. PM2.5-based indicative AQI</h3>
<p>The CPCB-style and US EPA-style numbers are educational estimates calculated from a rolling 24-hour PM2.5 mean only. They are not official CPCB or EPA AQI readings. Official AQI reporting may use pollutant-specific sub-indices, prescribed data completeness rules, and monitoring-station observations. The US EPA PM2.5 concentration is truncated to one decimal place and the resulting index is truncated to an integer.</p>
<h3>C. WHO 2021 guideline references</h3>
<table><thead><tr><th>Pollutant</th><th>Reference level</th><th>Averaging period</th></tr></thead><tbody>
<tr><td>PM2.5</td><td>15 μg/m³</td><td>24-hour mean (99th percentile guideline)</td></tr>
<tr><td>PM10</td><td>45 μg/m³</td><td>24-hour mean</td></tr>
<tr><td>NO₂</td><td>25 μg/m³</td><td>24-hour mean</td></tr>
<tr><td>O₃</td><td>100 μg/m³</td><td>Daily maximum 8-hour mean during the defined peak season</td></tr>
<tr><td>SO₂</td><td>40 μg/m³</td><td>24-hour mean</td></tr>
<tr><td>CO</td><td>4 mg/m³ (4,000 μg/m³)</td><td>24-hour mean</td></tr>
</tbody></table>
<p>Pollutant cards compare available rolling averages against reference levels for screening only. In particular, the current rolling 8-hour ozone value is not a formal WHO peak-season compliance calculation. Percentages in the statistics panel describe the share of evaluated rolling 24-hour PM2.5 windows above a reference, not official WHO exceedance days.</p>
<h3>D. Historical global and national indicators</h3>
<ul>
<li>CO₂: 421.08 ppm — NOAA Mauna Loa annual mean, 2023.</li>
<li>Global temperature anomaly: +1.28°C — NASA GISTEMP v4, 2024 vs 1951–1980 baseline.</li>
<li>Sea level: +4.5 mm/year — static NOAA-attributed reference for 2014–2024; not a local water level.</li>
<li>Arctic sea ice: 4.28 million km² — NSIDC September 2024 minimum extent.</li>
<li>India forest cover: 715,343 km² (21.76%); total forest and tree cover increased by about 1,445 km² since 2021 — FSI ISFR 2023.</li>
<li>Global solar capacity: 1.42 TW — IRENA 2023 historical reference.</li>
</ul>
<p>The CO₂ sparkline uses annual Mauna Loa means for 2009–2023. All climate ticker/card values are static historical references and are not refreshed live.</p>
<h3>E. Interpretation limits</h3>
<ul>
<li>A city/district/state search resolves to a representative coordinate; the app does not calculate an area-wide district or state average.</li>
<li>Source attribution is a heuristic pattern, not a validated source-apportionment model. Its label is not a measured finding.</li>
<li>Wind dispersion is a simple wind-speed proxy, not a full atmospheric dispersion model.</li>
<li>Health guidance is general and illustrative, not personalized medical advice.</li>
<li>Use official CPCB station data and authoritative sources for decisions that require regulatory accuracy.</li>
</ul>
<h3>F. Sources and attribution</h3>
<p>Open-Meteo air-quality and weather APIs; Open-Meteo Geocoding; OpenStreetMap contributors / Nominatim; US EPA AQI breakpoint guidance; WHO Global Air Quality Guidelines 2021; NOAA GML; NASA GISS; NSIDC; Forest Survey of India; IRENA.</p>`;
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}
