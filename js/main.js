(async () => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  /* ===== DATI =====
     Il catalogo vive in data/products.json (modificabile da telefono con /admin).
     Numero WhatsApp, social e opzioni del configuratore sono in js/config.js. */
  const CFG = window.LUNARA_CONFIG;
  const WHATSAPP = CFG.whatsapp, IG = CFG.instagram, TT = CFG.tiktok;
  const PLACEHOLDER = 'assets/images/placeholder.jpeg';
  let products = [];

  const isTrue = v => v === true || (typeof v === 'string' && ['TRUE', 'VERO', 'Y', 'YES'].includes(v.trim().toUpperCase()));
  const fmt = p => (p != null && p !== '') ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(p)) : 'NA';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  // il pannello può salvare percorsi con la barra iniziale ("/assets/..."): li rendo relativi alla cartella del sito
  const imgsOf = p => (p.images && p.images.length) ? p.images.map(s => String(s).replace(/^\/+/, '')) : [PLACEHOLDER];
  // collezioni, tipologie di bomboniera e colori vivono in data/options.json (modificabili da /admin)
  let OPTS = { collections: [], types: [], colors: [], fragrances: [] };
  const hexOf = n => { const k = String(n ?? '').trim().toLowerCase(); return ((OPTS.colors || []).find(c => String(c.name).trim().toLowerCase() === k) || {}).hex || null; };
  const colOf = p => (p.collection || '').trim() || 'Altro';
  const isBomb = c => String(c).toLowerCase() === 'bomboniere';
  // scelte extra di ogni candela (oltre a fragranza e colore)
  const EXTRAS = [
    { key: 'confetti', t: 'Confetti', list: ['Sì', 'No'] },
    { key: 'tag', t: 'Tag personalizzato', list: ['Sì', 'No'] },
    { key: 'pack', t: 'Confezione', list: ['Sacchetto', 'Scatola'] }
  ];
  const extrasOf = p => (p && !isTrue(p.no_extras)) ? EXTRAS : [];
  const CUSTOM_NOTE = '✨ Disponibile in diverse varianti – contattaci per personalizzazioni.';
  const OTHER = 'Altro (lo definiamo insieme)';
  const fragrancesOf = p => p?.fragrance_mode === 'all' ? (OPTS.fragrances || []).map(f => typeof f === 'string' ? f : f.name).filter(Boolean) : (p?.fragrances || []);
  const optsOf = (p, k) => [...((k === 'fragrances' ? fragrancesOf(p) : p?.[k]) || []), ...(p ? [OTHER] : [])];
  const keyOf = p => `${p.id}__${p.collection}`;
  const shuffle = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

  async function loadProducts() {
    // i prodotti creati dal pannello non hanno un codice: lo ricavo dal nome
    const clean = items => (items || []).filter(p => p && p.title).map(p => ({ ...p, id: p.id || slug(p.title) }));
    const get = async u => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw 0; return r.json(); };
    try {
      const [prods, collections, types, colors, fragrances] = await Promise.all([
        get('data/products.json'), get('data/collections.json'), get('data/types.json'),
        get('data/colors.json'), get('data/fragrances.json')
      ]);
      OPTS = { collections: collections.items || [], types: types.items || [], colors: colors.items || [], fragrances: fragrances.items || [] };
      return clean(prods.items);
    } catch {
      // file:// o rete assente: uso la copia di riserva
      await new Promise(res => { const sc = document.createElement('script'); sc.src = 'js/products-fallback.js'; sc.onload = sc.onerror = res; document.head.appendChild(sc); });
      const fb = window.LUNARA_FALLBACK || {};
      OPTS = { ...OPTS, ...(fb.options || {}) };
      OPTS.fragrances = [...new Set((fb.items || []).flatMap(p => p.fragrances || []))].map(name => ({ name }));
      return clean(fb.items);
    }
  }

  /* ===== HEADER / MENU / PROGRESSO ===== */
  const hdr = $('#hdr'), wax = $('#wax');
  let lastY = 0;
  function onScroll() {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    if (wax) wax.style.height = `max(30px, ${(1 - (h > 0 ? y / h : 0)) * 34}vh)`;
    hdr.classList.toggle('scrolled', y > 30);
    hdr.classList.toggle('hide', !matchMedia('(max-width:1000px)').matches && y > lastY && y > 500 && !$('#drawer').classList.contains('open'));
    lastY = y;
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const burger = $('#burger'), drawer = $('#drawer');
  function toggleDrawer(open) {
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('lock', open);
  }
  burger.addEventListener('click', () => toggleDrawer(!drawer.classList.contains('open')));
  $$('a', drawer).forEach(a => a.addEventListener('click', () => toggleDrawer(false)));

  // voce di menu attiva
  const navLinks = $$('.nav a[href^="#"], .tabbar a[href^="#"]');
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['hero', 'catalogo', 'benefits', 'personalizza', 'storia', 'recensioni', 'contatti'].forEach(id => spy.observe($('#' + id)));

  /* ===== BRACI (canvas) ===== */
  const cv = $('#embers'), cx = cv.getContext('2d');
  let W = 0, H = 0, parts = [];
  const sizeCv = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); W /= d; H /= d; };
  sizeCv(); addEventListener('resize', sizeCv);
  const spawn = () => ({ x: Math.random() * W, y: H + 10, r: .8 + Math.random() * 2.2, vy: .35 + Math.random() * .9, ph: Math.random() * 6.28, sw: .3 + Math.random() * .8, life: 0, max: 380 + Math.random() * 380, hue: 25 + Math.random() * 25 });
  function sparkBurst(x, y) {
    for (let i = 0; i < 46; i++) { const a = Math.random() * 6.28, v = 1 + Math.random() * 4;
      parts.push({ x, y, r: .8 + Math.random() * 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, ph: 0, sw: 0, life: 0, max: 60 + Math.random() * 60, hue: 30 + Math.random() * 25, burst: true }); }
  }
  if (!reduce) {
    let vis = true; document.addEventListener('visibilitychange', () => { vis = !document.hidden; if (vis) tick(); });
    (function tick() {
      if (!vis) return;
      cx.clearRect(0, 0, W, H);
        const target = innerWidth < 700 ? 8 : 18;
      if (parts.filter(p => !p.burst).length < target && Math.random() < .35) parts.push(spawn());
      parts = parts.filter(p => p.life < p.max && p.y > -20);
      for (const p of parts) {
        p.life++;
        if (p.burst) { p.x += p.vx; p.y += p.vy; p.vy += .08; p.vx *= .985; }
        else { p.y -= p.vy; p.x += Math.sin(p.life * .02 + p.ph) * p.sw; }
        const k = 1 - p.life / p.max, a = Math.min(1, p.life / 30) * k * .75;
        cx.globalAlpha = Math.max(0, a);
        cx.shadowBlur = 12; cx.shadowColor = `hsl(${p.hue} 100% 55%)`;
        cx.fillStyle = `hsl(${p.hue} 100% ${60 + 25 * k}%)`;
        cx.beginPath(); cx.arc(p.x, p.y, p.r * (.5 + k * .7), 0, 6.28); cx.fill();
      }
      cx.globalAlpha = 1; cx.shadowBlur = 0;
      requestAnimationFrame(tick);
    })();
  }

  /* ===== SPOTLIGHT + GLOW SULLE CARD ===== */
  if (!reduce) {
    addEventListener('pointermove', e => {
      root.style.setProperty('--mx', e.clientX + 'px');
      root.style.setProperty('--my', e.clientY + 'px');
    }, { passive: true });
  }
  document.addEventListener('pointermove', e => {
    const g = e.target.closest?.('.glass');
    if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty('--cx', (e.clientX - r.left) + 'px');
    g.style.setProperty('--cy', (e.clientY - r.top) + 'px');
    if (g.classList.contains('pc') && !reduce && matchMedia('(hover:hover)').matches) {
      g.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 7 + 'deg');
      g.style.setProperty('--rx', (.5 - (e.clientY - r.top) / r.height) * 7 + 'deg');
    }
  }, { passive: true });
  document.addEventListener('pointerout', e => {
    const g = e.target.closest?.('.pc');
    if (g && !g.contains(e.relatedTarget)) { g.style.setProperty('--rx', '0deg'); g.style.setProperty('--ry', '0deg'); }
  });

  /* ===== REVEAL + CONTATORI ===== */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    $$('[data-count]', e.target).concat(e.target.dataset.count ? [e.target] : []).forEach(countUp);
  }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  const watch = r => $$('.rv:not(.in)', r).forEach(el => io.observe(el));
  function countUp(el) {
    const to = +el.dataset.count, suf = el.dataset.suffix || '';
    if (reduce) { el.textContent = to + suf; return; }
    const t0 = performance.now(), D = 1600;
    (function f(t) {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e) + suf;
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }
  watch(document);

  /* ===== HERO ===== */
  function buildHero() {
    // carosello della vecchia home: copertine dei prodotti, caricate solo quando servono
    const pool = [...new Set(shuffle(products.map(p => imgsOf(p)[0]).filter(s => s && !s.includes('placeholder'))))].slice(0, 8);
    const slidesEl = $('#hero-slides'), dotsEl = $('#hero-dots'), car = $('#hero-carousel');
    const imgs = pool.length ? pool : [PLACEHOLDER];
    slidesEl.innerHTML = imgs.map((src, i) => `<div class="slide${i ? '' : ' active'}"><img ${i ? `data-src="${esc(src)}"` : `src="${esc(src)}" fetchpriority="high"`} alt="Candela Lunara" width="800" height="1000" decoding="async"></div>`).join('');
    dotsEl.innerHTML = imgs.map((_, i) => `<button type="button" class="dot${i ? '' : ' active'}" aria-label="Foto ${i + 1}"></button>`).join('');
    const slides = $$('.slide', slidesEl), dots = $$('.dot', dotsEl);
    let idx = 0, timer = null;
    const ensure = i => { const im = $('img', slides[(i + slides.length) % slides.length]); if (im && !im.src) im.src = im.dataset.src; };
    function goTo(i) {
      slides[idx].classList.remove('active'); dots[idx].classList.remove('active');
      idx = (i + slides.length) % slides.length;
      slides[idx].classList.add('active'); dots[idx].classList.add('active');
      ensure(idx); ensure(idx + 1);
    }
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { stop(); if (slides.length > 1 && !reduce) timer = setInterval(() => goTo(idx + 1), 4200); };
    dots.forEach((d, i) => d.addEventListener('click', () => { goTo(i); start(); }));
    setTimeout(() => ensure(1), 1500);
    start();
    car.addEventListener('mouseenter', stop); car.addEventListener('mouseleave', start);
    car.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { stop(); goTo(idx - 1); } if (e.key === 'ArrowRight') { stop(); goTo(idx + 1); } });
    let x0 = 0;
    car.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    car.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { goTo(idx + (dx < 0 ? 1 : -1)); start(); } }, { passive: true });
    // storia: orbite
    ['or1', 'or2', 'or3'].forEach((id, k) => { const s = pool[(k * 2 + 3) % pool.length]; const el = $('#' + id); if (s && el) el.src = s; });
  }

  /* ===== CATALOGO ===== */
  let col = 'Tutte', sub = 'Tutte', subNames = [];
  const grid = $('#grid'), seg = $('#seg'), subseg = $('#subseg'), search = $('#search'), sort = $('#sort');
  const OTHER_TYPE = 'Altre';
  const typeKey = p => (p.bomboniera_type || '').trim() || OTHER_TYPE;
  const typeIcon = n => ((OPTS.types || []).find(t => t.name === n) || {}).icon || '';
  // ordine del menu = ordine impostato da /admin (Impostazioni); le collezioni non elencate vanno prima di «Altro», che resta in fondo
  const collections = () => {
    const names = [...new Set(products.map(colOf))];
    const order = (OPTS.collections || []).map(c => String(c.name).toLowerCase());
    const rank = n => { const l = n.toLowerCase(), i = order.indexOf(l); return i > -1 ? i : (l === 'altro' ? 1e6 : 1e3); };
    return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'it'));
  };
  const descOf = n => ((OPTS.collections || []).find(c => String(c.name).toLowerCase() === n.toLowerCase()) || {}).description || '';
  function renderSeg() {
    const names = ['Tutte', ...collections()];
    if (!names.includes(col)) col = 'Tutte';
    seg.innerHTML = names.map(n => {
      const c = n === 'Tutte' ? products.length : products.filter(p => colOf(p) === n).length;
      return `<button role="tab" class="${n === col ? 'on' : ''}" data-c="${esc(n)}">${esc(n)}<small>${c}</small></button>`;
    }).join('');
    renderSub();
  }
  // le bomboniere si dividono per tipologia (Nascita, Comunione / Cresima, Matrimonio…) solo se almeno una ha una tipologia
  function renderSub() {
    const list = products.filter(p => colOf(p) === col);
    if (!isBomb(col) || !list.some(p => p.bomboniera_type)) { subNames = []; sub = 'Tutte'; subseg.hidden = true; subseg.innerHTML = ''; return; }
    const keys = new Set(list.map(typeKey));
    const known = (OPTS.types || []).map(t => t.name);
    subNames = [...known.filter(n => keys.has(n)), ...[...keys].filter(n => n !== OTHER_TYPE && !known.includes(n)), ...(keys.has(OTHER_TYPE) ? [OTHER_TYPE] : [])];
    if (sub !== 'Tutte' && !subNames.includes(sub)) sub = 'Tutte';
    const btn = (n, label, ico, c) => `<button type="button" class="${n === sub ? 'on' : ''}" data-t="${esc(n)}">${ico ? `<span aria-hidden="true">${esc(ico)}</span>` : ''}${esc(label)}<small>${c}</small></button>`;
    subseg.innerHTML = btn('Tutte', 'Tutte le bomboniere', '', list.length) + subNames.map(n => btn(n, n === OTHER_TYPE ? 'Altre bomboniere' : n, typeIcon(n), list.filter(p => typeKey(p) === n).length)).join('');
    subseg.hidden = false;
  }
  seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    col = b.dataset.c; sub = 'Tutte'; renderSeg(); renderGrid();
  });
  subseg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    sub = b.dataset.t; renderSub(); renderGrid();
  });

  function card(p, i) {
    const badge = isTrue(p.is_new) ? '<span class="tag gold">Novità</span>' : isTrue(p.is_low_stock) ? '<span class="tag">Ultimi pezzi</span>' : '';
    const im = imgsOf(p);
    return `<article class="glass pc rv" style="--i:${Math.min(i % 8, 7)}" data-k="${esc(keyOf(p))}" tabindex="0" role="button" aria-label="${esc(p.title)} — dettagli">
      <div class="pc-img"><span class="mini" aria-hidden="true"><svg class="flame" viewBox="0 0 40 76"><use href="#flame"/></svg></span>${badge}${p.collection ? `<span class="pc-col">${esc(p.collection)}${p.bomboniera_type && isBomb(p.collection) ? ' · ' + esc(p.bomboniera_type) : ''}</span>` : ''}
        <img src="${esc(im[0])}" alt="${esc(p.title)}" loading="lazy" decoding="async" width="400" height="500">
        ${im[1] ? `<img src="${esc(im[1])}" alt="" loading="lazy" decoding="async">` : ''}</div>
      <div class="pc-body"><h3>${esc(p.title)}</h3><div class="m">${esc(p.measures)}</div>
        <div class="pc-foot"><span class="price">${fmt(p.price)}</span>
          <span class="pc-go"><svg class="ic st" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></div></div>
    </article>`;
  }
  function filtered() {
    const q = search.value.trim().toLowerCase();
    let l = products.filter(p => col === 'Tutte' || colOf(p) === col);
    if (isBomb(col) && sub !== 'Tutte') l = l.filter(p => typeKey(p) === sub);
    if (q) l = l.filter(p => [p.title, p.measures, p.description, p.collection, p.bomboniera_type, ...(p.fragrances || []), ...(p.colors || [])].some(s => (s || '').toLowerCase().includes(q)));
    if (sort.value === 'price-asc') l.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sort.value === 'price-desc') l.sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (sort.value === 'new-first') l.sort((a, b) => isTrue(b.is_new) - isTrue(a.is_new));
    return l;
  }
  function renderGrid() {
    const l = filtered();
    if (l.length && isBomb(col) && sub === 'Tutte' && subNames.length) {
      // tutte le bomboniere: una sezione per tipologia
      let n = 0;
      grid.innerHTML = subNames.map(t => {
        const g = l.filter(p => typeKey(p) === t); if (!g.length) return '';
        return `<h3 class="grp-h rv"><span aria-hidden="true">${esc(typeIcon(t))}</span>${t === OTHER_TYPE ? 'Altre bomboniere' : esc(t)}<small>${g.length}</small></h3>${g.map(p => card(p, n++)).join('')}`;
      }).join('');
    } else grid.innerHTML = l.length ? l.map(card).join('') : '<div class="empty">Nessun prodotto trovato.</div>';
    watch(grid);
  }
  search.addEventListener('input', renderGrid);
  sort.addEventListener('change', renderGrid);
  const openFromEl = el => { const c = el.closest('.pc'); if (c) openProduct(c.dataset.k); };
  grid.addEventListener('click', e => openFromEl(e.target));
  grid.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromEl(e.target); } });

  /* ===== SCHEDA PRODOTTO ===== */
  const pd = $('#pd'), pdBody = $('#pd-body');
  let cur = null, gi = 0, lastFocus = null, curImgs = [];
  const newSel = () => ({ frag: null, col: null, confetti: null, tag: null, pack: null });
  let pdSel = newSel();
  // gruppi di scelta di un prodotto: fragranza e colore del prodotto + extra comuni
  const groupsOf = p => [['Fragranza', 'frag', fragrancesOf(p)], ['Colore', 'col', p?.colors || []], ...extrasOf(p).map(e => [e.t, e.key, e.list])].filter(g => g[2].length);
  const chipsHtml = (key, list) => list.map(v => { const hx = key === 'col' ? hexOf(v) : null; return `<button type="button" role="radio" aria-checked="false" data-v="${esc(v)}" class="pd-chip">${key === 'col' ? `<i class="${hx ? '' : 'any'}" style="${hx ? `background:${esc(hx)}` : ''}"></i>` : ''}${esc(v)}</button>`; }).join('');
  const grpHtml = (t, key, list) => `<div class="pd-opt"><h4>${esc(t)}</h4><div class="pd-chips" data-k="${key}" role="radiogroup" aria-label="${esc(t)}">${chipsHtml(key, list)}</div></div>`;
  const grpSelectHtml = (title, key, list) => `<div class="pd-opt"><label for="pd-opt-${key}">${esc(title)}</label><select class="field pd-select" id="pd-opt-${key}" data-k="${key}"><option value="">Seleziona ${esc(title.toLowerCase())}</option>${list.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></div>`;
  function optBlock(p) {
    const gs = groupsOf(p);
    return `<div class="pd-opts">${gs.map(g => grpSelectHtml(...g)).join('')}${gs.length ? '<p class="pd-opt-hint">Seleziona le varianti: le includeremo nel messaggio WhatsApp.</p>' : ''}<p class="pd-custom">${CUSTOM_NOTE}</p></div>`;
  }
  const selLines = (p, sel) => groupsOf(p).filter(g => sel[g[1]]).map(g => `${g[0]}: ${sel[g[1]]}`);
  const selText = () => selLines(cur, pdSel).join('\n');
  function openProduct(k, push = true) {
    const p = products.find(x => keyOf(x) === k); if (!p) return;
    cur = p; pdSel = newSel(); curImgs = imgsOf(p); gi = 0; lastFocus = document.activeElement;
    const badge = isTrue(p.is_new) ? '<span class="tag gold">Novità</span>' : isTrue(p.is_low_stock) ? '<span class="tag">⚠ Ultimi pezzi</span>' : '';
    const rec = shuffle(products.filter(x => keyOf(x) !== k && x.id !== p.id && (x.collection || '') === (p.collection || ''))).slice(0, 8);
    const rec2 = rec.length ? rec : shuffle(products.filter(x => x.id !== p.id)).slice(0, 8);
    pdBody.innerHTML = `
      <div class="gal">
        <div class="gal-main" id="gal-main">
          ${curImgs.map((s, i) => `<img src="${esc(s)}" alt="${esc(p.title)} ${i + 1}" class="${i ? '' : 'on'}" ${i ? 'loading="lazy"' : ''}>`).join('')}
          ${curImgs.length > 1 ? '<button class="gal-arrow p" aria-label="Precedente">‹</button><button class="gal-arrow n" aria-label="Successiva">›</button>' : ''}
        </div>
        ${curImgs.length > 1 ? `<div class="thumbs">${curImgs.map((s, i) => `<button class="${i ? '' : 'on'}" data-i="${i}" aria-label="Foto ${i + 1}"><img src="${esc(s)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <div class="pd-info">
        <div class="pd-flame" aria-hidden="true"><i class="halo"></i><svg class="flame" viewBox="0 0 40 76"><use href="#flame"/></svg></div>
        <div class="tags">${badge}${p.collection ? `<span class="pc-col">${esc(p.collection)}</span>` : ''}</div>
        <h1>${esc(p.title)}</h1>
        <div class="pd-price"><span class="price">${fmt(p.price)}</span><span class="m">${esc(p.measures)}</span></div>
        <span class="ship">🚚 Spedizione gratuita da 50€</span>
        <p class="pd-desc">${esc(p.description)}</p>
        ${optBlock(p)}
        <div class="pd-act">
          <button class="btn gold" id="pd-buy">Acquista</button>
          <button class="btn" id="pd-info">Chiedi informazioni</button>
          <button class="btn" id="pd-share">Condividi</button>
        </div>
      </div>
      <div class="pd-rec"><h3>Ti potrebbe piacere</h3><div class="rec-track">${rec2.map(card).join('')}</div></div>`;
    $$('.rv', pdBody).forEach(el => el.classList.add('in'));
    pd.classList.add('open'); pd.setAttribute('aria-hidden', 'false'); pd.scrollTop = 0;
    document.body.classList.add('lock');
    if (push) history.pushState({ p: k }, '', '#p=' + encodeURIComponent(k));
    document.title = `${p.title} — Candela artigianale | Lunara`;
    $('#pd-close').focus({ preventScroll: true });
  }
  function closeProduct(fromPop) {
    if (!pd.classList.contains('open')) return;
    pd.classList.remove('open'); pd.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lock'); document.title = 'Lunara — Candele artigianali italiane';
    if (!fromPop && location.hash.startsWith('#p=')) history.back();
    lastFocus?.focus?.({ preventScroll: true });
  }
  function gal(n) {
    gi = (n + curImgs.length) % curImgs.length;
    $$('#gal-main img').forEach((im, i) => im.classList.toggle('on', i === gi));
    $$('.thumbs button').forEach((b, i) => b.classList.toggle('on', i === gi));
    $('#gal-main')?.classList.remove('zoom'); $$('#gal-main img').forEach(im => im.style.transformOrigin = '');
  }
  pdBody.addEventListener('change', e => {
    const select = e.target.closest('.pd-select');
    if (select) pdSel[select.dataset.k] = select.value || null;
  });
  pdBody.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('.gal-arrow.p')) return gal(gi - 1);
    if (t.closest('.gal-arrow.n')) return gal(gi + 1);
    const th = t.closest('.thumbs button'); if (th) return gal(+th.dataset.i);
    const chipB = t.closest('.pd-chip');
    if (chipB) {
      const g = chipB.parentElement, key = g.dataset.k, was = chipB.getAttribute('aria-checked') === 'true';
      $$('.pd-chip', g).forEach(x => x.setAttribute('aria-checked', 'false'));
      pdSel[key] = was ? null : chipB.dataset.v; if (!was) chipB.setAttribute('aria-checked', 'true');
      return;
    }
    if (t.closest('#pd-buy') || t.closest('#pd-info')) return openBuy();
    if (t.closest('#pd-share')) return share();
    const c = t.closest('.pc'); if (c) return openProduct(c.dataset.k, false);
    if (t.closest('#gal-main')) $('#gal-main').classList.toggle('zoom');
  });
  pdBody.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('pc')) { e.preventDefault(); openProduct(e.target.dataset.k, false); }
  });
  pdBody.addEventListener('pointermove', e => {
    const m = e.target.closest('#gal-main'); if (!m || !m.classList.contains('zoom')) return;
    const r = m.getBoundingClientRect(), im = $('img.on', m);
    im.style.transformOrigin = `${(e.clientX - r.left) / r.width * 100}% ${(e.clientY - r.top) / r.height * 100}%`;
  });
  let tx = 0;
  pdBody.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  pdBody.addEventListener('touchend', e => {
    if (!e.target.closest('#gal-main')) return;
    const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) gal(gi + (dx < 0 ? 1 : -1));
  }, { passive: true });
  $('#pd-close').addEventListener('click', () => closeProduct(false));
  // i link del menu dentro la scheda: chiudono la scheda e portano alla sezione
  $$('.pd-top a[href^="#"], .tabbar a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href');
    const go = () => { const t = $(id); if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
    if (pd.classList.contains('open')) {
      pd.classList.remove('open'); pd.setAttribute('aria-hidden', 'true'); document.body.classList.remove('lock');
      document.title = 'Lunara — Candele artigianali italiane';
      if (location.hash.startsWith('#p=')) history.replaceState(null, '', id); else history.replaceState(null, '', id);
      setTimeout(go, 60);
    } else go();
  }));
  addEventListener('popstate', () => {
    const m = location.hash.match(/^#p=(.+)/);
    if (m) openProduct(decodeURIComponent(m[1]), false); else closeProduct(true);
  });
  async function share() {
    const data = { title: cur?.title || 'Lunara', text: 'Dai un’occhiata a questo prodotto Lunara', url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch {} return; }
    try { await navigator.clipboard.writeText(location.href); toast('Link copiato!'); } catch { prompt('Copia il link:', location.href); }
  }

  /* ===== MODAL ACQUISTO ===== */
  const buy = $('#buy');
  function openBuy() { buy.classList.add('open'); buy.setAttribute('aria-hidden', 'false'); $('#buy-x').focus(); }
  function closeBuy() { buy.classList.remove('open'); buy.setAttribute('aria-hidden', 'true'); }
  $('#buy-x').addEventListener('click', closeBuy);
  buy.addEventListener('click', e => { if (e.target === buy) closeBuy(); });
  $('#b-wa').addEventListener('click', () => { open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Ciao! Vorrei acquistare: ' + (cur?.title || '') + (selText() ? '\n' + selText() : ''))}`, '_blank', 'noopener'); closeBuy(); });
  $('#b-ig').addEventListener('click', () => { open(IG, '_blank', 'noopener'); closeBuy(); });
  $('#b-tt').addEventListener('click', () => { open(TT, '_blank', 'noopener'); closeBuy(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (buy.classList.contains('open')) closeBuy(); else if (pd.classList.contains('open')) closeProduct(false); else toggleDrawer(false); }
    if (pd.classList.contains('open') && !buy.classList.contains('open') && curImgs.length > 1) {
      if (e.key === 'ArrowLeft') gal(gi - 1); if (e.key === 'ArrowRight') gal(gi + 1);
    }
  });

  /* ===== TOAST + FORM ===== */
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); }
  const form = $('#contact-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const ok = $('#form-ok'), ko = $('#form-ko'); ok.classList.remove('show'); ko.classList.remove('show');
    try {
      const r = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!r.ok) throw 0; form.reset(); ok.classList.add('show');
    } catch { ko.classList.add('show'); }
  });

  /* ===== PERSONALIZZA LA TUA CANDELA (atelier a passi) ===== */
  const waLink = text => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  function initConfigurator() {
    const root = $('#atl'); if (!root) return;
    const sel = { base: null, ...newSel() };
    let step = 0, group = null, viewList = [];
    const NONE = 'Da definire';
    const panes = $$('.atl-pane', root), stepBtns = $$('#atl-steps button', root);
    const LAST_PICK = 2; // dopo creazione, profumo e colore si passa da soli al passo successivo
    const hasReal = p => imgsOf(p)[0] && !imgsOf(p)[0].includes('placeholder');
    const optCount = p => fragrancesOf(p).length + (p.colors || []).length;
    // elenco completo: stessa candela presente in più collezioni → tengo la scheda con più opzioni
    const allBases = () => [...products.reduce((m, p) => { const o = m.get(p.title); if (!o || optCount(p) > optCount(o)) m.set(p.title, p); return m; }, new Map()).values()];

    /* passo 1a: collezioni con anteprima */
    const covers = list => { const w = list.filter(hasReal); return (w.length ? w : list).slice(0, 3).map(p => imgsOf(p)[0]); };
    function renderCats() {
      const cols = collections();
      const card = (id, title, desc, imgs, n) => `<button type="button" class="cat" data-c="${esc(id)}"><span class="cat-pv">${imgs.map(s => `<img src="${esc(s)}" alt="" loading="lazy">`).join('')}</span><b>${esc(title)}</b><small>${desc ? esc(desc) + ' · ' : ''}${n} ${n === 1 ? 'creazione' : 'creazioni'}</small></button>`;
      $('#cfg-cats').innerHTML = cols.map(c => { const l = products.filter(p => colOf(p) === c); return card(c, c, descOf(c), covers(l), l.length); }).join('')
        + card('__all', 'Tutte le candele', 'Sfoglia l’elenco completo', covers(cols.map(c => products.find(p => colOf(p) === c && hasReal(p)) || products.find(p => colOf(p) === c))), allBases().length);
    }
    function showGroup(g) {
      group = g;
      const inList = g !== null;
      $('#cfg-cats').hidden = inList; $('#cfg-base').hidden = !inList; $('#cfg-back').hidden = !inList;
      $('#cfg-h-base').textContent = inList ? (g === '__all' ? 'Tutte le nostre candele' : g) : 'Da quale collezione parti?';
      $('#cfg-hint-base').textContent = inList ? 'Scegli la creazione da cui partire: la adattiamo insieme.' : 'Scegli una collezione per vedere le candele, oppure sfoglia l’elenco completo.';
      if (!inList) return;
      viewList = g === '__all' ? allBases() : products.filter(p => colOf(p) === g);
      // bomboniere: raggruppate per tipologia, se presente
      const typed = isBomb(g) && viewList.some(p => p.bomboniera_type);
      const order = typed ? [...(OPTS.types || []).map(t => t.name), ...new Set(viewList.map(typeKey))].filter((n, i, a) => a.indexOf(n) === i && viewList.some(p => typeKey(p) === n)) : [];
      const one = (p, i) => `<button type="button" role="radio" class="base" data-i="${i}" aria-checked="false"><img src="${esc(imgsOf(p)[0])}" alt="" loading="lazy"><span>${esc(p.title)}</span></button>`;
      if (typed) {
        const sorted = order.flatMap(t => viewList.filter(p => typeKey(p) === t));
        viewList = sorted;
        $('#cfg-base').innerHTML = order.map(t => `<h4 class="atl-grp">${esc(typeIcon(t))} ${t === OTHER_TYPE ? 'Altre bomboniere' : esc(t)}</h4>${viewList.map((p, i) => typeKey(p) === t ? one(p, i) : '').join('')}`).join('');
      } else $('#cfg-base').innerHTML = viewList.map(one).join('');
      paint();
    }

    /* passi 2-4: opzioni della creazione scelta */
    function renderOpts() {
      const fl = optsOf(sel.base, 'fragrances'), cl = optsOf(sel.base, 'colors'), ex = extrasOf(sel.base);
      $('#cfg-frag').innerHTML = sel.base ? fl.map((f, i) => `<button type="button" role="radio" class="frag" data-i="${i}" aria-checked="false"><b>${esc(f)}</b></button>`).join('') : '<p class="atl-hint">Scegli prima una creazione.</p>';
      $('#cfg-col').innerHTML = sel.base ? cl.map((c, i) => { const hx = hexOf(c); return `<button type="button" role="radio" class="col" data-i="${i}" aria-checked="false" aria-label="${esc(c)}"><i class="${hx ? '' : 'any'}" style="${hx ? `--c:${esc(hx)}` : ''}"></i><span>${esc(c)}</span></button>`; }).join('') : '';
      $('#cfg-ext').innerHTML = ex.map(e => grpHtml(e.t, e.key, e.list)).join('');
      $('#hint-frag').textContent = sel.base && fragrancesOf(sel.base).length ? `Le fragranze di «${sel.base.title}».` : 'Per questa creazione definiamo il profumo insieme: scrivici cosa preferisci.';
      $('#hint-col').textContent = sel.base && (sel.base.colors || []).length ? `I colori di «${sel.base.title}».` : 'Per questa creazione definiamo il colore insieme: scrivici cosa preferisci.';
      $('#hint-ext').textContent = !sel.base ? 'Scegli prima una creazione.' : ex.length ? 'Tutto facoltativo: se non sei sicuro, ne parliamo insieme.' : 'Per questa creazione questi extra non sono previsti: scrivici se hai richieste particolari.';
    }
    renderCats(); showGroup(null); renderOpts();

    const stage = $('#atl-stage'), img = $('#atl-img');
    const chip = (id, on, html) => { const el = $('#' + id); el.hidden = !on; if (on) el.innerHTML = html; };
    function paint() {
      $$('.base', root).forEach(b => b.setAttribute('aria-checked', String(viewList[+b.dataset.i] === sel.base)));
      const fl = optsOf(sel.base, 'fragrances'), cl = optsOf(sel.base, 'colors');
      $$('.frag', root).forEach((b, i) => b.setAttribute('aria-checked', String(fl[i] === sel.frag)));
      $$('.col', root).forEach((b, i) => b.setAttribute('aria-checked', String(cl[i] === sel.col)));
      $$('#cfg-ext .pd-chips', root).forEach(g => $$('.pd-chip', g).forEach(c => c.setAttribute('aria-checked', String(sel[g.dataset.k] === c.dataset.v))));
      stage.style.setProperty('--tone', hexOf(sel.col) || '#e8c98a');
      stage.classList.toggle('has-col', !!sel.col);
      const src = sel.base ? imgsOf(sel.base)[0] : null;
      if (src && img.dataset.src !== src) {
        img.dataset.src = src;
        const n = new Image(); n.alt = ''; n.src = src; n.className = 'in';
        img.appendChild(n); const old = $$('img', img).filter(x => x !== n);
        requestAnimationFrame(() => old.forEach(o => { o.classList.add('out'); setTimeout(() => o.remove(), 600); }));
      }
      chip('chip-base', true, esc(sel.base ? sel.base.title : 'Scegli una creazione'));
      chip('chip-frag', !!sel.frag, esc(sel.frag || ''));
      chip('chip-col', !!sel.col, `<i style="${hexOf(sel.col) ? `background:${esc(hexOf(sel.col))}` : ''}"></i><b>${esc(sel.col || '')}</b>`);
      $('#cfg-s-base').textContent = sel.base?.title || NONE;
      $('#cfg-s-frag').textContent = sel.frag || NONE;
      $('#cfg-s-col').textContent = sel.col || NONE;
      EXTRAS.forEach(e => { $('#cfg-s-' + e.key).textContent = sel[e.key] || NONE; });
      const note = $('#cfg-note').value.trim();
      $('#cfg-wa').href = waLink(['Ciao Lunara! Vorrei richiedere una candela personalizzata.', '',
        `Creazione: ${sel.base?.title || NONE}`, `Fragranza: ${sel.frag || NONE}`, `Colore: ${sel.col || NONE}`,
        ...EXTRAS.map(e => `${e.t}: ${sel[e.key] || NONE}`),
        ...(note ? ['', `Note: ${note}`] : [])].join('\n'));
    }
    function go(n) {
      step = Math.max(0, Math.min(panes.length - 1, n));
      panes.forEach((p, i) => p.hidden = i !== step);
      stepBtns.forEach((b, i) => { b.classList.toggle('on', i === step); b.classList.toggle('done', i < step); b.setAttribute('aria-current', i === step ? 'step' : 'false'); });
      $('#atl-prev').style.visibility = step ? 'visible' : 'hidden';
      $('#atl-next').style.display = step === panes.length - 1 ? 'none' : '';
    }
    const advance = () => setTimeout(() => { if (step <= LAST_PICK) go(step + 1); }, 380);
    const pick = key => e => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      if (key === 'base') { sel.base = viewList[+b.dataset.i]; sel.frag = sel.col = sel.confetti = sel.tag = sel.pack = null; renderOpts(); }
      else sel[key] = optsOf(sel.base, key === 'frag' ? 'fragrances' : 'colors')[+b.dataset.i];
      paint(); advance();
    };
    $('#cfg-cats').addEventListener('click', e => { const b = e.target.closest('.cat'); if (b) showGroup(b.dataset.c); });
    $('#cfg-back').addEventListener('click', () => showGroup(null));
    $('#cfg-base').addEventListener('click', pick('base'));
    $('#cfg-frag').addEventListener('click', pick('frag'));
    $('#cfg-col').addEventListener('click', pick('col'));
    $('#cfg-ext').addEventListener('click', e => {
      const c = e.target.closest('.pd-chip'); if (!c) return;
      const k = c.parentElement.dataset.k; sel[k] = sel[k] === c.dataset.v ? null : c.dataset.v; paint();
    });
    $('#cfg-note').addEventListener('input', paint);
    stepBtns.forEach(b => b.addEventListener('click', () => go(+b.dataset.s)));
    $('#atl-next').addEventListener('click', () => go(step + 1));
    $('#atl-prev').addEventListener('click', () => go(step - 1));
    go(0); paint();
  }
  const wc = $('#wa-contact'); if (wc) wc.href = `https://wa.me/${WHATSAPP}`;

  /* ===== AVVIO ===== */
  products = await loadProducts();
  buildHero(); renderSeg(); renderGrid(); initConfigurator();
  const intro = $('#intro');
  if (intro) {
    const hideIntro = () => intro.classList.add('out');
    if (reduce || sessionStorage.getItem('lunara_intro')) intro.remove();
    else { try { sessionStorage.setItem('lunara_intro', '1'); } catch {} setTimeout(hideIntro, 1700); setTimeout(() => intro.remove(), 3000); }
  }
  const h = location.hash.match(/^#p=(.+)/);
  if (h) openProduct(decodeURIComponent(h[1]), false);
})();
