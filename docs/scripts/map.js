(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = {
    retos: [],
    maps: new Map(),
    resizeObservers: new Map(),
    globalMarkers: new Map(),
    globalMap: null,
    detailsPanel: null,
    activeRetoId: null,
    cleanups: [],
  };

  function isLeafletReady() {
    return typeof window.L !== 'undefined' && typeof window.L.map === 'function';
  }

  function registerCleanup(fn) {
    if (typeof fn === 'function') {
      state.cleanups.push(fn);
    }
  }

  function setRetosData(retos = []) {
    state.retos = Array.isArray(retos) ? retos : [];
  }

  function ensureLazyImages(container) {
    if (!container) return;
    container.querySelectorAll('img:not([loading])').forEach((img) => {
      img.setAttribute('loading', 'lazy');
    });
  }

  function prepareDetailsPanel() {
    const panel = document.querySelector('.map-panel');
    if (!panel) return;

    state.detailsPanel = {
      title: panel.querySelector('[data-map-title]'),
      summary: panel.querySelector('[data-map-summary]'),
      image: panel.querySelector('[data-map-image]'),
      link: panel.querySelector('[data-map-link]'),
      container: panel,
    };
  }

  function updateDetails(reto) {
    if (!state.detailsPanel) return;
    const { title, summary, image, link, container } = state.detailsPanel;

    if (title) {
      title.textContent = reto ? `${reto.emoji || '📍'} ${reto.nombre}` : 'Selecciona un reto';
    }

    if (summary) {
      summary.textContent = reto ? reto.resumen : 'Los datos aparecerán aquí cuando interactúes con el mapa.';
    }

    if (image) {
      if (reto && reto.imagen) {
        image.src = reto.imagen;
        image.alt = reto.imagenAlt || `Vista representativa del reto ${reto.nombre}`;
        image.hidden = false;
      } else {
        image.hidden = true;
        image.removeAttribute('src');
        image.alt = 'Vista ilustrativa del reto seleccionado en el mapa global';
      }
    }

    if (link) {
      if (reto && reto.ruta) {
        link.href = reto.ruta;
        link.hidden = false;
      } else {
        link.hidden = true;
        link.removeAttribute('href');
      }
    }

    if (container) {
      container.dataset.activeReto = reto ? reto.id : '';
    }
  }

  function createIcon(reto) {
    const markerEmoji = reto.emoji || '📍';
    return window.L.divIcon({
      className: 'map-marker',
      html: `<span aria-hidden="true">${markerEmoji}</span>`,
      iconSize: [48, 48],
      iconAnchor: [24, 42],
      popupAnchor: [0, -32],
    });
  }

  function renderPopupContent(reto) {
    const escapedName = reto.nombre;
    const escapedSummary = reto.resumen;
    const imageAlt = reto.imagenAlt || `Vista representativa del reto ${reto.nombre}`;
    const imageHtml = reto.imagen
      ? `<img src="${reto.imagen}" alt="${imageAlt}" loading="lazy" decoding="async" />`
      : '';

    const buttonHtml = reto.ruta
      ? `<a class="map-popup__link" href="${reto.ruta}" data-reto-id="${reto.id}">Ver reto</a>`
      : '';

    return `
      <article class="map-popup" role="group" aria-label="${escapedName}">
        <header>
          <h3>${reto.emoji || '📍'} ${escapedName}</h3>
        </header>
        <p>${escapedSummary}</p>
        ${imageHtml}
        ${buttonHtml}
      </article>
    `;
  }

  function fitMapToRetos(map, retos) {
    if (!retos.length) {
      map.setView([20, 0], 2);
      return;
    }
    const bounds = window.L.latLngBounds(retos.map((reto) => reto.coordenadas));
    map.fitBounds(bounds, { padding: [40, 40] });
  }

  function initGlobalMap() {
    const container = document.getElementById('map');
    if (!container) return;

    prepareDetailsPanel();
    ensureLazyImages(container.parentElement);

    if (!isLeafletReady()) {
      container.innerHTML = '<p class="map-fallback">No se pudo cargar el mapa interactivo. Consulta la lista de retos para obtener detalles.</p>';
      updateDetails(null);
      return;
    }

    const map = window.L.map(container, {
      zoomControl: true,
      preferCanvas: false,
      worldCopyJump: false,
      maxBoundsViscosity: 1,
      minZoom: 2,
    });

    const worldBounds = window.L.latLngBounds(
      window.L.latLng(-90, -180),
      window.L.latLng(90, 180)
    );
    map.setMaxBounds(worldBounds);

    window.L
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contribuidores',
        noWrap: true,
        bounds: worldBounds,
      })
      .addTo(map);

    fitMapToRetos(map, state.retos);

    state.retos.forEach((reto) => {
      if (!Array.isArray(reto.coordenadas) || reto.coordenadas.length !== 2) return;
      const marker = window.L.marker(reto.coordenadas, {
        icon: createIcon(reto),
        keyboard: true,
        title: reto.nombre,
      });

      marker.bindPopup(renderPopupContent(reto), { closeButton: true });
      marker.on('popupopen', (event) => {
        state.activeRetoId = reto.id;
        updateDetails(reto);
        window.dispatchEvent(new CustomEvent('map:focus', { detail: reto.id }));
        const popupElement = event.popup.getElement();
        if (popupElement) {
          const focusable = popupElement.querySelector('a, button');
          if (focusable) {
            window.requestAnimationFrame(() => focusable.focus());
          }
        }
      });

      marker.on('click keypress', () => {
        state.activeRetoId = reto.id;
        updateDetails(reto);
      });

      marker.addTo(map);
      state.globalMarkers.set(reto.id, marker);
    });

    const resize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', resize);
    registerCleanup(() => window.removeEventListener('resize', resize));

    window.requestAnimationFrame(() => map.invalidateSize());

    state.globalMap = map;
    state.maps.set(container, map);
    updateDetails(null);
  }

  function initMiniMaps() {
    const miniMapContainers = document.querySelectorAll('[id^="map-"][data-map-lat]');
    if (!miniMapContainers.length) return;

    miniMapContainers.forEach((container) => {
      ensureLazyImages(container.parentElement);

      if (!isLeafletReady()) {
        container.innerHTML = '<p class="map-fallback">Activa la vista de mapa para explorar la ubicación.</p>';
        return;
      }

      const lat = Number.parseFloat(container.dataset.mapLat);
      const lng = Number.parseFloat(container.dataset.mapLng);
      const zoom = Number.parseFloat(container.dataset.mapZoom || '10');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const safeZoom = Number.isFinite(zoom) ? zoom : 10;

      const map = window.L.map(container, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        worldCopyJump: false,
        maxBoundsViscosity: 1,
        minZoom: Math.max(3, Math.min(safeZoom, 12) - 2),
      });

      const worldBounds = window.L.latLngBounds(
        window.L.latLng(-90, -180),
        window.L.latLng(90, 180)
      );
      map.setMaxBounds(worldBounds);

      map.setView([lat, lng], safeZoom);

      window.L
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contribuidores',
          noWrap: true,
          bounds: worldBounds,
        })
        .addTo(map);

      const marker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          className: 'map-marker map-marker--mini',
          html: `<span aria-hidden="true">${container.dataset.markerEmoji || '📍'}</span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 32],
        }),
        title: container.dataset.markerTitle || 'Ubicación del reto',
      });

      const popupContent = {
        nombre: container.dataset.markerTitle || 'Ubicación',
        resumen: container.dataset.markerSummary || '',
        imagen: container.dataset.markerImage || '',
        ruta: container.dataset.markerRoute || '',
        emoji: container.dataset.markerEmoji || '📍',
        id: container.id,
      };

      marker.bindPopup(renderPopupContent(popupContent), { closeButton: true });
      marker.addTo(map);

      if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => map.invalidateSize());
        resizeObserver.observe(container);
        state.resizeObservers.set(container, resizeObserver);
      } else {
        const onResize = () => map.invalidateSize();
        window.addEventListener('resize', onResize);
        registerCleanup(() => window.removeEventListener('resize', onResize));
      }

      state.maps.set(container, map);
    });
  }

  function destroy() {
    state.cleanups.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.error('Error al limpiar mapa', error);
      }
    });
    state.cleanups = [];

    state.maps.forEach((map) => {
      try {
        map.remove();
      } catch (error) {
        console.error('Error al eliminar mapa', error);
      }
    });
    state.maps.clear();

    state.resizeObservers.forEach((observer) => observer.disconnect());
    state.resizeObservers.clear();

    state.globalMarkers.clear();
    state.globalMap = null;
    state.detailsPanel = null;
    state.activeRetoId = null;
  }

  function focusOnReto(retoId) {
    if (!retoId) return;
    const marker = state.globalMarkers.get(retoId);
    const reto = state.retos.find((item) => item.id === retoId);
    if (!marker || !reto) return;

    state.activeRetoId = retoId;
    updateDetails(reto);
    window.dispatchEvent(new CustomEvent('map:focus', { detail: retoId }));

    if (state.globalMap && marker.getLatLng) {
      const duration = prefersReducedMotion.matches ? 0 : 0.85;
      state.globalMap.flyTo(marker.getLatLng(), state.globalMap.getZoom() > 3 ? state.globalMap.getZoom() : 4, {
        animate: duration > 0,
        duration,
      });
      marker.openPopup();
    }
  }

  function initPage(options = {}) {
    if (options.retosData) {
      setRetosData(options.retosData);
    }

    destroy();

    if (!isLeafletReady()) {
      initGlobalMap();
      initMiniMaps();
      return;
    }

    initGlobalMap();
    initMiniMaps();
  }

  window.MapManager = {
    initPage,
    destroy,
    setRetosData,
    focusOnReto,
  };
})();
