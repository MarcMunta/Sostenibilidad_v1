# Sostenibilidad 2030 — Guía de edición

Este repositorio contiene una demo educativa de los cuatro grandes retos de sostenibilidad. A continuación encontrarás todo lo necesario para personalizar datos, animaciones, estilos y recursos multimedia sin perder el enfoque en accesibilidad y rendimiento.

## Estructura del proyecto

- `index.html`: página principal con el hero, los cuatro retos, el mapa y el JSON embebido con los datos de los retos.
- `retos/`: casos detallados para cada reto (HTML estático).
- `styles/main.css`: hoja de estilos global con tokens y componentes.
- `scripts/animations.js`, `scripts/map.js`, `scripts/app.js`: lógica de animaciones, mapa interactivo y comportamiento general.
- `assets/lottie/`: configuraciones JSON que apuntan a animaciones públicas en LottieFiles (`planeta.json`, `gota.json`, `hoja.json`).
- `assets/img/`: referencias JSON a imágenes dinámicas de [Unsplash Source](https://source.unsplash.com) (`planeta.json`, `gota.json`, `hoja.json`).

## Editar el JSON embebido de retos

El listado mostrado en el mapa y en el panel lateral se alimenta del bloque `<script id="data-retos" type="application/json">` presente en `index.html`.

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
- **Imágenes del mapa y las tarjetas:** utiliza URLs de Unsplash Source para evitar almacenar binarios. Puedes documentar la URL correspondiente en `assets/img/*.json` y reutilizarla en el JSON de retos o en cualquier `<img>`. Ejemplo: `https://source.unsplash.com/collection/2290905/800x600?solar`.
- **Fallbacks de iconos:** cada figura con clase `.reto-icon` incluye una imagen de respaldo. Asegúrate de proporcionar un texto alternativo descriptivo.

## Modificar variables CSS

`styles/main.css` centraliza los tokens en la sección `:root` (colores, tipografías, radios, sombras y espaciados). Para modificar el aspecto global:

1. Ajusta los valores en `:root` para el tema claro y en `[data-theme="dark"]` para el modo oscuro.
2. Al añadir nuevos tokens sigue la convención `--nombre-kebab-case`.
3. Comprueba contraste mínimo AA (4.5:1) al cambiar colores de texto o fondo.

## Reemplazar iconos Lottie

Las animaciones se cargan usando los JSON de `assets/lottie/` junto con la librería Lottie-web.

1. Sustituye el contenido del archivo correspondiente (`planeta.json`, `gota.json` o `hoja.json`) indicando la nueva URL pública (`src`) y, opcionalmente, `name`, `description`, `loop`, `autoplay` y `renderer`.
2. Si necesitas un nuevo icono, crea un archivo adicional dentro de `assets/lottie/` y referencia su ruta relativa en el atributo `data-lottie-config` de la figura deseada.
3. El script detecta automáticamente la ausencia de Lottie y mantiene visible el fallback (`data-fallback-image`). No elimines esa imagen para conservar la accesibilidad.

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
- **Vídeos:** proporciona un `poster` ligero y comprime el archivo (`ffmpeg -crf 23 -preset slow`).
- **Preloads y preconnect:** la cabecera ya incluye `preconnect` para Google Fonts. Añade `<link rel="preload">` para recursos críticos si incorporas nuevas fuentes o scripts pesados.
- **JavaScript:** evita bloquear el hilo principal. Usa `defer` o `type="module"` y elimina dependencias no utilizadas.
- **Accesibilidad:** mantén textos alternativos, roles descriptivos y foco visible. Revisa contrastes con herramientas como Lighthouse o axe.
- **Preferencias del usuario:** el código respeta `prefers-reduced-motion`. Evita animaciones bruscas en nuevos componentes.

## Ejecutar la demo localmente

1. Clona o descarga el repositorio.
2. Abre `index.html` en tu navegador preferido (doble clic o arrastrar al navegador).
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
