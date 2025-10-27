/* =========================================================
   London 2025 – script.js (Banner + Daten + UI)
   ========================================================= */

/* Utils */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* 1) Tagesabhängiger Banner */
(function bannerByTime(){
  const TZ = 'Europe/Berlin';
  const HERO = $('#trip-info');
  if (!HERO) return;

  const HERO_IMAGES = {
    morning: 'img/london-morning.jpg',  // 05–09:59
    day:     'img/london-day.jpg',      // 10–16:59
    evening: 'img/london-evening.jpg',  // 17–20:59
    night:   'img/london-night.jpg'     // 21–04:59
  };

  function getHourInTZ(timeZone){
    const fmt = new Intl.DateTimeFormat('de-DE', { timeZone, hourCycle: 'h23', hour: '2-digit' });
    const parts = fmt.formatToParts(new Date());
    return parseInt(parts.find(p => p.type === 'hour').value, 10);
  }
  function getDaypart(h){
    if (h >= 5 && h < 10) return 'morning';
    if (h >= 10 && h < 17) return 'day';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  }
  function preload(src){
    return new Promise(res => { const i = new Image(); i.onload = () => res(src); i.onerror = () => res(null); i.src = src; });
  }

  async function applyHero(){
    const hour = (typeof window.__forceTestHour === 'number') ? window.__forceTestHour : getHourInTZ(TZ);
    const part = getDaypart(hour);
    HERO.setAttribute('data-daypart', part);
    const loaded = await preload(HERO_IMAGES[part]);
    const finalSrc = loaded || HERO_IMAGES.day;
    HERO.style.setProperty('--hero-image', `url("${finalSrc}")`);
  }

  document.addEventListener('DOMContentLoaded', applyHero, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyHero(); });
  setInterval(applyHero, 60 * 60 * 1000);
})();

/* 2) Daten laden */
const AppState = { data: { days: [], ideas: [] }, activeDayIndex: 0, map: null, mapLayer: null };

async function loadData() {
  // robust relativ zum Dokument (funktioniert im GitHub Pages Unterordner)
  const url = new URL('london2025_data.json', document.baseURI);
  url.searchParams.set('v', '2'); // Cachebust

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} für ${url.pathname}`);
    const json = await res.json();

    // Akzeptiere "days/ideas" oder "tage/ideen"
    const days  = Array.isArray(json.days)  ? json.days  : (Array.isArray(json.tage)  ? json.tage  : []);
    const ideas = Array.isArray(json.ideas) ? json.ideas : (Array.isArray(json.ideen) ? json.ideen : []);

    AppState.data.days  = days;
    AppState.data.ideas = ideas;

    console.log('JSON geladen:', url.pathname, { days: days.length, ideas: ideas.length });
  } catch (e) {
    console.error('Daten-Fehler:', e);
    AppState.data = { days: [], ideas: [] };
  }
}

/* 3) Render: Days & Ideas */
function renderDays() {
  const grid = $('#day-grid'); if (!grid) return;
  grid.innerHTML = '';

  if (!AppState.data.days.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.textContent = 'Keine Tage geladen. Prüfe london2025_data.json';
    grid.appendChild(empty);
    return;
  }

  AppState.data.days.forEach((day, idx) => {
    const card = document.createElement('button');
    card.className = 'card'; card.setAttribute('role','listitem'); card.style.textAlign = 'left';
    card.innerHTML = `<strong>Tag ${idx + 1}</strong><br/><span style="opacity:.8">${day.title || '—'}</span>`;
    card.addEventListener('click', () => window.showDay(idx));
    grid.appendChild(card);
  });
}

function renderIdeas() {
  const wrap = $('#ideas'); if (!wrap) return;
  wrap.innerHTML = '';

  if (!AppState.data.ideas.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.textContent = 'Keine Ideen geladen. Prüfe london2025_data.json';
    wrap.appendChild(empty);
    return;
  }

  AppState.data.ideas.forEach(group => {
    const card = document.createElement('div');
    card.className = 'card';
    const options = (group.options || []).map(opt => {
      const parts = [opt.name].filter(Boolean);
      if (opt.note) parts.push(`<span style="opacity:.75">(${opt.note})</span>`);
      return `<li>${parts.join(' ')}</li>`;
    }).join('');
    card.innerHTML = `
      <h3 style="margin:0 0 6px">${group.group || 'Ideen'}</h3>
      ${group.hint ? `<p style="margin:0 0 6px;opacity:.8">${group.hint}</p>` : ''}
      <ul style="margin:0;padding-left:18px">${options}</ul>
    `;
    wrap.appendChild(card);
  });
}

/* 4) Bottom Sheet */
(function sheetControls(){
  const sheet = $('#sheet'); if (!sheet) return;
  const closeBtn = $('#closeSheet'), prevBtn  = $('#prevDayTop'), nextBtn  = $('#nextDayTop');
  const titleEl  = $('#sheetTitle'), timeline = $('#timeline');

  function openSheet(){ sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden', 'false'); }
  function closeSheet(){ sheet.classList.add('hidden'); sheet.setAttribute('aria-hidden', 'true'); }

  window.showDay = function showDay(idx = 0){
    AppState.activeDayIndex = Math.max(0, Math.min(idx, AppState.data.days.length - 1));
    const day = AppState.data.days[AppState.activeDayIndex] || {};
    titleEl && (titleEl.textContent = `Tag ${AppState.activeDayIndex + 1}${day.title ? ' – ' + day.title : ''}`);

    if (timeline){
      timeline.innerHTML = '';
      (day.items || []).forEach(it => {
        const el = document.createElement('div');
        el.className = 'item';
        const t = it.time ? `<strong>${it.time}</strong> · ` : '';
        const name = it.title || '—';
        const note = it.note ? ` <span style="opacity:.75">(${it.note})</span>` : '';
        el.innerHTML = `${t}${name}${note}`;
        timeline.appendChild(el);
      });
    }

    prepareMapMarkersFromDay(day);
    openSheet();
  };

  closeBtn && closeBtn.addEventListener('click', closeSheet);
  prevBtn  && prevBtn.addEventListener('click', () => window.showDay(Math.max(0, AppState.activeDayIndex - 1)));
  nextBtn  && nextBtn.addEventListener('click', () => window.showDay(AppState.activeDayIndex + 1));
})();

/* 5) Karte (Leaflet) + Globaler Button */
(function mapModal(){
  const modal = $('#mapModal'), mapDiv = $('#map');
  const openBtn = $('#openMap'), closeBtn= $('#closeMap'), dblHint = $('#mapHint');
  const openGlobal = $('#openMapGlobal');
  if (!modal || !mapDiv) return;

  function ensureMap(){
    if (AppState.map) return AppState.map;
    AppState.map = L.map(mapDiv).setView([51.5074, -0.1278], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(AppState.map);
    AppState.mapLayer = L.layerGroup().addTo(AppState.map);
    return AppState.map;
  }

  function openModal(){
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
    ensureMap(); setTimeout(() => { AppState.map && AppState.map.invalidateSize(); }, 0);
  }
  function closeModal(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); }

  openBtn   && openBtn.addEventListener('click', openModal);
  closeBtn  && closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('dblclick', (e)=>{ if (e.target === modal || e.target === dblHint) closeModal(); });

  openGlobal && openGlobal.addEventListener('click', ()=>{
    if (typeof window.showDay === 'function') window.showDay(0);
    openModal();
  });
})();

/* Marker aus aktivem Tag */
function prepareMapMarkersFromDay(day){
  if (!day || !Array.isArray(day.items) || !window.L || !AppState.map) return;
  if (AppState.mapLayer){ AppState.mapLayer.clearLayers(); }
  const pts = day.items.filter(i => typeof i.lat === 'number' && typeof i.lng === 'number');
  pts.forEach(p => { L.marker([p.lat, p.lng]).addTo(AppState.mapLayer).bindPopup(p.title || 'Ort'); });
  if (pts.length){ const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng])); AppState.map.fitBounds(bounds.pad(0.25)); }
}

/* 6) Standort (optional) */
(function geolocation(){
  const btn = $('#enableLocation');
  if (!btn || !('geolocation' in navigator)) return;
  btn.addEventListener('click', ()=>{
    navigator.geolocation.getCurrentPosition(
      pos => { console.info('Standort:', pos.coords); },
      err => { console.warn('Standort abgelehnt/Fehler:', err && err.message); alert('Standort konnte nicht ermittelt werden.'); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
})();

/* 7) Boot */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderDays();
  renderIdeas();
});
