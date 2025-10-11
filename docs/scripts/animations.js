(function () {
  const hasGSAP = typeof window.gsap !== 'undefined';
  const hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';
  const prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = {
    timelines: [],
    observers: [],
    cleanups: [],
    flipButtons: new Set(),
    flipHandlers: new WeakMap(),
  };

  const pendingCountUps = new Set();
  let countUpObserver = null;

  const splitCache = new WeakSet();
  const configCache = new Map();

  function resolveCountUpConstructor() {
    const namespaces = [window.CountUp, window.countUp];
    for (const namespace of namespaces) {
      if (!namespace) continue;
      if (typeof namespace === 'function') {
        return namespace;
      }
      if (typeof namespace.CountUp === 'function') {
        return namespace.CountUp;
      }
    }
    return null;
  }

  async function loadJsonConfig(path) {
    if (!path) return null;
    const cacheKey = path;
    if (configCache.has(cacheKey)) {
      return configCache.get(cacheKey);
    }

    try {
      const response = await fetch(path, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Estado ${response.status}`);
      }
      const json = await response.json();
      configCache.set(cacheKey, json);
      return json;
    } catch (error) {
      console.warn(`No se pudo cargar la configuración JSON desde ${path}`, error);
      configCache.set(cacheKey, null);
      return null;
    }
  }

  window.MediaConfigLoader = {
    load: loadJsonConfig,
  };

  async function ensureFallbackImage(container, wrapper) {
    if (!container || !wrapper) return null;
    const fallbackConfigPath = container.getAttribute('data-fallback-config');
    const fallbackImage = wrapper.querySelector('[data-fallback-image]');
    if (!fallbackConfigPath || !fallbackImage) return fallbackImage;

    const config = await loadJsonConfig(fallbackConfigPath);
    if (config && config.src) {
      fallbackImage.src = config.src;
    }
    if (config && config.alt) {
      fallbackImage.alt = config.alt;
    }

    return fallbackImage;
  }

  async function hydrateLottieContainer(container, reduceMotion) {
    if (!container) return;
    if (container.dataset.lottieHydrated === 'true') {
      const wrapper = container.closest('.reto-icon');
      const fallbackImage = wrapper ? wrapper.querySelector('[data-fallback-image]') : null;
      if (reduceMotion) {
        if (wrapper) {
          wrapper.dataset.state = 'fallback';
        }
        if (fallbackImage) {
          fallbackImage.hidden = false;
        }
      } else {
        if (wrapper) {
          wrapper.dataset.state = 'animated';
        }
        if (fallbackImage) {
          fallbackImage.hidden = true;
        }
      }
      return;
    }
    const wrapper = container.closest('.reto-icon');
    if (wrapper && !wrapper.dataset.state) {
      wrapper.dataset.state = 'fallback';
    }

    const fallbackImage = await ensureFallbackImage(container, wrapper);

    if (typeof window.lottie === 'undefined') {
      if (fallbackImage) {
        fallbackImage.hidden = false;
      }
      return;
    }

    const configPath = container.getAttribute('data-lottie-config');
    const config = await loadJsonConfig(configPath);
    if (!config || !config.src) {
      if (fallbackImage) {
        fallbackImage.hidden = false;
      }
      return;
    }

    try {
      const animation = window.lottie.loadAnimation({
        container,
        renderer: config.renderer || 'svg',
        loop: typeof config.loop === 'boolean' ? config.loop : true,
        autoplay: reduceMotion ? false : config.autoplay !== false,
        path: config.src,
        name: config.name || undefined,
      });

      container.dataset.lottieReady = 'true';
      if (config.description) {
        container.setAttribute('data-description', config.description);
      }

      const showAnimation = () => {
        if (wrapper) {
          wrapper.dataset.state = 'animated';
        }
        if (fallbackImage) {
          fallbackImage.hidden = true;
        }
      };

      if (typeof animation.addEventListener === 'function') {
        animation.addEventListener('DOMLoaded', showAnimation);
      } else {
        window.requestAnimationFrame(showAnimation);
      }

      if (reduceMotion && typeof animation.goToAndStop === 'function') {
        animation.goToAndStop(0, true);
      }
      container.dataset.lottieHydrated = 'true';
    } catch (error) {
      console.warn('No se pudo inicializar la animación Lottie', error);
      if (wrapper) {
        wrapper.dataset.state = 'fallback';
      }
      if (fallbackImage) {
        fallbackImage.hidden = false;
      }
    }
  }

  function registerTimeline(timeline) {
    if (timeline && typeof timeline.kill === 'function') {
      state.timelines.push(timeline);
    }
    return timeline;
  }

  function registerObserver(observer) {
    if (observer && typeof observer.disconnect === 'function') {
      state.observers.push(observer);
    }
    return observer;
  }

  function registerCleanup(fn) {
    if (typeof fn === 'function') {
      state.cleanups.push(fn);
    }
    return fn;
  }

  function splitText(element) {
    if (!element || splitCache.has(element)) {
      return [];
    }

    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      return [];
    }

    const fragment = document.createDocumentFragment();
    const words = text.split(' ');
    const spans = [];

    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.className = 'split-word';
      span.textContent = word;
      fragment.appendChild(span);
      spans.push(span);

      if (index < words.length - 1) {
        fragment.appendChild(document.createTextNode(' '));
      }
    });

    element.innerHTML = '';
    element.appendChild(fragment);
    splitCache.add(element);
    return spans;
  }

  function ensureSplitText() {
    const splitTargets = document.querySelectorAll('.split-ready');
    splitTargets.forEach((target) => {
      splitText(target);
    });
  }

  function animateHero(reduceMotion) {
    const hero = document.querySelector('#hero');
    if (!hero) return;

    const words = hero.querySelectorAll('.split-word');
    const cta = hero.querySelector('.hero-cta');

    if (hasGSAP && !reduceMotion) {
      const timeline = registerTimeline(
        window.gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from(words, {
            yPercent: 120,
            opacity: 0,
            duration: 0.8,
            stagger: 0.05,
            onStart: () => {
              words.forEach((word) => {
                word.style.willChange = 'transform, opacity';
              });
            },
            onComplete: () => {
              words.forEach((word) => {
                word.style.willChange = 'auto';
              });
            },
          })
          .from(
            cta,
            {
              opacity: 0,
              y: 24,
              duration: 0.6,
              onStart: () => {
                if (cta) cta.style.willChange = 'transform, opacity';
              },
              onComplete: () => {
                if (cta) cta.style.willChange = 'auto';
              },
            },
            '-=0.4'
          )
      );

      return timeline;
    }

    words.forEach((word) => {
      word.style.opacity = '1';
      word.style.transform = 'translateY(0)';
    });
    if (cta) {
      cta.style.opacity = '1';
      cta.style.transform = 'translateY(0)';
    }
  }

  function animateParallax(reduceMotion) {
    const layers = document.querySelectorAll('.parallax-layer');
    if (!layers.length) return;

    if (hasGSAP && hasScrollTrigger && !reduceMotion) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      layers.forEach((layer) => {
        const depth = Number.parseFloat(layer.dataset.depth || '0.3');
        const trigger = layer.closest('section') || layer;
        const timeline = window.gsap.to(layer, {
          yPercent: depth * -60,
          ease: 'none',
          scrollTrigger: {
            trigger,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            onEnter: () => {
              layer.style.willChange = 'transform';
            },
            onLeave: () => {
              layer.style.willChange = 'auto';
            },
            onLeaveBack: () => {
              layer.style.willChange = 'auto';
            },
          },
        });
        registerTimeline(timeline);
      });
      return;
    }

    if (reduceMotion) {
      layers.forEach((layer) => {
        layer.style.transform = 'none';
        layer.style.willChange = 'auto';
      });
      return;
    }

    let rafId = null;
    const update = () => {
      layers.forEach((layer) => {
        const depth = Number.parseFloat(layer.dataset.depth || '0.3');
        const offset = window.scrollY * depth * -0.12;
        layer.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
      rafId = null;
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    registerCleanup(() => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    });
  }

  function animateSections(reduceMotion) {
    const sections = document.querySelectorAll('[data-animate="section"]');
    if (!sections.length) return;

    if (hasGSAP && hasScrollTrigger && !reduceMotion) {
      window.gsap.registerPlugin(window.ScrollTrigger);
    }

    sections.forEach((section) => {
      const targets = section.querySelectorAll('[data-animate-item]');
      const elements = targets.length ? targets : [section];

      if (hasGSAP && hasScrollTrigger && !reduceMotion) {
        const timeline = window.gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
          },
        });

        timeline.from(elements, {
          opacity: 0,
          y: 32,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power2.out',
          onStart: () => {
            elements.forEach((el) => {
              el.style.willChange = 'transform, opacity';
            });
          },
          onComplete: () => {
            elements.forEach((el) => {
              el.style.willChange = 'auto';
            });
          },
        });
        registerTimeline(timeline);
      } else {
        const observer = registerObserver(
          new IntersectionObserver(
            (entries, obs) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                elements.forEach((el, index) => {
                  window.setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                  }, reduceMotion ? 0 : index * 80);
                });
                obs.unobserve(entry.target);
              });
            },
            { threshold: 0.4 }
          )
        );
        observer.observe(section);
      }
    });
  }

  function animateTimeline(reduceMotion) {
    const timelineSection = document.querySelector('[data-animate="timeline"]');
    if (!timelineSection) return;

    const items = timelineSection.querySelectorAll('[data-animate-item]');
    if (!items.length) return;

    if (hasGSAP && hasScrollTrigger && !reduceMotion) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      const timeline = window.gsap.timeline({
        scrollTrigger: {
          trigger: timelineSection,
          start: 'top 80%',
        },
      });
      timeline.from(items, {
        opacity: 0,
        x: -24,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power2.out',
        onStart: () => {
          items.forEach((item) => {
            item.style.willChange = 'transform, opacity';
          });
        },
        onComplete: () => {
          items.forEach((item) => {
            item.style.willChange = 'auto';
          });
        },
      });
      registerTimeline(timeline);
    } else {
      const observer = registerObserver(
        new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              items.forEach((item, index) => {
                window.setTimeout(() => {
                  item.style.opacity = '1';
                  item.style.transform = 'translateX(0)';
                }, reduceMotion ? 0 : index * 60);
              });
              obs.unobserve(entry.target);
            });
          },
          { threshold: 0.5 }
        )
      );
      observer.observe(timelineSection);
    }
  }

  function animateSvgDraw(reduceMotion) {
    const shapes = document.querySelectorAll('.reto-parallax svg path, .reto-parallax svg circle');
    if (!shapes.length) return;

    shapes.forEach((shape) => {
      if (typeof shape.getTotalLength !== 'function') return;
      const length = shape.getTotalLength();
      shape.style.strokeDasharray = `${length}`;
      shape.style.strokeDashoffset = `${length}`;
    });

    if (hasGSAP && hasScrollTrigger && !reduceMotion) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      shapes.forEach((shape) => {
        const trigger = shape.closest('.reto-section') || shape.parentElement;
        const tween = window.gsap.to(shape, {
          strokeDashoffset: 0,
          ease: 'none',
          duration: 1.5,
          scrollTrigger: {
            trigger,
            start: 'top 85%',
          },
        });
        registerTimeline(tween);
      });
    } else {
      const observer = registerObserver(
        new IntersectionObserver((entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const element = entry.target;
            element.style.transition = reduceMotion ? 'none' : 'stroke-dashoffset 1.2s ease-out';
            element.style.strokeDashoffset = '0';
            obs.unobserve(element);
          });
        })
      );
      shapes.forEach((shape) => observer.observe(shape));
    }
  }

  function markCountUpComplete(valueEl, target) {
    if (!valueEl) return;
    const finalValue = Number.isFinite(target)
      ? Math.round(target).toLocaleString('es-ES')
      : valueEl.textContent;
    valueEl.textContent = finalValue;
    valueEl.setAttribute('data-count-complete', 'true');
  }

  function startCountUp(element, CountUpCtor, reduceMotion, observer) {
    const valueEl = element ? element.querySelector('.kpi-value') : null;
    const fallbackText = valueEl ? valueEl.textContent : '0';
    const target = Number.parseFloat(element?.dataset.target || fallbackText || '0');

    if (!element || !valueEl) {
      if (observer && element instanceof Element) {
        observer.unobserve(element);
      }
      return;
    }

    if (!CountUpCtor || reduceMotion) {
      markCountUpComplete(valueEl, target);
      if (observer && element instanceof Element) {
        observer.unobserve(element);
      }
      return;
    }

    try {
      const counter = new CountUpCtor(valueEl, target, {
        duration: 2.2,
        separator: '.',
        decimal: ',',
      });

      if (!counter.error) {
        counter.start(() => {
          valueEl.setAttribute('data-count-complete', 'true');
        });
      } else {
        markCountUpComplete(valueEl, target);
      }
    } catch (error) {
      markCountUpComplete(valueEl, target);
    }

    if (observer && element instanceof Element) {
      observer.unobserve(element);
    }
  }

  function attemptPendingCountUps(reduceMotion, { forceFallback = false } = {}) {
    if (!pendingCountUps.size) {
      return;
    }

    const CountUpCtor = reduceMotion ? null : resolveCountUpConstructor();
    const hasConstructor = Boolean(CountUpCtor);

    if (!hasConstructor && !reduceMotion && !forceFallback) {
      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    pendingCountUps.forEach((element) => {
      if (!element || !element.isConnected) {
        pendingCountUps.delete(element);
        return;
      }

      if (!reduceMotion) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top < viewportHeight && rect.bottom > 0;
        if (!isVisible) {
          return;
        }
      }

      pendingCountUps.delete(element);
      delete element.dataset.countupPending;
      const shouldUseReduceMotion = Boolean(reduceMotion || !hasConstructor);
      const ctorToUse = shouldUseReduceMotion ? null : CountUpCtor;
      startCountUp(element, ctorToUse, shouldUseReduceMotion, countUpObserver);
    });
  }

  function initCountUps(reduceMotion) {
    const kpis = document.querySelectorAll('.kpi');
    if (!kpis.length) return;

    const handleReady = (event) => {
      const detail = event && typeof event === 'object' ? event.detail : undefined;
      const shouldFallback = detail === null || typeof detail === 'undefined';
      attemptPendingCountUps(reduceMotion, { forceFallback: shouldFallback });
    };

    window.addEventListener('countup:ready', handleReady);
    registerCleanup(() => window.removeEventListener('countup:ready', handleReady));

    countUpObserver = registerObserver(
      new IntersectionObserver((entries) => {
        const CountUpCtor = reduceMotion ? null : resolveCountUpConstructor();

        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target;

          if (!CountUpCtor && !reduceMotion) {
            if (!element.dataset.countupPending) {
              element.dataset.countupPending = 'true';
            }
            pendingCountUps.add(element);
            return;
          }

          pendingCountUps.delete(element);
          delete element.dataset.countupPending;
          startCountUp(element, CountUpCtor, reduceMotion, countUpObserver);
        });
      }, { threshold: 0.6 })
    );

    kpis.forEach((kpi) => countUpObserver.observe(kpi));

    attemptPendingCountUps(reduceMotion);
  }

  function initLottieAnimations(reduceMotion) {
    const containers = document.querySelectorAll('[data-lottie-config]');
    if (!containers.length) return;

    containers.forEach((container) => {
      hydrateLottieContainer(container, reduceMotion);
    });
  }

  function handleFlipToggle(event) {
    const button = event.currentTarget;
    const pressed = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!pressed));
  }

  function initFlipCards(reduceMotion) {
    const sections = document.querySelectorAll('[data-animate="flip-cards"]');
    if (!sections.length) return;

    sections.forEach((section) => {
      const cards = Array.from(section.querySelectorAll('.flip-card'));
      cards.forEach((card) => {
        const button = card.querySelector('button');
        if (!button) return;
        if (!state.flipHandlers.has(button)) {
          button.addEventListener('click', handleFlipToggle);
          state.flipHandlers.set(button, handleFlipToggle);
        }
        state.flipButtons.add(button);
      });

      if (hasGSAP && hasScrollTrigger && !reduceMotion) {
        window.gsap.registerPlugin(window.ScrollTrigger);
        const timeline = window.gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
          },
        });
        timeline.from(cards.map((card) => card), {
          opacity: 0,
          rotateX: -15,
          transformOrigin: 'top center',
          y: 36,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power2.out',
          onStart: () => {
            cards.forEach((card) => {
              card.style.willChange = 'transform, opacity';
            });
          },
          onComplete: () => {
            cards.forEach((card) => {
              card.style.willChange = 'auto';
            });
          },
        });
        registerTimeline(timeline);
      } else {
        const observer = registerObserver(
          new IntersectionObserver(
            (entries, obs) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                cards.forEach((card, index) => {
                  window.setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'rotateX(0deg)';
                  }, reduceMotion ? 0 : index * 70);
                });
                obs.unobserve(entry.target);
              });
            },
            { threshold: 0.4 }
          )
        );
        observer.observe(section);
      }
    });
  }

  function destroy() {
    state.timelines.forEach((timeline) => {
      try {
        timeline.kill();
      } catch (error) {
        console.error('Error al limpiar animación', error);
      }
    });
    state.timelines = [];

    if (hasScrollTrigger) {
      try {
        window.ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      } catch (error) {
        console.error('Error al limpiar ScrollTrigger', error);
      }
    }

    state.observers.forEach((observer) => observer.disconnect());
    state.observers = [];

    state.cleanups.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.error('Error en limpieza de animación', error);
      }
    });
    state.cleanups = [];

    state.flipButtons.forEach((button) => {
      const handler = state.flipHandlers.get(button);
      if (handler) {
        button.removeEventListener('click', handler);
        state.flipHandlers.delete(button);
      }
    });
    state.flipButtons.clear();

    pendingCountUps.forEach((element) => {
      if (element && element.dataset) {
        delete element.dataset.countupPending;
      }
    });
    pendingCountUps.clear();
    countUpObserver = null;
  }

  function init() {
    destroy();

    const reduceMotion = prefersReducedMotionQuery.matches;

    ensureSplitText();
    animateHero(reduceMotion);
    animateParallax(reduceMotion);
    animateSections(reduceMotion);
    animateTimeline(reduceMotion);
    animateSvgDraw(reduceMotion);
    initCountUps(reduceMotion);
    initFlipCards(reduceMotion);
    initLottieAnimations(reduceMotion);
  }

  const handleMotionChange = () => {
    init();
  };

  if (typeof prefersReducedMotionQuery.addEventListener === 'function') {
    prefersReducedMotionQuery.addEventListener('change', handleMotionChange);
  } else if (typeof prefersReducedMotionQuery.addListener === 'function') {
    prefersReducedMotionQuery.addListener(handleMotionChange);
  }

  window.AnimationManager = {
    init,
    destroy,
  };
})();
