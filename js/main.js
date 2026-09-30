// ====================================================
// EK PENSION — interactions
// ====================================================

document.addEventListener('DOMContentLoaded', () => {

  /* Header scroll state */
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (window.scrollY > 12) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive:true });

  /* Mobile drawer */
  const toggle = document.querySelector('.menu-toggle');
  const drawer = document.querySelector('.mobile-drawer');
  const backdrop = document.querySelector('.drawer-backdrop');
  const drawerClose = document.querySelector('.drawer-close');

  function openDrawer(){
    drawer.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer(){
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (toggle) toggle.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);
  document.querySelectorAll('.mobile-drawer a').forEach(a => a.addEventListener('click', closeDrawer));

  /* Scroll reveal */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* Lightbox for gallery images */
  const lightbox = document.querySelector('.lightbox');
  const lightboxImg = lightbox ? lightbox.querySelector('img') : null;
  const lightboxClose = document.querySelector('.lightbox-close');

  document.querySelectorAll('[data-lightbox]').forEach(item => {
    item.addEventListener('click', () => {
      const src = item.getAttribute('data-lightbox');
      lightboxImg.setAttribute('src', src);
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });
  function closeLightbox(){
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lightbox && lightbox.classList.contains('open')) closeLightbox(); });

  /* Smooth-scroll for same-page anchors when on index */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length > 1){
        const target = document.querySelector(id);
        if (target){
          e.preventDefault();
          target.scrollIntoView({ behavior:'smooth', block:'start' });
        }
      }
    });
  });

});
