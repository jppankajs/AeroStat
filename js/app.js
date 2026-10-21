/**
 * AeroStat — Application Entry Point
 * Dashboard orchestration and initialization
 */

// ═══ RENDER DASHBOARD ═══

function renderDashboard(d) {
  currentData = d;
  document.getElementById('dashboard').style.display = 'block';
  const ts = document.getElementById('fetchTs'); if (ts) ts.textContent = new Date(d.fetchTimestamp).toLocaleTimeString();

  if (d.sparseWarning) {
    document.getElementById('sparseBanner').style.display = 'block';
    document.getElementById('sparseBanner').textContent =
      `⚠ Sparse sensor coverage (${d.nullPct.toFixed(0)}% null). Data from Copernicus CAMS model interpolation only.`;
  } else {
    document.getElementById('sparseBanner').style.display = 'none';
  }

  // Render all dashboard modules
  renderGauge(d);
  renderStdCards(d);
  renderPollCards(d);
  renderStats(d);
  renderPivotChart(d);
  renderFingerprint(d);
  renderRadar(d);
  renderHeatmap(d);
  renderDonut(d);
  renderHistogram(d);
  renderScatter(d);
  renderHealth(d);
  renderWeather(d);
  updateTicker(d);
  applyAura(d);
}


// ═══ LIVING SKY: page glows in the colour of the air ═══
const VERDICTS = {
  'Good': '',
  'Satisfactory': 'The modelled PM2.5 indicator is in the satisfactory band; sensitive people should check local advisories.',
  'Moderate': 'The modelled PM2.5 indicator is moderate. Sensitive people may consider reducing prolonged outdoor exertion.',
  'Poor': 'The modelled PM2.5 indicator is elevated. Consider reducing prolonged outdoor exertion and checking official advisories.',
  'Very Poor': 'The modelled PM2.5 indicator is very elevated. Reduce exposure and consult official local air-quality guidance.',
  'Severe': 'The modelled PM2.5 indicator is in the highest band. Follow official local public-health guidance.'
};

function applyAura(d) {
  const c = d.indiaAQI.color;
  document.documentElement.style.setProperty('--aura', c);
  document.getElementById('heroCity').textContent = d.cityName;
  const verdictEl = document.getElementById('verdict');
  const verdictText = VERDICTS[d.indiaAQI.category] || '';
  if (verdictEl) {
    verdictEl.textContent = verdictText;
    verdictEl.hidden = !verdictText;
  }
  const c1 = document.getElementById('cmp1');
  if (c1 && !c1.value) c1.value = d.cityName;
}

// Highlight the nav pill of the section being viewed
const navPills = document.querySelectorAll('.nav-pill');
const spy = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) navPills.forEach(p => p.classList.toggle('active', p.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-35% 0px -60% 0px' });
document.querySelectorAll('main section').forEach(sec => spy.observe(sec));

// ═══ INITIALIZATION ═══

// Boot ticker with static data
updateTicker(null);

// Render global climate indicators
renderGlobalIndicators();

// Auto-load Bengaluru on start
(async () => {
  try {
    showLoading();
    setLoadStep(1);
    searchInput.value = 'Bengaluru';
    setLoadStep(2);
    const d = await fetchCityData(12.97, 77.59, 'Bengaluru');
    setLoadStep(3);
    renderDashboard(d);
    setLoadStep(4);
    setTimeout(hideLoading, 500);
  } catch (e) {
    hideLoading();
    showError('API_FAIL');
    console.error('Initial Bengaluru data load failed:', e);
  }
})();
