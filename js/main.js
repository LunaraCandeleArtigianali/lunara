document.addEventListener('DOMContentLoaded', async () => {

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
      const url = 'https://docs.google.com/spreadsheets/d/1jt9Bu6CIN9Q1x4brjyWfafIWOVbYrTEp0ihNAnIW-Es/gviz/tq?tqx=out:json';
      const res = await fetch(url);
      const text = await res.text();
      const json = JSON.parse(text.substring(47).slice(0, -2));
      const rows = json.table.rows;
      return rows.map(r => ({
        id: r.c[0]?.v,
        title: r.c[1]?.v,
        measures: r.c[2]?.v,
        description: r.c[3]?.v,
        price: r.c[4]?.v
      }));
    } catch(e) {
      console.warn('Errore caricamento prodotti', e);
      return [];
    }
  }

  function formatPrice(p) { return (p!=null && p!=='') ? Number(p).toFixed(2)+'€' : 'NA'; }
  function formatMeta(measures, price) { return `${measures||'NA'} • ${formatPrice(price)}`; }

  function sanitizeFolderName(name) { return name.replace(/[\/\\\:\*\?"<>\|]/g, "_"); }
  function getImagesFromFolder(title, maxImages=10, exts=['jpeg']){
    const folder = sanitizeFolderName(title);
    const images=[];
    for(let i=1;i<=maxImages;i++){
      for(const ext of exts){
        images.push(`assets/images/${folder}/${i}.${ext}`);
      }
    }
    return images;
  }

  async function filterExistingImages(paths){
    return Promise.all(paths.map(src=>new Promise(res=>{
      const img = new Image();
      img.onload=()=>res(src);
      img.onerror=()=>res(null);
      img.src=src;
    }))).then(r=>r.filter(Boolean));
  }

  function createCard(product){
    const article=document.createElement('article');
    article.className='card';

    const img=document.createElement('img');
    img.src=product.images[0]||'assets/images/placeholder.jpeg';
    img.alt=product.title||'Candela';
    img.addEventListener('click',()=>openModal(product));
    article.appendChild(img);

    const h3=document.createElement('h3'); h3.textContent=product.title||'Prodotto';
    article.appendChild(h3);

    const meta=document.createElement('p'); meta.className='meta';
    meta.textContent=formatMeta(product.measures, product.price);
    article.appendChild(meta);

    const actions=document.createElement('div'); actions.className='card-actions';
    const viewBtn=document.createElement('button'); viewBtn.className='btn ghost'; viewBtn.textContent='Visualizza';
    viewBtn.addEventListener('click',()=>openModal(product));
    const buyBtn=document.createElement('a'); buyBtn.className='btn primary';
    buyBtn.textContent='Compra'; buyBtn.href='https://www.instagram.com/c.a.lunara/'; buyBtn.target='_blank'; buyBtn.rel='noopener';
    actions.appendChild(viewBtn); actions.appendChild(buyBtn); article.appendChild(actions);
    return article;
  }

  // Insert products
  const grid=document.getElementById('product-grid');
  const products=await fetchProducts();
  for(const p of products){
    const possibleImages=getImagesFromFolder(p.id);
    p.images=await filterExistingImages(possibleImages);
    grid.appendChild(createCard(p));
  }

  // Modal
  const modal=document.getElementById('product-modal');
  const modalClose=modal.querySelector('.modal-close');
  const modalTitle=modal.querySelector('.modal-title');
  const modalDescription=modal.querySelector('.modal-description');
  const modalMeta=modal.querySelector('.modal-meta');
  const modalImages=modal.querySelector('.modal-images');
  const modalBuy=modal.querySelector('.modal-buy');
  const modalMessage=modal.querySelector('.modal-message');

  let currentImg=0; let modalImgs=[];

  function openModal(product){
    modalTitle.textContent=product.title||'';
    modalDescription.textContent=product.description||'';
    modalMeta.textContent=formatMeta(product.measures, product.price);
    modalBuy.href='https://www.instagram.com/c.a.lunara/';
    modalMessage.href='https://www.instagram.com/c.a.lunara/';

    modalImages.innerHTML=''; modalImgs=product.images||[]; currentImg=0;
    modalImgs.forEach((src,i)=>{
      const img=document.createElement('img');
      img.src=src; img.style.display=(i===0)?'block':'none';
      modalImages.appendChild(img);
    });

    modal.style.display='flex'; modal.setAttribute('aria-hidden','false');
  }

  function closeModal(){ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); }
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', e=>{if(e.target===modal) closeModal();});

  const prevBtn=modal.querySelector('.carousel-prev');
  const nextBtn=modal.querySelector('.carousel-next');
  function showImg(index){
    const imgs=modalImages.querySelectorAll('img');
    imgs.forEach((img,i)=>img.style.display=(i===index)?'block':'none');
  }
  prevBtn.addEventListener('click',()=>{currentImg=(currentImg-1+modalImgs.length)%modalImgs.length; showImg(currentImg)});
  nextBtn.addEventListener('click',()=>{currentImg=(currentImg+1)%modalImgs.length; showImg(currentImg)});

  // Touch swipe for mobile
  let startX=0;
  modalImages.addEventListener('touchstart', e=>{startX=e.touches[0].clientX;});
  modalImages.addEventListener('touchend', e=>{
    const endX=e.changedTouches[0].clientX;
    if(endX-startX>50){ currentImg=(currentImg-1+modalImgs.length)%modalImgs.length; showImg(currentImg);}
    else if(startX-endX>50){ currentImg=(currentImg+1)%modalImgs.length; showImg(currentImg);}
  });

  // Contact form
  const form=document.getElementById('contact-form');
  const success=document.getElementById('form-success');
  if(form){ form.addEventListener('submit', ev=>{ ev.preventDefault(); success.style.display='block'; }); }

});
