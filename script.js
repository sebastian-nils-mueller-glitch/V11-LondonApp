/* =========================================================
   London 2025 – script.js
   ========================================================= */

/* ---------------------------------
   1) Tagesabhängiger Banner (EU/Berlin)
   --------------------------------- */
(function bannerByTime(){
  const TZ = 'Europe/Berlin';
  const HERO = document.getElementById('trip-info');
  if (!HERO) return;

  // Pfade zu deinen vier Bildern (liegen unter /img/)
  const HERO_IMAGES = {
    morning: 'img/london-morning.jpg',  // 05–09:59
    day:     'img/london-day.jpg',      // 10–16:59
    evening: 'img/london-evening.jpg',  // 17–20:59
    night:   'img/london-night.jpg'     // 21–04:59
  };

  function getHourInTZ(timeZone){
    const fmt = new Intl.DateTimeFormat('de-DE', {
      timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit'
    });
    const parts = fmt.formatToParts(new Date());
    return parseInt(parts.find(p => p.type === 'hour').value, 10);
  }

  function getDaypart(hour){
    if (hour >= 5 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 17) return 'day';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  function preload(src){
    return new Promise((resolve)=>{ const img = new Image();
      img.onload = ()=>resolve(src);
      img.onerror = ()=>resolve(null);
      img.src = src;
    });
  }

  async function applyHero(){
    // Zum Testen kannst du kurz eine Stunde erzwingen:
    // window.__forceTestHour = 18; // danach wieder entfernen!
    const hour = (typeof window.__forceTestHour === 'number')
      ? window.__forceTestHour
      : getHourInTZ(TZ);

    const part = getDaypart(hour);
    const src = HERO_IMAGES[part];

    HERO.setAttribute('data-daypart', part);

    const loaded = await preload(src);
    const finalSrc = loaded || HERO_IMAGES.day; // Fallback
    HERO.style.setProperty('--hero-image', `url("${finalSrc}")`);
  }

  document.addEventListener('DOMContentLoaded', applyHero, { once: true });
  document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) applyHero(); });
  setInterval(applyHero, 60 * 60 * 1000); // stündlich aktualisieren
})();

/* ---------------------------------
   2) Bottom Sheet (Tagesansicht)
   --------------------------------- */
(function sheetControls(){
  const sheet = document.getElementById('sheet');
  if (!sheet) return;

  const closeBtn = document.getElementById('closeSheet');
  const prevBtn  = document.getElementById('prevDayTop');
  const nextBtn  = document.getElementById('nextDayTop');
  const titleEl  = document.getElementById('sheetTitle');
  const timeline = document.getElementById('timeline');

  let activeDayIndex = 0;

  function openSheet(){
    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden', 'false');
  }
  function closeSheet(){
    sheet.classList.add('hidden');
    sheet.setAttribute('aria-hidden', 'true');
  }

  // Öffentliche API, falls du extern triggern willst:
  window.showDay = function showDay(idx = 0){
    activeDayIndex = Math.max(0, idx|0);
    titleEl && (titleEl.textContent = `Tag ${activeDayIndex + 1}`);
    // Dummy-Inhalt (kannst du später mit echten Daten ersetzen)
    if (timeline){
      timeline.innerHTML = '';
      const make = (t)=>{ const el = document.createElement('div'); el.className='item'; el.textContent=t; return el; };
      timeline.append(
        make('09:00 Frühstück in Shoreditch'),
        make('11:00 Spaziergang an der Themse'),
        make('14:00 Museum / Gallery'),
        make('18:00 Dinner & Drinks')
      );
    }
    openSheet();
  };

  closeBtn && closeBtn.addEventListener('click', closeSheet);
  prevBtn  && prevBtn.addEventListener('click', ()=> window.showDay(Math.max(0, activeDayIndex - 1)));
  nextBtn  && nextBtn.addEventListener('click', ()=> window.showDay(activeDayIndex + 1));
})();

/* ---------------------------------
   3) Karten-Modal (Leaflet) + Globaler Button
   --------------------------------- */
(function mapModal(){
  const modal   = document.getElementById('mapModal');
  const mapDiv  = document.getElementById('map');
  const openBtn = document.getElementById('openMap');
  const closeBtn= document.getElementById('closeMap');
  const dblHint = document.getElementById('mapHint');
  const openGlobal = document.getElementById('openMapGlobal');

  if (!modal || !mapDiv) return;

  let mapInstance = null;

  function ensureLeafletMap(){
    if (mapInstance) return mapInstance;
    // Default: London Zentrum
    mapInstance = L.map(mapDiv).setView([51.5074, -0.1278], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(mapInstance);
    // Beispielmarker (kannst du ersetzen)
    L.marker([51.505, -0.09]).addTo(mapInstance).bindPopup('Hallo London 👋');
    return mapInstance;
  }

  function openModal(){
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    ensureLeafletMap();
    setTimeout(()=>{ mapInstance && mapInstance.invalidateSize(); }, 0);
  }
  function closeModal(){
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }

  openBtn   && openBtn.addEventListener('click', openModal);
  closeBtn  && closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('dblclick', (e)=>{ if (e.target === modal || e.target === dblHint) closeModal(); });

  // Globaler Button: öffnet zuerst die Tagesansicht, dann die Karte
  openGlobal && openGlobal.addEventListener('click', ()=>{
    if (typeof window.showDay === 'function') window.showDay(0); // Tag 1 als Fallback
    openModal();
  });
})();

/* ---------------------------------
   4) Standort-Freigabe (für spätere Zonen-/Routing-Features)
   --------------------------------- */
(function geolocation(){
  const btn = document.getElementById('enableLocation');
  if (!btn || !('geolocation' in navigator)) return;

  btn.addEventListener('click', ()=>{
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        const { latitude, longitude } = pos.coords;
        console.info('Standort:', latitude, longitude);
        // Hier könntest du: Karte zentrieren, Tarif-Zonen vorschlagen, etc.
        const mapEl = document.getElementById('map');
        if (mapEl && window.L){ 
          // Soft-Integr.: falls Karte offen ist → zentrieren
          const _map = mapEl._leaflet_id ? window.L.map(mapEl, { attributionControl:false }) : null;
        }
      },
      (err)=>{
        console.warn('Standort abgelehnt/Fehler:', err && err.message);
        alert('Standort konnte nicht ermittelt werden.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
})();
