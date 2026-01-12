
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

  /* ===== DATA (Google Sheet gviz) ===== */
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1jt9Bu6CIN9Q1x4brjyWfafIWOVbYrTEp0ihNAnIW-Es/gviz/tq?tqx=out:json';
  const CACHE_KEY = 'lunara_products_collections_v16';
  const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 ore
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
        // r.c[5] libero
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

  async function runInBatches(items, batchSize, worker){
    for (let i=0; i<items.length; i+=batchSize){
      const slice = items.slice(i, i + batchSize);
      await Promise.all(slice.map(worker));
    }
  }

  const slug = (s) => (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

  /* ===== DOM ===== */
  const skeleton = document.getElementById('grid-skeleton');
  const sectionsWrap = document.getElementById('catalogo-sections');
  const navWrap = document.getElementById('collection-nav');
  const searchInput = document.getElementById('search');
  const sortSelect = document.getElementById('sort');

  /* ===== CARD ===== */
  function goToDetail(product){
    const id = encodeURIComponent(product.id || '');
    if (!id) return;
    window.location.href = `product.html?id=${id}`;
  }

  function createCard(product) {
    const article = document.createElement('article');
    article.className = 'card';

    const badgeText =
      isSheetTrue(product.is_new) ? 'Novità' :
      isSheetTrue(product.is_low_stock) ? 'Ultimi pezzi' :
      null;
    if (badgeText) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = badgeText;
      article.appendChild(badge);
    }

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = product.images?.[0] || 'assets/images/placeholder.jpeg';
    img.alt = product.title || 'Candela';
    img.addEventListener('click', () => goToDetail(product));
    article.appendChild(img);

    const h3 = document.createElement('h3');
    h3.textContent = product.title || 'Prodotto';
    article.appendChild(h3);

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = fmtPrice(product.price);
    article.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const det = document.createElement('button'); det.className = 'btn ghost'; det.textContent = 'Dettagli'; det.addEventListener('click', () => goToDetail(product));
    const buy = document.createElement('button'); buy.className = 'btn primary'; buy.textContent = 'Acquista'; buy.addEventListener('click', () => goToDetail(product));
    actions.appendChild(det); actions.appendChild(buy);
    article.appendChild(actions);

    // JSON-LD
    try {
      const ld = document.createElement('script'); ld.type = 'application/ld+json';
      ld.text = JSON.stringify({
        "@context":"https://schema.org","@type":"Product","name": product.title,
        "image": product.images?.[0] || 'assets/images/placeholder.jpeg',
        "description": product.description || '',
        "sku": product.id || '',
        "brand": {"@type":"Brand","name":"Lunara"},
        "offers": {"@type":"Offer","priceCurrency":"EUR","price": product.price != null ? String(product.price) : "",
          "availability": isSheetTrue(product.is_low_stock) ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock"}
      });
      article.appendChild(ld);
    } catch {}

    return article;
  }

  /* ===== SEZIONI ORIZZONTALI ===== */
  function createCollectionSection(title, id, list) {
    const sec = document.createElement('section');
    sec.className = 'collection-section';
    sec.id = id;

    const head = document.createElement('div');
    head.className = 'collection-header';
    const h3 = document.createElement('h3'); h3.className = 'collection-title'; h3.textContent = title;
    const cnt = document.createElement('div'); cnt.className = 'collection-count'; cnt.textContent = `${list.length} prodotti`;
    head.appendChild(h3); head.appendChild(cnt);
    sec.appendChild(head);

    const track = document.createElement('div'); track.className = 'collection-track';
    const frag = document.createDocumentFragment();
    list.forEach(p => frag.appendChild(createCard(p)));
    track.appendChild(frag);
    sec.appendChild(track);

    return sec;
  }

  function renderCollectionNav(names) {
    navWrap.innerHTML = '';
    names.filter(n => (n || '').trim().length).forEach(name => {
      const a = document.createElement('a');
      a.className = 'chip-ancora';
      a.href = `#col-${slug(name)}`;
      a.textContent = name;
      navWrap.appendChild(a);
    });
  }

  function prioritySort(names) {
    const prio = ['san valentino','bomboniere','natale'];
    return [...names].sort((a,b) => {
      const ai = prio.indexOf(a.toLowerCase()); const bi = prio.indexOf(b.toLowerCase());
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b, 'it', { sensitivity: 'base' });
    });
  }

  function renderCollections(list) {
    sectionsWrap.innerHTML = '';

    const map = new Map();
    list.forEach(p => {
      const keyRaw = (p.collection || '').trim();
      const key = keyRaw.length ? keyRaw : 'Altro';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });

    const names = prioritySort([...map.keys()]);
    renderCollectionNav(names);

    names.forEach(name => {
      const items = map.get(name) || [];
      if (!items.length) return;
      sectionsWrap.appendChild(createCollectionSection(name, `col-${slug(name)}`, items));
    });

    sectionsWrap.setAttribute('aria-busy','false');
    document.getElementById('grid-skeleton')?.setAttribute('hidden','true');
    document.getElementById('grid-skeleton')?.style.setProperty('display','none','important');

    if (debug) console.log('[CATALOGO]', { sezioni: names, totaleProdotti: list.length });
  }

  /* ===== CARICAMENTO ===== */
  let allProducts = await fetchProducts();
  if (debug) console.log('[SHEET]', { prodotti: allProducts?.length, sample: allProducts?.[0] });

  if (!allProducts || !allProducts.length) {
    document.getElementById('grid-skeleton')?.setAttribute('hidden','true');
    sectionsWrap.innerHTML = '<div class="empty-state">Nessun prodotto disponibile al momento.</div>';
    return;
  }

  await runInBatches(allProducts, 8, async (p) => {
    const candidates = getImageCandidates(p, 6);
    const found = await pickExistingImagesUnique(candidates, 6);
    p.images = found.length ? found : ['assets/images/placeholder.jpeg'];
    if (debug) console.log('[FOTO]', p.title, { candidates: candidates.slice(0,24), found: p.images });
  });

  // HERO
  buildHeroCarousel(allProducts);
  renderCollections(allProducts);

  /* ===== FILTRI ===== */
  function applyFilters() {
    const q = (searchInput.value || '').toLowerCase();
    let list = [...allProducts];

    if (q) {
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.measures || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.collection || '').toLowerCase().includes(q)
      );
    }
    switch (sortSelect.value) {
      case 'price-asc':  list.sort((a,b) => Number(a.price||0) - Number(b.price||0)); break;
      case 'price-desc': list.sort((a,b) => Number(b.price||0) - Number(a.price||0)); break;
      case 'new-first':  list.sort((a,b) => (isSheetTrue(b.is_new) - isSheetTrue(a.is_new))); break;
      default: break;
    }
    renderCollections(list);
  }
  searchInput?.addEventListener('input', applyFilters);
  sortSelect?.addEventListener('change', applyFilters);

  /* ===== HERO CAROUSEL ===== */
  function shuffle(arr){ return arr.map(a => [Math.random(), a]).sort((x,y)=>x[0]-y[0]).map(p=>p[1]); }

  function buildHeroCarousel(products){
    const slidesWrap = document.getElementById('hero-slides');
    const dotsWrap = document.getElementById('hero-dots');
    const carousel = document.getElementById('hero-carousel');
    if (!slidesWrap || !dotsWrap || !carousel) return;

    let imgs = products.map(p => p.images?.[0]).filter(src => src && !src.includes('placeholder'));
    imgs = Array.from(new Set(imgs));
    imgs = shuffle(imgs).slice(0, 8);
    if (!imgs.length) imgs = ['assets/images/placeholder.jpeg'];

    slidesWrap.innerHTML = '';
    dotsWrap.innerHTML = '';
    imgs.forEach((src,i) => {
      const slide = document.createElement('div');
      slide.className = 'slide' + (i===0 ? ' active' : '');
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Prodotto Lunara';
      slide.appendChild(img);
      slidesWrap.appendChild(slide);

      const dot = document.createElement('span');
      dot.className = 'dot' + (i===0 ? ' active' : '');
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });

    let idx = 0;
    let timer = null;
    const DURATION = 4000;

    function goTo(i){
      const slides = slidesWrap.querySelectorAll('.slide');
      const dots = dotsWrap.querySelectorAll('.dot');
      slides[idx].classList.remove('active');
      dots[idx].classList.remove('active');
      idx = (i + slides.length) % slides.length;
      slides[idx].classList.add('active');
      dots[idx].classList.add('active');
    }
    function next(){ goTo(idx + 1); }
    function start(){ stop(); timer = setInterval(next, DURATION); }
    function stop(){ if (timer) clearInterval(timer); timer = null; }

    start();
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('focusout', start);

    carousel.setAttribute('tabindex','0');
    carousel.addEventListener('keydown', (e)=> {
      if (e.key === 'ArrowLeft') { stop(); goTo(idx - 1); }
      if (e.key === 'ArrowRight'){ stop(); goTo(idx + 1); }
    });
  }
});
