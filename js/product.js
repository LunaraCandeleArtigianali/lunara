
document.addEventListener('DOMContentLoaded', async () => {
  /* ===== MENU MOBILE ===== */
  const hamburger = document.getElementById('hamburger');
  const mobileCollapse = document.getElementById('mobile-collapse');

  function openMobile(){
    document.body.classList.add('menu-open');
    mobileCollapse.classList.add('open');
    mobileCollapse.setAttribute('aria-hidden','false');
    hamburger.setAttribute('aria-expanded','true');
  }
  function closeMobile(){
    document.body.classList.remove('menu-open');
    mobileCollapse.classList.remove('open');
    mobileCollapse.setAttribute('aria-hidden','true');
    hamburger.setAttribute('aria-expanded','false');
  }
  hamburger?.addEventListener('click', (e) => {
    e.preventDefault();
    mobileCollapse.classList.contains('open') ? closeMobile() : openMobile();
  });
  mobileCollapse?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => closeMobile()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mobileCollapse.classList.contains('open')) closeMobile(); });

  /* ===== DATA ===== */
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1jt9Bu6CIN9Q1x4brjyWfafIWOVbYrTEp0ihNAnIW-Es/gviz/tq?tqx=out:json';
  const CACHE_KEY = 'lunara_products_collections_v16';
  const CACHE_TTL = 6 * 60 * 60 * 1000;
  const debug = window.location.search.includes('debug=1');

  const parseGViz = (text) => {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('Formato gViz inatteso');
      const json = JSON.parse(text.slice(start, end + 1));
      const rows = json.table?.rows || [];
      return rows.map(r => ({
        id: r.c[0]?.v ?? null,
        title: r.c[1]?.v ?? '',
        measures: r.c[2]?.v ?? '',
        description: r.c[3]?.v ?? '',
        price: r.c[4]?.v ?? null,
        is_new: r.c[6]?.v ?? false,
        is_low_stock: r.c[7]?.v ?? false,
        collection: r.c[8]?.v ?? '',
        image_folder: r.c[9]?.v ?? null
      }));
    } catch (e) {
      console.error('Errore parse gViz:', e);
      return null;
    }
  };

  const getCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return data;
    } catch { return null; }
  };
  const setCache = (data) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {} };

  async function fetchProducts() {
    const cached = getCache();
    try {
      const res = await fetch(SHEET_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseGViz(text);
      if (parsed) { setCache(parsed); return parsed; }
      console.warn('Parse gViz fallito, uso cache se presente.');
      return cached || [];
    } catch (e) {
      console.warn('Fetch prodotti fallito:', e);
      return cached || [];
    }
  }

  /* ===== UTIL ===== */
  const fmtPrice = (p) => (p!=null && p!=='') ? new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(p)) : 'NA';
  const sanitize = (s) => (s || '').toString().replace(/\.\.\//g,'').replace(/^\/+/,'').trim();

  function isSheetTrue(v){
    if (v === true) return true;
    if (typeof v === 'string') {
      const t = v.trim().toUpperCase();
      return t === 'TRUE' || t === 'VERO' || t === 'Y' || t === 'YES';
    }
    return false;
  }

  const EXT_LIST = ['jpeg','jpg','webp','png','JPEG','JPG','WEBP','PNG'];
  const getImageCandidates = (product, max = 6, exts = EXT_LIST) => {
    const folder = sanitize(product.image_folder || product.id || product.title);
    const out = [];
    for (let i=1; i<=max; i++){
      for (const ext of exts){
        out.push(`assets/images/${folder}/${i}.${ext}`);
      }
    }
    return out;
  };

  async function pickExistingImagesUnique(paths, maxByIndex = 6) {
    const found = []; const seen = new Set();
    for (const src of paths) {
      const m = src.match(/\/(\d+)\.[A-Za-z]+$/);
      const idx = m ? m[1] : null;
      if (!idx || seen.has(idx)) continue;
      const ok = await new Promise(res => {
        const im = new Image();
        im.onload = () => res(true);
        im.onerror = () => res(false);
        im.src = src + (debug ? `?t=${Date.now()}` : '');
      });
      if (ok) { seen.add(idx); found.push(src); }
      if (found.length >= maxByIndex) break;
    }
    return found;
  }

  const slug = (s) => (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

  /* ===== PARAM ID ===== */
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  const pdWrap = document.getElementById('pd-content');
  const recTrack = document.getElementById('rec-track');
  const recCount = document.getElementById('rec-count');

  if (!productId) {
    pdWrap.innerHTML = `<p>Prodotto non trovato. <a class="nav-link" href="index.html#catalogo">Torna al catalogo</a></p>`;
    recTrack.innerHTML = '';
    recCount.textContent = '';
    return;
  }

  /* ===== LOAD & RENDER ===== */
  let all = await fetchProducts();
  if (!all || !all.length) {
    pdWrap.innerHTML = `<p>Prodotti non disponibili al momento. <a class="nav-link" href="index.html#catalogo">Torna al catalogo</a></p>`;
    recTrack.innerHTML = '';
    recCount.textContent = '';
    return;
  }

  // Precarica immagini per TUTTI (per consigliati e gallery)
  await Promise.all(all.map(async p => {
    const candidates = getImageCandidates(p, 6);
    const found = await pickExistingImagesUnique(candidates, 6);
    p.images = found.length ? found : ['assets/images/placeholder.jpeg'];
  }));

  const product = all.find(p => String(p.id) === String(productId));
  if (!product) {
    pdWrap.innerHTML = `<p>Prodotto non trovato. <a class="nav-link" href="index.html#catalogo">Torna al catalogo</a></p>`;
    recTrack.innerHTML = '';
    recCount.textContent = '';
    return;
  }

  // ===== PAGE TITLE (opzionale: potresti aggiornare <title>)
  try { document.title = `${product.title} — Lunara`; } catch {}

  // ===== RENDER DETAIL
  function renderProduct(p){
    const isLow = isSheetTrue(p.is_low_stock);
    const badge = isSheetTrue(p.is_new) ? `<span class="low-stock-inline" style="background:#111;color:#fff">Novità</span>` :
                 isLow ? `<span class="low-stock-inline">⚠️ Ultimi pezzi disponibili</span>` : '';

    const images = p.images || [];
    const main = images[0] || 'assets/images/placeholder.jpeg';

    pdWrap.innerHTML = `
      <div class="product-detail">
        <div class="pd-gallery">
          <div class="pg-viewport" id="pg-viewport">
            ${images.map((src,i)=>`<img src="${src}" alt="${p.title} foto ${i+1}" class="${i===0?'active':''}">`).join('')}
          </div>
          <div class="pg-nav" id="pg-nav">
            ${images.map((_,i)=>`<span class="dot ${i===0?'active':''}" data-idx="${i}"></span>`).join('')}
          </div>
        </div>

        <div class="pd-info">
          ${badge}
          <h1>${p.title || ''}</h1>
          <p class="price-line">
            <span>${[p.measures, fmtPrice(p.price)].filter(Boolean).join(' • ')}</span>
            <span class="free-ship-note">🚚 Spedizione gratuita dai 25€</span>
          </p>
          <p class="muted">${p.description || ''}</p>
          <div class="pd-actions">
            <a class="btn primary" id="pd-buy-whatsapp">Acquista su WhatsApp</a>
            <a class="btn ghost" id="pd-instagram">Instagram</a>
          </div>
        </div>
      </div>
    `;

    // Gallery behavior
    const vp = document.getElementById('pg-viewport');
    const nav = document.getElementById('pg-nav');
    if (vp && nav) {
      const imgs = Array.from(vp.querySelectorAll('img'));
      const dots = Array.from(nav.querySelectorAll('.dot'));
      let current = 0;
      function go(i){
        current = (i + imgs.length) % imgs.length;
        imgs.forEach((im, idx)=>im.classList.toggle('active', idx===current));
        dots.forEach((d, idx)=>d.classList.toggle('active', idx===current));
      }
      dots.forEach(d => d.addEventListener('click', ()=> go(Number(d.dataset.idx||0))));
    }

    // Buy actions
    const buyW = document.getElementById('pd-buy-whatsapp');
    buyW?.addEventListener('click', () => {
      const txt = encodeURIComponent(`Ciao! Vorrei acquistare: ${p.title || ''}`);
      window.open(`https://wa.me/393483471201?text=${txt}`, '_blank');
    });
    const ig = document.getElementById('pd-instagram');
    ig?.addEventListener('click', () => window.open('https://www.instagram.com/c.a.lunara/', '_blank'));
  }

  renderProduct(product);

  // ===== RECOMMENDED (stessa collezione, escluso corrente; fallback random)
  function shuffle(arr){ return arr.map(a => [Math.random(), a]).sort((x,y)=>x[0]-y[0]).map(p=>p[1]); }
  let rec = all.filter(p => String(p.id)!==String(product.id) && (p.collection || '') === (product.collection || ''));
  if (!rec.length) rec = shuffle(all.filter(p => String(p.id)!==String(product.id))).slice(0,8);

  recTrack.innerHTML = '';
  recCount.textContent = `${rec.length} prodotti`;
  rec.forEach(p => {
    const card = document.createElement('article'); card.className = 'card';
    const img = document.createElement('img'); img.src = p.images?.[0] || 'assets/images/placeholder.jpeg'; img.alt = p.title || 'Prodotto';
    img.addEventListener('click', () => window.location.href = `product.html?id=${encodeURIComponent(p.id)}`);
    card.appendChild(img);

    // badge
    const badgeText = isSheetTrue(p.is_new) ? 'Novità' : isSheetTrue(p.is_low_stock) ? 'Ultimi pezzi' : null;
    if (badgeText) {
      const b = document.createElement('span'); b.className = 'badge'; b.textContent = badgeText;
      card.appendChild(b);
    }

    const h3 = document.createElement('h3'); h3.textContent = p.title || 'Prodotto'; card.appendChild(h3);
    const meta = document.createElement('p'); meta.className = 'meta'; meta.textContent = fmtPrice(p.price); card.appendChild(meta);

    const actions = document.createElement('div'); actions.className = 'card-actions';
    const det = document.createElement('button'); det.className = 'btn ghost'; det.textContent = 'Dettagli';
    det.addEventListener('click', () => window.location.href = `product.html?id=${encodeURIComponent(p.id)}`);
    const buy = document.createElement('button'); buy.className = 'btn primary'; buy.textContent = 'Acquista';
    buy.addEventListener('click', () => window.location.href = `product.html?id=${encodeURIComponent(p.id)}`);
    actions.appendChild(det); actions.appendChild(buy);
    card.appendChild(actions);

    recTrack.appendChild(card);
  });

});
