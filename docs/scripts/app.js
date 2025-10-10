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
    mapObserver: null,
  };

  const assetState = {
    leafletPromise: null,
    leafletStylePromise: null,
    countUpPromise: null,
    scrollPromise: null,
    mapDependenciesPromise: null,
    leafletStyleLoaded: Boolean(
      document.querySelector('link[data-leaflet-style], link[href*="leaflet.css"]'),
    ),
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

  function syncBodyAttributes(container) {
    if (!container) {
      return;
    }

    const body = document.body;
    const targetClassName = container.dataset.bodyClass || '';

    body.className = targetClassName;

    Object.keys(body.dataset).forEach((key) => {
      if (key !== 'barba') {
        delete body.dataset[key];
      }
    });

    Object.keys(container.dataset).forEach((key) => {
      if (key === 'bodyClass') {
        return;
      }

      body.dataset[key] = container.dataset[key];
    });
  }

  function ensureLeafletStyle() {
    if (assetState.leafletStyleLoaded) {
      return Promise.resolve();
    }

    const existing = document.querySelector('link[data-leaflet-style], link[href*="leaflet.css"]');
    if (existing) {
      assetState.leafletStyleLoaded = true;
      return Promise.resolve(existing);
    }

    if (assetState.leafletStylePromise) {
      return assetState.leafletStylePromise;
    }

    assetState.leafletStylePromise = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = 'anonymous';
      link.dataset.leafletStyle = 'true';
      link.addEventListener('load', () => {
        assetState.leafletStyleLoaded = true;
        assetState.leafletStylePromise = null;
        resolve(link);
      });
      link.addEventListener('error', () => {
        assetState.leafletStylePromise = null;
        reject(new Error('No se pudo cargar la hoja de estilos de Leaflet.'));
      });
      document.head.appendChild(link);
    });

    return assetState.leafletStylePromise;
  }

  function ensureLeafletScript() {
    if (typeof window.L !== 'undefined' && typeof window.L.map === 'function') {
      return Promise.resolve(window.L);
    }

    if (assetState.leafletPromise) {
      return assetState.leafletPromise;
    }

    const existing = document.querySelector('script[data-leaflet-script]');
    if (existing) {
      assetState.leafletPromise = new Promise((resolve, reject) => {
        existing.addEventListener('load', () => {
          assetState.leafletPromise = null;
          resolve(window.L);
        }, { once: true });
        existing.addEventListener('error', () => {
          assetState.leafletPromise = null;
          reject(new Error('No se pudo cargar Leaflet.'));
        }, { once: true });
      });
      return assetState.leafletPromise;
    }

    assetState.leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.dataset.leafletScript = 'true';
      script.addEventListener('load', () => {
        assetState.leafletPromise = null;
        resolve(window.L);
      });
      script.addEventListener('error', () => {
        assetState.leafletPromise = null;
        reject(new Error('No se pudo cargar Leaflet.'));
      });
      document.head.appendChild(script);
    });

    return assetState.leafletPromise;
  }

  function ensureCountUp() {
    if (typeof window.CountUp !== 'undefined') {
      return Promise.resolve(window.CountUp);
    }

    if (assetState.countUpPromise) {
      return assetState.countUpPromise;
    }

    const existing = document.querySelector('script[data-countup-script]');
    if (existing) {
      assetState.countUpPromise = new Promise((resolve, reject) => {
        existing.addEventListener('load', () => {
          assetState.countUpPromise = null;
          resolve(window.CountUp);
        }, { once: true });
        existing.addEventListener('error', () => {
          assetState.countUpPromise = null;
          reject(new Error('No se pudo cargar CountUp.'));
        }, { once: true });
      });
      return assetState.countUpPromise;
    }

    assetState.countUpPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/countup.js/2.8.0/countUp.umd.js';
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.async = true;
      script.dataset.countupScript = 'true';
      script.addEventListener('load', () => {
        assetState.countUpPromise = null;
        resolve(window.CountUp);
      });
      script.addEventListener('error', () => {
        assetState.countUpPromise = null;
        reject(new Error('No se pudo cargar CountUp.'));
      });
      document.head.appendChild(script);
    });

    return assetState.countUpPromise;
  }

  function ensureScrollModules() {
    if (typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined') {
      return Promise.resolve({ gsap: window.gsap, ScrollTrigger: window.ScrollTrigger });
    }

    if (assetState.scrollPromise) {
      return assetState.scrollPromise;
    }

    const loadGsap = () =>
      new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-gsap-script], script[src*="/gsap.min.js"]');
        if (existing && !existing.dataset.gsapBound) {
          existing.dataset.gsapBound = 'true';
          existing.addEventListener('load', () => resolve(window.gsap), { once: true });
          existing.addEventListener('error', () => reject(new Error('No se pudo cargar GSAP.')), {
            once: true,
          });
          return;
        }

        if (typeof window.gsap !== 'undefined') {
          resolve(window.gsap);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
        script.async = true;
        script.dataset.gsapScript = 'true';
        script.addEventListener('load', () => resolve(window.gsap));
        script.addEventListener('error', () => reject(new Error('No se pudo cargar GSAP.')));
        document.head.appendChild(script);
      });

    const loadScrollTrigger = () =>
      new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-scrolltrigger-script], script[src*="ScrollTrigger.min.js"]');
        if (existing && !existing.dataset.scrollTriggerBound) {
          existing.dataset.scrollTriggerBound = 'true';
          existing.addEventListener('load', () => resolve(window.ScrollTrigger), {
            once: true,
          });
          existing.addEventListener('error', () => reject(new Error('No se pudo cargar ScrollTrigger.')), {
            once: true,
          });
          return;
        }

        if (typeof window.ScrollTrigger !== 'undefined') {
          resolve(window.ScrollTrigger);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js';
        script.async = true;
        script.dataset.scrolltriggerScript = 'true';
        script.addEventListener('load', () => resolve(window.ScrollTrigger));
        script.addEventListener('error', () => reject(new Error('No se pudo cargar ScrollTrigger.')));
        document.head.appendChild(script);
      });

    assetState.scrollPromise = loadGsap()
      .catch((error) => {
        console.warn(error.message);
        return window.gsap;
      })
      .then((gsapInstance) => {
        if (typeof window.ScrollTrigger !== 'undefined') {
          return { gsap: gsapInstance || window.gsap, ScrollTrigger: window.ScrollTrigger };
        }
        return loadScrollTrigger()
          .catch((error) => {
            console.warn(error.message);
            return window.ScrollTrigger;
          })
          .then((scrollTrigger) => ({ gsap: gsapInstance || window.gsap, ScrollTrigger: scrollTrigger }));
      })
      .finally(() => {
        assetState.scrollPromise = null;
      });

    return assetState.scrollPromise;
  }

  function loadMapDependencies() {
    if (assetState.mapDependenciesPromise) {
      return assetState.mapDependenciesPromise;
    }

    const optionalDependencies = [
      ensureCountUp().catch((error) => {
        console.warn(error.message);
        return null;
      }),
      ensureScrollModules().catch((error) => {
        console.warn(error.message);
        return null;
      }),
    ];

    assetState.mapDependenciesPromise = Promise.all([
      ensureLeafletStyle().catch((error) => {
        console.warn(error.message);
        return null;
      }),
      ensureLeafletScript(),
      Promise.all(optionalDependencies),
    ])
      .then(([, leaflet]) => {
        if (window.MapManager) {
          if (typeof window.MapManager.hydrateWithLeaflet === 'function') {
            window.MapManager.hydrateWithLeaflet(leaflet);
          } else if (typeof window.MapManager.initPage === 'function') {
            window.MapManager.initPage({ retosData: state.retosData });
          }
        }
        return leaflet;
      })
      .catch((error) => {
        console.error('No se pudieron cargar las dependencias del mapa', error);
        throw error;
      })
      .finally(() => {
        assetState.mapDependenciesPromise = null;
      });

    return assetState.mapDependenciesPromise;
  }

  function disconnectMapObserver() {
    if (state.mapObserver && typeof state.mapObserver.disconnect === 'function') {
      state.mapObserver.disconnect();
    }
    state.mapObserver = null;
  }

  function observeMapsForDependencies() {
    disconnectMapObserver();

    const targets = Array.from(
      document.querySelectorAll('#mapa-global, [id^="map-"]'),
    ).filter((element) => element instanceof Element);

    if (!targets.length) {
      return;
    }

    let triggered = false;
    const triggerLoad = () => {
      if (triggered) return;
      triggered = true;
      loadMapDependencies().catch(() => {});
    };

    if (!('IntersectionObserver' in window)) {
      triggerLoad();
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          triggerLoad();
          obs.disconnect();
          state.mapObserver = null;
        });
      },
      { rootMargin: '200px 0px', threshold: 0.15 },
    );

    targets.forEach((target) => observer.observe(target));
    state.mapObserver = observer;

    addCleanup(() => {
      observer.disconnect();
      if (state.mapObserver === observer) {
        state.mapObserver = null;
      }
    });
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

  function initMobileMenu() {
    const toggle = document.querySelector('.nav-toggle');
    const panel = document.getElementById('menu-principal');
    if (!toggle || !panel) return;

    const navLinks = Array.from(panel.querySelectorAll('.nav-links a'));
    const mobileQuery = window.matchMedia('(max-width: 639px)');
    const focusableSelectors =
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

    let isOpen = false;
    let lastFocused = null;

    const toggleLabel = toggle.querySelector('.nav-toggle__label');

    const setAriaHidden = (open) => {
      if (mobileQuery.matches) {
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      } else {
        panel.removeAttribute('aria-hidden');
      }
    };

    const updateToggleLabel = (open) => {
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      if (toggleLabel) {
        toggleLabel.textContent = open ? 'Cerrar' : 'Menú';
      }
    };

    const getFocusableElements = () =>
      Array.from(panel.querySelectorAll(focusableSelectors)).filter((element) => {
        if (element.hasAttribute('disabled')) return false;
        const tabIndex = element.getAttribute('tabindex');
        return tabIndex === null || tabIndex !== '-1';
      });

    const removeDocumentListeners = () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };

    const handleKeydown = (event) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusableElements();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (!panel.contains(active) || active === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handlePointerDown = (event) => {
      if (!isOpen) return;
      if (panel.contains(event.target) || toggle.contains(event.target)) {
        return;
      }
      closeMenu({ restoreFocus: false });
    };

    const openMenu = ({ focus = true } = {}) => {
      if (isOpen || !mobileQuery.matches) return;
      isOpen = true;
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      toggle.setAttribute('aria-expanded', 'true');
      panel.dataset.open = 'true';
      setAriaHidden(true);
      updateToggleLabel(true);
      document.body.classList.add('has-mobile-nav-open');
      document.addEventListener('keydown', handleKeydown);
      document.addEventListener('pointerdown', handlePointerDown, true);

      if (focus) {
        requestAnimationFrame(() => {
          const focusable = getFocusableElements();
          if (focusable.length) {
            focusable[0].focus({ preventScroll: true });
          }
        });
      }
    };

    const closeMenu = ({ restoreFocus = true, force = false } = {}) => {
      if (!isOpen && !force) {
        panel.dataset.open = 'false';
        setAriaHidden(false);
        updateToggleLabel(false);
        toggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('has-mobile-nav-open');
        removeDocumentListeners();
        return;
      }

      isOpen = false;
      panel.dataset.open = 'false';
      toggle.setAttribute('aria-expanded', 'false');
      setAriaHidden(false);
      updateToggleLabel(false);
      document.body.classList.remove('has-mobile-nav-open');
      removeDocumentListeners();

      const shouldRestoreFocus = restoreFocus && mobileQuery.matches;
      const focusTarget = shouldRestoreFocus ? lastFocused || toggle : null;
      lastFocused = null;

      if (focusTarget && typeof focusTarget.focus === 'function') {
        requestAnimationFrame(() => {
          focusTarget.focus({ preventScroll: true });
        });
      }
    };

    const handleToggle = () => {
      if (!mobileQuery.matches) return;
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    };

    const handleLinkClick = () => {
      if (!mobileQuery.matches) return;
      closeMenu({ restoreFocus: false });
    };

    const handleMobileChange = (query) => {
      const matches = typeof query.matches === 'boolean' ? query.matches : mobileQuery.matches;

      if (!matches) {
        isOpen = false;
        panel.dataset.open = 'true';
        toggle.setAttribute('aria-expanded', 'false');
        updateToggleLabel(false);
        setAriaHidden(true);
        document.body.classList.remove('has-mobile-nav-open');
        removeDocumentListeners();
        lastFocused = null;
      } else {
        closeMenu({ restoreFocus: false, force: true });
      }
    };

    updateToggleLabel(false);
    handleMobileChange(mobileQuery);

    toggle.addEventListener('click', handleToggle);
    navLinks.forEach((link) => link.addEventListener('click', handleLinkClick));

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleMobileChange);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(handleMobileChange);
    }

    const cleanup = () => {
      closeMenu({ restoreFocus: false, force: true });
      toggle.removeEventListener('click', handleToggle);
      navLinks.forEach((link) => link.removeEventListener('click', handleLinkClick));
      if (typeof mobileQuery.removeEventListener === 'function') {
        mobileQuery.removeEventListener('change', handleMobileChange);
      } else if (typeof mobileQuery.removeListener === 'function') {
        mobileQuery.removeListener(handleMobileChange);
      }
      panel.dataset.open = 'true';
      panel.removeAttribute('aria-hidden');
      toggle.setAttribute('aria-expanded', 'false');
      updateToggleLabel(false);
      document.body.classList.remove('has-mobile-nav-open');
      removeDocumentListeners();
    };

    addCleanup(cleanup);
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
      container.className = 'map-card-scroller';
      container.setAttribute('role', 'list');
      panel.insertBefore(container, details || panel.firstChild);
    }

    container.innerHTML = '';

    retos.forEach((reto) => {
      const card = document.createElement('article');
      card.className = 'reto-card';
      card.dataset.hoverCard = 'true';
      card.dataset.retoId = reto.id;
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', reto.nombre);
      card.tabIndex = 0;

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

      const focusReto = () => {
        const dependenciesPromise = loadMapDependencies();
        if (dependenciesPromise && typeof dependenciesPromise.catch === 'function') {
          dependenciesPromise.catch(() => {});
        }

        if (window.MapManager && typeof window.MapManager.focusOnReto === 'function') {
          window.MapManager.focusOnReto(reto.id);
        } else {
          highlightRetoCard(reto.id);
        }
      };

      mapButton.addEventListener('click', (event) => {
        event.stopPropagation();
        focusReto();
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

      card.addEventListener('click', (event) => {
        if (event.target.closest('a, button')) {
          return;
        }
        focusReto();
      });

      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          focusReto();
        }
      });

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
      card.setAttribute('aria-current', isActive ? 'true' : 'false');
      if (isActive) {
        const behavior = prefersReducedMotion.matches ? 'auto' : 'smooth';
        const containerRect = container.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const containerScrollLeft = container.scrollLeft;
        const cardCenter = cardRect.left - containerRect.left + containerScrollLeft + cardRect.width / 2;
        const targetLeft = cardCenter - container.clientWidth / 2;
        const maxScroll = container.scrollWidth - container.clientWidth;
        const clampedLeft = Math.max(0, Math.min(targetLeft, maxScroll));

        container.scrollTo({
          left: clampedLeft,
          behavior,
        });
      }
    });
  }

  function initHoverCards() {
    const cards = document.querySelectorAll('[data-hover-card]');
    if (!cards.length) return;

    const pointerMoveHandler = (event) => {
      const card = event.currentTarget;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--pointer-x', `${x}%`);
      card.style.setProperty('--pointer-y', `${y}%`);
    };

    const pointerEnterHandler = (event) => {
      const card = event.currentTarget;
      if (!card) return;
      card.dataset.hoverActive = 'true';
    };

    const pointerLeaveHandler = (event) => {
      const card = event.currentTarget;
      if (!card) return;
      card.dataset.hoverActive = 'false';
      card.style.removeProperty('--pointer-x');
      card.style.removeProperty('--pointer-y');
    };

    cards.forEach((card) => {
      if (card.dataset.hoverBound === 'true') {
        return;
      }

      card.addEventListener('pointermove', pointerMoveHandler);
      card.addEventListener('pointerenter', pointerEnterHandler);
      card.addEventListener('pointerleave', pointerLeaveHandler);
      card.addEventListener('focusin', pointerEnterHandler);
      card.addEventListener('focusout', pointerLeaveHandler);

      addCleanup(() => {
        card.removeEventListener('pointermove', pointerMoveHandler);
        card.removeEventListener('pointerenter', pointerEnterHandler);
        card.removeEventListener('pointerleave', pointerLeaveHandler);
        card.removeEventListener('focusin', pointerEnterHandler);
        card.removeEventListener('focusout', pointerLeaveHandler);
        card.style.removeProperty('--pointer-x');
        card.style.removeProperty('--pointer-y');
        delete card.dataset.hoverActive;
        delete card.dataset.hoverBound;
      });

      card.dataset.hoverBound = 'true';
    });
  }

  function initPrefetch() {
    const prefetched = new Set();
    const links = document.querySelectorAll('a[href]');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.dataset.prefetchBound === 'true') return;
      const url = new URL(href, window.location.href);
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
    initMobileMenu();
    initNavHighlight();
    initPrefetch();
    parseAndRenderRetos();
    initHoverCards();

    if (window.AnimationManager && typeof window.AnimationManager.init === 'function') {
      window.AnimationManager.init();
    }

    if (window.MapManager && typeof window.MapManager.initPage === 'function') {
      window.MapManager.initPage({ retosData: state.retosData });
    }

    observeMapsForDependencies();

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

    disconnectMapObserver();

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
      syncBodyAttributes(document.querySelector('[data-barba="container"]'));
      initPage();
      focusMain(true);
      return;
    }

    const overlay = createOverlay();

    function scrollToHash(hash) {
      if (!hash || hash === '#') {
        return;
      }

      let target;
      try {
        target = document.querySelector(hash);
      } catch (error) {
        return;
      }

      if (!target) {
        return;
      }

      requestAnimationFrame(() => {
        target.scrollIntoView({
          behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
        });
      });
    }

    window.barba.hooks.beforeLeave(() => {
      teardownPage();
    });

    window.barba.hooks.afterEnter((data) => {
      const nextContainer = data && data.next && data.next.container;
      syncBodyAttributes(nextContainer);
      initPage();
      const hash = (data && data.next && data.next.url && data.next.url.hash) || window.location.hash;
      scrollToHash(hash);
      focusMain();
    });

    window.barba.hooks.once((data) => {
      const nextContainer = data && data.next && data.next.container;
      syncBodyAttributes(nextContainer);
      initPage();
      const hash = (data && data.next && data.next.url && data.next.url.hash) || window.location.hash;
      scrollToHash(hash);
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
