# Sostenibilidad 2030 — Guía de edición

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen)](https://marcmunta.github.io/Sostenibilidad_v1/)

Este repositorio contiene una demo educativa de los cuatro grandes retos de sostenibilidad. A continuación encontrarás todo lo necesario para personalizar datos, animaciones, estilos y recursos multimedia sin perder el enfoque en accesibilidad y rendimiento.

## Publicación en GitHub Pages

- **URL pública:** <https://marcmunta.github.io/Sostenibilidad_v1/>
- **Despliegue automático:** cualquier _push_ a `main` publica la última versión porque GitHub Pages sirve el contenido del directorio `/docs` directamente.
- **Rutas relativas:** mantén los enlaces sin barras iniciales (por ejemplo, `retos/reto-clima.html` en lugar de `/retos/reto-clima.html`) para que funcionen dentro de la subcarpeta `/Sostenibilidad_v1/`.
- **Configuración del proyecto:** en GitHub ve a **Settings → Pages → Source** y selecciona `Deploy from a branch` con la rama `main` y la carpeta `/docs`.

> Consejo: si añades HTML adicional fuera de `docs/`, recuerda moverlo a esa carpeta antes de hacer _push_ para que forme parte del despliegue.

## Estructura del proyecto

- `docs/index.html`: página principal con el hero, los cuatro retos, el mapa y el JSON embebido con los datos de los retos.
- `docs/retos/`: casos detallados para cada reto (HTML estático).
- `docs/styles/main.css`: hoja de estilos global con tokens y componentes.
- `docs/scripts/animations.js`, `docs/scripts/map.js`, `docs/scripts/app.js`: lógica de animaciones, mapa interactivo y comportamiento general.
- `docs/assets/`: recursos multimedia (animaciones Lottie, fotografías de referencia, audio y favicon en SVG).
- `docs/404.html`: página de error personalizada enlazando con la portada.
- `docs/robots.txt` y `docs/sitemap.xml`: archivos mínimos para SEO adaptados a rutas relativas.

## Editar el JSON embebido de retos

El listado mostrado en el mapa y en el panel lateral se alimenta del bloque `<script id="data-retos" type="application/json">` presente en `docs/index.html`.

1. Localiza el bloque dentro de la sección `#mapa-global`.
2. Cada reto incluye las claves `id`, `nombre`, `resumen`, `coordenadas`, `imagen`, `imagenAlt`, `ruta` y `emoji`.
3. Para añadir un nuevo reto duplica uno existente y ajusta:
   - `id`: identificador único en minúsculas y sin espacios.
   - `coordenadas`: array `[latitud, longitud]` en formato decimal.
   - `imagen`: URL de Unsplash Source (consulta el apartado **Imágenes** más abajo).
   - `imagenAlt`: descripción corta y objetiva de la imagen (se usa en cards, popups y panel lateral).
   - `ruta`: enlace relativo al detalle en `/retos/`.
4. Guarda el archivo. Al recargar la página el mapa y las tarjetas se actualizarán automáticamente.

> Consejo: mantén los textos concisos (máximo 140 caracteres) para evitar desbordes en el panel.

## Actualizar textos e imágenes

- **Textos principales:** edítalos directamente en `index.html` o en los archivos específicos dentro de `retos/`. Los elementos con la clase `split-ready` están segmentados palabra a palabra para animaciones; mantén las etiquetas `<span>` al editar títulos.
- **Imágenes del mapa y las tarjetas:** las ilustraciones SVG se alojan en `docs/assets/img/`. Reutiliza los archivos existentes o añade nuevos recursos vectoriales para mantener la ligereza del proyecto.
- **Hero principal:** la ilustración vectorial animada se encuentra en `docs/assets/img/hero-aurora.svg` y fue diseñada exclusivamente para el proyecto con licencia CC0. Puedes editar sus gradientes y figuras directamente en un editor SVG.
- **Iconos animados:** cada figura con clase `.reto-icon` contiene un SVG decorativo marcado con `aria-hidden="true"`. Mantén esa estructura para evitar que los lectores de pantalla anuncien información redundante.

## Modificar variables CSS

`styles/main.css` centraliza los tokens en la sección `:root` (colores, tipografías, radios, sombras y espaciados). Para modificar el aspecto global:

1. Ajusta los valores en `:root` para el tema claro y en `[data-theme="dark"]` para el modo oscuro.
2. Al añadir nuevos tokens sigue la convención `--nombre-kebab-case`.
3. Comprueba contraste mínimo AA (4.5:1) al cambiar colores de texto o fondo.

## Actualizar los iconos animados

Los iconos de los retos ahora son SVG inline animados mediante CSS (`styles/icons.css`). Cada figura está incrustada directamente en el HTML para evitar dependencias externas.

1. Ajusta los colores o el movimiento editando las clases `.icon-*` y las `@keyframes` en `styles/icons.css`.
2. Si necesitas sustituir la ilustración, modifica el `path` o añade nuevos elementos dentro de la etiqueta `<svg>` correspondiente en `index.html`.
3. Para crear iconos adicionales reutiliza la estructura existente (`<svg class="icon icon-nombre">…</svg>`) y añade las clases necesarias en `styles/icons.css`. Recuerda proporcionar una alternativa visual estática en caso de usar el icono fuera de los contextos animados.

## Añadir fuentes bibliográficas y recursos

- Utiliza la sección de créditos del `footer` o crea un `<section>` específico antes del pie con una lista `<ol>` o `<ul>`.
- Incluye autor, título, año y URL. Ejemplo:
  ```html
  <li>
    "Plan Nacional Integrado de Energía y Clima 2021-2030" (2023). Ministerio para la Transición Ecológica. Disponible en ...
  </li>
  ```
- Para citas internas añade enlaces con `rel="noopener"` y `target="_blank"` cuando se trate de recursos externos.

## Optimizar rendimiento y accesibilidad

- **Imágenes:** fija dimensiones en la URL de Unsplash Source (`/800x600`) y añade `loading="lazy"` y `decoding="async"` (ya configurado en los scripts). Considera sustituirlas por versiones optimizadas alojadas en un CDN propio si el proyecto pasa a producción.
- **Vídeos (opcional):** si necesitas reintroducir clips, proporciona un `poster` ligero y comprime el archivo (`ffmpeg -crf 23 -preset slow`).
- **Preloads y preconnect:** la cabecera ya incluye `preconnect` para Google Fonts. Añade `<link rel="preload">` para recursos críticos si incorporas nuevas fuentes o scripts pesados.
- **JavaScript:** evita bloquear el hilo principal. Usa `defer` o `type="module"` y elimina dependencias no utilizadas.
- **Accesibilidad:** mantén textos alternativos, roles descriptivos y foco visible. Revisa contrastes con herramientas como Lighthouse o axe.
- **Preferencias del usuario:** el código respeta `prefers-reduced-motion`. Evita animaciones bruscas en nuevos componentes.

## Ejecutar la demo localmente

1. Clona o descarga el repositorio.
2. Abre `docs/index.html` en tu navegador preferido (doble clic o arrastrar al navegador).
3. Para asegurar la carga de los JSON locales en algunos navegadores, se recomienda usar un servidor estático sencillo (`npx serve`, `python -m http.server`, etc.), aunque el sitio funciona en modo solo lectura con apertura directa.

## Buenas prácticas al agregar nuevo contenido

- Utiliza jerarquías semánticas (`<h2>`, `<h3>`, listas, `<figure>` con `<figcaption>` cuando corresponda).
- Añade `alt` descriptivos, evita textos como “imagen 1”.
- Respeta el orden lógico de tabulación y verifica que los controles sean accesibles con teclado.
- Mantén el peso de imágenes individuales por debajo de 250 KB cuando sea posible (usa compresión y formatos modernos como AVIF/WebP si cuentas con un servidor).
- Prefiere animaciones vectoriales y evita autoplay de audio. Si integras nuevos Lottie, verifica que dispongan de fallback.
- Documenta en este README cualquier cambio estructural relevante para que el equipo lo pueda seguir.

---

¿Dudas o mejoras? Puedes abrir un issue o documentar propuestas directamente en esta guía.
