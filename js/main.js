(async function() {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('site-nav');
  const header = document.getElementById('site-header');

  // Hamburger mobile
  hamburger?.addEventListener('click', () => {
    const expanded = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('show');
  });

  // Smooth scroll
  function offsetScrollTo(targetEl) {
    const headerHeight = header.offsetHeight;
    const top = targetEl.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
      const href = a.getAttribute('href');
      if (!href || href === '#' || href.startsWith('http')) return;
      const el = document.querySelector(href);
      if (!el) return;
      ev.preventDefault();
      offsetScrollTo(el);
      nav.classList.remove('show');
      hamburger?.setAttribute('aria-expanded', 'false');
    });
  });

  // Fetch products
  async function fetchProducts() {
    try {
      const r = await fetch('data/products.json');
      if (!r.ok) throw new Error('products.json non trovato');
      return await r.json();
    } catch (e) { console.warn(e); return []; }
  }

  function formatPrice(p) {
    return (p !== undefined && p !== null && p !== '') ? Number(p).toFixed(2) + '€' : 'NA';
  }

  function formatMeta(weight, price) {
    return `${weight || 'NA'} • ${formatPrice(price)}`;
  }

  function createCard(product) {
    const article = document.createElement('article');
    article.className = 'card';

    const img = document.createElement('img');
    img.src = (product.images && product.images[0]) ? product.images[0] : 'assets/images/placeholder.jpg';
    img.alt = product.title || 'Candela';
    img.addEventListener('click', () => openModal(product));
    article.appendChild(img);

    const h3 = document.createElement('h3');
    h3.textContent = product.title || 'Prodotto';
    article.appendChild(h3);

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = formatMeta(product.weight, product.price);
    article.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const viewBtn = document.createElement('button');
    viewBtn.className='btn ghost';
    viewBtn.textContent='Visualizza';
    viewBtn.addEventListener('click',()=>openModal(product));

    const buyBtn = document.createElement('a');
    buyBtn.className = 'btn primary';
    buyBtn.textContent = 'Compra';
    buyBtn.href = product.vinted_link || '#';
    buyBtn.target='_blank';
    buyBtn.rel='noopener';

    actions.appendChild(viewBtn);
    actions.appendChild(buyBtn);
    article.appendChild(actions);

    return article;
  }

  const grid = document.getElementById('product-grid');
  const products = await fetchProducts();
  products.forEach(p => grid.appendChild(createCard(p)));

  // MODAL
  const modal = document.getElementById('product-modal');
  const modalClose = modal.querySelector('.modal-close');
  const modalTitle = modal.querySelector('.modal-title');
  const modalDescription = modal.querySelector('.modal-description');
  const modalMeta = modal.querySelector('.modal-meta');
  const modalImages = modal.querySelector('.modal-images');
  const modalBuy = modal.querySelector('.modal-buy');
  const modalMessage = modal.querySelector('.modal-message');

  let currentImg = 0;
  let modalImgs = [];

  function openModal(product){
    modalTitle.textContent = product.title || '';
    modalDescription.textContent = product.description || '';
    modalMeta.textContent = formatMeta(product.weight, product.price);
    modalBuy.href = product.vinted_link || '#';
    modalMessage.href = 'https://www.instagram.com/c.a.lunara/';

    modalImages.innerHTML = '';
    modalImgs = product.images || [];
    currentImg = 0;

    modalImgs.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.style.display=(i===0)?'block':'none';
      modalImages.appendChild(img);
    });

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden','false');
  }

  function closeModal(){
    modal.style.display='none';
    modal.setAttribute('aria-hidden','true');
  }

  
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const success = document.getElementById('form-success');
  
    form.addEventListener('submit', function() {
      // mostra messaggio di conferma subito dopo l’invio
      success.style.display = 'block';
    });
  });

  
  modalClose.addEventListener('click',closeModal);
  modal.addEventListener('click',(e)=>{if(e.target===modal)closeModal()});

  const prevBtn = modal.querySelector('.carousel-prev');
  const nextBtn = modal.querySelector('.carousel-next');

  function showImg(index){
    const imgs = modalImages.querySelectorAll('img');
    imgs.forEach((img,i)=>img.style.display=(i===index)?'block':'none');
  }
  prevBtn.addEventListener('click',()=>{currentImg=(currentImg-1+modalImgs.length)%modalImgs.length; showImg(currentImg)});
  nextBtn.addEventListener('click',()=>{currentImg=(currentImg+1)%modalImgs.length; showImg(currentImg)});
})();

const scrollMenu = document.querySelector('.visualizza-menu');
let isDown = false;
let startX;
let scrollLeft;

scrollMenu.addEventListener('mousedown', (e) => {
  isDown = true;
  scrollMenu.classList.add('active');
  startX = e.pageX - scrollMenu.offsetLeft;
  scrollLeft = scrollMenu.scrollLeft;
});
scrollMenu.addEventListener('mouseleave', () => isDown = false);
scrollMenu.addEventListener('mouseup', () => isDown = false);
scrollMenu.addEventListener('mousemove', (e) => {
  if(!isDown) return;
  e.preventDefault();
  const x = e.pageX - scrollMenu.offsetLeft;
  const walk = (x - startX) * 1.5; 
  scrollMenu.scrollLeft = scrollLeft - walk;
});

// Touch
scrollMenu.addEventListener('touchstart', e => {
  startX = e.touches[0].pageX - scrollMenu.offsetLeft;
  scrollLeft = scrollMenu.scrollLeft;
}, { passive: true });

scrollMenu.addEventListener('touchmove', e => {
  const x = e.touches[0].pageX - scrollMenu.offsetLeft;
  const walk = (x - startX) * 1.5;
  scrollMenu.scrollLeft = scrollLeft - walk;
}, { passive: true });
