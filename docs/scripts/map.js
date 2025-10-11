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
    leaflet: null,
  };

  function getLeaflet() {
    if (state.leaflet && typeof state.leaflet.map === 'function') {
      return state.leaflet;
    }
    if (typeof window.L !== 'undefined' && typeof window.L.map === 'function') {
      return window.L;
    }
    return null;
  }

  function isLeafletReady() {
    return !!getLeaflet();
  }

  function clearContainer(container) {
    if (container) {
      container.innerHTML = '';
    }
  }

  function resolveUrl(path) {
    if (!path) return '';
    try {
      return new URL(path, window.location.href).href;
    } catch (error) {
      return path;
    }
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

    const details = panel.querySelector('.map-details');
    const titleElement = panel.querySelector('[data-map-title]');
    const summaryElement = panel.querySelector('[data-map-summary]');
    const imageElement = panel.querySelector('[data-map-image]');
    const linkElement = panel.querySelector('[data-map-link]');

    state.detailsPanel = {
      title: titleElement,
      summary: summaryElement,
      image: imageElement,
      link: linkElement,
      container: panel,
      details,
      placeholder: resolveUrl(
        (details && (details.dataset.placeholderImage || details.dataset.placeholder)) ||
          panel.dataset.placeholderImage ||
          (imageElement && (imageElement.dataset.placeholderImage || imageElement.dataset.placeholder)) ||
          ''
      ),
      defaultTitle: titleElement?.textContent?.trim() || 'Selecciona un reto',
      defaultSummary:
        summaryElement?.textContent?.trim() ||
        'Interactúa con el mapa para conocer los datos clave de cada caso.',
    };

    if (details && !details.dataset.state) {
      details.dataset.state = 'idle';
    }
    if (!panel.dataset.state) {
      panel.dataset.state = 'idle';
    }
  }

  function updateDetails(reto) {
    if (!state.detailsPanel) return;
    const {
      title,
      summary,
      image,
      link,
      container,
      details,
      placeholder,
      defaultTitle,
      defaultSummary,
    } = state.detailsPanel;

    const placeholderAlt =
      'Ilustración de un mapa con un marcador indicando que selecciones un reto para ver los detalles';

    if (title) {
      title.textContent = reto ? `${reto.emoji || '📍'} ${reto.nombre}` : defaultTitle;
    }

    if (summary) {
      summary.textContent = reto ? reto.resumen : defaultSummary;
    }

    if (image) {
      if (reto && reto.imagen) {
        image.src = resolveUrl(reto.imagen);
        image.alt = reto.imagenAlt || `Vista representativa del reto ${reto.nombre}`;
        image.hidden = false;
        image.dataset.state = 'media';
      } else if (placeholder) {
        image.src = resolveUrl(placeholder);
        image.alt = reto
          ? `Ilustración genérica para el reto ${reto.nombre}`
          : placeholderAlt;
        image.hidden = false;
        image.dataset.state = 'placeholder';
      } else {
        image.hidden = true;
        image.removeAttribute('src');
        image.alt = reto
          ? `Representación del reto ${reto.nombre}`
          : 'Vista ilustrativa del reto seleccionado en el mapa global';
        delete image.dataset.state;
      }
    }

    if (link) {
      if (reto && reto.ruta) {
        link.href = reto.ruta;
        link.setAttribute('aria-label', `Abrir la ficha del reto ${reto.nombre}`);
        link.hidden = false;
      } else {
        link.hidden = true;
        link.removeAttribute('href');
        link.removeAttribute('aria-label');
      }
    }

    if (container) {
      if (reto && reto.id) {
        container.dataset.activeReto = reto.id;
        container.dataset.state = 'active';
      } else {
        delete container.dataset.activeReto;
        container.dataset.state = 'idle';
      }
    }

    if (details) {
      details.dataset.state = reto ? 'active' : 'idle';
    }
  }

  function createIcon(reto) {
    const markerEmoji = reto.emoji || '📍';
    const L = getLeaflet();
    if (!L) {
      return null;
    }

    return L.divIcon({
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
      ? `<figure class="map-popup__media">
          <img src="${reto.imagen}" alt="${imageAlt}" loading="lazy" decoding="async" />
        </figure>`
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

  function getNavHeight() {
    const nav = document.querySelector('nav');
    if (!nav) return 0;
    const rect = typeof nav.getBoundingClientRect === 'function' ? nav.getBoundingClientRect() : null;
    return Math.max(nav.offsetHeight || 0, rect?.height || 0, 0);
  }

  function getPopupPadding() {
    const basePadding = 32;
    const navHeight = getNavHeight();
    const topPadding = basePadding + navHeight + 48;
    const bottomPadding = basePadding + 24;
    const sidePadding = basePadding;

    const L = getLeaflet();
    const toPoint = (x, y) =>
      L && typeof L.point === 'function'
        ? L.point(x, y)
        : [x, y];

    return {
      topLeft: toPoint(sidePadding, topPadding),
      bottomRight: toPoint(sidePadding, bottomPadding),
    };
  }

  function adjustPopupPosition(marker, { animate = true } = {}) {
    if (!state.globalMap || !marker || typeof marker.getLatLng !== 'function') {
      return;
    }

    const map = state.globalMap;
    const L = getLeaflet();
    if (!L || typeof map.getSize !== 'function') {
      return;
    }

    const latlng = marker.getLatLng();
    const popup = typeof marker.getPopup === 'function' ? marker.getPopup() : null;
    const padding = getPopupPadding();

    if (popup) {
      popup.options.autoPanPaddingTopLeft = padding.topLeft;
      popup.options.autoPanPaddingBottomRight = padding.bottomRight;
    }

    const shouldAnimate = animate && !prefersReducedMotion.matches;

    if (typeof map.panInside === 'function') {
      map.panInside(latlng, {
        paddingTopLeft: padding.topLeft,
        paddingBottomRight: padding.bottomRight,
        animate: shouldAnimate,
        duration: shouldAnimate ? 0.65 : 0,
      });
    } else {
      map.panTo(latlng, {
        animate: shouldAnimate,
        duration: shouldAnimate ? 0.65 : 0,
      });
    }

    if (popup && typeof popup.update === 'function') {
      popup.update();
    }

    const popupElement = popup && typeof popup.getElement === 'function' ? popup.getElement() : null;
    if (!popupElement || typeof popupElement.getBoundingClientRect !== 'function') {
      return;
    }

    const rect = popupElement.getBoundingClientRect();
    const mapRect = map.getContainer().getBoundingClientRect();
    const navHeight = getNavHeight();
    const topLimit = navHeight + 16;
    const margin = 16;

    let offsetX = 0;
    let offsetY = 0;

    if (rect.top < topLimit) {
      offsetY += topLimit - rect.top;
    }
    if (rect.bottom > mapRect.bottom - margin) {
      offsetY -= rect.bottom - (mapRect.bottom - margin);
    }
    if (rect.left < mapRect.left + margin) {
      offsetX += mapRect.left + margin - rect.left;
    }
    if (rect.right > mapRect.right - margin) {
      offsetX -= rect.right - (mapRect.right - margin);
    }

    if (offsetX !== 0 || offsetY !== 0) {
      if (typeof map.panBy === 'function') {
        map.panBy(L.point(-offsetX, -offsetY), { animate: false });
      } else {
        const centerPoint = map.latLngToContainerPoint(map.getCenter());
        const targetPoint = centerPoint.add(L.point(offsetX, offsetY).multiplyBy(-1));
        const targetLatLng = map.containerPointToLatLng(targetPoint);
        map.panTo(targetLatLng, { animate: false });
      }

      if (popup && typeof popup.update === 'function') {
        popup.update();
      }
    }
  }

  function refreshActivePopupPosition() {
    if (!state.activeRetoId) return;
    const marker = state.globalMarkers.get(state.activeRetoId);
    if (!marker) return;
    adjustPopupPosition(marker, { animate: false });
  }

  function fitMapToRetos(map, retos) {
    if (!retos.length) {
      map.setView([20, 0], 2);
      return;
    }
    const L = getLeaflet();
    if (!L) return;

    const bounds = L.latLngBounds(retos.map((reto) => reto.coordenadas));
    map.fitBounds(bounds, { padding: [40, 40] });
  }

  function initGlobalMap() {
    const container = document.getElementById('map');
    if (!container) return;

    prepareDetailsPanel();
    ensureLazyImages(container.parentElement);

    const L = getLeaflet();

    if (!L) {
      container.innerHTML = '<p class="map-fallback">No se pudo cargar el mapa interactivo. Consulta la lista de retos para obtener detalles.</p>';
      updateDetails(null);
      return;
    }

    clearContainer(container);

    const map = L.map(container, {
      zoomControl: true,
      preferCanvas: false,
      worldCopyJump: false,
      maxBoundsViscosity: 1,
      minZoom: 2,
    });

    const worldBounds = L.latLngBounds(
      L.latLng(-90, -180),
      L.latLng(90, 180)
    );
    map.setMaxBounds(worldBounds);

    L
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
      const icon = createIcon(reto);
      if (!icon) return;

      const marker = L.marker(reto.coordenadas, {
        icon,
        keyboard: true,
        title: reto.nombre,
      });

      const popupPadding = getPopupPadding();
      marker.bindPopup(renderPopupContent(reto), {
        closeButton: true,
        autoPan: true,
        autoPanPaddingTopLeft: popupPadding.topLeft,
        autoPanPaddingBottomRight: popupPadding.bottomRight,
      });
      marker.on('popupopen', (event) => {
        state.activeRetoId = reto.id;
        updateDetails(reto);
        window.dispatchEvent(new CustomEvent('map:focus', { detail: reto.id }));
        adjustPopupPosition(marker, { animate: false });
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
      refreshActivePopupPosition();
    };

    window.addEventListener('resize', resize);
    registerCleanup(() => window.removeEventListener('resize', resize));

    window.requestAnimationFrame(() => map.invalidateSize());

    state.globalMap = map;
    state.maps.set(container, map);
    updateDetails(null);

    if (state.activeRetoId) {
      focusOnReto(state.activeRetoId);
    }
  }

  function initMiniMaps() {
    const miniMapContainers = document.querySelectorAll('[id^="map-"][data-map-lat]');
    if (!miniMapContainers.length) return;

    const L = getLeaflet();

    miniMapContainers.forEach((container) => {
      ensureLazyImages(container.parentElement);

      if (!L) {
        container.innerHTML =
          '<p class="map-fallback">Cargando mapa interactivo…</p>';
        return;
      }

      clearContainer(container);

      const lat = Number.parseFloat(container.dataset.mapLat);
      const lng = Number.parseFloat(container.dataset.mapLng);
      const zoom = Number.parseFloat(container.dataset.mapZoom || '10');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const safeZoom = Number.isFinite(zoom) ? zoom : 10;

      const map = L.map(container, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        worldCopyJump: false,
        maxBoundsViscosity: 1,
        minZoom: Math.max(3, Math.min(safeZoom, 12) - 2),
      });

      const worldBounds = L.latLngBounds(
        L.latLng(-90, -180),
        L.latLng(90, 180)
      );
      map.setMaxBounds(worldBounds);

      map.setView([lat, lng], safeZoom);

      L
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contribuidores',
          noWrap: true,
          bounds: worldBounds,
        })
        .addTo(map);

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
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
    const reto = state.retos.find((item) => item.id === retoId);
    if (!reto) return;

    state.activeRetoId = retoId;
    updateDetails(reto);
    window.dispatchEvent(new CustomEvent('map:focus', { detail: retoId }));

    const marker = state.globalMarkers.get(retoId);
    if (!marker) {
      return;
    }

    if (state.globalMap && marker.getLatLng) {
      const duration = prefersReducedMotion.matches ? 0 : 0.85;
      state.globalMap.flyTo(marker.getLatLng(), state.globalMap.getZoom() > 3 ? state.globalMap.getZoom() : 4, {
        animate: duration > 0,
        duration,
      });
      marker.openPopup();
      if (duration > 0) {
        state.globalMap.once('moveend', () => adjustPopupPosition(marker, { animate: false }));
      }
      adjustPopupPosition(marker, { animate: false });
    }
  }

  function initPage(options = {}) {
    if (options.retosData) {
      setRetosData(options.retosData);
    }

    destroy();
    initGlobalMap();
    initMiniMaps();
  }

  function hydrateWithLeaflet(leafletInstance) {
    if (leafletInstance && typeof leafletInstance.map === 'function') {
      state.leaflet = leafletInstance;
    } else if (!state.leaflet) {
      const globalLeaflet = typeof window.L !== 'undefined' ? window.L : null;
      if (globalLeaflet && typeof globalLeaflet.map === 'function') {
        state.leaflet = globalLeaflet;
      }
    }

    if (!isLeafletReady()) {
      return;
    }

    if (state.maps.size) {
      return;
    }

    destroy();
    initGlobalMap();
    initMiniMaps();
  }

  window.MapManager = {
    initPage,
    destroy,
    setRetosData,
    focusOnReto,
    hydrateWithLeaflet,
  };
})();
