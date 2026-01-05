
document.addEventListener('DOMContentLoaded', async () => {
  /* ===== MENU MOBILE (drawer) ===== */
  const header = document.getElementById('site-header');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const mobileClose = document.getElementById('mobile-close');
  const mobileDrawer = document.querySelector('.mobile-drawer');

  let lastFocus = null;

  function lockBodyScroll(lock) { document.body.style.overflow = lock ? 'hidden' : ''; }

  function openMobileMenu() {
    if (!mobileMenu) return;
    lastFocus = document.activeElement;
    mobileMenu.classList.add('open');
    mobileMenu.setAttribute('aria-hidden', 'false');
    hamburger?.setAttribute('aria-expanded', 'true');
    lockBodyScroll(true);
    mobileClose?.focus();
  }

  function closeMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    hamburger?.setAttribute('aria-expanded', 'false');
    lockBodyScroll(false);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  hamburger?.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = mobileMenu.classList.contains('open');
    isOpen ? closeMobileMenu() : openMobileMenu();
  });
  mobileClose?.addEventListener('click', (e) => { e.preventDefault(); closeMobileMenu(); });
  mobileBackdrop?.addEventListener('click', (e) => { e.preventDefault(); closeMobileMenu(); });
  document.querySelectorAll('#mobile-menu .mobile-nav a')
    .forEach(a => a.addEventListener('click', () => closeMobileMenu()));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu?.classList.contains('open')) closeMobileMenu();
  });

  // Focus trap nel drawer
  function trapFocus(e) {
    if (!mobileMenu.classList.contains('open')) return;
    const focusables = mobileDrawer.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }
  document.addEventListener('keydown', trapFocus);

  // Smooth scroll con offset header
  const offsetScrollTo = (el) => {
    const top = el.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 12;
    window.scrollTo({ top, behavior: 'smooth' });
  };
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
      const href = a.getAttribute('href');
      if (!href || href === '#' || href.startsWith('http')) return;
      const target = document.querySelector(href);
      if (!target) return;
      ev.preventDefault();
      offsetScrollTo(target);
    });
  });

  /* ===== REVEAL ABOUT ===== */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }});
    }, { threshold: 0.2 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  /* ===== DATA (Google Sheet gviz) ===== */
  // Colonne attese: id, title, measures, description, price, is_new, is_low_stock, collection, image_folder
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1jt9Bu6CIN9Q1x4brjyWfafIWOVbYrTEp0ihNAnIW-Es/gviz/tq?tqx=out:json';
  const CACHE_KEY = 'lunara_products_v4';
  const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 ore

  const parseGViz = (text) => {
    try {
      const json = JSON.parse(text.substring(47).slice(0, -2));
      const rows = json.table.rows || [];
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
  const setCache = (data) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  };

  async function fetchProducts() {
    const cached = getCache();
    try {
      const res = await fetch(SHEET_URL, { cache: 'no-store' });
      const text = await res.text();
      const parsed = parseGViz(text);
      if (parsed) {
        setCache(parsed);
        return parsed;
      }
      console.warn('Parse gViz fallito, uso cache se esiste.');
      return cached || [];
    } catch (e) {
      console.warn('Fetch prodotti fallito:', e);
      return cached || [];
    }
  }

  /* ===== UTIL ===== */
  const fmtPrice = (p) => (p!=null && p!=='')
    ? new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(p))
    : 'NA';
  const formatMeta = (measures, price) => `${measures || 'NA'} • ${fmtPrice(price)}`;
  const sanitize = (s) => (s || '').toString().replace(/[\/\\:\*\?"<>\|]/g, "_").trim();

  const getImageCandidates = (product, max = 10, exts = ['jpeg']) => {
    const folder = sanitize(product.image_folder || product.id || product.title);
    const out = [];
    for (let i=1; i<=max; i++) for (const ext of exts) out.push(`assets/images/${folder}/${i}.${ext}`);
    return out;
  };

  const pickExistingImages = async (paths, limit = 10) => {
    const checks = paths.slice(0, limit).map(src => new Promise(res => {
      const im = new Image();
      im.onload = () => res(src);
      im.onerror = () => res(null);
      im.src = src;
    }));
    const results = await Promise.all(checks);
    return results.filter(Boolean);
  };

  /* ===== ELEMENTI DOM ===== */
  const grid = document.getElementById('product-grid');
  const skeleton = document.getElementById('grid-skeleton');
  const searchInput = document.getElementById('search');
  const filterCollection = document.getElementById('filter-collection');
  const sortSelect = document.getElementById('sort');

  /* ===== RENDER CARD ===== */
  function createCard(product) {
    const article = document.createElement('article');
    article.className = 'card';

    const badgeText = (product.is_new === true || product.is_new === 'true') ? 'Novità'
                     : (product.is_low_stock === true || product.is_low_stock === 'true') ? 'Ultimi pezzi'
                     : null;
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
    img.addEventListener('click', () => openModal(product));
    article.appendChild(img);

    const h3 = document.createElement('h3');
    h3.textContent = product.title || 'Prodotto';
    article.appendChild(h3);

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = formatMeta(product.measures, product.price);
    article.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn ghost';
    viewBtn.textContent = 'Dettagli';
    viewBtn.addEventListener('click', () => openModal(product));

    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn primary';
    buyBtn.textContent = 'Acquista';
    buyBtn.addEventListener('click', () => openBuyModal(product));

    actions.appendChild(viewBtn);
    actions.appendChild(buyBtn);
    article.appendChild(actions);

    // JSON-LD per SEO
    try {
      const ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.text = JSON.stringify({
        "@context":"https://schema.org",
        "@type":"Product",
        "name": product.title,
        "image": product.images?.[0] || 'assets/images/placeholder.jpeg',
        "description": product.description || '',
        "sku": product.id || '',
        "brand": {"@type":"Brand","name":"Lunara"},
        "offers": {
          "@type":"Offer",
          "priceCurrency":"EUR",
          "price": product.price != null ? String(product.price) : "",
          "availability": (product.is_low_stock === true || product.is_low_stock === 'true')
            ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock"
        }
      });
      article.appendChild(ld);
    } catch {}

    return article;
  }

  const renderList = (list) => {
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach(p => frag.appendChild(createCard(p)));
    grid.appendChild(frag);
    grid.setAttribute('aria-busy','false');
    skeleton.style.display = 'none';
  };

  /* ===== CARICAMENTO PRODOTTI ===== */
  let allProducts = await fetchProducts();

  if (!allProducts.length) {
    console.warn('Nessun prodotto caricato. Verifica Pubblica sul web e URL gViz.');
    skeleton.style.display = 'none';
    grid.innerHTML = '<p class="muted">Nessun prodotto disponibile al momento.</p>';
    return;
  }

  // Precarica fino a 10 immagini
  for (const p of allProducts) {
    const candidates = getImageCandidates(p, 10);
    const found = await pickExistingImages(candidates, 10);
    p.images = found.length ? found : ['assets/images/placeholder.jpeg'];
  }

  // Popola collezioni
  const collections = Array.from(new Set(
    allProducts.map(p => (p.collection || '').trim()).filter(Boolean)
  )).sort();
  collections.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    filterCollection.appendChild(opt);
  });

  // Render iniziale
  renderList(allProducts);

  /* ===== FILTRI / ORDINAMENTO ===== */
  function applyFilters() {
    const q = (searchInput.value || '').toLowerCase();
    const col = (filterCollection.value || '');
    let list = [...allProducts];

    if (q) {
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.measures || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.collection || '').toLowerCase().includes(q)
      );
    }
    if (col) list = list.filter(p => (p.collection || '') === col);

    switch (sortSelect.value) {
      case 'price-asc':  list.sort((a,b) => Number(a.price||0) - Number(b.price||0)); break;
      case 'price-desc': list.sort((a,b) => Number(b.price||0) - Number(a.price||0)); break;
      case 'new-first':  list.sort((a,b) => ((b.is_new==='true'||b.is_new===true) - (a.is_new==='true'||a.is_new===true))); break;
      default: break;
    }
    renderList(list);
  }
  searchInput?.addEventListener('input', applyFilters);
  filterCollection?.addEventListener('change', applyFilters);
  sortSelect?.addEventListener('change', applyFilters);

  /* ===== MODAL PRODOTTO ===== */
  const modal = document.getElementById('product-modal');
  const modalClose = modal.querySelector('.modal-close');
  const modalTitle = modal.querySelector('.modal-title');
  const modalDescription = modal.querySelector('.modal-description');
  const modalMeta = modal.querySelector('.modal-meta');
  const modalImages = modal.querySelector('.modal-images');
  const lowStockAlert = document.getElementById('low-stock-alert');
  const openBuyModalBtn = document.getElementById('open-buy-modal');

  let currentImg = 0;
  let modalImgs = [];
  let lastFocusModal = null;
  let currentProduct = null;

  const bodyScroll = (lock) => { document.body.style.overflow = lock ? 'hidden' : ''; };

  const openModal = (product) => {
    currentProduct = product;
    lastFocusModal = document.activeElement;
    modalTitle.textContent = product.title || '';
    modalDescription.textContent = product.description || '';
    modalMeta.textContent = formatMeta(product.measures, product.price);
    lowStockAlert.hidden = !(product.is_low_stock === true || product.is_low_stock === 'true');

    // Usa TUTTE le immagini (fino a 10) già rilevate
    modalImgs = product.images || [];
    modalImages.innerHTML = '';
    modalImgs.forEach((src,i) => {
      const im = document.createElement('img');
      im.src = src;
      im.style.display = (i===0) ? 'block':'none';
      modalImages.appendChild(im);
    });
    currentImg = 0;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    bodyScroll(true);
    modalClose.focus();
  };
  const showImg = (i) => {
    const imgs = modalImages.querySelectorAll('img');
    imgs.forEach((im,idx) => im.style.display = (idx===i) ? 'block' : 'none');
  };
  const closeModal = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    bodyScroll(false);
    if (lastFocusModal) lastFocusModal.focus();
  };
  modal.querySelector('.carousel-prev').addEventListener('click', () => {
    currentImg = (currentImg - 1 + modalImgs.length) % modalImgs.length; showImg(currentImg);
  });
  modal.querySelector('.carousel-next').addEventListener('click', () => {
    currentImg = (currentImg + 1) % modalImgs.length; showImg(currentImg);
  });
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') { currentImg = (currentImg - 1 + modalImgs.length) % modalImgs.length; showImg(currentImg); }
    if (e.key === 'ArrowRight'){ currentImg = (currentImg + 1) % modalImgs.length; showImg(currentImg); }
  });

  /* ===== BUY CHANNELS MODAL ===== */
  const buyModal = document.getElementById('buy-modal');
  const buyModalClose = document.getElementById('buy-modal-close');
  const buyWhatsappBtn = document.getElementById('buy-whatsapp');
  const buyInstagramBtn = document.getElementById('buy-instagram');
  const buyTikTokBtn = document.getElementById('buy-tiktok');

  const WHATSAPP_NUMBER = '393483471201';
  const INSTAGRAM_PROFILE = 'https://www.instagram.com/c.a.lunara/';
  const TIKTOK_PROFILE = 'https://www.tiktok.com/@lunara.candele';

  const openBuyModal = (product) => {
    currentProduct = product;
    buyModal.classList.add('open');
    buyModal.setAttribute('aria-hidden','false');
    bodyScroll(true);
    buyModalClose.focus();
  };
  const closeBuyModal = () => {
    buyModal.classList.remove('open');
    buyModal.setAttribute('aria-hidden','true');
    bodyScroll(false);
  };
  buyModalClose.addEventListener('click', closeBuyModal);
  buyModal.addEventListener('click', e => { if (e.target === buyModal) closeBuyModal(); });
  document.addEventListener('keydown', e => {
    if (buyModal.classList.contains('open') && e.key === 'Escape') closeBuyModal();
  });

  buyWhatsappBtn.addEventListener('click', () => {
    const txt = encodeURIComponent(`Ciao! Vorrei acquistare: ${currentProduct?.title || ''}`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${txt}`, '_blank');
    closeBuyModal();
  });
  buyInstagramBtn.addEventListener('click', () => {
    window.open(INSTAGRAM_PROFILE, '_blank');
    closeBuyModal();
  });
  buyTikTokBtn.addEventListener('click', () => {
    window.open(TIKTOK_PROFILE, '_blank');
    closeBuyModal();
  });

  openBuyModalBtn?.addEventListener('click', () => { if (currentProduct) openBuyModal(currentProduct); });

  /* ===== CONTATTI (Formspree) ===== */
  const form = document.getElementById('contact-form');
  const successMsg = document.getElementById('form-success');
  const errorMsg = document.getElementById('form-error');
  if (form) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      successMsg.style.display = 'none'; errorMsg.style.display = 'none';
      try {
        const data = new FormData(form);
        const res = await fetch(form.action, { method:'POST', body:data, headers:{'Accept':'application/json'} });
        if (res.ok) {
          successMsg.style.display = 'block';
          form.reset();
        } else {
          errorMsg.style.display = 'block';
        }
      } catch (e) {
        console.warn('Errore invio form', e);
        errorMsg.style.display = 'block';
      }
    });
  }
});
