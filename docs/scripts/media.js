const assetsBase = new URL('../assets/', import.meta.url);
const assetUrl = (path) => new URL(path, assetsBase).href;

if (typeof window !== 'undefined' && typeof window.assetUrl !== 'function') {
  window.assetUrl = assetUrl;
}

const docReady = (fn) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
};

docReady(() => {
  const noop = () => {};
  const prefersReducedMotion =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : {
          matches: false,
          addEventListener: noop,
          removeEventListener: noop,
          addListener: noop,
          removeListener: noop,
        };
  const supportsIntersectionObserver = 'IntersectionObserver' in window;

  /**
   * Lazy load responsive <picture> elements with blur-up effect
   */
  const hydratePicture = (container) => {
    const picture = container.matches('picture') ? container : container.querySelector('picture');
    if (!picture) return;
    container.dataset.state = 'loading';
    const img = picture.querySelector('img');
    const onLoad = () => {
      container.classList.add('is-loaded');
      container.dataset.state = 'loaded';
    };

    if (img) {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
      if (img.dataset.srcset) {
        img.srcset = img.dataset.srcset;
      }
      const lqipSrc = container.dataset.lqipSrc || picture.dataset.lqipSrc;
      if (lqipSrc) {
        container.style.setProperty('--lqip', `url("${lqipSrc}") center/cover no-repeat`);
      }
      if (!img.complete) {
        img.addEventListener('load', onLoad, { once: true });
        img.addEventListener(
          'error',
          () => {
            container.dataset.state = 'error';
            container.classList.add('is-loaded');
          },
          { once: true },
        );
      } else {
        onLoad();
      }
    }

    picture.querySelectorAll('source').forEach((source) => {
      if (source.dataset.srcset) {
        source.srcset = source.dataset.srcset;
      }
    });
  };

  const lazyTargets = document.querySelectorAll('.media-img[data-lqip], picture[data-lqip]');

  if (supportsIntersectionObserver && lazyTargets.length) {
    const pictureObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const container = entry.target;
        hydratePicture(container);
        observer.unobserve(container);
      });
    }, { rootMargin: '200px 0px' });

    lazyTargets.forEach((target) => pictureObserver.observe(target));
  } else if (lazyTargets.length) {
    lazyTargets.forEach((target) => hydratePicture(target));
  }

  /**
   * Hero imagery progressive loading
   */
  const heroImages = document.querySelectorAll('[data-hero-img]');
  heroImages.forEach((img) => {
    const container =
      img.closest('[data-hero-container]') ||
      img.closest('.hero-media, .hero-visual, figure');

    if (!container) return;

    const updateFallbackVisual = (src) => {
      if (!src) return;
      let finalSrc = src;
      if (typeof src === 'string' && !src.startsWith('data:')) {
        try {
          finalSrc = new URL(src, window.location.href).href;
        } catch (error) {
          finalSrc = src;
        }
      }
      if (container.style && typeof container.style.setProperty === 'function') {
        container.style.setProperty('--hero-fallback-image', `url("${finalSrc}")`);
      }
    };

    const markLoaded = () => {
      container.classList.add('is-loaded');
    };

    const fallbackSource = img.dataset.fallbackSrc || img.currentSrc || img.src;
    updateFallbackVisual(fallbackSource);

    if (img.complete && img.naturalWidth > 0) {
      markLoaded();
    } else {
      img.addEventListener('load', markLoaded, { once: true });
    }

    img.addEventListener(
      'error',
      () => {
        container.classList.remove('is-loaded');
      },
      { once: true },
    );
  });

  /**
   * Mensajes dinámicos para notas visuales
   */
  const visualNotes = document.querySelectorAll('.notas-visuales');
  visualNotes.forEach((note) => {
    const emphasize = note.querySelector('h2');
    if (!emphasize || emphasize.innerHTML.includes('notas-visuales__keyword')) return;
    emphasize.innerHTML = emphasize.textContent.replace(
      /(visual)/i,
      '<span class="notas-visuales__keyword">$1</span>',
    );
  });

  /**
   * Lottie animations on intersection with reduced motion fallback
   */
  const lottieTargets = document.querySelectorAll('[data-lottie]');
  if (lottieTargets.length) {
    if (prefersReducedMotion.matches) {
      lottieTargets.forEach((target) => {
        target.classList.add('is-static');
      });
    } else {
      import('https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_svg.min.js')
        .then((lottieModule) => {
          const { default: lottie } = lottieModule;
          const lottieObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              const el = entry.target;
              if (!el._lottie && window.lottie) {
                el._lottie = window.lottie.loadAnimation({
                  container: el,
                  renderer: 'svg',
                  loop: true,
                  autoplay: false,
                  path: el.dataset.src,
                });
              }
              if (el._lottie) {
                if (entry.isIntersecting) {
                  if (typeof el._lottie.play === 'function') {
                    el._lottie.play();
                  }
                } else if (typeof el._lottie.pause === 'function') {
                  el._lottie.pause();
                }
              }
            });
          }, { rootMargin: '150px 0px' });

          lottieTargets.forEach((target) => lottieObserver.observe(target));

          document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
              lottieTargets.forEach((target) => {
                if (target._lottie && typeof target._lottie.pause === 'function') {
                  target._lottie.pause();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('Lottie could not be loaded', error);
          lottieTargets.forEach((target) => target.classList.add('is-static'));
        });
    }
  }

  /**
   * GSAP ambient animations for hero/content
   */
  if (!prefersReducedMotion.matches) {
    import('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js')
      .then((gsapModule) => {
        const gsap = gsapModule.gsap || window.gsap;
        if (!gsap) return;

        const hero = document.querySelector('.hero-content');
        const mediaItems = document.querySelectorAll('.media-img');

        const timeline = gsap.timeline({ paused: false });
        if (hero) {
          timeline.from(hero, {
            y: 40,
            opacity: 0,
            duration: 1,
            ease: 'power2.out',
          });
        }

        timeline.from(mediaItems, {
          opacity: 0,
          y: 40,
          stagger: 0.18,
          duration: 0.8,
          ease: 'power2.out',
        }, '-=0.6');

        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            timeline.pause();
          } else {
            timeline.resume();
          }
        });
      })
      .catch((error) => {
        console.warn('GSAP could not be loaded', error);
      });
  }

  /**
   * Canvas vignette demo with safe crossOrigin handling
   */
  const canvas = document.getElementById('fx');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = canvas.dataset.src;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.3,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.7,
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      console.warn('Canvas image could not be loaded with CORS, skipping effects.');
    };
  }

  /**
   * Lazy Leaflet map init only when visible
   */
  const mapSection = document.querySelector('[data-map]');
  if (mapSection) {
    const activateMap = async () => {
      if (mapSection.dataset.state === 'loaded' || mapSection.dataset.state === 'loading') {
        return;
      }

      mapSection.dataset.state = 'loading';

      try {
        const leafletCssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        if (!document.querySelector(`link[href="${leafletCssHref}"]`)) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = leafletCssHref;
          cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          cssLink.crossOrigin = 'anonymous';
          document.head.append(cssLink);
        }

        const leafletModule = await import('https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js');
        const L = leafletModule && leafletModule.default ? leafletModule.default : leafletModule;

        const map = L.map('map', {
          zoomControl: true,
          scrollWheelZoom: false,
        }).setView([40.4168, -3.7038], 5);

        const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        });
        tiles.addTo(map);

        const leafIcon = L.icon({
          iconUrl:
            'data:image/svg+xml;charset=UTF-8,' +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" aria-hidden="true"><title>Ubicación ecológica</title><circle cx="30" cy="30" r="26" fill="#1f824b"/><path d="M30 12c6.6 0 12 5.4 12 12 0 8.4-12 24-12 24S18 32.4 18 24c0-6.6 5.4-12 12-12z" fill="#c9f4da"/></svg>`,
            ),
          iconSize: [60, 60],
          iconAnchor: [30, 55],
          popupAnchor: [0, -50],
        });

        const popupImage = assetUrl('img/aire-hero.svg');
        const popupHtml = `
          <article class="map-card">
            <picture class="media-img" data-lqip data-lqip-src="${popupImage}" style="--lqip:url('${popupImage}')">
              <source type="image/svg+xml" data-srcset="${popupImage}">
              <img data-src="${popupImage}" src="${popupImage}" alt="Ilustración de paisaje resiliente" width="640" height="426" loading="lazy" decoding="async">
            </picture>
            <p style="margin:0.75rem 0 0;font-size:0.85rem;">Visual educativo generado localmente para la demo del mapa.</p>
          </article>`;

        L.marker([43.2627, -2.9253], { icon: leafIcon })
          .addTo(map)
          .bindPopup(popupHtml);

        mapSection.dataset.state = 'loaded';
        const placeholder = mapSection.querySelector('.map-placeholder');
        if (placeholder && typeof placeholder.remove === 'function') {
          placeholder.remove();
        }
      } catch (error) {
        console.error('Error loading map resources', error);
        mapSection.dataset.state = 'error';
      }
    };

    if (supportsIntersectionObserver) {
      const mapObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          activateMap();
          observer.unobserve(entry.target);
        });
      }, { rootMargin: '200px 0px' });

      mapObserver.observe(mapSection);
    } else {
      activateMap();
    }
  }
});
