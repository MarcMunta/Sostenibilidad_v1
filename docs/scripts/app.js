(function () {
  const THEME_STORAGE_KEY = 'sostenibilidad-theme';
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

  const state = {
    lenis: null,
    lenisRafId: null,
    lenisCleanup: null,
    sectionObserver: null,
    cleanupFns: [],
    retosData: [],
    overlay: null,
    navLinks: [],
    initialScrollBehavior: null,
  };

  function addCleanup(fn) {
    if (typeof fn === 'function') {
      state.cleanupFns.push(fn);
    }
  }

  function runCleanups() {
    while (state.cleanupFns.length) {
      const fn = state.cleanupFns.pop();
      try {
        fn();
      } catch (error) {
        console.error('Error en limpieza de página', error);
      }
    }
  }

  function setupLenis() {
    if (state.lenisCleanup) {
      const previousCleanup = state.lenisCleanup;
      state.cleanupFns = state.cleanupFns.filter((fn) => fn !== previousCleanup);
      previousCleanup();
    }

    state.lenis = null;
    state.lenisCleanup = null;
    state.lenisRafId = null;

    if (state.initialScrollBehavior === null) {
      state.initialScrollBehavior = document.documentElement.style.scrollBehavior || '';
    }

    if (prefersReducedMotion.matches) {
      document.documentElement.style.scrollBehavior = 'auto';
      return;
    }

    if (state.initialScrollBehavior) {
      document.documentElement.style.scrollBehavior = state.initialScrollBehavior;
    } else {
      document.documentElement.style.removeProperty('scroll-behavior');
    }

    if (typeof window.ScrollTrigger !== 'undefined') {
      window.ScrollTrigger.update();
    }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.setAttribute('data-theme', theme);

    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      const isDark = theme === 'dark';
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('data-theme', theme);
      const icon = toggle.querySelector('[data-feather]');
      if (icon) {
        icon.setAttribute('data-feather', isDark ? 'sun' : 'moon');
      }
    }

    if (window.feather && typeof window.feather.replace === 'function') {
      window.feather.replace();
    }
  }

  function getStoredTheme() {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('No se pudo guardar la preferencia de tema', error);
    }
  }

  function initTheme() {
    const storedTheme = getStoredTheme();
    const theme = storedTheme || (prefersDarkScheme.matches ? 'dark' : 'light');
    applyTheme(theme);
  }

  function initThemeToggle() {
    const toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;

    if (toggle.dataset.themeBound === 'true') {
      const currentTheme = document.documentElement.dataset.theme || 'light';
      toggle.setAttribute('aria-pressed', String(currentTheme === 'dark'));
      return;
    }

    const onToggle = () => {
      const currentTheme = document.documentElement.dataset.theme || 'light';
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      storeTheme(nextTheme);
    };

    toggle.addEventListener('click', onToggle);
    toggle.dataset.themeBound = 'true';
  }

  function focusMain(initial = false) {
    const main = document.querySelector('#contenido-principal');
    if (!main) return;

    main.setAttribute('tabindex', '-1');
    if (!initial) {
      main.focus({ preventScroll: true });
    }
    main.addEventListener(
      'blur',
      () => {
        main.removeAttribute('tabindex');
      },
      { once: true }
    );
  }

  function initNavHighlight() {
    if (state.sectionObserver) {
      state.sectionObserver.disconnect();
      state.sectionObserver = null;
    }

    const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    state.navLinks = links;
    if (!links.length) return;

    const sectionMap = new Map();
    links.forEach((link) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const id = hash.slice(1);
      const section = document.getElementById(id);
      if (section) {
        sectionMap.set(section, link);
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = sectionMap.get(entry.target);
          if (!link) return;
          if (entry.isIntersecting) {
            state.navLinks.forEach((item) => item.classList.remove('is-active'));
            link.classList.add('is-active');
          }
        });
      },
      { threshold: 0.55 }
    );

    sectionMap.forEach((_, section) => observer.observe(section));
    state.sectionObserver = observer;
  }

  function ensureLazyImages() {
    document.querySelectorAll('img:not([loading])').forEach((img) => {
      img.setAttribute('loading', 'lazy');
    });
  }

  function parseRetosData() {
    const script = document.getElementById('data-retos');
    if (!script) return [];
    try {
      const parsed = JSON.parse(script.textContent.trim());
      return Array.isArray(parsed.retos) ? parsed.retos : [];
    } catch (error) {
      console.error('No se pudo parsear el JSON de retos', error);
      return [];
    }
  }

  function renderRetosSummary(retos) {
    const panel = document.querySelector('.map-panel');
    if (!panel || !retos.length) return;

    const details = panel.querySelector('.map-details');
    let container = panel.querySelector('[data-retos-list]');
    if (!container) {
      container = document.createElement('div');
      container.dataset.retosList = 'true';
      container.className = 'retos-grid';
      panel.insertBefore(container, details || panel.firstChild);
    }

    container.innerHTML = '';

    retos.forEach((reto) => {
      const card = document.createElement('article');
      card.className = 'reto-card';
      card.dataset.retoId = reto.id;

      if (reto.imagen) {
        const picture = document.createElement('img');
        picture.className = 'reto-card__image';
        picture.src = reto.imagen;
        picture.alt = reto.imagenAlt || `Vista representativa del reto ${reto.nombre}`;
        picture.loading = 'lazy';
        picture.decoding = 'async';
        card.appendChild(picture);
      }

      const title = document.createElement('h3');
      title.className = 'reto-card__title';
      title.textContent = `${reto.emoji || '📍'} ${reto.nombre}`;
      card.appendChild(title);

      const summary = document.createElement('p');
      summary.textContent = reto.resumen;
      card.appendChild(summary);

      const controls = document.createElement('div');
      controls.className = 'reto-card__actions';

      const mapButton = document.createElement('button');
      mapButton.type = 'button';
      mapButton.className = 'reto-card__map';
      mapButton.textContent = 'Ver en el mapa';
      mapButton.addEventListener('click', () => {
        if (window.MapManager && typeof window.MapManager.focusOnReto === 'function') {
          window.MapManager.focusOnReto(reto.id);
        }
        highlightRetoCard(reto.id);
      });
      controls.appendChild(mapButton);

      if (reto.ruta) {
        const link = document.createElement('a');
        link.href = reto.ruta;
        link.textContent = 'Ver reto';
        link.className = 'reto-card__link';
        controls.appendChild(link);
      }

      card.appendChild(controls);
      container.appendChild(card);
    });
  }

  function highlightRetoCard(retoId) {
    const container = document.querySelector('[data-retos-list]');
    if (!container) return;
    const panel = document.querySelector('.map-panel');
    if (panel) {
      panel.dataset.activeReto = retoId || '';
    }
    container.querySelectorAll('.reto-card').forEach((card) => {
      const isActive = card.dataset.retoId === retoId;
      card.classList.toggle('is-active', isActive);
      if (isActive) {
        card.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
      }
    });
  }

  function initPrefetch() {
    const prefetched = new Set();
    const links = document.querySelectorAll('a[href]');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.dataset.prefetchBound === 'true') return;
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;

      const prefetch = () => {
        const key = `${url.pathname}${url.search}`;
        if (prefetched.has(key)) return;
        prefetched.add(key);
        const prefetchLink = document.createElement('link');
        prefetchLink.rel = 'prefetch';
        prefetchLink.href = url.pathname + url.search;
        prefetchLink.as = 'document';
        document.head.appendChild(prefetchLink);
      };

      const onceHandler = () => {
        prefetch();
        link.removeEventListener('mouseenter', onceHandler);
        link.removeEventListener('focus', onceHandler);
      };

      link.addEventListener('mouseenter', onceHandler, { once: true });
      link.addEventListener('focus', onceHandler, { once: true });
      link.dataset.prefetchBound = 'true';
    });
  }

  function parseAndRenderRetos() {
    const retos = parseRetosData();
    if (retos.length) {
      state.retosData = retos;
      renderRetosSummary(retos);
    }
  }

  function onMapFocus(event) {
    highlightRetoCard(event.detail);
  }

  function initPage() {
    ensureLazyImages();
    initThemeToggle();
    initNavHighlight();
    initPrefetch();
    parseAndRenderRetos();

    if (window.AnimationManager && typeof window.AnimationManager.init === 'function') {
      window.AnimationManager.init();
    }

    if (window.MapManager && typeof window.MapManager.initPage === 'function') {
      window.MapManager.initPage({ retosData: state.retosData });
    }

    if (window.feather && typeof window.feather.replace === 'function') {
      window.feather.replace();
    }

    window.addEventListener('map:focus', onMapFocus);
    addCleanup(() => window.removeEventListener('map:focus', onMapFocus));
  }

  function teardownPage() {
    if (state.sectionObserver) {
      state.sectionObserver.disconnect();
      state.sectionObserver = null;
    }

    runCleanups();
    if (window.AnimationManager && typeof window.AnimationManager.destroy === 'function') {
      window.AnimationManager.destroy();
    }

    if (window.MapManager && typeof window.MapManager.destroy === 'function') {
      window.MapManager.destroy();
    }
  }

  function createOverlay() {
    if (state.overlay) return state.overlay;
    const overlay = document.createElement('div');
    overlay.className = 'transition-overlay';
    overlay.hidden = true;
    document.body.appendChild(overlay);
    state.overlay = overlay;
    return overlay;
  }

  function animateOverlay(direction) {
    const overlay = createOverlay();
    if (!overlay) return Promise.resolve();

    const reduce = prefersReducedMotion.matches;
    overlay.hidden = false;

    if (reduce) {
      overlay.style.opacity = direction === 'in' ? '1' : '0';
      if (direction === 'out') {
        overlay.hidden = true;
      }
      return Promise.resolve();
    }

    const keyframesIn = [
      { opacity: 0, clipPath: 'circle(0% at 50% 50%)' },
      { opacity: 1, clipPath: 'circle(150% at 50% 50%)' },
    ];

    const keyframesOut = [
      { opacity: 1, clipPath: 'circle(150% at 50% 50%)' },
      { opacity: 0, clipPath: 'circle(0% at 50% 50%)' },
    ];

    const animation = overlay.animate(direction === 'in' ? keyframesIn : keyframesOut, {
      duration: 500,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    });

    return animation.finished.then(() => {
      if (direction === 'out') {
        overlay.hidden = true;
      }
    });
  }

  function initBarba() {
    if (!window.barba) {
      initPage();
      focusMain(true);
      return;
    }

    const overlay = createOverlay();

    window.barba.hooks.beforeLeave(() => {
      teardownPage();
    });

    window.barba.hooks.afterEnter(() => {
      initPage();
      focusMain();
    });

    window.barba.hooks.once(() => {
      initPage();
      focusMain(true);
    });

    window.barba.init({
      transitions: [
        {
          name: 'overlay-morph',
          async leave() {
            overlay.hidden = false;
            await animateOverlay('in');
          },
          async enter() {
            await animateOverlay('out');
          },
        },
      ],
    });
  }

  function initApp() {
    setupLenis();
    initTheme();
    initBarba();
  }

  if (typeof prefersReducedMotion.addEventListener === 'function') {
    prefersReducedMotion.addEventListener('change', setupLenis);
  } else if (typeof prefersReducedMotion.addListener === 'function') {
    prefersReducedMotion.addListener(setupLenis);
  }

  const handleThemeChange = () => {
    const stored = getStoredTheme();
    if (!stored) {
      applyTheme(prefersDarkScheme.matches ? 'dark' : 'light');
    }
  };

  if (typeof prefersDarkScheme.addEventListener === 'function') {
    prefersDarkScheme.addEventListener('change', handleThemeChange);
  } else if (typeof prefersDarkScheme.addListener === 'function') {
    prefersDarkScheme.addListener(handleThemeChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
